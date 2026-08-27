"""Module 1 — un fichier déposé devient quelque chose de lisible.

Trois entrées, une sortie : un PDF, une image, ou une photo prise au téléphone
deviennent soit du texte, soit une image redressée prête pour le lecteur.

Ce que fait ce module, et pourquoi :

- **Le texte déjà présent dans un PDF est pris tel quel.** Une facture
  téléchargée depuis un espace client contient son texte : la relire par
  reconnaissance optique, c'est payer et perdre en fiabilité pour rien.
- **Une page sans texte est rendue en image.** C'est le cas des scans et des
  photos ; le rendu se fait à 200 ppp, résolution en dessous de laquelle les
  petits caractères d'un pied de facture — les références client, précisément
  celles qui comptent — deviennent illisibles.
- **La photo est redressée et recadrée avant tout.** Un document photographié
  de travers, sur une table, se lit mal quel que soit le lecteur derrière.
- **Le document reste où il est.** Ce module ne déplace rien ; le déplacement
  est le travail de `nommage.py`, et seulement avec `--appliquer`.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

# Un PDF de facture porte parfois quelques caractères d'en-tête par-dessus une
# page entièrement scannée. En dessous de ce seuil par page, le texte trouvé
# n'est pas le document : c'est son décor, et il faut passer par l'image.
TEXTE_UTILE_PAR_PAGE = 120

# Les champs qui comptent — émetteur, montant, référence, échéance — sont sur la
# première page, parfois la deuxième. Rendre les quarante pages d'un relevé à
# 200 ppp coûte des secondes et des mégaoctets pour rien.
PAGES_RENDUES_MAX = 3

# 200 ppp : en dessous, les petits caractères d'un pied de facture — la référence
# client, précisément celle qui compte — deviennent illisibles.
PPP = 200

# On identifie sur les octets de tête, jamais sur l'extension : un « .jpg » venu
# d'un iPhone est souvent un HEIC, et un « .pdf » renommé à la main n'en est pas
# un. L'extension ment, les octets non.
SIGNATURES = {
    b"%PDF": "pdf",
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"GIF8": "gif",
    b"II*\x00": "tiff",
    b"MM\x00*": "tiff",
}
FORMATS_IMAGE = ("jpeg", "png", "gif", "tiff")


class ErreurLecture(Exception):
    """Fichier illisible, vide, ou d'un format que ce module ne sait pas ouvrir."""


@dataclass(frozen=True)
class Lecture:
    """Ce qu'un fichier déposé a donné, avant toute interprétation."""

    chemin: Path
    format: str
    empreinte: str
    pages: int
    texte: str
    images: list[Path] = field(default_factory=list)

    @property
    def a_du_texte(self) -> bool:
        """Le texte trouvé est-il celui du document, ou seulement son décor ?"""
        return len(self.texte.strip()) >= TEXTE_UTILE_PAR_PAGE * max(1, self.pages)


def empreinte(chemin: str | Path) -> str:
    """SHA-256 du contenu, lu par blocs.

    Par blocs parce qu'un relevé annuel scanné pèse parfois cent mégaoctets, et
    qu'un téléphone n'a pas de quoi le charger d'un coup.
    """
    condensat = hashlib.sha256()
    with open(chemin, "rb") as fichier:
        for bloc in iter(lambda: fichier.read(1 << 20), b""):
            condensat.update(bloc)
    return condensat.hexdigest()


def format_de(chemin: str | Path) -> str:
    """Reconnaît le format sur les octets de tête."""
    with open(chemin, "rb") as fichier:
        tete = fichier.read(16)
    if not tete:
        raise ErreurLecture(f"{chemin} est vide")
    for signature, nom in SIGNATURES.items():
        if tete.startswith(signature):
            return nom
    raise ErreurLecture(
        f"{chemin} : format non reconnu (octets de tete {tete[:8]!r}). "
        "Ni PDF ni image courante — le convertir avant de le deposer."
    )


def lire(chemin: str | Path, dossier_images: str | Path | None = None) -> Lecture:
    """Ouvre le fichier et rend son texte, ou les images de ses pages.

    Le fichier n'est jamais déplacé ni modifié : le rangement appartient à
    `nommage.py`, et seulement quand on le lui demande.
    """
    chemin = Path(chemin)
    if not chemin.exists():
        raise ErreurLecture(f"{chemin} est introuvable")
    genre = format_de(chemin)

    if genre in FORMATS_IMAGE:
        # Une image est déjà l'image : rien à rendre, rien à extraire ici.
        return Lecture(chemin=chemin, format=genre, empreinte=empreinte(chemin),
                       pages=1, texte="", images=[chemin])

    document = pymupdf.open(chemin)
    try:
        pages = len(document)
        texte = "\n".join(page.get_text() for page in document)
        lecture = Lecture(chemin=chemin, format="pdf", empreinte=empreinte(chemin),
                          pages=pages, texte=texte)
        if lecture.a_du_texte or dossier_images is None:
            return lecture
        return Lecture(chemin=chemin, format="pdf", empreinte=lecture.empreinte,
                       pages=pages, texte=texte,
                       images=_rendre(document, Path(dossier_images), chemin.stem))
    finally:
        document.close()


def _rendre(document: pymupdf.Document, dossier: Path, base: str) -> list[Path]:
    dossier.mkdir(parents=True, exist_ok=True)
    rendues: list[Path] = []
    for numero in range(min(len(document), PAGES_RENDUES_MAX)):
        image = dossier / f"{base}-p{numero + 1}.png"
        document[numero].get_pixmap(dpi=PPP).save(image)
        rendues.append(image)
    return rendues
