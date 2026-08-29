#!/usr/bin/env python3
"""Voix off française fabriquée sur la machine, sans clé et sans réseau au tirage.

Longtemps, ce dépôt a tenu la synthèse vocale pour hors de portée : pas de clé
ElevenLabs, et `edge-tts` passe par `speech.platform.bing.com`, que le mandataire
refuse. La conclusion « impossible » était juste sur les deux chemins essayés, et
fausse sur le troisième.

Le chemin qui marche est celui que la reconnaissance de parole utilisait déjà,
et que personne n'avait retourné vers la synthèse : **sherpa-onnx**, dont les
modèles sont publiés en objets de release GitHub — un hôte que le mandataire
laisse passer, contrairement à Hugging Face. Le modèle se télécharge une fois
(65 Mo), se range à côté, et tout le reste tourne hors ligne.

Mesuré ici : 5,81 s de parole en 0,23 s de calcul, soit **25× le temps réel**.
Passée à `voir-le-son`, cette voix perd 4 dB sur un haut-parleur de téléphone —
son fondamental descend sous les 400 Hz, mais ses formants n'y sont pas, et ce
sont eux qui portent l'intelligibilité. C'est ce qui la rend utilisable en
format court.

Deux décisions tiennent ce fichier :

1. **Le modèle se télécharge à la demande, pas au démarrage de la session.**
   65 Mo à chaque conteneur pour une capacité qu'on n'emploie pas tous les jours
   serait payé cent fois pour rien. Il est mis en cache sous `.fixtures/voix/`,
   ignoré par Git comme le reste des binaires.
2. **La sortie est du WAV à 22 050 Hz mono, pas du MP3.** C'est la sortie native
   du modèle ; la convertir ici ajouterait une perte avant le mixage, alors que
   `monter.py` sait déjà sortir au format et à la loudness de la plateforme.

Usage :
    python3 voix.py --texte "Bonjour à tous" --sortie voix.wav
    python3 voix.py --fichier script.txt --sortie voix.wav --vitesse 0.95
    python3 voix.py --voix upmc --check
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tarfile
import urllib.request
import wave
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
CACHE = RACINE / ".fixtures" / "voix"

# Deux voix françaises publiées en release GitHub. `siwis` est la plus neutre et
# la plus lisible ; `upmc` a un grain plus marqué. Les deux sont des modèles
# Piper servis par sherpa-onnx.
BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models"
VOIX = {
    "siwis": "vits-piper-fr_FR-siwis-medium",
    "upmc": "vits-piper-fr_FR-upmc-medium",
    # Deux voix masculines, vérifiées présentes dans la même release. Elles
    # manquaient, et leur absence a fait conclure une fois qu'aucune voix
    # grave n'était fabriquable ici — alors que seule la liste était courte.
    "tom": "vits-piper-fr_FR-tom-medium",
    "gilles": "vits-piper-fr_FR-gilles-low",
}


def dossier_voix(nom: str) -> Path:
    return CACHE / VOIX[nom]


def obtenir(nom: str, silencieux: bool = False) -> Path | None:
    """Rend le dossier du modèle, en le téléchargeant s'il manque."""
    cible = dossier_voix(nom)
    if (cible / "tokens.txt").is_file():
        return cible

    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / f"{VOIX[nom]}.tar.bz2"
    url = f"{BASE}/{VOIX[nom]}.tar.bz2"
    if not silencieux:
        print(f"   Téléchargement de la voix « {nom} » (~65 Mo)…")
    try:
        urllib.request.urlopen  # noqa: B018 — présence explicite avant l'appel
        with urllib.request.urlopen(url) as r, open(archive, "wb") as f:  # noqa: S310
            while bloc := r.read(1 << 16):
                f.write(bloc)
        with tarfile.open(archive) as t:
            t.extractall(CACHE)
        archive.unlink(missing_ok=True)
        return cible
    except Exception as erreur:  # noqa: BLE001
        archive.unlink(missing_ok=True)
        print(
            f"   Téléchargement impossible : {erreur}\n"
            f"   Le modèle vit ici : {url}\n"
            f"   Le déposer décompressé dans {CACHE} fait aussi l'affaire.",
            file=sys.stderr,
        )
        return None


def verifier(nom: str) -> bool:
    """Dit ce qui manque sans rien synthétiser."""
    print("── Voix off locale")
    try:
        import sherpa_onnx  # noqa: F401
        print("   sherpa-onnx : présent")
    except ImportError:
        print("   sherpa-onnx : ABSENT — pip install sherpa-onnx", file=sys.stderr)
        return False

    cible = dossier_voix(nom)
    if (cible / "tokens.txt").is_file():
        poids = sum(f.stat().st_size for f in cible.rglob("*") if f.is_file())
        print(f"   voix « {nom} » : en place ({poids / 1024**2:.0f} Mo)")
    else:
        print(f"   voix « {nom} » : absente, elle sera téléchargée au premier tirage")
    return True


def dire(texte: str, sortie: Path, nom: str = "siwis", vitesse: float = 1.0) -> Path | None:
    """Synthétise `texte` et écrit un WAV. Rend le chemin, ou None en l'expliquant."""
    if not texte.strip():
        print("Rien à dire : le texte est vide.", file=sys.stderr)
        return None
    try:
        import numpy as np
        import sherpa_onnx
    except ImportError as erreur:
        print(f"Bibliothèque manquante : {erreur}. pip install sherpa-onnx numpy",
              file=sys.stderr)
        return None

    modele = obtenir(nom)
    if modele is None:
        return None

    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                # Le fichier ne se déduit pas du nom de la voix : la qualité fait
                # partie du nom, et une voix « low » ne s'appelle pas « medium ».
                # On prend le seul .onnx du dossier, ce qui vaut pour toutes.
                model=str(next(modele.glob("*.onnx"))),
                tokens=str(modele / "tokens.txt"),
                data_dir=str(modele / "espeak-ng-data"),
            ),
            num_threads=4,
        ),
        # Une phrase à la fois : le modèle respire entre les points, ce qui donne
        # un débit lisible plutôt qu'un bloc récité.
        max_num_sentences=1,
    )
    audio = sherpa_onnx.OfflineTts(config).generate(texte, sid=0, speed=vitesse)

    sortie = Path(sortie).expanduser().resolve()
    sortie.parent.mkdir(parents=True, exist_ok=True)
    # Écriture sous un nom provisoire : un WAV tronqué par une interruption
    # passerait le contrôle de présence et casserait le mixage plus loin.
    provisoire = sortie.with_suffix(sortie.suffix + ".partiel")
    with wave.open(str(provisoire), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(audio.sample_rate)
        w.writeframes((np.array(audio.samples) * 32767).astype("<i2").tobytes())
    provisoire.replace(sortie)

    duree = len(audio.samples) / audio.sample_rate
    print(f"   Voix écrite : {sortie}  ({duree:.2f} s, {audio.sample_rate} Hz)")
    return sortie


def main() -> int:
    a = argparse.ArgumentParser(
        description="Fabrique une voix off française sur la machine, sans clé.",
        epilog=("Le résultat se juge ensuite avec voir-le-son, et se mixe avec "
                "monter.py."),
    )
    source = a.add_mutually_exclusive_group()
    source.add_argument("--texte", help="Le texte à dire.")
    source.add_argument("--fichier", help="Fichier contenant le texte (UTF-8).")
    a.add_argument("--sortie", default="voix.wav", help="WAV à écrire.")
    a.add_argument("--voix", default="siwis", choices=sorted(VOIX),
                   help="siwis (neutre) ou upmc (grain plus marqué).")
    a.add_argument("--vitesse", type=float, default=1.0,
                   help="1.0 = naturel. En dessous, plus posé.")
    a.add_argument("--check", action="store_true",
                   help="Dit ce qui manque, puis s'arrête.")
    args = a.parse_args()

    if args.check:
        return 0 if verifier(args.voix) else 1

    if args.fichier:
        try:
            texte = Path(args.fichier).expanduser().read_text(encoding="utf-8")
        except OSError as erreur:
            print(f"Texte illisible : {erreur}", file=sys.stderr)
            return 1
    elif args.texte:
        texte = args.texte
    else:
        a.error("--texte ou --fichier (ou --check).")

    return 0 if dire(texte, Path(args.sortie), args.voix, args.vitesse) else 1


if __name__ == "__main__":
    sys.exit(main())
