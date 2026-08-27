#!/usr/bin/env python3
"""Relève la surface publique d'une application déployée, sans dépôt.

Raison d'être : le filtre « dépôt public » et le filtre « clients payants » sont
anticorrélés — les applications cassées qui encaissent de l'argent gardent leur
dépôt privé. Or toute application déployée sert publiquement, à quiconque ouvre
son URL, ce que son navigateur reçoit : le bundle JavaScript, la configuration
cliente qu'il contient, et les en-têtes de la réponse. C'est la même surface
pour tout le monde, elle ne demande aucune invitation, et elle suffit à établir
les constats qui font signer.

CE SCRIPT EST PASSIF, ET DOIT LE RESTER. Il ne fait que des GET, et seulement
sur l'URL donnée puis sur les fichiers que cette page dit elle-même au
navigateur d'aller chercher. Il ne devine aucun chemin, n'énumère rien,
n'envoie aucun formulaire, ne forge aucune requête d'authentification et ne
teste aucune règle d'autorisation. Cette limite n'est pas de la prudence
décorative : lire ce qu'un serveur sert spontanément est légitime, pousser le
serveur pour voir où il cède ne l'est pas sans accord écrit. Ajouter ici la
moindre requête active transformerait un audit non sollicité en intrusion.

Comme `scan.py`, il collecte et ne juge pas : le classement par « ce qui
cassera en premier » se fait à la lecture.

Usage : python3 scan_surface.py https://app.exemple.com
"""

import gzip
import re
import sys
import time
import urllib.error
import urllib.request
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.insert(0, str(Path(__file__).parent))
from scan import EXPOSE, SECRETS  # motifs partagés : un seul endroit à corriger

AGENT = "audit-code-ia/1.0 (releve passif de surface publique)"
DELAI = 0.3        # entre deux requêtes : on lit un site, on ne le martèle pas
PLAFOND_ACTIFS = 25
PLAFOND_OCTETS = 8 * 1024 * 1024

# Configuration de service que les générateurs déposent en clair dans le bundle.
# Toutes ne sont pas des fuites — une clé publiable Supabase est exposée au
# navigateur par conception. Ce qui compte est ce qu'elles révèlent : quel
# service porte les données, et donc où l'autorisation doit exister.
#
# Le drapeau dit si la valeur peut être recopiée telle quelle. Une clé secrète
# est recopiée tronquée : le rapport part par courrier, souvent relayé, et un
# rapport qui reproduit la clé qu'il signale devient la deuxième fuite. Le
# préfixe suffit largement au propriétaire pour retrouver laquelle révoquer.
SERVICES = [
    ("projet Supabase", re.compile(r"https://([a-z0-9]{16,32})\.supabase\.co"), True),
    ("projet Firebase", re.compile(r"[\"']([a-z0-9-]+)\.firebaseio\.com[\"']"), True),
    ("clé d'API Firebase", re.compile(r"[\"']AIza[0-9A-Za-z_-]{30,}[\"']"), False),
    ("clé publiable Stripe", re.compile(r"pk_(live|test)_[A-Za-z0-9]{20,}"), True),
    ("CLÉ SECRÈTE STRIPE", re.compile(r"sk_(live|test)_[A-Za-z0-9]{20,}"), False),
    ("projet Google Cloud", re.compile(r"[\"']([a-z0-9-]+)\.appspot\.com[\"']"), True),
    ("fonction Vercel/Netlify", re.compile(r"/\.netlify/functions/[\w-]+"), True),
]


def citer(valeur, recopiable):
    """Rend la valeur telle quelle, ou son préfixe suivi d'une marque de coupe."""
    return valeur[:80] if recopiable else valeur[:12] + "…[tronqué]"


def recuperer(url):
    """Un GET, et rien d'autre. Rend (statut, en-têtes, texte) ou None."""
    requete = urllib.request.Request(url, headers={
        "User-Agent": AGENT,
        "Accept-Encoding": "gzip",
    })
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            brut = reponse.read(PLAFOND_OCTETS)
            if reponse.headers.get("Content-Encoding") == "gzip":
                try:
                    brut = gzip.decompress(brut)
                except OSError:
                    pass
            return reponse.status, reponse.headers, brut.decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.headers, ""
    except (urllib.error.URLError, OSError, ValueError) as e:
        print(f"  (injoignable : {url} — {e})", file=sys.stderr)
        return None


def actifs_cites(html, base):
    """Les scripts et feuilles que la page dit au navigateur d'aller chercher.

    On ne prend que ce qui est écrit dans le HTML : aucun chemin deviné.
    """
    trouves = []
    for motif in (r"""<script[^>]+src=["']([^"']+)["']""",
                  r"""<link[^>]+href=["']([^"']+\.(?:js|css|json))["']"""):
        for m in re.finditer(motif, html, re.I):
            trouves.append(urljoin(base, m.group(1)))
    vus, uniques = set(), []
    for u in trouves:
        if u not in vus:
            vus.add(u)
            uniques.append(u)
    return uniques[:PLAFOND_ACTIFS]


def entetes_manquants(entetes):
    """Les protections que le navigateur applique seulement si on les demande."""
    constats = []
    attendus = {
        "content-security-policy": "aucune politique de sécurité du contenu",
        "strict-transport-security": "HTTPS non imposé au navigateur (HSTS absent)",
        "x-content-type-options": "type MIME devinable (nosniff absent)",
    }
    presents = {k.lower() for k in entetes.keys()}
    for cle, phrase in attendus.items():
        if cle not in presents:
            constats.append(phrase)

    origine = entetes.get("Access-Control-Allow-Origin")
    if origine == "*":
        constats.append("CORS ouvert à tous les sites (Access-Control-Allow-Origin: *)")

    for brut in entetes.get_all("Set-Cookie") or []:
        biscuit = SimpleCookie()
        try:
            biscuit.load(brut)
        except Exception:  # noqa: BLE001 — un cookie malformé ne doit pas tout arrêter
            continue
        for nom, valeur in biscuit.items():
            manques = [m for m, present in (
                ("Secure", valeur["secure"]),
                ("HttpOnly", valeur["httponly"]),
                ("SameSite", valeur.get("samesite")),
            ) if not present]
            if manques:
                constats.append(f"cookie « {nom} » sans {', '.join(manques)}")
    return constats


def bloc(titre, lignes, vide="rien relevé"):
    print(f"\n## {titre}\n")
    print("\n".join(f"  {l}" for l in lignes) if lignes else f"  {vide}")


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage : python3 scan_surface.py https://app.exemple.com")
    url = sys.argv[1]
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    page = recuperer(url)
    if page is None:
        sys.exit(f"Page injoignable : {url}")
    statut, entetes, html = page

    print(f"# Relevé de surface — {urlparse(url).netloc}")
    print(f"\n_Relevé passif : {url} et les fichiers que cette page demande "
          f"elle-même au navigateur. Aucune requête forgée, aucun chemin deviné._")

    secrets, exposes, services, cartes = [], [], [], []
    actifs = actifs_cites(html, url)
    documents = [(url, html)]

    for actif in actifs:
        time.sleep(DELAI)
        recu = recuperer(actif)
        if recu is None or not recu[2]:
            continue
        documents.append((actif, recu[2]))

        # Une carte de sources servie en production rend TOUT le code d'origine
        # lisible : c'est le constat qui rouvre l'audit complet sans dépôt.
        carte = re.search(r"//[#@]\s*sourceMappingURL=(\S+)", recu[2])
        if carte and not carte.group(1).startswith("data:"):
            cible = urljoin(actif, carte.group(1))
            time.sleep(DELAI)
            tete = recuperer(cible)
            if tete and tete[0] == 200:
                cartes.append(f"{cible} — code d'origine lisible publiquement")

    for source, contenu in documents:
        nom = source.rsplit("/", 1)[-1][:60] or source
        for ligne in contenu.splitlines():
            for etiquette, motif in SECRETS:
                if motif.search(ligne):
                    secrets.append(f"{nom} — {etiquette}")
                    break
            m = EXPOSE.search(ligne)
            if m:
                exposes.append(f"{nom} — {m.group(0)}")
        for etiquette, motif, recopiable in SERVICES:
            m = motif.search(contenu)
            if m:
                services.append(f"{nom} — {etiquette} : {citer(m.group(0), recopiable)}")

    bloc("Réponse", [f"statut {statut}",
                     f"serveur : {entetes.get('Server', 'non annoncé')}",
                     f"{len(actifs)} fichiers cités par la page, "
                     f"{len(documents) - 1} récupérés"])
    bloc("Secrets partis dans le navigateur", sorted(set(secrets))[:25])
    bloc("Variables exposées portant un nom de secret", sorted(set(exposes))[:15])
    bloc("Services dont la configuration est lisible", sorted(set(services))[:20])
    bloc("Cartes de sources exposées", sorted(set(cartes))[:10])
    bloc("Protections absentes des en-têtes", entetes_manquants(entetes))

    print("\n---\nCe relevé dit ce que l'application donne à qui la visite. Il ne "
          "dit pas si l'autorisation existe côté serveur : cela ne se vérifie "
          "qu'avec l'accord du propriétaire, et c'est précisément ce qu'on vend.")


if __name__ == "__main__":
    main()
