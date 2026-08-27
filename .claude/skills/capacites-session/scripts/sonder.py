#!/usr/bin/env python3
"""Sonde ce que cette session-ci sait faire, avant de promettre quoi que ce soit.

Une session distante n'a ni les mêmes binaires, ni le même réseau, ni les mêmes
modèles qu'une machine de développement — et elle ne le dit pas. On l'apprend en
pleine tâche, au moment où l'on a déjà annoncé un résultat : quatre détours en
une nuit, dont deux annonces à reprendre devant l'utilisateur.

Ce script pose les questions à l'avance, en une dizaine de secondes. Il ne juge
pas et ne répare rien : il constate, pour que le plan de travail tienne compte
du terrain plutôt que de l'espérer.

Les hôtes sondés ne sont pas génériques : ce sont ceux dont les projets de ce
dépôt ont réellement besoin. En ajouter un se justifie par un usage, pas par une
intuition — une liste qui grossit sans raison ralentit chaque démarrage.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

DELAI = 6  # secondes : au-delà, un hôte est inutilisable de toute façon

BINAIRES = {
    'git': 'versionnement',
    'node': 'Amorce, socle Agence',
    'npm': 'Amorce, socle Agence',
    'python3': 'chaînes Python',
    'flutter': 'Look & Find',
    'psql': 'contrôles RLS du socle Agence',
    'ffmpeg': 'audio et vidéo',
    'ffprobe': 'fiche technique d’un média',
    'pdftoppm': 'rendu de PDF',
    'tesseract': 'OCR',
}

MODULES = {
    'PIL': 'images (KDP, Life-Organizer)',
    'numpy': 'mesures sur images',
    'fitz': 'PDF (PyMuPDF)',
    'whisper': 'transcription de parole',
    'torch': 'transcription de parole',
    'edge_tts': 'voix de synthèse',
    'requests': 'appels réseau',
    'streamlit': 'studio audio (en sommeil)',
}

# Paquets Node, cherchés dans les deux projets qui en ont : la racine (Amorce)
# et `agence/`. Un `find_spec` ne les verrait pas — ils ne sont pas Python.
PAQUETS_NODE = {
    'playwright': 'parcours de vérification d’Amorce',
    'next': 'Amorce et socle Agence',
}

HOTES = {
    'https://github.com': 'pousser, ouvrir une PR',
    'https://registry.npmjs.org': 'dépendances npm',
    'https://pypi.org': 'dépendances Python',
    'https://storage.googleapis.com': 'SDK Flutter',
    'https://openaipublic.azureedge.net': 'modèles Whisper',
    'https://speech.platform.bing.com': 'voix de synthèse edge-tts',
    'https://supabase.com': 'documentation et API Supabase',
    'https://graph.facebook.com': 'répondeur Facebook',
}

# Ce qu'on ne doit surtout pas tenter quand une capacité manque, et par quoi la
# remplacer. Écrit ici parce que c'est là qu'on le lit au bon moment.
REPLIS = {
    'ffprobe': "`ffmpeg -i fichier` donne les mêmes informations sur sa sortie d’erreur ; "
               "`imageio-ffmpeg` fournit ffmpeg mais jamais ffprobe.",
    'whisper': "Modèle non téléchargeable ici : demander le texte à l’utilisateur, ou lui "
               "faire lancer la transcription sur sa machine. Ne pas réessayer le "
               "téléchargement, il est refusé par la politique réseau.",
    'edge_tts': "Le service refuse les sessions distantes : écrire le code, le laisser "
                "vérifié par test unitaire, et le dire plutôt que de l’annoncer vérifié.",
    'playwright': "Chromium est déjà là : `AMORCE_CHROMIUM=/opt/pw-browsers/chromium`. "
                  "Ne jamais lancer `playwright install`, le dépôt l’interdit.",
    'psql': "Les binaires du serveur ne sont pas dans le PATH : "
            "`PATH=$PATH:$(ls -d /usr/lib/postgresql/*/bin | tail -1)`.",
}


def binaire(nom: str) -> tuple[bool, str]:
    chemin = shutil.which(nom)
    if chemin:
        return True, chemin
    # Les binaires serveur de PostgreSQL vivent hors du PATH sur cette image.
    for repertoire in Path('/usr/lib/postgresql').glob('*/bin') if Path('/usr/lib/postgresql').exists() else []:
        if (repertoire / nom).exists():
            return True, f'{repertoire / nom} (hors PATH)'
    return False, ''


def module(nom: str) -> tuple[bool, str]:
    try:
        return (importlib.util.find_spec(nom) is not None), ''
    except (ImportError, ValueError):
        return False, ''


def paquet_node(nom: str) -> tuple[bool, str]:
    # scripts → capacites-session → skills → .claude → racine du dépôt
    racine = Path(__file__).resolve().parents[4]
    for projet in ('', 'agence'):
        chemin = racine / projet / 'node_modules' / nom
        if chemin.exists():
            return True, projet or 'racine'
    return False, ''


def hote(url: str) -> tuple[bool, str]:
    requete = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'sonde'})
    try:
        with urllib.request.urlopen(requete, timeout=DELAI) as reponse:
            return True, f'{reponse.status}'
    except urllib.error.HTTPError as erreur:
        # Un 4xx applicatif prouve que l'hôte répond ; c'est ce qu'on mesure.
        joignable = erreur.code not in (403, 407)
        return joignable, f'{erreur.code}'
    except Exception as souci:
        message = str(souci)
        if '403' in message:
            return False, 'refusé par le mandataire'
        return False, type(souci).__name__


def modeles_whisper() -> list[str]:
    cache = Path.home() / '.cache' / 'whisper'
    return sorted(f.stem for f in cache.glob('*.pt')) if cache.exists() else []


def sonder() -> dict:
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as bassin:
        reseau = dict(zip(HOTES, bassin.map(hote, HOTES)))

    return {
        'binaires': {nom: binaire(nom) for nom in BINAIRES},
        'modules': {nom: module(nom) for nom in MODULES},
        'node': {nom: paquet_node(nom) for nom in PAQUETS_NODE},
        'reseau': reseau,
        'modeles': modeles_whisper(),
    }


def rapporter(etat: dict) -> None:
    print('# Capacités de cette session\n')

    print('## Binaires')
    for nom, (present, detail) in etat['binaires'].items():
        marque = '✓' if present else '✗'
        print(f'  {marque} {nom:<12} {BINAIRES[nom]}{f" — {detail}" if detail and not present else ""}')
        if not present and nom in REPLIS:
            print(f'      repli : {REPLIS[nom]}')

    print('\n## Bibliothèques Python')
    for nom, (present, _) in etat['modules'].items():
        print(f'  {"✓" if present else "✗"} {nom:<12} {MODULES[nom]}')
        if not present and nom in REPLIS:
            print(f'      repli : {REPLIS[nom]}')

    print('\n## Paquets Node')
    for nom, (present, ou) in etat['node'].items():
        print(f'  {"✓" if present else "✗"} {nom:<12} {PAQUETS_NODE[nom]}{f" — {ou}" if present else ""}')
        if not present and nom in REPLIS:
            print(f'      repli : {REPLIS[nom]}')

    print('\n## Réseau sortant')
    for url, (joignable, detail) in etat['reseau'].items():
        print(f'  {"✓" if joignable else "✗"} {url:<42} {HOTES[url]} ({detail})')

    modeles = etat['modeles']
    print(f'\n## Modèles de transcription en cache : {", ".join(modeles) if modeles else "aucun"}')
    if not modeles and not etat['reseau'].get('https://openaipublic.azureedge.net', (False,))[0]:
        print(f'  {REPLIS["whisper"]}')


def ligne_courte(etat: dict) -> str:
    """Une ligne pour le démarrage : ce qui manque, et rien d'autre."""
    manques = [nom for nom, (present, _) in etat['binaires'].items() if not present]
    manques += [nom for nom, (present, _) in etat['modules'].items() if not present]
    manques += [nom for nom, (present, _) in etat['node'].items() if not present]
    refus = [url.split('//')[1] for url, (ok, _) in etat['reseau'].items() if not ok]

    morceaux = []
    if manques:
        morceaux.append(f'absents : {", ".join(manques)}')
    if refus:
        morceaux.append(f'réseau refusé : {", ".join(refus)}')
    return ' — '.join(morceaux) if morceaux else 'tout est disponible'


def main() -> int:
    analyse = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    analyse.add_argument('--court', action='store_true',
                         help='une seule ligne, pour le démarrage de session')
    arguments = analyse.parse_args()

    etat = sonder()
    if arguments.court:
        print(ligne_courte(etat))
    else:
        rapporter(etat)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
