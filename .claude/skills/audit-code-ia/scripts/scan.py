#!/usr/bin/env python3
"""Relève mécaniquement les indices d'une base de code générée par IA.

Ce script ne juge pas, il collecte. La hiérarchisation — quel constat cassera
en premier en production — demande de comprendre ce que fait l'application, ce
qu'aucune expression régulière ne sait faire. Rendre un verdict automatique
serait le meilleur moyen de livrer un rapport faux avec assurance.

Il n'ouvre que les fichiers suivis par git : le bruit d'un `node_modules` ou
d'un dossier de build noierait les vrais signaux, et ce qui n'est pas versionné
n'est pas ce que le client déploie.

Sortie : des faits datés et localisés, à recouper à la main.
"""

import base64
import binascii
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

SOURCE = {".py", ".js", ".jsx", ".ts", ".tsx", ".dart", ".go", ".rb", ".php",
          ".java", ".rs", ".vue", ".svelte"}
TEXTE = SOURCE | {".json", ".yml", ".yaml", ".toml", ".env", ".sh", ".sql", ".md"}

# Formes de clés reconnaissables sans ambiguïté. Volontairement étroit : un
# faux positif dans un rapport d'audit coûte la crédibilité de tout le reste.
SECRETS = [
    ("clé OpenAI", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("clé Anthropic", re.compile(r"sk-ant-[A-Za-z0-9_-]{20,}")),
    ("clé AWS", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("jeton GitHub", re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}")),
    ("clé Google", re.compile(r"AIza[0-9A-Za-z_-]{30,}")),
    ("jeton Slack", re.compile(r"xox[baprs]-[0-9A-Za-z-]{10,}")),
    ("clé privée", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("CLÉ SECRÈTE SUPABASE", re.compile(r"sb_secret_[A-Za-z0-9_-]{10,}")),
    ("secret affecté en dur", re.compile(
        r"""(?i)(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["']([^"'\s]{12,})["']""")),
]

# Ce que le motif « secret affecté en dur » attrape et qui n'en est pas un. Sur
# un premier audit réel, neuf de ses onze constats étaient des jetons de thème
# (`token: "--muted-foreground"`) : un nom de variable CSS, pas un secret. Le
# rapport en serait mort — le lecteur vérifie toujours le premier constat, et
# s'il est faux il ne lit pas le deuxième.
#
# Le tri se fait sur la forme de la valeur, jamais sur celle de la clé : un vrai
# secret mêle chiffres et lettres, un jeton de design est un mot en minuscules
# et tirets.
BENIN = re.compile(
    r"""^(--|var\(|\$|#[0-9a-f]{3,8}$|rgb|hsl|/|\./|\.\./|[a-z]+([-_.][a-z]+)*$)""", re.I)


def anodin(valeur):
    """Une valeur qui a la forme d'un nom, d'une couleur ou d'un chemin."""
    if BENIN.match(valeur):
        return True
    # Un secret sans le moindre chiffre est presque toujours une phrase, un nom
    # de classe ou un identifiant lisible ; les clés en produisent tous.
    return not any(c.isdigit() for c in valeur)

# Une clé Supabase est un JWT, et les deux que le projet distribue — l'`anon`,
# publiable par conception, et la `service_role`, qui contourne toute politique
# d'autorisation — sont indiscernables à l'œil : même préfixe `eyJ`, même
# longueur, même allure. Seule leur charge utile les sépare, et l'écart entre
# les deux est celui qui va de « identifiant public du projet » à « accès total
# à la base, lecture et écriture, sans aucune règle ».
#
# Les confondre coûte dans les deux sens, et c'est pour ça que le tri se fait
# ici plutôt que par un motif de plus : signaler l'`anon` fabrique le faux
# positif le plus cher du métier, laisser passer la `service_role` laisse
# tomber le seul constat qui justifie à lui seul le prix de l'audit.
JWT = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{8,}")

# Les rôles qui n'ont rien à faire dans ce qu'un navigateur reçoit. `anon` en est
# volontairement absent : c'est le rôle du jeton public, et le signaler serait
# exactement le faux positif ci-dessus.
ROLES_A_PRIVILEGES = {"service_role", "supabase_admin", "postgres"}


def role_jwt(charge):
    """Le rôle qu'annonce la charge utile d'un JWT, ou None si elle est illisible.

    Aucune signature n'est vérifiée : on ne cherche pas à valider le jeton, ni à
    s'en servir, seulement à lire ce qu'il déclare être. C'est du décodage, pas
    de la cryptographie — et c'est ce qui garde le relevé passif.
    """
    rembourrage = "=" * (-len(charge) % 4)
    try:
        donnees = json.loads(base64.urlsafe_b64decode(charge + rembourrage))
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return None
    role = donnees.get("role") if isinstance(donnees, dict) else None
    return role if isinstance(role, str) else None


def jeton_a_privileges(ligne):
    """L'étiquette du constat si la ligne porte un JWT à privilèges, sinon None.

    Rend le rôle dans l'étiquette et jamais le jeton : un rapport part par
    courrier, souvent relayé, et celui qui recopie la clé qu'il signale est la
    deuxième fuite.
    """
    for m in JWT.finditer(ligne):
        role = role_jwt(m.group(1))
        if role in ROLES_A_PRIVILEGES:
            return f"JETON À PRIVILÈGES (rôle « {role} ») — contourne toute l'autorisation"
    return None

# Une variable exposée au navigateur qui porte un nom de secret : la fuite la
# plus fréquente des applications générées, parce que le préfixe a l'air d'un
# détail de configuration.
EXPOSE = re.compile(r"(NEXT_PUBLIC_|VITE_|REACT_APP_|PUBLIC_)\w*"
                    r"(KEY|SECRET|TOKEN|PASSWORD)\w*", re.I)

# Sauf celles qui sont publiables par conception. Une clé `anon` de Supabase,
# une configuration Firebase ou une clé publiable Stripe *doivent* partir au
# navigateur : ce sont les identifiants publics du projet, et ce qui protège
# réellement les données est la politique d'autorisation côté serveur.
#
# Les signaler comme une fuite est le faux positif le plus coûteux du métier :
# c'est le premier constat que le client vérifie, il sait que c'est faux, et il
# ne lit pas le second. Ce qui mérite un audit n'est pas qu'une clé publiable
# soit visible, mais ce qu'elle permet de faire une fois en main.
PUBLIABLE = re.compile(
    r"(?i)(ANON_KEY|PUBLISHABLE|FIREBASE|SENTRY_DSN|POSTHOG|GA_|GTM_|MAPBOX|"
    r"ALGOLIA_SEARCH|RECAPTCHA_SITE|CLERK_PUBLISHABLE|STRIPE_PUBLI)")

RISQUES = [
    ("eval() sur une entrée", re.compile(r"\beval\s*\(")),
    ("HTML injecté sans filtrage", re.compile(r"dangerouslySetInnerHTML|v-html|innerHTML\s*=")),
    ("SQL concaténé", re.compile(
        r"""(?i)(select|insert|update|delete)\s+.{0,60}["'`]\s*\+|"""
        r"""f["'](?i:\s*select|\s*insert|\s*update|\s*delete)""")),
    ("secret comparé en clair", re.compile(r"(?i)(password|token)\s*===?\s*[\"'][^\"']+[\"']")),
]

MARQUEURS = re.compile(r"\b(TODO|FIXME|HACK|XXX)\b")
TEST = re.compile(r"(^|[/_.-])(test|tests|spec|__tests__)([/_.-]|$)", re.I)
VERROUS = ("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
           "Pipfile.lock", "requirements.txt", "pubspec.lock", "Cargo.lock",
           "go.sum", "composer.lock")


def fichiers(racine):
    """Les fichiers suivis par git, ou tout l'arbre si ce n'est pas un dépôt."""
    try:
        sortie = subprocess.run(["git", "-C", str(racine), "ls-files", "-z"],
                                capture_output=True, text=True, timeout=30, check=True)
        noms = [n for n in sortie.stdout.split("\0") if n]
        return [racine / n for n in noms]
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        print("  (dossier non versionné : analyse de l'arbre complet)\n")
        return [p for p in racine.rglob("*")
                if p.is_file() and not any(x in p.parts for x in
                                           ("node_modules", ".git", "build", "dist", ".venv"))]


def bloc(titre, lignes, vide="rien relevé"):
    print(f"\n## {titre}\n")
    print("\n".join(f"  {l}" for l in lignes) if lignes else f"  {vide}")


def main():
    racine = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    if not racine.is_dir():
        sys.exit(f"Dossier introuvable : {racine}")

    print(f"# Relevé mécanique — {racine.name}")

    tous = fichiers(racine)
    src = [p for p in tous if p.suffix in SOURCE]
    tests = [p for p in src if TEST.search(str(p.relative_to(racine)))]

    secrets, exposes, risques, gros, marqueurs = [], [], [], [], Counter()
    total_lignes = 0

    for p in tous:
        if p.suffix not in TEXTE or not p.exists():
            continue
        try:
            contenu = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = p.relative_to(racine)
        lignes = contenu.splitlines()
        if p.suffix in SOURCE:
            total_lignes += len(lignes)
            if len(lignes) > 500:
                gros.append((len(lignes), rel))
        for n, ligne in enumerate(lignes, 1):
            if len(ligne) > 400:      # minifié : ni lisible ni pertinent
                continue
            for nom, motif in SECRETS:
                m = motif.search(ligne)
                if not m:
                    continue
                # Seul le motif générique porte un groupe de valeur ; les formes
                # nommées (clé OpenAI, jeton GitHub) sont reconnaissables par
                # construction et n'ont pas à être retriées.
                if m.lastindex and m.lastindex >= 2 and anodin(m.group(2)):
                    continue
                secrets.append(f"{rel}:{n} — {nom}")
                break
            etiquette = jeton_a_privileges(ligne)
            if etiquette:
                secrets.append(f"{rel}:{n} — {etiquette}")
            expose = EXPOSE.search(ligne)
            if expose and not PUBLIABLE.search(expose.group(0)):
                exposes.append(f"{rel}:{n} — {expose.group(0)}")
            for nom, motif in RISQUES:
                if motif.search(ligne):
                    risques.append(f"{rel}:{n} — {nom}")
            for m in MARQUEURS.findall(ligne):
                marqueurs[m] += 1

    noms = {p.name for p in tous}
    verrous = sorted(noms & set(VERROUS))
    env = [str(p.relative_to(racine)) for p in tous
           if p.name.startswith(".env") and not p.name.endswith((".example", ".sample", ".template"))]

    bloc("Secrets en clair", sorted(set(secrets))[:25])
    bloc("Secrets exposés au navigateur", sorted(set(exposes))[:15])
    bloc("Fichiers .env versionnés", env)
    bloc("Motifs à risque", sorted(set(risques))[:25])
    bloc("Couverture de tests", [
        f"{len(src)} fichiers source, {total_lignes} lignes",
        f"{len(tests)} fichiers de test"
        + (" — AUCUN" if not tests else f" ({len(tests) * 100 // max(len(src), 1)} % des fichiers)"),
    ])
    bloc("Verrouillage des dépendances", verrous, vide="AUCUN fichier de verrouillage")
    bloc("Fichiers de plus de 500 lignes",
         [f"{n} lignes — {r}" for n, r in sorted(gros, reverse=True)[:10]])
    bloc("Marqueurs d'inachèvement",
         [f"{m} × {n}" for m, n in marqueurs.most_common()])

    print("\n---\nCe relevé est une matière première. Le classement par « ce qui "
          "cassera en premier » se fait à la lecture, pas ici.")


if __name__ == "__main__":
    main()
