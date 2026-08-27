#!/usr/bin/env python3
"""Qui travaille déjà sur ce sujet, et qu'est-ce qui existe déjà.

Ce dépôt reçoit plusieurs sessions en parallèle. Le jour où deux d'entre elles
ont construit Life-Organizer chacune de son côté, la seconde a perdu tout son
travail : rien ne l'avait prévenue, parce que rien ne regarde ailleurs que dans
la copie locale. `git status` ne montre pas les branches des autres, et `main`
tel qu'on l'a cloné à l'ouverture de la session est déjà en retard.

Ce script pose les trois questions qu'on aurait dû poser avant d'écrire :

1. **Où en est `main` réellement**, maintenant, pas au démarrage du conteneur.
2. **Quelles branches ont bougé récemment**, et sur quoi — une branche poussée
   il y a vingt minutes est une session vivante, pas une trace ancienne.
3. **Le sujet existe-t-il déjà** dans le dépôt, sous un nom ou un autre.

Il ne décide rien : il montre. C'est à la lecture qu'on choisit de continuer,
de rejoindre ce qui existe, ou de changer de sujet.

Usage :
    python3 .claude/skills/demarrer-un-chantier/scripts/etat-du-terrain.py rangement photos
    python3 … --jours 3        # ne montrer que les branches des trois derniers jours
"""

from __future__ import annotations

import re
import subprocess
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]

# Un mot trop court ou trop courant rapproche n'importe quoi de n'importe quoi.
MOTS_VIDES = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "pour",
    "avec", "dans", "sur", "par", "qui", "que", "module", "projet", "ajouter",
    "faire",
}

# Ce qu'on ne fouille jamais : ni les dépendances, ni les binaires.
EXCLUS = {"node_modules", ".git", ".fixtures", ".travail", "build", "__pycache__"}


def git(*args: str) -> str:
    resultat = subprocess.run(
        ["git", *args], cwd=RACINE, capture_output=True, text=True, timeout=60
    )
    return resultat.stdout.strip()


def sans_accents(texte: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texte.lower())
        if unicodedata.category(c) != "Mn"
    )


def mots_utiles(termes: list[str]) -> list[str]:
    return [
        sans_accents(mot) for mot in termes
        if len(mot) > 3 and sans_accents(mot) not in MOTS_VIDES
    ]


def etat_de_main() -> None:
    print("── main, à l'instant")
    # `--prune` et sans nom de branche : sinon on ne voit que ce que la session
    # avait déjà récupéré, c'est-à-dire précisément pas les branches ouvertes
    # depuis. Un outil censé montrer les autres sessions ne peut pas se
    # permettre de mentir par omission.
    git("fetch", "origin", "--prune", "--quiet")
    tete = git("log", "--oneline", "-1", "origin/main")
    print(f"   {tete}")

    local = git("rev-parse", "--abbrev-ref", "HEAD")
    retard = git("rev-list", "--count", "HEAD..origin/main")
    avance = git("rev-list", "--count", "origin/main..HEAD")
    if retard and int(retard) > 0:
        print(f"   ⚠ « {local} » a {retard} commit(s) de retard sur main. "
              "Repartir de là avant d'écrire quoi que ce soit.")
    elif avance and int(avance) > 0:
        print(f"   « {local} » a {avance} commit(s) d'avance, à jour sur main.")
    else:
        print(f"   « {local} » est exactement sur main.")


def branches_vivantes(mots: list[str], jours: int) -> None:
    print(f"\n── branches poussées ces {jours} derniers jours")
    brut = git(
        "for-each-ref", "--sort=-committerdate", "refs/remotes/origin/",
        "--format=%(refname:short)|%(committerdate:relative)|%(committerdate:unix)|%(contents:subject)",
    )
    maintenant = int(git("log", "-1", "--format=%ct", "origin/main") or 0)
    limite = jours * 86400
    montrees = 0
    for ligne in brut.splitlines():
        parts = ligne.split("|", 3)
        if len(parts) < 4:
            continue
        nom, age, horodatage, sujet = parts
        if nom.endswith("/main") or nom.endswith("/HEAD"):
            continue
        if maintenant and (maintenant - int(horodatage or 0)) > limite:
            continue
        proche = [m for m in mots if m in sans_accents(nom) or m in sans_accents(sujet)]
        marque = "  ⚠ MÊME SUJET" if proche else ""
        print(f"   {age:<16} {nom.removeprefix('origin/')}{marque}")
        print(f"   {'':<16} {sujet[:80]}")
        montrees += 1
    if not montrees:
        print("   aucune — le terrain est libre.")


def deja_dans_le_depot(mots: list[str]) -> None:
    print("\n── ce qui existe déjà sous ce nom")
    trouves: list[str] = []

    for chemin in sorted(RACINE.rglob("*")):
        if any(part in EXCLUS or part.startswith(".") for part in chemin.parts):
            continue
        nom = sans_accents(chemin.name)
        if any(mot in nom for mot in mots):
            trouves.append(str(chemin.relative_to(RACINE)))
        if len(trouves) > 25:
            break

    for chemin in trouves[:25]:
        print(f"   {chemin}")
    if not trouves:
        print("   aucun fichier ni dossier ne porte ces mots.")

    # Les compétences décrivent les chantiers du dépôt : si l'une d'elles parle
    # déjà du sujet, le travail a probablement commencé ailleurs.
    competences = RACINE / ".claude" / "skills"
    if competences.is_dir():
        proches = []
        for skill in sorted(competences.glob("*/SKILL.md")):
            texte = sans_accents(skill.read_text(encoding="utf-8")[:2000])
            if sum(1 for mot in mots if mot in texte) >= max(1, len(mots) - 1):
                proches.append(skill.parent.name)
        if proches:
            print(f"\n   compétence(s) qui parlent déjà de ce sujet : {', '.join(proches)}")
            print("   → les lire avant d'écrire : elles portent des pièges déjà payés.")


def main(argv: list[str]) -> int:
    jours = 7
    if "--jours" in argv:
        index = argv.index("--jours")
        jours = int(argv[index + 1])
        del argv[index: index + 2]

    termes = argv[1:]
    if not termes:
        print("Donner les mots du sujet : etat-du-terrain.py rangement photos")
        return 2
    mots = mots_utiles(termes)
    if not mots:
        print("Aucun mot assez distinctif dans ces termes.")
        return 2

    etat_de_main()
    branches_vivantes(mots, jours)
    deja_dans_le_depot(mots)

    print("\n── à décider maintenant, avant d'écrire")
    print("   Si une branche porte le même sujet : la lire, et rejoindre plutôt que refaire.")
    print("   Si le dépôt en contient déjà : partir de l'existant, ce qui est fusionné gagne.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
