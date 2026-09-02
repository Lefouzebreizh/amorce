#!/usr/bin/env python3
"""L'état du dépôt, mesuré plutôt que recopié.

Ce dépôt a appris deux fois la même leçon à ses dépens : une liste écrite à la
main y est fausse le lendemain, et fausse en silence. `CLAUDE.md` a annoncé dix
projets là où il en énumérait neuf ; la ligne du hook a listé les dépendances
installées avec trois projets de retard. Dans les deux cas, personne n'a rien
vu — un texte périmé ne casse aucun test.

D'où ce script. Il ne connaît pas les projets : il les **découvre**, en cherchant
les répertoires racine qui contiennent du code. Ajouter un dixième chantier ne
demande donc de le déclarer nulle part, ce qui est la seule façon connue de ne
pas se retrouver avec un inventaire faux.

Ce script répond à « qu'y a-t-il dans ce dépôt et où en est-ce » :

    python3 .claude/skills/etat-du-depot/scripts/inventaire.py

Il ne dit rien de ce que la *machine* sait faire — binaires, bibliothèques,
hôtes joignables. C'est le travail de `capacites-session`, dont la sonde va
plus loin que ne le ferait un doublon écrit ici.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]

# Ce qui n'est pas un chantier : outillage, dépendances, sorties de travail.
IGNORES = {
    'node_modules', 'public', 'scripts', '.git', '.next', '.claude', '.github',
    '.fixtures', '.travail', 'inbox', 'projets-actifs', 'archives-backlog',
    '__pycache__', '.venv', 'venv', 'build', 'dist', 'coverage',
}
CODE = ('*.py', '*.ts', '*.tsx', '*.dart', '*.mjs')


def git(*args: str) -> str:
    try:
        return subprocess.run(('git', *args), cwd=RACINE, capture_output=True,
                              text=True, timeout=30).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ''


def _compter_lignes(dossier: Path) -> int:
    total = 0
    for motif in CODE:
        for fichier in dossier.rglob(motif):
            if any(part in IGNORES for part in fichier.parts):
                continue
            if fichier.name.endswith('.g.dart'):     # code généré par build_runner
                continue
            try:
                total += sum(1 for _ in fichier.open('rb'))
            except OSError:
                pass
    return total


def _compter_tests(dossier: Path) -> int:
    # `.mts` compte autant que `.ts` : dans un paquet sans `"type": "module"`,
    # c'est la SEULE façon d'écrire un test en modules ES. `motion/` en est là
    # — lui imposer `"type": "module"` toucherait à la façon dont Remotion
    # charge sa configuration, pour le seul confort d'une extension. Sans cette
    # ligne, ses tests existent, tournent, et le tableau les affiche à zéro :
    # le pire des trois états, puisqu'il désigne comme découvert un chantier
    # qui est gardé.
    # `.js` et `.mjs` manquaient aussi, et c'est le nom de test le plus
    # répandu qui soit : `annuaire-ia/` s'est affiché à zéro test le jour où il
    # en a reçu dix-huit. Le tableau ne se trompait pas sur le dépôt, il se
    # trompait sur lui-même — ce qui est pire, puisqu'on s'y fie pour décider
    # où le prochain défaut tombera.
    motifs = ('test_*.py', '*_test.py', '*_test.dart',
              '*.test.ts', '*.test.tsx', '*.test.mts',
              '*.test.js', '*.test.mjs')
    return sum(1 for m in motifs for f in dossier.rglob(m)
               if not any(p in IGNORES for p in f.parts))


def chantiers() -> list[dict]:
    """Découvre les chantiers plutôt que de les connaître."""
    trouves = []
    candidats = [d for d in RACINE.iterdir()
                 if d.is_dir() and d.name not in IGNORES and not d.name.startswith('.')]
    for dossier in sorted(candidats):
        lignes = _compter_lignes(dossier)
        commits = git('log', '--no-merges', '--oneline', '--', dossier.name)
        n_commits = len(commits.splitlines()) if commits else 0
        # Un dossier sans code ni commit n'est pas un chantier : c'est un reste.
        if lignes == 0 and n_commits == 0:
            continue
        trouves.append({
            'nom': dossier.name,
            'lignes': lignes,
            'commits': n_commits,
            'tests': _compter_tests(dossier),
            'dernier': (git('log', '--no-merges', '-1', '--format=%ad',
                            '--date=format:%d/%m', '--', dossier.name) or '—'),
        })
    return trouves


def afficher_etat() -> None:
    branche = git('rev-parse', '--abbrev-ref', 'HEAD') or '?'
    tete = git('log', '-1', '--format=%h %s') or '?'
    print(f'Branche : {branche}')
    print(f'Tête    : {tete}')

    ecart = git('rev-list', '--left-right', '--count', 'origin/main...HEAD')
    if ecart:
        derriere, devant = (ecart.split() + ['?', '?'])[:2]
        etat = []
        if derriere != '0':
            etat.append(f'{derriere} commit(s) de retard sur origin/main')
        if devant != '0':
            etat.append(f'{devant} en avance')
        print(f'Écart   : {" · ".join(etat) if etat else "à jour avec origin/main"}')
        if derriere != '0':
            print('          → fusionner main avant d’ouvrir quoi que ce soit '
                  '(voir /fusionner-main)')

    sale = git('status', '--porcelain')
    print(f'Arbre   : {"propre" if not sale else str(len(sale.splitlines())) + " fichier(s) modifié(s)"}')

    trouves = chantiers()
    print(f'\n{len(trouves)} chantiers découverts\n')
    print(f'{"CHANTIER":<22}{"LIGNES":>8}{"COMMITS":>9}{"TESTS":>7}  {"DERNIÈRE"}')
    for c in sorted(trouves, key=lambda c: -c['lignes']):
        print(f'{c["nom"]:<22}{c["lignes"]:>8}{c["commits"]:>9}{c["tests"]:>7}  {c["dernier"]}')

    competences = RACINE / '.claude' / 'skills'
    if competences.is_dir():
        n = sum(1 for d in competences.iterdir() if (d / 'SKILL.md').exists())
        print(f'\n{n} compétences · {len(list((RACINE / ".claude" / "agents").glob("*.md")))} agents')



def main() -> int:
    argparse.ArgumentParser(
        description='Inventaire du dépôt : chantiers découverts, leur activité, '
                    'et l’écart avec origin/main.').parse_args()
    afficher_etat()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
