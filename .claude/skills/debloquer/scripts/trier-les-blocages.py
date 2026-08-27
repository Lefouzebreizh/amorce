#!/usr/bin/env python3
"""Confronte les blocages annoncés par les sessions à l'état réel du dépôt.

Une session distante déclare son blocage une fois, dans son `needs_action`, et
ne le révise jamais. Elle n'a aucun moyen de savoir qu'entre-temps sa branche a
été fusionnée, sa PR ouverte, son sujet traité par une voisine. Le blocage reste
donc affiché, à l'identique, indéfiniment.

Mesuré sur ce dépôt le 27 août : sur six blocages affichés, **deux étaient faux
et deux étaient périmés**. Une session réclamait qu'on déverrouille `main` pour
fusionner une PR qui n'existait plus ; une autre demandait un dépôt dont le
sujet était déjà en ligne. Le tri a coûté une session entière, et il aurait pu
coûter une session par jour.

Ce script ne débloque rien : il sépare ce qui attend vraiment quelqu'un de ce
qui n'attend plus personne.

## Deux pièges, et le second a failli me faire mentir

**L'ascendance ment après une fusion par écrasement.** `git branch --no-merged`
signale une branche dont le contenu est intégralement dans `main`, parce que le
squash a détaché ses commits de leur descendance. Sept branches sont ressorties
ainsi, dont trois fusionnées le matin même. Le seul juge est le contenu.

**Le contenu ment aussi, quand le travail a été refait ailleurs.** Une branche
portait 523 lignes de persistance absentes de `main`… qui existaient dans `main`
sous un autre nom de fichier. Aucune comparaison automatique n'attrape ça. D'où
la troisième catégorie ci-dessous, qui rend la main plutôt que de trancher.

## Trois verdicts, et le troisième est le plus important

- **périmé** : démontrable. La branche a disparu, ou elle est à zéro commit
  d'avance sur `main`. Le blocage n'attend plus personne.
- **vivant** : la branche porte des fichiers absents de `main`, ou le blocage ne
  parle pas de git du tout (un identifiant, une URL, une capture). Il attend.
- **à regarder** : la branche apporte des fichiers, mais `main` a des fichiers
  voisins qui pourraient être le même travail sous un autre nom. Un humain
  trancher en dix secondes ; le script ne le peut pas, et prétendre le contraire
  ferait fermer une branche vivante.

## Usage

Le script ne sait pas appeler le serveur MCP : la liste des sessions lui est
donnée.

    # depuis une session, coller la sortie de list_sessions
    python3 .claude/skills/debloquer/scripts/trier-les-blocages.py < sessions.json
    python3 … --fichier sessions.json
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

BASE = "origin/main"


def git(*args: str) -> str:
    resultat = subprocess.run(
        ["git", *args], capture_output=True, text=True, check=False
    )
    return resultat.stdout.strip() if resultat.returncode == 0 else ""


def sessions_depuis(charge: object) -> list[dict]:
    """Accepte la sortie brute de `list_sessions` ou une simple liste."""
    if isinstance(charge, dict):
        if "ccr" in charge:
            return charge["ccr"].get("data", [])
        if "data" in charge:
            return charge["data"]
        return [charge]
    return list(charge) if isinstance(charge, list) else []


def blocage_de(session: dict) -> str:
    """Le `needs_action`, où qu'il se cache — il est écrit à deux endroits."""
    for source in (session.get("post_turn_summary"),
                   session.get("external_metadata", {}).get("post_turn_summary")):
        if isinstance(source, dict) and source.get("needs_action"):
            return source["needs_action"]
    return ""


def branche_de(session: dict) -> str:
    branches = session.get("external_metadata", {}).get("current_branches") or {}
    if isinstance(branches, dict):
        for valeur in branches.values():
            if valeur and valeur != "main":
                return valeur
    sortie = session.get("session_context", {}).get("outcomes") or []
    for issue in sortie:
        noms = issue.get("git_repository", {}).get("git_info", {}).get("branches") or []
        for nom in noms:
            if nom != "main":
                return nom
    return ""


# Le verdict porte sur **la demande**, jamais sur la branche seule — et c'est la
# correction qui a sauvé ce script d'être faux. Une session attendait des
# identifiants Cloudflare depuis une branche déjà fusionnée : juger la branche
# l'aurait classée « périmé » alors que personne n'avait envoyé les
# identifiants. Git ne peut trancher que ce que git décide.
DEMANDE_GIT = (
    "pr ", "pull request", "merge", "fusionn", "branch", "branche",
    "push", "pousser", "déverrouill", "unlock", "rebase", "conflit", "conflict",
)


def juger(session: dict, branche: str, blocage: str) -> tuple[str, str]:
    """Rend (verdict, explication) pour le blocage déclaré par une session."""
    # Une session archivée n'attend plus rien : son blocage est un vestige.
    if session.get("session_status") == "SESSION_STATUS_ARCHIVED":
        return "périmé", "session archivée — plus personne n'attend cette réponse"

    # Un blocage humain — un identifiant, une URL, une capture, un arbitrage —
    # ne se lève pas dans le dépôt. Aucune mesure git n'a rien à en dire.
    if not any(mot in blocage.lower() for mot in DEMANDE_GIT):
        return "vivant", "demande humaine (identifiant, URL, arbitrage) — git n'en sait rien"

    if not branche:
        return "à regarder", (
            "parle de git sans branche rattachée — lister les PR ouvertes "
            "avant de croire au blocage"
        )

    ref = f"origin/{branche}"
    if not git("rev-parse", "--verify", "--quiet", ref):
        return "périmé", "la branche n'existe plus sur origin"

    ecart = git("rev-list", "--left-right", "--count", f"{BASE}...{ref}")
    if ecart:
        _, avance = (ecart.split() + ["0", "0"])[:2]
        if avance == "0":
            return "périmé", "zéro commit d'avance sur main — le travail y est"

    apport = [f for f in git("diff", "--name-only", f"{BASE}...{ref}").splitlines() if f]
    if not apport:
        return "périmé", "n'apporte aucun fichier par-dessus main"

    # Le travail refait sous un autre nom : on ne tranche pas, on le dit.
    voisins = []
    for chemin in apport:
        p = Path(chemin)
        if not p.exists() and p.parent.is_dir():
            racine = p.stem.rstrip("s")
            voisins += [
                str(f) for f in p.parent.iterdir()
                if f.is_file() and f.name != p.name and racine and racine in f.stem
            ]
    if voisins:
        apercu = ", ".join(sorted(set(voisins))[:3])
        return "à regarder", f"apporte {len(apport)} fichier(s), mais main a : {apercu}"

    return "vivant", f"apporte {len(apport)} fichier(s) absent(s) de main"


ORDRE = {"vivant": 0, "à regarder": 1, "périmé": 2}


def main(argv: list[str]) -> int:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--fichier", help="JSON de list_sessions (défaut : stdin)")
    options = analyseur.parse_args(argv[1:])

    brut = Path(options.fichier).read_text(encoding="utf-8") if options.fichier else sys.stdin.read()
    try:
        sessions = sessions_depuis(json.loads(brut))
    except json.JSONDecodeError as erreur:
        print(f"JSON illisible : {erreur}", file=sys.stderr)
        return 2

    git("fetch", "--quiet", "origin", "main")

    releve = []
    for session in sessions:
        blocage = blocage_de(session)
        if not blocage:
            continue
        branche = branche_de(session)
        verdict, pourquoi = juger(session, branche, blocage)
        releve.append((verdict, session.get("title", "?"), branche, blocage, pourquoi))

    if not releve:
        print("Aucune session ne déclare de blocage.")
        return 0

    releve.sort(key=lambda ligne: (ORDRE[ligne[0]], ligne[1]))
    compte = {"vivant": 0, "à regarder": 0, "périmé": 0}

    for verdict, titre, branche, blocage, pourquoi in releve:
        compte[verdict] += 1
        marque = {"vivant": "●", "à regarder": "⚠", "périmé": "○"}[verdict]
        print(f"{marque} {verdict.upper():12} {titre}")
        print(f"    demande  : {blocage[:150]}")
        print(f"    branche  : {branche or '—'}")
        print(f"    pourquoi : {pourquoi}")
        print()

    print(f"{compte['vivant']} attendent vraiment · "
          f"{compte['à regarder']} à regarder · "
          f"{compte['périmé']} périmé(s), à classer sans suite.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
