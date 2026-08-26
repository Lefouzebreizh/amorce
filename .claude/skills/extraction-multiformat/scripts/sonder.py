#!/usr/bin/env python3
"""Sonde un fichier et dit ce qu'il est vraiment, pas ce que son extension prétend.

Pourquoi ce script existe : l'extension ment souvent. Un « .jpg » sorti d'un
iPhone est un HEIC, un « .xls » exporté par un ERP est un CSV, un « .dat »
opaque est un ZIP. Extraire selon l'extension, c'est planter une fois sur cinq
avec une erreur illisible ; extraire selon les octets de tête, c'est ne jamais
se tromper de bibliothèque.

Le second rôle du script est de dire, pour le type trouvé, quels outils sont
présents sur cette machine. Choisir une recette avant de savoir si `ffmpeg`
existe fait perdre un aller-retour à chaque fichier.

Usage :
    python3 sonder.py <fichier> [<fichier>...]
    python3 sonder.py --json <fichier>     # sortie exploitable par un script
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import zipfile
from importlib.util import find_spec

# (offset, octets attendus, famille, type, précision)
# Ordonné du plus spécifique au plus général : la première correspondance gagne.
SIGNATURES: list[tuple[int, bytes, str, str]] = [
    (0, b"\x89PNG\r\n\x1a\n", "image", "png"),
    (0, b"\xff\xd8\xff", "image", "jpeg"),
    (0, b"GIF8", "image", "gif"),
    (0, b"BM", "image", "bmp"),
    (0, b"II*\x00", "image", "tiff-ou-raw"),
    (0, b"MM\x00*", "image", "tiff-ou-raw"),
    (0, b"\x1aE\xdf\xa3", "video", "matroska (mkv/webm)"),
    (0, b"fLaC", "audio", "flac"),
    (0, b"OggS", "audio", "ogg"),
    (0, b"ID3", "audio", "mp3"),
    (0, b"\xff\xfb", "audio", "mp3"),
    (0, b"\xff\xf3", "audio", "mp3"),
    (0, b"\xff\xf2", "audio", "mp3"),
    (0, b"%PDF", "document", "pdf"),
    (0, b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "document", "ole2 (doc/xls/ppt/msg ancien)"),
    (0, b"{\\rtf", "document", "rtf"),
    (0, b"SQLite format 3\x00", "donnees", "sqlite"),
    (0, b"Rar!", "archive", "rar"),
    (0, b"7z\xbc\xaf\x27\x1c", "archive", "7z"),
    (0, b"\x1f\x8b", "archive", "gzip"),
    (0, b"BZh", "archive", "bzip2"),
    (0, b"\xfd7zXZ\x00", "archive", "xz"),
    (0, b"\x7fELF", "binaire", "exécutable ELF"),
    (0, b"MZ", "binaire", "exécutable Windows"),
    (0, b"OTTO", "police", "opentype"),
    (0, b"\x00\x01\x00\x00\x00", "police", "truetype"),
    (0, b"wOF", "police", "woff"),
]

# Conteneurs ISO-BMFF : « ftyp » en 4, la marque en 8 dit lequel.
MARQUES_FTYP = {
    b"heic": ("image", "heic"), b"heix": ("image", "heic"),
    b"hevc": ("image", "heic"), b"heim": ("image", "heic"),
    b"mif1": ("image", "heif"), b"msf1": ("image", "heif"),
    b"avif": ("image", "avif"),
    b"qt  ": ("video", "mov"),
    b"M4A ": ("audio", "m4a"), b"M4B ": ("audio", "m4b"),
}

# Un ZIP peut être six choses. Ce qu'il contient tranche.
MEMBRES_ZIP = [
    ("word/document.xml", "document", "docx"),
    ("xl/workbook.xml", "document", "xlsx"),
    ("ppt/presentation.xml", "document", "pptx"),
    ("META-INF/container.xml", "livre", "epub"),
    ("AndroidManifest.xml", "binaire", "apk"),
]

# Pour chaque famille : la recette, et ce dont elle a besoin.
# ("module python" | "!binaire système", …)
RECETTES: dict[str, tuple[str, list[str]]] = {
    "video": ("ffmpeg pour la piste audio, opencv pour les images clés, "
              "faster-whisper pour la parole", ["!ffmpeg", "cv2", "faster_whisper"]),
    "audio": ("ffmpeg + pydub pour la découpe, faster-whisper pour la parole, "
              "mutagen pour les tags", ["!ffmpeg", "pydub", "faster_whisper", "mutagen"]),
    "image": ("pillow (+ pillow-heif pour le HEIC) pour les pixels, exifread pour "
              "la date et le GPS, tesseract si l'image porte du texte",
              ["PIL", "pillow_heif", "exifread", "!tesseract"]),
    "document": ("pdfplumber/pymupdf pour un PDF, python-docx / openpyxl / "
                 "python-pptx pour la bureautique", ["pdfplumber", "fitz", "docx", "openpyxl", "pptx"]),
    "livre": ("ebooklib pour les chapitres, beautifulsoup4 pour nettoyer le HTML",
              ["ebooklib", "bs4"]),
    "donnees": ("le module sqlite3 de la bibliothèque standard, puis pandas",
                ["pandas"]),
    "archive": ("décompresser d'abord, puis re-sonder chaque membre", []),
    "texte": ("lecture directe ; chardet si l'encodage résiste", ["chardet"]),
    "police": ("fonttools, ou simplement l'installer pour la rendre", []),
    "binaire": ("aucune recette : passer à l'inspection manuelle (voir "
                "references/binaires.md)", []),
    "inconnu": ("aucune recette : passer à l'inspection manuelle (voir "
                "references/binaires.md)", []),
}

# Famille attendue pour les extensions courantes. Comparer les familles plutôt
# que les chaînes évite de crier au loup sur « .txt » → texte, ou « .jpg » → jpeg.
FAMILLE_ATTENDUE = {
    "jpg": "image", "jpeg": "image", "png": "image", "gif": "image", "bmp": "image",
    "webp": "image", "tif": "image", "tiff": "image", "heic": "image", "heif": "image",
    "avif": "image", "raw": "image", "cr2": "image", "nef": "image",
    "mp4": "video", "mov": "video", "mkv": "video", "webm": "video", "avi": "video",
    "m4v": "video", "mpg": "video", "mpeg": "video",
    "mp3": "audio", "wav": "audio", "flac": "audio", "ogg": "audio", "m4a": "audio",
    "aac": "audio", "opus": "audio", "wma": "audio",
    "pdf": "document", "doc": "document", "docx": "document", "xls": "document",
    "xlsx": "document", "ppt": "document", "pptx": "document", "odt": "document",
    "ods": "document", "odp": "document", "rtf": "document", "msg": "document",
    "epub": "livre", "mobi": "livre", "azw3": "livre",
    "zip": "archive", "rar": "archive", "7z": "archive", "gz": "archive",
    "tar": "archive", "bz2": "archive", "xz": "archive",
    "txt": "texte", "csv": "texte", "tsv": "texte", "json": "texte", "xml": "texte",
    "html": "texte", "md": "texte", "log": "texte", "yml": "texte", "yaml": "texte",
    "db": "donnees", "sqlite": "donnees", "sqlite3": "donnees",
    "ttf": "police", "otf": "police", "woff": "police", "woff2": "police",
}

# Types qui, à l'intérieur même de leur famille, réclament un outil que le
# lecteur par défaut n'a pas : un HEIC d'iPhone renommé « .jpg » reste une image,
# mais Pillow seul l'ouvre pas — il faut pillow-heif. Ces cas méritent l'alerte
# au même titre qu'un changement de famille.
TYPES_EXIGEANTS = {"heic", "heif", "avif", "tiff-ou-raw",
                   "ole2 (doc/xls/ppt/msg ancien)"}

# Skills du dépôt qui prennent le relais. Y renvoyer plutôt que réinventer.
DELEGATIONS = {
    "pdf": "pdf", "docx": "docx", "xlsx": "xlsx", "pptx": "pptx",
    "csv": "xlsx", "tsv": "xlsx",
}


def _lire_tete(chemin: str, n: int = 4096) -> bytes:
    with open(chemin, "rb") as f:
        return f.read(n)


def _identifier_zip(chemin: str) -> tuple[str, str]:
    """Ouvre le ZIP pour savoir lequel des six formats ZIP c'est."""
    try:
        with zipfile.ZipFile(chemin) as z:
            noms = set(z.namelist())
            for membre, famille, type_ in MEMBRES_ZIP:
                if membre in noms:
                    return famille, type_
            if "mimetype" in noms:
                mime = z.read("mimetype").decode("ascii", "replace")
                if "epub" in mime:
                    return "livre", "epub"
                if "opendocument" in mime:
                    return "document", f"opendocument ({mime.rsplit('.', 1)[-1]})"
    except (zipfile.BadZipFile, OSError, KeyError):
        pass
    return "archive", "zip"


def _semble_texte(tete: bytes) -> bool:
    """Un fichier sans octet nul dont l'essentiel est imprimable est du texte."""
    if not tete or b"\x00" in tete:
        return False
    imprimables = sum(1 for o in tete if 32 <= o < 127 or o in (9, 10, 13))
    return imprimables / len(tete) > 0.90


def _preciser_texte(tete: bytes) -> str:
    """Distingue un texte délimité d'une prose. Un export d'ERP nommé « .xls »
    est le plus souvent un CSV : le dire évite de lancer openpyxl pour rien."""
    lignes = [l for l in tete.decode("utf-8", "replace").splitlines()[:20] if l.strip()]
    if not lignes:
        return "texte brut"
    if lignes[0].lstrip()[:1] in "{[":
        return "json probable"
    if lignes[0].lstrip().startswith("<"):
        return "xml/html probable"
    if len(lignes) < 2:
        return "texte brut"
    for sep, nom in ((",", "csv"), (";", "csv"), ("\t", "tsv"), ("|", "csv")):
        comptes = {l.count(sep) for l in lignes}
        # Même nombre de séparateurs sur chaque ligne, et au moins un : c'est un tableau.
        if len(comptes) == 1 and comptes.pop() >= 1:
            return f"{nom} (séparateur « {sep} »)"
    return "texte brut"


def identifier(chemin: str) -> tuple[str, str]:
    """Renvoie (famille, type) d'après les octets de tête."""
    tete = _lire_tete(chemin)
    if not tete:
        return "inconnu", "fichier vide"

    # ZIP et ISO-BMFF avant la table : leur signature ne suffit pas à conclure.
    if tete.startswith(b"PK\x03\x04"):
        return _identifier_zip(chemin)
    if len(tete) >= 12 and tete[4:8] == b"ftyp":
        return MARQUES_FTYP.get(tete[8:12], ("video", "mp4"))
    if tete.startswith(b"RIFF") and len(tete) >= 12:
        return {b"WAVE": ("audio", "wav"), b"WEBP": ("image", "webp"),
                b"AVI ": ("video", "avi")}.get(tete[8:12], ("inconnu", "conteneur RIFF"))

    for offset, motif, famille, type_ in SIGNATURES:
        if tete[offset:offset + len(motif)] == motif:
            return famille, type_

    if _semble_texte(tete):
        return "texte", _preciser_texte(tete)
    return "inconnu", "binaire non identifié"


def _outils(besoins: list[str]) -> list[tuple[str, bool]]:
    """Pour chaque besoin, dit s'il est présent. Un « ! » préfixe un binaire."""
    etat = []
    for besoin in besoins:
        if besoin.startswith("!"):
            nom = besoin[1:]
            etat.append((nom, shutil.which(nom) is not None))
        else:
            try:
                etat.append((besoin, find_spec(besoin) is not None))
            except (ImportError, ValueError):
                etat.append((besoin, False))
    return etat


def sonder(chemin: str) -> dict:
    if not os.path.isfile(chemin):
        return {"chemin": chemin, "erreur": "fichier introuvable"}

    famille, type_ = identifier(chemin)
    extension = os.path.splitext(chemin)[1].lower().lstrip(".")
    recette, besoins = RECETTES.get(famille, RECETTES["inconnu"])

    rapport = {
        "chemin": chemin,
        "taille_octets": os.path.getsize(chemin),
        "extension": extension or None,
        "famille": famille,
        "type_reel": type_,
        # Le point le plus utile du rapport : l'extension trahit-elle le contenu.
        # Une extension inconnue de la table n'accuse personne — on ne sait pas.
        # On n'alerte que si la méprise change l'outil à employer ; un PNG nommé
        # « .jpg » se lit avec la même bibliothèque, le signaler serait du bruit.
        "extension_trompeuse": (
            (extension in FAMILLE_ATTENDUE and FAMILLE_ATTENDUE[extension] != famille)
            or (type_ in TYPES_EXIGEANTS and extension not in type_)
        ),
        "recette": recette,
        "outils": {nom: present for nom, present in _outils(besoins)},
    }
    for cle, skill in DELEGATIONS.items():
        if cle in type_.lower() or extension == cle:
            rapport["skill_dedie"] = skill
            break
    return rapport


def afficher(r: dict) -> None:
    if "erreur" in r:
        print(f"✗ {r['chemin']} : {r['erreur']}")
        return
    o = r["taille_octets"]
    taille = (f"{o} o" if o < 1024 else
              f"{o / 1024:.0f} Ko" if o < 1024 ** 2 else
              f"{o / 1024 ** 2:.1f} Mo")
    print(f"\n── {r['chemin']}  ({taille})")
    ecart = ("" if not r["extension"] or r["extension"] in r["type_reel"]
             else f"  (annoncé « .{r['extension']} »)")
    print(f"   type réel   : {r['type_reel']}{ecart}  [famille : {r['famille']}]")
    if r["extension_trompeuse"]:
        print(f"   ⚠  l'extension « .{r['extension']} » ne correspond pas au contenu — "
              f"suivre le type réel")
    if "skill_dedie" in r:
        print(f"   → un skill dédié existe : /{r['skill_dedie']} — l'utiliser plutôt que ce script")
        return
    print(f"   recette     : {r['recette']}")
    if r["outils"]:
        absents = [n for n, ok in r["outils"].items() if not ok]
        presents = [n for n, ok in r["outils"].items() if ok]
        if presents:
            print(f"   disponible  : {', '.join(presents)}")
        if absents:
            print(f"   ✗ manquant  : {', '.join(absents)}")
            print(f"     → extraire ce qui est possible sans, et dire à l'utilisateur "
                  f"ce que l'absence coûte")


def main(argv: list[str]) -> int:
    en_json = "--json" in argv
    chemins = [a for a in argv[1:] if not a.startswith("--")]
    if not chemins:
        print(__doc__)
        return 2
    rapports = [sonder(c) for c in chemins]
    if en_json:
        print(json.dumps(rapports, ensure_ascii=False, indent=2))
    else:
        for r in rapports:
            afficher(r)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
