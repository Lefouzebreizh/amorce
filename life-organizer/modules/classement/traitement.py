"""Dater les fichiers, puis les ranger. Tout ce qui touche au disque est ici.

Deux décisions :

1. **La date se cherche dans l'ordre déclaré, et on retient laquelle a répondu.**
   `classement.source_de_la_date` va de la plus fiable à la moins fiable ; la
   première qui donne une date gagne, et son nom voyage jusqu'au motif affiché.
   Sans ce nom, l'utilisateur ne peut pas distinguer une photo rangée sur sa
   vraie date de prise de vue d'une photo rangée sur la date où elle a été
   copiée depuis une sauvegarde — et c'est la différence entre un souvenir
   retrouvé et dix ans de souvenirs empilés sous le mois courant.

2. **Un fichier qu'on n'arrive pas à dater n'est pas un échec.** Il part vers
   « À dater » (voir `regles.py`) et le parcours continue. S'arrêter au premier
   JPEG dont l'EXIF est corrompu, c'est perdre le rangement des mille neuf cent
   quatre-vingt-dix-neuf autres.

Pillow n'est importé qu'ici, et dans le corps des fonctions : lire un EXIF ne
doit pas être une condition pour lancer `organizer calendrier`.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable

from noyau import fichiers
from noyau.journal import Journal
from noyau.modele import Fiche

from . import regles

# Les seules extensions dont un EXIF de prise de vue vaut la peine d'être
# cherché. Ouvrir un PDF avec Pillow pour n'y rien trouver coûte le temps de
# l'ouvrir, multiplié par le nombre de documents.
EXTENSIONS_EXIF = {"jpg", "jpeg", "tiff", "tif", "heic", "heif", "dng", "cr2", "nef"}

# 36867 = DateTimeOriginal, la date de déclenchement. À ne pas confondre avec
# 306 (DateTime), que le moindre logiciel de retouche réécrit.
ETIQUETTE_DATE_ORIGINALE = 36867


def dater(chemins: Iterable[Path], sources: list[str],
          consigner: Callable[[Path, str], None] | None = None
          ) -> list[tuple[Fiche, str | None]]:
    """Rend, pour chaque fichier, sa fiche et le nom de la source qui l'a daté."""
    resultats = []
    for chemin in chemins:
        try:
            infos = chemin.stat()
        except OSError as erreur:
            if consigner:
                consigner(chemin, f"illisible ({erreur.strerror})")
            continue

        horodatage, source = _premiere_date(chemin, sources, infos.st_mtime, consigner)
        resultats.append((
            Fiche(chemin=chemin, poids_octets=infos.st_size,
                  date_horodatage=horodatage if horodatage else infos.st_mtime),
            source,
        ))
    return resultats


def _premiere_date(chemin: Path, sources: list[str], mtime: float,
                   consigner) -> tuple[float | None, str | None]:
    for source in sources:
        if source == "exif":
            trouvee = _date_exif(chemin, consigner)
        elif source == "nom_de_fichier":
            trouvee = _date_du_nom(chemin.name)
        elif source == "modification":
            trouvee = mtime
        else:
            # « metadonnees » (conteneur vidéo) attend `noyau/outils_externes`,
            # qui ne sait pas encore localiser ffprobe. Passer plutôt que
            # d'inventer : une source silencieusement absente vaut mieux qu'une
            # date inventée, et `sources_ignorees` le dit à l'utilisateur.
            trouvee = None
        if trouvee:
            return trouvee, source
    return None, None


def sources_ignorees(sources: list[str]) -> list[str]:
    """Les sources déclarées que ce module ne sait pas encore lire.

    Annoncé avant de traiter, comme le détecteur de visages absent du module de
    nettoyage : découvrir après coup qu'une source promise par la configuration
    n'a jamais été consultée, c'est l'apprendre une fois les fichiers déplacés.
    """
    connues = {"exif", "nom_de_fichier", "modification"}
    return [source for source in sources if source not in connues]


def _date_exif(chemin: Path, consigner) -> float | None:
    if chemin.suffix.lower().lstrip(".") not in EXTENSIONS_EXIF:
        return None
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        return None
    try:
        with Image.open(chemin) as image:
            brut = (image.getexif() or {}).get(ETIQUETTE_DATE_ORIGINALE)
    except UnidentifiedImageError:
        # Un `.jpg` que Pillow ne reconnaît pas n'est pas un incident : c'est
        # une vignette, un fichier renommé, un PNG déguisé. Il se range très
        # bien sur son nom ou sa date. Le consigner noierait les vrais
        # incidents sous des centaines de lignes sans conséquence.
        return None
    except OSError as erreur:
        if consigner:
            consigner(chemin, f"illisible ({erreur.strerror or erreur})")
        return None
    except Exception:
        # Pillow lève une famille entière selon le format (fichier tronqué,
        # profil couleur exotique). Aucune n'empêche de ranger le fichier.
        return None
    if not brut:
        return None
    try:
        # Format EXIF : « 2024:03:15 19:12:03 ». Les deux-points des dates sont
        # la seule chose qui distingue cette chaîne d'un ISO 8601.
        return datetime.strptime(str(brut), "%Y:%m:%d %H:%M:%S").timestamp()
    except ValueError:
        return None


def _date_du_nom(nom: str) -> float | None:
    trouve = re.search(regles.MOTIF_DATE_DANS_LE_NOM, nom)
    if not trouve:
        return None
    annee, mois, jour = (int(part) for part in trouve.groups())
    try:
        return datetime(annee, mois, jour).timestamp()
    except ValueError:
        return None


def ranger(rangements: list[regles.Rangement], bibliotheque: Path,
           journal: Journal, verifier_empreinte: bool = False) -> int:
    """Déplace ce qui doit l'être. Rend le nombre de fichiers rangés.

    Le journal décide seul s'il faut agir (mode simulation) : la condition n'est
    pas réécrite ici, sans quoi elle finirait par diverger de celle des cinq
    autres modules.
    """
    ranges = 0
    for rangement in rangements:
        if not rangement.a_deplacer:
            continue
        destination = bibliotheque / rangement.destination
        # Dernier rempart, après la validation de `noyau/config.py`. Les deux ne
        # font pas double emploi : celle-là refuse au démarrage une
        # configuration fautive et dit quoi corriger ; celui-ci protège le cas
        # où la destination arrive par un autre chemin — configuration écrite à
        # la main entre deux `verifier`, réglages fabriqués par un appelant.
        # Un fichier qui sortirait de la bibliothèque est consigné et laissé où
        # il est : déplacer un relevé bancaire hors de la zone prévue est pire
        # que ne pas le ranger.
        if not destination.resolve().is_relative_to(bibliotheque.resolve()):
            journal.incident(
                rangement.fiche.chemin,
                f"rangement refusé : « {rangement.destination} » sort de la bibliothèque",
            )
            continue
        if not journal.prevoir(f"ranger : {rangement.fiche.chemin} → {destination} "
                               f"({rangement.motif})"):
            ranges += 1
            continue
        try:
            fichiers.deplacer(rangement.fiche.chemin, destination, verifier=verifier_empreinte)
        except OSError as erreur:
            journal.incident(rangement.fiche.chemin, f"rangement impossible ({erreur})")
            continue
        ranges += 1
    return ranges


# Ce dont on sait tirer du texte sans rien installer de plus. Les images
# scannées en sont volontairement absentes : les lire demanderait un OCR, et
# `tesseract` n'est pas un paquet Python — il manque dans la plupart des
# environnements. Un document sans couche texte garde donc son nom de fichier
# pour seul indice, ce que le compte rendu dit plutôt que de le taire.
EXTENSIONS_LISIBLES = {"pdf", "txt", "md"}


def texte_du_document(chemin: Path, pages_max: int = 2, caracteres_max: int = 2000,
                      consigner: Callable[[Path, str], None] | None = None) -> str:
    """Le début du texte d'un document, ou une chaîne vide si on ne sait pas le lire.

    Vide et non une exception : un document illisible se range très bien sur son
    nom et sa date, et refuser de traiter deux mille fichiers parce que l'un
    d'eux est protégé par mot de passe serait une régression, pas une prudence.

    `pypdf` s'importe ici et non en tête de fichier — le rangement des photos ne
    doit pas dépendre d'une bibliothèque qui ne sert qu'aux documents.
    """
    extension = chemin.suffix.lower().lstrip(".")
    if extension not in EXTENSIONS_LISIBLES:
        return ""

    if extension in {"txt", "md"}:
        try:
            return chemin.read_text(encoding="utf-8", errors="replace")[:caracteres_max]
        except OSError as erreur:
            if consigner:
                consigner(chemin, f"illisible ({erreur.strerror or erreur})")
            return ""

    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    # `pypdf` écrit « invalid pdf header » et « EOF marker not found » sur la
    # sortie standard, au milieu du compte rendu. L'incident est déjà consigné
    # proprement quelques lignes plus bas : ce doublon-là ne fait que salir la
    # seule liste que l'utilisateur lit.
    logging.getLogger("pypdf").setLevel(logging.ERROR)

    try:
        lecteur = PdfReader(str(chemin))
        # Les premières pages seulement : un avis d'imposition annonce sa nature
        # en en-tête, et sa dernière page cite trois thèmes qui n'ont rien à
        # voir. Lire tout le document rendrait la détection moins fiable, pas
        # plus — en plus de coûter du temps sur un dossier entier.
        morceaux = [page.extract_text() or "" for page in lecteur.pages[:pages_max]]
    except Exception as erreur:
        # `pypdf` lève une famille entière selon le défaut du fichier : chiffré,
        # tronqué, en-tête absent. Aucun de ces cas n'empêche de ranger.
        if consigner:
            consigner(chemin, f"texte illisible ({type(erreur).__name__})")
        return ""
    return "\n".join(morceaux)[:caracteres_max]
