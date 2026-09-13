#!/usr/bin/env python3
"""Radar Reprise IA — découverte et qualification prudente de prospects.

Le programme ne contourne aucune authentification, ne scanne aucun port et
n'envoie aucun message. Il interroge l'API Brave, lit une page publique comme
un navigateur ordinaire, calcule un score explicable puis prépare un brouillon
à valider humainement.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import ipaddress
import json
import os
import re
import socket
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "data" / "radar.sqlite3"
DEFAULT_CONFIG = ROOT / "config.json"
USER_AGENT = "Lefouzebreizh-Radar/0.1 (+audit technique public; contact humain)"

PRICE_WORDS = ("tarif", "pricing", "abonnement", "mensuel", "par mois", "checkout", "essai gratuit")
TRACTION_WORDS = ("clients", "utilisateurs", "témoignage", "avis", "mrr", "lancement", "production")
PAIN_WORDS = ("bug", "bloqué", "erreur", "broken", "help", "panne", "lent", "payment", "paiement", "stripe", "webhook", "auth")
TECH_MARKERS = {
    "Lovable": ("lovable",),
    "Bubble": ("bubble.io", "bubbleapps.io"),
    "FlutterFlow": ("flutterflow",),
    "Supabase": ("supabase.co", "supabase"),
    "Firebase": ("firebaseapp.com", "firebaseio.com", "firebase"),
    "Vercel": ("vercel.app", "_next/static"),
    "Netlify": ("netlify.app",),
    "Stripe": ("js.stripe.com", "stripe"),
}


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SystemExit(f"Configuration absente: copiez config.example.json vers {path.name}.")
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    existed = path.exists()
    db = sqlite3.connect(path)
    if not existed:
        path.chmod(0o600)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          domain TEXT NOT NULL,
          product TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT '',
          source_query TEXT NOT NULL DEFAULT '',
          snippet TEXT NOT NULL DEFAULT '',
          contact_name TEXT NOT NULL DEFAULT '',
          contact_email TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'new',
          score INTEGER NOT NULL DEFAULT 0,
          score_reasons TEXT NOT NULL DEFAULT '[]',
          public_fact TEXT NOT NULL DEFAULT '',
          tech TEXT NOT NULL DEFAULT '[]',
          http_status INTEGER,
          draft_subject TEXT NOT NULL DEFAULT '',
          draft_body TEXT NOT NULL DEFAULT '',
          discovered_at TEXT NOT NULL,
          checked_at TEXT,
          reviewed_at TEXT,
          next_followup_at TEXT,
          last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS suppressions (
          value TEXT PRIMARY KEY,
          reason TEXT NOT NULL DEFAULT 'opposition',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY,
          lead_id INTEGER,
          kind TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY(lead_id) REFERENCES leads(id)
        );
        """
    )
    return db


def normalize_url(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("URL vide")
    if "://" not in value:
        value = "https://" + value
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Seules les URL HTTP(S) publiques sont acceptées")
    port = f":{parsed.port}" if parsed.port else ""
    path = parsed.path or "/"
    return f"{parsed.scheme}://{parsed.hostname.lower()}{port}{path}".rstrip("/") or value


def assert_public_host(url: str) -> None:
    host = urlparse(url).hostname
    if not host:
        raise ValueError("Hôte absent")
    if host == "localhost" or host.endswith(".local"):
        raise ValueError("Hôte local refusé")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(host, None)}
    except socket.gaierror as exc:
        raise ValueError(f"DNS introuvable: {host}") from exc
    for raw in addresses:
        address = ipaddress.ip_address(raw)
        if not address.is_global:
            raise ValueError(f"Adresse non publique refusée: {address}")


class PublicOnlyRedirectHandler(HTTPRedirectHandler):
    """Refuse une redirection avant que la nouvelle requête ne parte."""

    def redirect_request(self, req: Request, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> Request | None:
        absolute = urljoin(req.full_url, newurl)
        assert_public_host(absolute)
        return super().redirect_request(req, fp, code, msg, headers, absolute)


def fetch_public_page(url: str, timeout: int, maximum_bytes: int) -> tuple[int, str, str]:
    assert_public_host(url)
    opener = build_opener(PublicOnlyRedirectHandler())
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    robots = RobotFileParser()
    robots.set_url(robots_url)
    try:
        robots_request = Request(robots_url, headers={"User-Agent": USER_AGENT, "Accept": "text/plain"})
        with opener.open(robots_request, timeout=timeout) as robots_response:
            robots.parse(robots_response.read(256_001)[:256_000].decode("utf-8", errors="replace").splitlines())
        if not robots.can_fetch(USER_AGENT, url):
            raise ValueError("robots.txt interdit cette lecture automatisée")
    except HTTPError as exc:
        if exc.code not in {401, 403, 404, 410}:
            raise
        if exc.code in {401, 403}:
            raise ValueError("robots.txt inaccessible; lecture automatisée abandonnée") from exc
    except URLError:
        # Une panne du fichier robots ne suffit pas à qualifier la cible. Le GET
        # reste unique, lent et identifiable; l'erreur sera consignée si lui aussi échoue.
        pass
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with opener.open(request, timeout=timeout) as response:
        final_url = response.geturl()
        assert_public_host(final_url)
        content_type = response.headers.get_content_type()
        if content_type not in {"text/html", "application/xhtml+xml"}:
            raise ValueError(f"Type de contenu ignoré: {content_type}")
        raw = response.read(maximum_bytes + 1)
        if len(raw) > maximum_bytes:
            raise ValueError("Page trop volumineuse")
        charset = response.headers.get_content_charset() or "utf-8"
        return response.status, raw.decode(charset, errors="replace"), final_url


def visible_text(markup: str) -> str:
    without_scripts = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", markup)
    text = re.sub(r"(?s)<[^>]+>", " ", without_scripts)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def title_from_html(markup: str, fallback: str) -> str:
    match = re.search(r"(?is)<title[^>]*>(.*?)</title>", markup)
    if not match:
        return fallback
    title = re.sub(r"\s+", " ", html.unescape(match.group(1))).strip()
    return title[:120] or fallback


def contains_any(text: str, words: tuple[str, ...]) -> bool:
    lowered = text.casefold()
    return any(word.casefold() in lowered for word in words)


@dataclass
class Assessment:
    score: int
    reasons: list[str]
    fact: str
    tech: list[str]


def assess(url: str, markup: str, snippet: str, contact_available: bool = False) -> Assessment:
    text = visible_text(markup)
    corpus = f"{url} {markup} {snippet}".casefold()
    reasons: list[str] = []
    score = 0
    has_price = contains_any(text, PRICE_WORDS)
    has_traction = contains_any(f"{text} {snippet}", TRACTION_WORDS)
    has_pain = contains_any(snippet, PAIN_WORDS)
    if has_price:
        score += 2
        reasons.append("Offre payante ou page de tarifs détectée (+2)")
    if has_traction:
        score += 2
        reasons.append("Signal public d’activité ou de traction (+2)")
    if has_pain:
        score += 2
        reasons.append("Besoin précis dans la source de découverte (+2)")
    score += 1
    reasons.append("Produit public accessible (+1)")
    hostname = urlparse(url).hostname or ""
    if hostname.endswith(".fr") or contains_any(text, ("siret", "siren", "france")):
        score += 1
        reasons.append("Signal d’entreprise française (+1)")
    if contact_available:
        score += 1
        reasons.append("Contact professionnel identifié (+1)")
    technologies = [name for name, markers in TECH_MARKERS.items() if any(marker.casefold() in corpus for marker in markers)]
    if technologies:
        score += 1
        reasons.append("Pile technique compatible détectée (+1)")

    if has_price:
        fact = "J’ai relevé une offre tarifée sur le parcours public de votre produit."
    elif technologies:
        fact = f"Le parcours public utilise notamment {', '.join(technologies[:2])}."
    else:
        fact = "J’ai parcouru la page publique de votre produit sans accéder à aucun espace privé."
    return Assessment(min(score, 10), reasons, fact, technologies)


def make_draft(row: sqlite3.Row, config: dict[str, Any]) -> tuple[str, str]:
    first_name = row["contact_name"].strip() or ""
    hello = f"Bonjour {first_name}," if first_name else "Bonjour,"
    source = row["source"] or "une source publique"
    identity = config.get("identity", {})
    signature = f"{identity.get('name', 'Erwann Chevallier')} — {identity.get('brand', 'Lefouzèbreizh')}"
    privacy = identity.get("privacy_url", "")
    subject = f"Une remarque sur {row['product'] or row['domain']}"
    body = (
        f"{hello}\n\n"
        f"J’ai découvert {row['product'] or row['domain']} via {source}. "
        f"{row['public_fact']} Je n’ai consulté que ce que le site sert publiquement, sans rien forcer.\n\n"
        "Je reprends les applications créées ou accélérées par IA/no-code lorsqu’elles commencent à accueillir de vrais utilisateurs. "
        "Si cela vous aide, je peux vous envoyer gratuitement une fiche d’une page avec la preuve et deux vérifications utiles.\n\n"
        "Souhaitez-vous que je vous l’envoie ?\n\n"
        f"— {signature}\n"
        f"Votre adresse professionnelle figure sur {source}. Je l’utilise uniquement pour cette proposition liée à votre activité. "
        "Répondez simplement « non » et je ne vous recontacterai pas."
    )
    if privacy:
        body += f"\nInformations : {privacy}"
    return subject, body


def upsert_lead(db: sqlite3.Connection, url: str, source: str, query: str = "", snippet: str = "", product: str = "") -> int:
    normalized = normalize_url(url)
    domain = urlparse(normalized).hostname or ""
    now = utcnow()
    db.execute(
        """INSERT INTO leads(url, domain, product, source, source_query, snippet, discovered_at)
           VALUES(?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET
           source=CASE WHEN leads.source='' THEN excluded.source ELSE leads.source END,
           source_query=CASE WHEN leads.source_query='' THEN excluded.source_query ELSE leads.source_query END,
           snippet=CASE WHEN length(excluded.snippet)>length(leads.snippet) THEN excluded.snippet ELSE leads.snippet END""",
        (normalized, domain, product[:120], source[:300], query[:500], snippet[:1000], now),
    )
    lead_id = db.execute("SELECT id FROM leads WHERE url=?", (normalized,)).fetchone()[0]
    db.commit()
    return int(lead_id)


def brave_discover(db: sqlite3.Connection, config: dict[str, Any]) -> int:
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("BRAVE_SEARCH_API_KEY absent; utilisez add pour ajouter une URL manuellement.")
    discovery = config.get("discovery", {})
    count = int(discovery.get("results_per_query", 10))
    added = 0
    for query in discovery.get("queries", []):
        params = urlencode({"q": query, "count": min(count, 20), "country": discovery.get("country", "fr"), "search_lang": discovery.get("language", "fr")})
        req = Request(
            "https://api.search.brave.com/res/v1/web/search?" + params,
            headers={"Accept": "application/json", "X-Subscription-Token": api_key, "User-Agent": USER_AGENT},
        )
        with urlopen(req, timeout=20) as response:
            payload = json.load(response)
        for result in payload.get("web", {}).get("results", []):
            try:
                upsert_lead(db, result["url"], "Brave Search", query, result.get("description", ""), result.get("title", ""))
                added += 1
            except (KeyError, ValueError):
                continue
        time.sleep(0.25)
    return added


def process_pending(db: sqlite3.Connection, config: dict[str, Any], limit: int = 50) -> tuple[int, int]:
    limits = config.get("limits", {})
    timeout = int(limits.get("request_timeout_seconds", 12))
    maximum = int(limits.get("maximum_page_bytes", 1_000_000))
    minimum_score = int(limits.get("minimum_score", 7))
    rows = db.execute("SELECT * FROM leads WHERE status IN ('new','retry') ORDER BY discovered_at LIMIT ?", (limit,)).fetchall()
    checked = queued = 0
    for row in rows:
        blocked = db.execute(
            "SELECT 1 FROM suppressions WHERE value IN (lower(?), lower(?)) LIMIT 1",
            (row["domain"], row["contact_email"]),
        ).fetchone()
        if blocked:
            db.execute("UPDATE leads SET status='suppressed', checked_at=? WHERE id=?", (utcnow(), row["id"]))
            db.commit()
            continue
        try:
            status, markup, final_url = fetch_public_page(row["url"], timeout, maximum)
            product = row["product"] or title_from_html(markup, row["domain"])
            assessment = assess(final_url, markup, row["snippet"], bool(row["contact_email"]))
            next_status = "review" if assessment.score >= minimum_score else "discarded"
            transient = dict(row)
            transient.update({"product": product, "public_fact": assessment.fact})
            subject, body = make_draft(transient, config)  # type: ignore[arg-type]
            db.execute(
                """UPDATE leads SET product=?, status=?, score=?, score_reasons=?, public_fact=?, tech=?,
                   http_status=?, draft_subject=?, draft_body=?, checked_at=?, last_error='' WHERE id=?""",
                (product, next_status, assessment.score, json.dumps(assessment.reasons, ensure_ascii=False), assessment.fact,
                 json.dumps(assessment.tech, ensure_ascii=False), status, subject, body, utcnow(), row["id"]),
            )
            db.execute("INSERT INTO events(lead_id,kind,detail,created_at) VALUES(?,?,?,?)", (row["id"], "checked", f"score={assessment.score}", utcnow()))
            checked += 1
            queued += next_status == "review"
        except (ValueError, HTTPError, URLError, TimeoutError, OSError) as exc:
            db.execute("UPDATE leads SET status='error', checked_at=?, last_error=? WHERE id=?", (utcnow(), str(exc)[:500], row["id"]))
        db.commit()
    return checked, queued


def set_status(db: sqlite3.Connection, lead_id: int, status: str) -> None:
    allowed = {"approved", "rejected", "review", "contacted", "replied", "paid", "lost"}
    if status not in allowed:
        raise ValueError("Statut interdit")
    db.execute("UPDATE leads SET status=?, reviewed_at=? WHERE id=?", (status, utcnow(), lead_id))
    db.execute("INSERT INTO events(lead_id,kind,detail,created_at) VALUES(?,?,?,?)", (lead_id, "status", status, utcnow()))
    db.commit()


def export_approved(db: sqlite3.Connection, output: Path) -> int:
    rows = db.execute(
        """SELECT * FROM leads WHERE status='approved'
           AND lower(domain) NOT IN (SELECT value FROM suppressions)
           AND (contact_email='' OR lower(contact_email) NOT IN (SELECT value FROM suppressions))
           ORDER BY score DESC, discovered_at"""
    ).fetchall()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "produit", "url", "contact", "email", "objet", "message"])
        for row in rows:
            writer.writerow([row["id"], row["product"], row["url"], row["contact_name"], row["contact_email"], row["draft_subject"], row["draft_body"]])
    return len(rows)


def dashboard(db_path: Path, config: dict[str, Any], host: str, port: int) -> None:
    token = hashlib.sha256(os.urandom(32)).hexdigest()
    daily = int(config.get("limits", {}).get("daily_review", 5))

    class Handler(BaseHTTPRequestHandler):
        def send_html(self, body: str, status: int = 200) -> None:
            data = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Frame-Options", "DENY")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            with connect(db_path) as local:
                rows = local.execute("SELECT * FROM leads WHERE status='review' ORDER BY score DESC, discovered_at LIMIT ?", (daily,)).fetchall()
                counts = dict(local.execute("SELECT status, count(*) FROM leads GROUP BY status").fetchall())
            cards = []
            for row in rows:
                reasons = json.loads(row["score_reasons"])
                cards.append(f"""
                <article><header><div><strong>{html.escape(row['product'] or row['domain'])}</strong><br><a href="{html.escape(row['url'])}" target="_blank" rel="noopener">{html.escape(row['domain'])}</a></div><span>{row['score']}/10</span></header>
                <p class="fact">{html.escape(row['public_fact'])}</p>
                <ul>{''.join(f'<li>{html.escape(reason)}</li>' for reason in reasons)}</ul>
                <details><summary>Voir le brouillon</summary><h3>{html.escape(row['draft_subject'])}</h3><pre>{html.escape(row['draft_body'])}</pre></details>
                <form method="post"><input type="hidden" name="token" value="{token}"><input type="hidden" name="lead_id" value="{row['id']}"><button name="status" value="approved">Approuver</button><button class="secondary" name="status" value="rejected">Rejeter</button></form></article>""")
            body = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Radar Reprise IA</title><style>
            :root{{--ink:#0f1115;--panel:#202430;--edge:#354052;--accent:#40e0d0;--text:#f6f7fb;--muted:#aeb7c6}}*{{box-sizing:border-box}}body{{margin:0;background:var(--ink);color:var(--text);font:16px/1.5 system-ui,sans-serif}}main{{max-width:920px;margin:auto;padding:32px 18px 80px}}h1{{font-size:clamp(2rem,6vw,4rem);margin:.2em 0}}.lede{{color:var(--muted);max-width:65ch}}.stats{{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}}.stats span,article{{background:var(--panel);border:1px solid var(--edge);border-radius:16px}}.stats span{{padding:8px 12px}}article{{padding:20px;margin:18px 0}}article header{{display:flex;justify-content:space-between;gap:20px}}article header span{{color:var(--accent);font-size:1.3rem;font-weight:800}}a{{color:var(--accent)}}.fact{{font-size:1.08rem}}summary{{cursor:pointer;color:var(--accent)}}pre{{white-space:pre-wrap;background:#151820;padding:16px;border-radius:10px}}form{{display:flex;gap:10px;margin-top:18px}}button{{min-height:46px;border:0;border-radius:10px;background:var(--accent);color:#061615;font-weight:800;padding:0 18px;cursor:pointer}}button.secondary{{background:#343b4b;color:var(--text)}}button:focus-visible,a:focus-visible,summary:focus-visible{{outline:3px solid #c2a2f6;outline-offset:3px}}.empty{{padding:30px;border:1px dashed var(--edge);border-radius:14px;color:var(--muted)}}
            </style></head><body><main><p>LEFOUZÈBREIZH</p><h1>Radar Reprise IA</h1><p class="lede">Cinq dossiers maximum. Vérifie le fait public, puis approuve ou rejette. Aucun message ne part depuis cet écran.</p><div class="stats">{''.join(f'<span>{html.escape(str(k))}: {v}</span>' for k,v in sorted(counts.items()))}</div>{''.join(cards) if cards else '<p class="empty">Rien à valider aujourd’hui.</p>'}</main></body></html>"""
            self.send_html(body)

        def do_POST(self) -> None:  # noqa: N802
            length = min(int(self.headers.get("Content-Length", "0")), 4096)
            form = parse_qs(self.rfile.read(length).decode("utf-8"))
            if form.get("token", [""])[0] != token:
                self.send_html("Jeton invalide", 403)
                return
            try:
                lead_id = int(form.get("lead_id", ["0"])[0])
                status = form.get("status", [""])[0]
                with connect(db_path) as local:
                    set_status(local, lead_id, status)
            except (ValueError, sqlite3.Error):
                self.send_html("Requête invalide", 400)
                return
            self.send_response(303)
            self.send_header("Location", "/")
            self.end_headers()

        def log_message(self, fmt: str, *args: object) -> None:
            print(f"dashboard: {fmt % args}", file=sys.stderr)

    print(f"Radar disponible sur http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


def main() -> int:
    parser = argparse.ArgumentParser(description="Radar semi-automatique pour audits d’applications IA")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    add = sub.add_parser("add")
    add.add_argument("url")
    add.add_argument("--source", default="Ajout manuel")
    add.add_argument("--snippet", default="")
    add.add_argument("--product", default="")
    run = sub.add_parser("run")
    run.add_argument("--skip-discovery", action="store_true")
    run.add_argument("--limit", type=int, default=50)
    serve = sub.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8787)
    export = sub.add_parser("export")
    export.add_argument("--output", type=Path, default=ROOT / "data" / "messages-approuves.csv")
    suppress = sub.add_parser("suppress")
    suppress.add_argument("value")
    args = parser.parse_args()
    config = load_config(args.config)
    db = connect(args.db)
    if args.command == "init":
        print(f"Base prête: {args.db}")
    elif args.command == "add":
        lead_id = upsert_lead(db, args.url, args.source, snippet=args.snippet, product=args.product)
        print(f"Prospect #{lead_id} ajouté")
    elif args.command == "run":
        discovered = 0 if args.skip_discovery else brave_discover(db, config)
        checked, queued = process_pending(db, config, args.limit)
        print(json.dumps({"discovered": discovered, "checked": checked, "queued_for_review": queued}, ensure_ascii=False))
    elif args.command == "serve":
        db.close()
        dashboard(args.db, config, args.host, args.port)
    elif args.command == "export":
        print(f"{export_approved(db, args.output)} messages exportés vers {args.output}")
    elif args.command == "suppress":
        value = args.value.strip().casefold()
        db.execute("INSERT OR REPLACE INTO suppressions(value,reason,created_at) VALUES(?,?,?)", (value, "opposition", utcnow()))
        db.execute("UPDATE leads SET status='suppressed' WHERE lower(contact_email)=? OR lower(domain)=?", (value, value))
        db.commit()
        print("Opposition enregistrée")
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
