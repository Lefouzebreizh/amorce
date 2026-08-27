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

Deux usages, et le second compte autant que le premier :

    python3 .claude/outils/etat.py              # les chantiers, leur activité
    python3 .claude/outils/etat.py --outillage  # ce que la machine sait faire

`--outillage` existe parce qu'une session distante n'a pas toujours ce qu'on
croit : ni `ffprobe`, ni `pdftotext`, ni `tesseract` ne sont installés ici, alors
que les tâches qui les appellent d'ordinaire sont courantes. Chercher la
commande absente, échouer, puis chercher une parade coûte plusieurs minutes à
chaque fois — et se termine parfois par « ce n'est pas possible », ce qui est
faux. Le script mesure donc ce qui est là et **nomme la parade** pour ce qui
manque.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]

# Ce qui n'est pas un chantier : outillage, dépendances, sorties de travail.
IGNORES = {
    'node_modules', 'public', 'scripts', '.git', '.next', '.claude', '.github',
    '.fixtures', '.travail', 'inbox', 'projets-actifs', 'archives-backlog',
    '__pycache__', '.venv', 'venv', 'build', 'dist', 'coverage',
}
CODE = ('*.py', '*.ts', '*.tsx', '*.dart', '*.mjs')

# Ce qu'on cherche à savoir faire, et par quoi remplacer ce qui manque.
# Le remède est écrit ici plutôt que découvert à chaque fois : c'est du temps
# repris sur une impasse qu'on a déjà rencontrée.
PARADES = {
    'ffprobe': "utiliser `ffmpeg -i <fichier>` : les mêmes métadonnées sortent sur stderr",
    'pdftotext': "utiliser pdfplumber (`page.extract_text()`) ou pymupdf (`page.get_text()`)",
    'pdfinfo': "utiliser pymupdf : `len(pymupdf.open(f))` et `page.rect`",
    'qpdf': "utiliser pypdf : `PdfWriter` fusionne, découpe et pivote",
    'tesseract': "aucune OCR locale — décrire l'image plutôt que d'en extraire le texte, "
                 "ou installer pytesseract *et* le binaire",
    'convert': "utiliser Pillow (`PIL.Image`), qui couvre recadrage, échelle et conversion",
    'gh': "utiliser les outils MCP `mcp__github__*` : PR, revues, état des vérifications",
}
PARADES_PY = {
    'matplotlib': "à installer si besoin (`pip install --break-system-packages matplotlib`) ; "
                  "pour un rendu soigné en PDF, reportlab est déjà là",
    'pytesseract': "sans le binaire tesseract il ne sert à rien — voir la parade de `tesseract`",
    'openpyxl': "à installer pour lire ou écrire un .xlsx",
    'docx': "`python-docx`, à installer pour produire un .docx",
    'pptx': "`python-pptx`, à installer pour produire un .pptx",
    'whisper': "transcription locale absente ; l'installer prend plusieurs minutes et "
               "plusieurs gigaoctets — le dire avant de lancer",
    'torch': "absent volontairement : deux gigaoctets pour un seul chemin de code",
}

BINAIRES = ['git', 'node', 'npm', 'python3', 'flutter', 'dart', 'jq', 'ffmpeg',
            'ffprobe', 'pdftotext', 'pdfinfo', 'qpdf', 'tesseract', 'convert', 'gh']
MODULES = ['PIL', 'pymupdf', 'pypdf', 'reportlab', 'pdfplumber', 'numpy', 'pandas',
           'requests', 'yaml', 'bs4', 'matplotlib', 'pytesseract', 'openpyxl',
           'docx', 'pptx', 'whisper', 'torch']


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
    motifs = ('test_*.py', '*_test.py', '*_test.dart', '*.test.ts', '*.test.tsx')
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


def afficher_outillage() -> None:
    manquants = []
    print('Binaires')
    for b in BINAIRES:
        ok = shutil.which(b) is not None
        print(f'  {b:<12}{"présent" if ok else "ABSENT"}')
        if not ok:
            manquants.append(b)

    print('\nModules Python')
    for m in MODULES:
        code = subprocess.run([sys.executable, '-c', f'import {m}'],
                              capture_output=True, check=False).returncode
        print(f'  {m:<12}{"présent" if code == 0 else "ABSENT"}')
        if code != 0:
            manquants.append(m)

    parades = [(m, PARADES.get(m) or PARADES_PY.get(m)) for m in manquants]
    parades = [(m, p) for m, p in parades if p]
    if parades:
        print('\nCe qui manque a une parade — aucune de ces tâches n’est impossible :')
        for nom, parade in parades:
            print(f'  {nom} → {parade}')
    autres = [m for m in manquants if not (PARADES.get(m) or PARADES_PY.get(m))]
    if autres:
        print(f'\nAbsents sans parade consignée : {", ".join(autres)}')
        print('  Installer avec `pip install --break-system-packages <paquet>`, '
              'puis ajouter la parade ici.')


def main() -> int:
    analyse = argparse.ArgumentParser(
        description='État du dépôt : chantiers découverts, activité, et outillage '
                    'réellement disponible.')
    analyse.add_argument('--outillage', action='store_true',
                         help='Lister les binaires et modules présents, et la parade '
                              'de chaque absent.')
    arguments = analyse.parse_args()
    afficher_outillage() if arguments.outillage else afficher_etat()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
