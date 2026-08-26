#!/usr/bin/env python3
"""Mettre à jour le répondeur depuis GitHub, sans quitter le téléphone.

Quatre décisions tiennent ce fichier :

1. **Rien d'autre que la bibliothèque standard.** C'est le script qu'on lance
   quand quelque chose ne va pas ; s'il dépendait d'un paquet à installer, il
   tomberait en panne exactement le jour où l'installation est le problème.
2. **L'archive complète plutôt que fichier par fichier.** Une seule requête,
   pas de liste à tenir à jour, et un fichier ajouté au projet arrive tout
   seul. Trois mégaoctets se téléchargent en quelques secondes.
3. **`config.env` et `journal.jsonl` ne sont jamais écrasés.** Ils
   appartiennent au téléphone, pas au dépôt : le premier porte les clés,
   le second la mémoire des commentaires déjà traités. Les remplacer
   coûterait une reconfiguration, ou une réponse en double sous un
   commentaire déjà traité.
4. **Le compte rendu dit ce qui a changé**, pas ce qui a été téléchargé. Sur
   dix fichiers dont un seul bouge, une liste de dix lignes identiques
   n'apprend rien — et c'est la ligne qui bouge qu'on veut voir.

Usage :
    python3 maj.py
"""

from __future__ import annotations

import io
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

DEPOT = 'Lefouzebreizh/amorce'
BRANCHE = 'claude/facebook-responder-permissions-d8s8r5'
DOSSIER = 'repondeur-facebook'
INTOUCHABLES = {'config.env', 'journal.jsonl'}

ICI = Path(__file__).resolve().parent


def destination(nom: str) -> Path | None:
    """Où atterrit un membre de l'archive — ou None s'il ne nous concerne pas.

    Le chemin est vérifié plutôt que recopié : un nom d'archive est une donnée
    extérieure, et rien ne l'empêche de contenir des `..` qui feraient écrire
    ailleurs sur le téléphone.
    """
    if nom.endswith('/'):
        return None
    morceaux = nom.split('/')
    if len(morceaux) < 3 or morceaux[1] != DOSSIER:
        return None
    relatif = '/'.join(morceaux[2:])
    if Path(relatif).name in INTOUCHABLES:
        return None
    cible = (ICI / relatif).resolve()
    return cible if ICI in cible.parents else None


def main() -> int:
    url = f'https://codeload.github.com/{DEPOT}/zip/refs/heads/{BRANCHE}'
    print(f'🔄 Téléchargement de la branche {BRANCHE}…')
    try:
        with urllib.request.urlopen(url, timeout=120) as reponse:
            archive = zipfile.ZipFile(io.BytesIO(reponse.read()))
    except (urllib.error.URLError, OSError, zipfile.BadZipFile) as erreur:
        print(f'❌ Téléchargement impossible : {erreur}')
        return 1

    changes: list[str] = []
    inchanges = 0
    for nom in archive.namelist():
        cible = destination(nom)
        if cible is None:
            continue
        neuf = archive.read(nom)
        if cible.exists() and cible.read_bytes() == neuf:
            inchanges += 1
            continue
        cible.parent.mkdir(parents=True, exist_ok=True)
        etat = 'mis à jour' if cible.exists() else 'ajouté'
        cible.write_bytes(neuf)
        changes.append(f'   ✔ {cible.relative_to(ICI)} — {etat}')

    if changes:
        print(f'\n{len(changes)} fichier(s) modifié(s) :')
        print('\n'.join(changes))
    else:
        print('\n✅ Déjà à jour, rien à faire.')
    print(f'\n{inchanges} fichier(s) inchangé(s). '
          'config.env et journal.jsonl n’ont pas été touchés.')
    if changes:
        print('▶ Relance essai_ton.py pour voir le changement.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
