#!/usr/bin/env python3
"""Récupère les poids de YAMNet — la seule chose à télécharger avant d'écrire.

**L'hôte compte plus que le modèle**, et c'est la leçon de ce script. Les trois
adresses qu'on trouve dans la documentation officielle sont refusées depuis une
session distante de ce dépôt, mesuré le 01/09/2026 :

    tfhub.dev                          -> 000 (tunnel refusé)
    kaggle.com (qui a repris TF Hub)   -> 000
    huggingface.co                     -> 000

Celle-ci répond, et c'est le miroir MediaPipe du même modèle :

    storage.googleapis.com             -> 200, 4 126 810 octets

C'est le même mécanisme que la voix off et les poids Wav2Lip du dépôt : quand
l'hôte canonique est fermé, le miroir d'un projet Google ou un objet de release
GitHub répond. Chercher là **avant** de conclure à l'impossibilité.
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

URL = ("https://storage.googleapis.com/mediapipe-models/audio_classifier/"
       "yamnet/float32/1/yamnet.tflite")
CIBLE = Path(__file__).resolve().parents[1] / "modeles" / "yamnet.tflite"

# Relevés sur le fichier réellement téléchargé le 01/09/2026. Un poids qui
# change sous le même nom déplacerait silencieusement tous les scores — et
# donc le seuil de la porte, qui est réglé dessus.
TAILLE = 4_126_810
MD5 = "d02e1b838813107817b755d09d6b56b3"


def principal() -> int:
    CIBLE.parent.mkdir(parents=True, exist_ok=True)
    if CIBLE.exists() and CIBLE.stat().st_size == TAILLE:
        print(f"Déjà là : {CIBLE} ({TAILLE} octets)")
        return 0

    print(f"Téléchargement depuis {URL}")
    try:
        with urllib.request.urlopen(URL, timeout=120) as reponse:
            contenu = reponse.read()
    except Exception as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        print("storage.googleapis.com est-il joignable ? `curl -sI " + URL + "`",
              file=sys.stderr)
        return 1

    empreinte = hashlib.md5(contenu).hexdigest()
    if len(contenu) != TAILLE or empreinte != MD5:
        print(f"AVERTISSEMENT : {len(contenu)} octets / md5 {empreinte}, "
              f"attendu {TAILLE} / {MD5}.", file=sys.stderr)
        print("Le modèle a changé en amont — revérifier le seuil de la porte "
              "avant de croire un verdict.", file=sys.stderr)

    CIBLE.write_bytes(contenu)
    print(f"Écrit : {CIBLE} ({len(contenu)} octets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
