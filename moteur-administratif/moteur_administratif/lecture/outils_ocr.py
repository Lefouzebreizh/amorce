"""Localisation de tesseract, et dégradation propre en son absence.

Porté depuis `life-organizer/noyau/outils_externes.py`, réduit à tesseract
seul — ffmpeg n'a rien à faire dans un moteur de lecture de documents. Deux
choses à savoir avant d'y toucher :

1. **L'installateur Windows ne met pas tesseract sur le `PATH`.** UB-Mannheim
   propose la case, décochée par défaut : `shutil.which` ne le voit pas, et le
   module conclurait « pas installé » sur une machine où il l'est. D'où le repli
   qui cherche le même binaire à l'endroit précis où cet installateur le pose.
2. **La recherche est mise en cache.** La refaire par fichier ajouterait un
   parcours du `PATH` à chaque document d'un lot.
"""

from __future__ import annotations

import os
import shutil
from functools import lru_cache
from pathlib import Path

DOSSIERS_TESSERACT_WINDOWS = ("Tesseract-OCR", "Programs/Tesseract-OCR")

MESSAGE_INSTALLATION = (
    "tesseract est absent : l'OCR ne peut pas tourner.\n"
    "  Debian/Ubuntu : sudo apt install tesseract-ocr tesseract-ocr-fra\n"
    "  macOS         : brew install tesseract tesseract-lang\n"
    "  Windows       : winget install UB-Mannheim.TesseractOCR"
)


@lru_cache(maxsize=None)
def trouver_tesseract() -> Path | None:
    """Le chemin de tesseract, celui du système d'abord, ou `None`."""
    trouve = shutil.which("tesseract")
    if trouve:
        return Path(trouve)
    return _tesseract_installe_sans_path()


def _tesseract_installe_sans_path() -> Path | None:
    """Le tesseract posé par l'installateur Windows sans avoir été mis au `PATH`.

    Mesuré le 01/09/2026 sur cette machine : Tesseract 5.4.0 présent dans
    « C:\\Program Files\\Tesseract-OCR », absent du `PATH`.
    """
    if os.name != "nt":
        return None
    racines = (
        os.environ.get("ProgramFiles"),
        os.environ.get("ProgramFiles(x86)"),
        os.environ.get("LOCALAPPDATA"),
    )
    for racine in racines:
        if not racine:
            continue
        for dossier in DOSSIERS_TESSERACT_WINDOWS:
            chemin = Path(racine).joinpath(*dossier.split("/")) / "tesseract.exe"
            if chemin.exists():
                return chemin
    return None


def langues_presentes(dossier: Path) -> tuple[str, ...]:
    """Les `.traineddata` disponibles dans `dossier`, par exemple pour vérifier
    que le français y est bien — l'installateur Windows ne pose que l'anglais."""
    try:
        return tuple(sorted(f.stem for f in dossier.glob("*.traineddata")))
    except OSError:
        return ()


def message_installation() -> str:
    return MESSAGE_INSTALLATION
