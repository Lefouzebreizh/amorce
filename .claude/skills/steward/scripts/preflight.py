#!/usr/bin/env python3
"""Contrôle avant de pousser : références orphelines et collisions de sessions.

Deux défauts ont chacun coûté un aller-retour complet dans ce dépôt, et aucun
des deux ne se voit dans un diff.

**Les références orphelines.** Déplacer `mon-app-audio/` sous `archives-backlog/`
a laissé quatre fichiers qui le citaient encore : le hook de démarrage, la carte
des projets, la grille d'un skill — et la découverte des suites de tests de
l'intégration continue, qui ne balayait qu'un niveau. Trois ont été rattrapés à
la lecture ; le quatrième a sorti soixante-deux tests du filet sans qu'aucune
ligne rouge n'apparaisse. Un déplacement de fichiers a des conséquences dans des
fichiers que le diff ne montre pas.

**Les collisions.** Ce dépôt reçoit plusieurs sessions en parallèle. Une branche
a corrigé pendant six minutes un défaut qu'une autre session venait de corriger
mieux ; la pull request a été fermée sans rien fusionner. Le signal existait
pourtant dans git : `main` avait déjà bougé sur les mêmes fichiers.

Le script ne bloque rien et ne corrige rien : il ne fait que rendre visibles ces
deux signaux. Le jugement — « cette citation est-elle vraiment cassée ? »,
« dois-je abandonner ma branche ? » — reste à la lecture.
"""

import re
import subprocess
import sys
from pathlib import Path

BASE = "origin/main"
# Les fichiers qui citent des chemins sans qu'un outil ne le vérifie : c'est là
# que les références orphelines survivent le plus longtemps.
TEXTE = {".md", ".yml", ".yaml", ".sh", ".json", ".toml", ".txt", ".mjs", ".ts", ".py"}


def git(*args, court=True):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode and court:
        return ""
    return r.stdout


def modifies():
    """Chemins touchés par la branche, plus ceux non encore committés."""
    sortie = git("diff", "--name-status", f"{BASE}...HEAD") + git("status", "--porcelain")
    ajoutes, disparus = set(), set()
    for ligne in sortie.splitlines():
        if not ligne.strip():
            continue
        parts = ligne.split()
        etat, chemins = parts[0], parts[1:]
        if not chemins:
            continue
        if etat.startswith("R"):          # renommage : ancien puis nouveau
            disparus.add(chemins[0])
            ajoutes.add(chemins[-1])
        elif etat.startswith("D"):
            disparus.add(chemins[0])
        else:
            ajoutes.add(chemins[-1])
    return ajoutes, disparus


def citations(chemin, exclure):
    """Fichiers suivis qui citent encore ce chemin ou le dossier qui le portait."""
    # Chercher le dossier de premier niveau plutôt que le fichier : un
    # déplacement de projet se cite par son dossier (`mon-app-audio/tests`),
    # presque jamais par le fichier exact qui a bougé.
    racine = chemin.split("/")[0]
    motif = re.escape(racine)
    trouves = []
    for f in git("ls-files").splitlines():
        if f in exclure or Path(f).suffix not in TEXTE:
            continue
        try:
            contenu = Path(f).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for n, ligne in enumerate(contenu.splitlines(), 1):
            if re.search(rf"(?<![\w/-]){motif}/", ligne):
                trouves.append(f"{f}:{n}")
                break
    return trouves


def main():
    git("fetch", "--quiet", "origin", "main")
    # Une seule requête pour toutes les branches de session, sinon le contrôle
    # coûte plus cher que le défaut qu'il cherche.
    git("fetch", "--quiet", "origin", "+refs/heads/claude/*:refs/remotes/origin/claude/*")

    ajoutes, disparus = modifies()
    miens = ajoutes | disparus
    if not miens:
        print("Rien de modifié par rapport à origin/main.")
        return 0

    print(f"# Contrôle avant poussée — {len(miens)} chemin(s) touché(s)\n")

    # 1. Références orphelines
    print("## Références aux chemins disparus\n")
    # Grouper par dossier racine : déplacer un projet de huit fichiers produisait
    # huit blocs identiques, et un rapport qu'on ne lit pas ne sert à rien.
    racines = {c.split("/")[0] for c in disparus if not Path(c.split("/")[0]).exists()}
    orphelines = False
    for racine in sorted(racines):
        refs = citations(racine, miens)
        if refs:
            orphelines = True
            combien = sum(1 for c in disparus if c.startswith(racine + "/"))
            print(f"  {racine}/ ({combien} fichiers déplacés ou supprimés)")
            print(f"    encore cité par : {', '.join(refs[:10])}")
    if not orphelines:
        print("  aucune")

    # 2. Collisions
    print("\n## Ce qui a bougé sur les mêmes fichiers\n")
    collision = False
    recents = set(git("log", f"HEAD..{BASE}", "--name-only", "--pretty=format:").split())
    croise = sorted(recents & miens)
    if croise:
        collision = True
        print(f"  origin/main a modifié depuis : {', '.join(croise[:8])}")
        print("    → fusionner main avant d'ouvrir, et relire ce qu'il y fait déjà.")

    courante = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    par_branche = {}
    frequence = {}
    for ref in git("for-each-ref", "--format=%(refname:short)",
                   "refs/remotes/origin/claude").splitlines():
        if ref.endswith("/" + courante) or not ref.strip():
            continue
        commun = set(git("diff", "--name-only", f"{BASE}...{ref}").split()) & miens
        if commun:
            par_branche[ref] = commun
            for f in commun:
                frequence[f] = frequence.get(f, 0) + 1

    # Un fichier que presque toutes les branches touchent ne porte aucun signal :
    # dans ce dépôt, `CLAUDE.md` et le hook de démarrage sont des carrefours, pas
    # des indices de doublon. Les signaler par branche noyait les deux ou trois
    # recoupements qui, eux, méritent un coup d'œil.
    CARREFOUR = 3
    carrefours = sorted(f for f, n in frequence.items() if n >= CARREFOUR)
    if carrefours:
        print(f"  carrefours du dépôt ({', '.join(carrefours)}) : "
              f"touchés par {max(frequence[f] for f in carrefours)} branches.")
        print("    → conflit probable à la fusion, mais ce n'est pas un doublon.")

    for ref, commun in sorted(par_branche.items()):
        rares = sorted(f for f in commun if frequence[f] < CARREFOUR)
        if rares:
            collision = True
            print(f"  {ref} touche aussi : {', '.join(rares[:6])}")
            print("    → vérifier ce qu'elle fait avant de dupliquer le travail.")
    if not collision:
        print("  aucun recoupement inhabituel")

    print("\n---\nCe relevé signale, il ne tranche pas. Une citation peut être "
          "légitime (un journal, une fiche d'archive) ; une branche voisine peut "
          "faire tout autre chose du même fichier.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
