"""Localisation de ffmpeg et de tesseract, et dégradation propre en leur absence.

Ni l'un ni l'autre n'est un paquet Python : `pip install` ne les fait pas
apparaître. On les cherche au démarrage — celui du système d'abord, puis celui
livré par `imageio-ffmpeg` — et on désactive le module concerné avec un message
qui dit quoi installer. Découvrir l'absence au milieu du traitement d'un millier
de fichiers coûte tout le travail déjà fait.

Deux pièges y sont tenus :

1. **`ffmpeg` et `ffprobe` se cherchent séparément.** Le repli `imageio-ffmpeg`
   ne livre que le premier : son paquet embarque un binaire `ffmpeg` et rien
   d'autre. Supposer que trouver l'un donne l'autre fait échouer l'inspection
   des vidéos au premier fichier, sur une machine où tout semblait installé.
2. **Une absence se constate une fois.** La recherche est mise en cache : la
   refaire par fichier ajoute un parcours du `PATH` à chacun des deux mille
   fichiers d'un dossier, pour un résultat qui ne change pas en cours de route.
"""

from __future__ import annotations

import shutil
from functools import lru_cache
from pathlib import Path

# Ce qu'il faut taper, par système. Le message n'est pas générique parce qu'un
# « installez ffmpeg » sans la ligne de commande renvoie l'utilisateur à un
# moteur de recherche, et que la moitié des réponses qu'il y trouvera lui feront
# compiler les sources.
INSTALLATION = {
    "ffmpeg": (
        "ffmpeg est absent.\n"
        "  Debian/Ubuntu : sudo apt install ffmpeg\n"
        "  macOS         : brew install ffmpeg\n"
        "  Windows       : winget install Gyan.FFmpeg"
    ),
    "ffprobe": (
        "ffprobe est absent : il est livré avec ffmpeg.\n"
        "  Debian/Ubuntu : sudo apt install ffmpeg\n"
        "  macOS         : brew install ffmpeg\n"
        "  Windows       : winget install Gyan.FFmpeg\n"
        "  (le paquet Python imageio-ffmpeg ne fournit que ffmpeg, pas ffprobe)"
    ),
    "tesseract": (
        "tesseract est absent : l'OCR ne peut pas tourner.\n"
        "  Debian/Ubuntu : sudo apt install tesseract-ocr tesseract-ocr-fra\n"
        "  macOS         : brew install tesseract tesseract-lang\n"
        "  Windows       : winget install UB-Mannheim.TesseractOCR"
    ),
}


@lru_cache(maxsize=None)
def trouver(nom: str) -> Path | None:
    """Le chemin de l'outil, celui du système d'abord, ou `None`.

    Le système passe avant le repli embarqué : c'est la version que l'utilisateur
    a choisie, celle que ses autres outils utilisent, et celle qu'il saura mettre
    à jour. Un binaire caché dans un `site-packages` qui l'emporterait sur elle
    donnerait des différences de comportement impossibles à expliquer.
    """
    trouve = shutil.which(nom)
    if trouve:
        return Path(trouve)
    if nom == "ffmpeg":
        return _ffmpeg_embarque()
    return None


def _ffmpeg_embarque() -> Path | None:
    """Le ffmpeg livré par `imageio-ffmpeg`, s'il est installé.

    Ce repli existe pour la machine où l'on n'a pas les droits d'installer un
    paquet système. Il ne couvre que `ffmpeg` : voir le piège 1 en tête de
    fichier.
    """
    try:
        import imageio_ffmpeg  # noqa: PLC0415 — décision 2 du README

        chemin = Path(imageio_ffmpeg.get_ffmpeg_exe())
    except Exception:  # noqa: BLE001 — paquet absent, ou binaire absent du paquet
        return None
    return chemin if chemin.exists() else None


def trouver_ffmpeg() -> Path | None:
    return trouver("ffmpeg")


def trouver_ffprobe() -> Path | None:
    return trouver("ffprobe")


def trouver_tesseract() -> Path | None:
    return trouver("tesseract")


def capacites() -> dict[str, bool]:
    """Ce qui est réellement disponible sur cette machine.

    Rendu comme un état à lire avant de commencer, et non levé comme une
    exception au moment de servir : une commande doit pouvoir annoncer « les
    vidéos ne seront pas inspectées » avant d'ouvrir le premier fichier, pas
    s'interrompre au millième.
    """
    return {nom: trouver(nom) is not None for nom in INSTALLATION}


def message_installation(outil: str) -> str:
    """La marche à suivre pour installer l'outil manquant."""
    return INSTALLATION.get(outil, f"{outil} est absent.")
