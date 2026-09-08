"""Fichier → texte. Impur : lecture disque, appel à un OCR externe.

Chemin par défaut, décidé le 03/09/2026 : texte natif d'un PDF d'abord, OCR
Tesseract **local** ensuite si la page n'en rend pas assez — jamais de modèle
de vision réseau dans cette brique. Un produit qui a vraiment besoin d'un
chemin par modèle l'ajoute lui-même, en connaissance de cause : ce n'est pas au
moteur de décider quand un document quitte la machine.

`extraire` est porté depuis `life-organizer/modules/scan_ocr/traitement.py`,
dépouillé de sa configuration d'origine (`reglages["scan_ocr"]`) au profit de
paramètres explicites — ce fichier ne doit connaître aucune structure de
configuration propre à life-organizer. Cinq choses le structurent, reprises
telles quelles de la source :

1. **Le texte natif passe avant l'OCR, et de très loin.** Un PDF déjà
   numérique rend son texte en quelques millisecondes ; le même passé par la
   rastérisation et l'OCR coûte plusieurs secondes par page.
2. **Tesseract est nourri par son entrée standard, jamais par un chemin.**
   Sous Windows, les bibliothèques qui reçoivent un nom de fichier le
   reçoivent en encodage local et échouent sur certains dossiers accentués. En
   lui passant les octets, la question ne se pose plus.
3. **`dossier_langues` est explicite, jamais deviné.** Contrairement à
   life-organizer, ce module ne sait pas où vit un projet : c'est à l'appelant
   de résoudre son propre chemin vers des `.traineddata` (français compris —
   l'installateur Windows ne pose que l'anglais).
4. **`pages_max` borne le coût, et c'est presque toujours gratuit.** Un
   contrat de quatre-vingts pages porte son émetteur, sa date et son objet sur
   les premières.
5. **Un fichier qui résiste n'arrête pas le lot.** PDF chiffré, image
   tronquée, page que le moteur refuse : c'est rendu comme diagnostic et le
   lot continue.
"""

from __future__ import annotations

import subprocess
from collections.abc import Callable, Iterable
from pathlib import Path

from . import outils_ocr
from .modele import Extraction

# En deçà, le texte rendu par la couche numérique ne dit rien d'exploitable :
# un PDF scanné en rend souvent quelques-uns, glissés par le logiciel de
# numérisation. Seuil par page lue, volontairement bas — le coût d'un OCR
# inutile est bien plus faible que celui d'un document jamais lu.
CARACTERES_MINIMAUX_PAR_PAGE = 40

# Au-delà, l'appel n'aboutira pas : une page pathologique peut occuper le
# moteur indéfiniment, et le lot entier attendrait derrière elle.
DELAI_OCR_SECONDES = 120

_EXTENSIONS_PDF = {".pdf"}


def _importable(nom: str) -> bool:
    from importlib.util import find_spec

    try:
        return find_spec(nom) is not None
    except (ImportError, ValueError):
        return False


def capacites(dossier_langues: Path | None = None,
              langues: tuple[str, ...] = ("fra", "eng")) -> tuple[bool, list[str]]:
    """Le module peut-il lire un document, et sinon que manque-t-il ?

    Demandé avant d'ouvrir le premier fichier : le module reste utile sans OCR
    — les PDF numériques se lisent avec `pypdf` seul — d'où un booléen qui
    vaut « quelque chose est possible », et des manques qui disent lesquels ne
    le sont pas.
    """
    manques: list[str] = []
    possible = False

    if _importable("pypdf"):
        possible = True
    else:
        manques.append("Les PDF ne seront pas lus : pypdf est absent.\n  pip install pypdf")

    tesseract = outils_ocr.trouver_tesseract()
    if tesseract is None:
        manques.append(outils_ocr.message_installation()
                       + "\n  (les PDF déjà numériques restent lisibles sans lui)")
    else:
        possible = True
        if not _importable("pymupdf"):
            manques.append(
                "Les PDF scannés ne seront pas rastérisés : pymupdf est absent.\n"
                "  pip install pymupdf"
            )
        if dossier_langues is not None:
            presentes = outils_ocr.langues_presentes(dossier_langues)
            absentes = [l for l in langues if l not in presentes]
            if absentes:
                manques.append(
                    f"Langue(s) d'OCR absente(s) : {', '.join(absentes)} — cherchées "
                    f"dans {dossier_langues}"
                )

    return possible, manques


def extraire(chemins: Iterable[Path], dossier_langues: Path | None = None,
             langues: tuple[str, ...] = ("fra", "eng"), pages_max: int = 8,
             dpi: int = 300, consigner: Callable[[Path, str], None] | None = None,
             ) -> list[Extraction]:
    """Le texte de chaque document, par la voie la moins chère qui marche."""
    resultats: list[Extraction] = []
    for brut in chemins:
        chemin = Path(brut)
        extraction = _extraire_un(chemin, dossier_langues, langues, pages_max, dpi)
        if not extraction.lisible and consigner:
            consigner(chemin, extraction.diagnostic or "illisible")
        resultats.append(extraction)
    return resultats


def _extraire_un(chemin: Path, dossier_langues: Path | None, langues: tuple[str, ...],
                  pages_max: int, dpi: int) -> Extraction:
    if chemin.suffix.lower() in _EXTENSIONS_PDF:
        return _extraire_pdf(chemin, dossier_langues, langues, pages_max, dpi)
    return _extraire_image(chemin, dossier_langues, langues, dpi)


def _extraire_pdf(chemin: Path, dossier_langues: Path | None, langues: tuple[str, ...],
                   pages_max: int, dpi: int) -> Extraction:
    """La couche numérique d'abord ; l'OCR seulement si elle ne rend rien."""
    texte, pages, echec = _texte_natif(chemin, pages_max)
    if echec:
        return Extraction(chemin, lisible=False, diagnostic=echec)

    if len(texte.strip()) >= CARACTERES_MINIMAUX_PAR_PAGE * max(1, pages):
        return Extraction(chemin, texte, "texte natif", pages)

    images, echec = _pages_en_images(chemin, pages_max, dpi)
    if echec:
        # Le texte natif, même maigre, vaut mieux que rien : on le rend en
        # disant d'où il vient plutôt que de déclarer le document illisible.
        if texte.strip():
            return Extraction(chemin, texte, "texte natif (maigre)", pages)
        return Extraction(chemin, lisible=False, diagnostic=echec)

    morceaux: list[str] = []
    for octets in images:
        lu, echec = _ocr(octets, dossier_langues, langues, dpi)
        if echec:
            return Extraction(chemin, lisible=False, diagnostic=echec)
        morceaux.append(lu)
    return Extraction(chemin, "\n".join(morceaux), "OCR", len(images))


def _extraire_image(chemin: Path, dossier_langues: Path | None, langues: tuple[str, ...],
                     dpi: int) -> Extraction:
    try:
        octets = chemin.read_bytes()
    except OSError as erreur:
        return Extraction(chemin, lisible=False, diagnostic=str(erreur.strerror or erreur))
    texte, echec = _ocr(octets, dossier_langues, langues, dpi)
    if echec:
        return Extraction(chemin, lisible=False, diagnostic=echec)
    return Extraction(chemin, texte, "OCR", 1)


def _texte_natif(chemin: Path, pages_max: int) -> tuple[str, int, str]:
    """Ce que le PDF porte déjà comme texte. Rend (texte, pages lues, échec)."""
    try:
        import logging

        from pypdf import PdfReader
    except ImportError:
        return "", 0, "pypdf est absent"

    # pypdf écrit ses avertissements dans le journal global — les laisser
    # parler par-dessus brouille la seule sortie que l'appelant relira ; ce
    # qu'il signale, on le rend nous-mêmes comme diagnostic du fichier
    # concerné.
    logging.getLogger("pypdf").setLevel(logging.CRITICAL)

    try:
        lecteur = PdfReader(str(chemin))
        if lecteur.is_encrypted:
            # Un PDF chiffré n'est pas abîmé : il est fermé.
            return "", 0, "PDF protégé par mot de passe"
        pages = lecteur.pages[:pages_max]
        return "\n".join((p.extract_text() or "") for p in pages), len(pages), ""
    except Exception as erreur:  # noqa: BLE001 — pypdf lève une famille entière
        return "", 0, _diagnostic_lisible(erreur)


def _pages_en_images(chemin: Path, pages_max: int, dpi: int) -> tuple[list[bytes], str]:
    """Les premières pages rendues en PNG, en mémoire."""
    try:
        import pymupdf
    except ImportError:
        return [], "pymupdf est absent : impossible de rastériser un PDF scanné"

    try:
        with pymupdf.open(str(chemin)) as document:
            images = []
            for page in list(document)[:pages_max]:
                images.append(page.get_pixmap(dpi=dpi).tobytes("png"))
        return images, ""
    except Exception as erreur:  # noqa: BLE001
        return [], f"{type(erreur).__name__}: {erreur}"


def _ocr(octets: bytes, dossier_langues: Path | None, langues: tuple[str, ...],
         dpi: int) -> tuple[str, str]:
    """Le texte lu par tesseract, nourri par l'entrée standard."""
    tesseract = outils_ocr.trouver_tesseract()
    if tesseract is None:
        return "", outils_ocr.message_installation()

    langues_jointes = "+".join(str(l) for l in langues) or "eng"
    commande = [str(tesseract), "-", "stdout", "-l", langues_jointes, "--dpi", str(dpi)]
    # Sans le dossier, tesseract se rabat sur celui de son installation — qui,
    # sous Windows, ne porte que l'anglais. On ne le lui impose donc que s'il
    # existe vraiment, sinon l'OCR échouerait là où il aurait pu lire un peu.
    if dossier_langues is not None and Path(dossier_langues).is_dir():
        commande += ["--tessdata-dir", str(dossier_langues)]

    try:
        sortie = subprocess.run(commande, input=octets, capture_output=True,
                                timeout=DELAI_OCR_SECONDES)
    except (subprocess.TimeoutExpired, OSError) as erreur:
        return "", f"OCR interrompu ({type(erreur).__name__})"
    if sortie.returncode != 0:
        return "", "OCR refusé : " + _premiere_ligne(sortie.stderr.decode("utf-8", "replace"))
    return sortie.stdout.decode("utf-8", "replace"), ""


def _diagnostic_lisible(erreur: Exception) -> str:
    """Ce qu'on dit à l'appelant d'un PDF que pypdf refuse.

    Un PDF chiffré en AES fait lever `DependencyError: cryptography>=3.1 is
    required` — un message sur une dépendance, là où le fait qui compte est
    que le document est **protégé par un mot de passe**.
    """
    message = str(erreur)
    aplati = message.lower()
    if "cryptography" in aplati or "decrypt" in aplati or "encrypt" in aplati:
        return "PDF protégé par mot de passe"
    return f"{type(erreur).__name__}: {message}"


def _premiere_ligne(texte: str) -> str:
    for ligne in (texte or "").splitlines():
        ligne = ligne.strip()
        if ligne:
            return ligne
    return "sans message"
