"""Le geste : ouvrir les photos, en tirer une empreinte, écarter les surnuméraires.

Ce fichier ne décide de rien — il mesure et il déplace. Les seuils, le
regroupement et le choix de celle qu'on garde sont dans `regles.py`, testables
sans décoder une seule image.

Trois choses le structurent :

1. **Pillow, pillow-heif et ImageHash s'importent dans le corps des fonctions**
   (README, décision 2). Un import en tête de fichier ferait payer leur
   chargement à `organizer verifier`, qui ne lit qu'un JSON.
2. **Une photo illisible n'arrête pas le parcours.** Un JPEG tronqué par un
   transfert interrompu, un HEIC sans le décodeur qui va avec : c'est consigné
   et enjambé. Sur deux mille photos, il y en a toujours une.
3. **L'écart passe par la quarantaine**, jamais par une suppression, et
   seulement si le journal laisse agir — c'est lui qui porte le mode simulation.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from pathlib import Path

from noyau import fichiers
from noyau.journal import Journal
from noyau.modele import ECARTER, Decision, Doublon, Fiche, Media

from . import regles, variantes

# Les seuls formats dont on tire une empreinte. Les RAW en sont absents à
# dessein : les décoder demande une bibliothèque de plus, et un RAW cohabite
# normalement avec son JPEG — les rapprocher listerait chaque photo comme le
# doublon d'elle-même.
EXTENSIONS_PHOTO = ("jpg", "jpeg", "png", "heic", "heif", "webp", "tiff", "bmp", "gif")


def calculer_empreintes(
    chemins: Iterable[Path],
    hachage: str = "phash",
    consigner: Callable[[Path, str], None] | None = None,
    nettetes: dict[Path, float] | None = None,
) -> list[Media]:
    """Ouvre chaque photo et en tire son empreinte perceptuelle.

    L'image est ouverte une seule fois : l'empreinte, la définition et le poids
    sortent du même passage. Deux passages sur un dossier de vacances, c'est
    deux fois la lecture du disque pour le même résultat.
    """
    import imagehash
    from PIL import Image, ImageFile

    try:  # Les HEIC des iPhone : Pillow ne les décode pas seul.
        import pillow_heif

        pillow_heif.register_heif_opener()
    except ImportError:
        pass

    # Un JPEG tronqué par un transfert interrompu se lit quand même : son
    # empreinte vaut celle de la partie lisible, ce qui est exactement ce qu'on
    # veut pour le rapprocher de l'original intact.
    ImageFile.LOAD_TRUNCATED_IMAGES = True

    fonction = _fonction_de_hachage(imagehash, hachage)
    medias: list[Media] = []
    for chemin in chemins:
        try:
            infos = chemin.stat()
            with Image.open(chemin) as image:
                largeur, hauteur = image.size
                empreinte = str(fonction(image))
                horodatage = _date_de_prise_de_vue(image) or infos.st_mtime
        except Exception as erreur:  # noqa: BLE001 — un dossier personnel contient tout
            if consigner:
                consigner(chemin, f"image illisible ({type(erreur).__name__})")
            continue
        medias.append(
            Media(
                chemin=chemin,
                poids_octets=infos.st_size,
                date_horodatage=horodatage,
                largeur=largeur,
                hauteur=hauteur,
                empreinte_perceptuelle=empreinte,
                # Reprise de la passe de netteté quand elle a eu lieu : sans
                # elle, le départage d'un groupe ne saurait pas laquelle des
                # deux copies est la version ratée.
                nettete=(nettetes or {}).get(chemin),
            )
        )
    return medias


def _fonction_de_hachage(imagehash, nom: str):
    """Le hachage demandé par `nettoyage_medias.doublons.hachage`.

    Trois familles, toutes en 64 bits pour rester comparables entre elles :
    `phash` (transformée en cosinus — le plus tolérant au recadrage et au
    réétalonnage, d'où le défaut), `dhash` (gradients, plus rapide) et `ahash`
    (moyenne, le plus grossier).
    """
    disponibles = {
        "phash": imagehash.phash,
        "dhash": imagehash.dhash,
        "ahash": imagehash.average_hash,
    }
    if nom not in disponibles:
        raise SystemExit(
            f"nettoyage_medias.doublons.hachage : « {nom} » inconnu "
            f"(attendu : {', '.join(disponibles)})"
        )
    return disponibles[nom]


def _date_de_prise_de_vue(image) -> float | None:
    """La date de déclenchement lue dans l'EXIF, ou rien.

    L'appelant se rabat alors sur la date de modification, qui n'est pas la date
    de la photo : une copie, une restauration de sauvegarde ou un envoi par
    messagerie la réécrivent. Comme c'est elle qui départage deux photos par
    ailleurs équivalentes, s'en contenter revient à mettre l'original en
    quarantaine et à garder la copie.
    """
    from datetime import datetime

    try:
        exif = image.getexif()
        # 36867 = DateTimeOriginal, dans le bloc Exif (0x8769) et non à la
        # racine — c'est la date du déclenchement. 306 = DateTime, à la racine,
        # celle du dernier enregistrement : un repli, pas un équivalent.
        for source, etiquette in ((exif.get_ifd(0x8769), 36867), (exif, 306)):
            valeur = source.get(etiquette)
            if valeur:
                return datetime.strptime(str(valeur), "%Y:%m:%d %H:%M:%S").timestamp()
    except Exception:  # noqa: BLE001 — un EXIF absent ou malformé est banal
        return None
    return None


def detecter(
    chemins: Iterable[Path],
    config: dict,
    distance_max: int,
    journal: Journal,
    nettetes: dict[Path, float] | None = None,
) -> tuple[list[Doublon], int]:
    """Les groupes de photos quasi-identiques parmi ces fichiers.

    Reçoit des chemins et non des dossiers : la passe de netteté les a déjà
    parcourus, et refaire le parcours relirait le disque pour retrouver les
    mêmes fichiers — moins ceux qu'elle vient d'écarter.

    Rend aussi le nombre de photos examinées : sans lui, une liste vide ne dit
    pas si tout est propre ou si aucun fichier n'a été lu.
    """
    reglages = config.get("nettoyage_medias", {}).get("doublons", {})

    medias = calculer_empreintes(
        chemins, reglages.get("hachage", "phash"),
        consigner=journal.incident, nettetes=nettetes,
    )
    doublons = regles.constituer_doublons(
        medias,
        distance_max,
        regles.criteres_de_departage(
            reglages.get("conserver", "meilleure_definition"),
            reglages.get("departager_par", ["nettete", "poids", "date_la_plus_ancienne"]),
        ),
        reglages.get("comparer_entre_dossiers", True),
    )
    return doublons, len(medias)


def ecarter(doublons: list[Doublon], quarantaine: Path, journal: Journal) -> int:
    """Déplace les surnuméraires en quarantaine. Rend les octets libérés.

    Celle qu'on garde n'est jamais touchée, et l'échec d'un déplacement
    n'interrompt pas les autres : une photo verrouillée par une visionneuse
    ouverte est un incident courant, pas une raison de laisser le dossier à
    moitié traité.
    """
    liberes = 0
    for doublon in doublons:
        for media in doublon.ecartes:
            motif = (
                f"quasi-doublon de {doublon.conserve.chemin} "
                f"(distance {regles.distance_de_hamming(doublon.conserve.empreinte_perceptuelle, media.empreinte_perceptuelle)})"
            )
            if journal.prevoir(f"quarantaine : {media.chemin} — {motif}"):
                try:
                    fichiers.mettre_en_quarantaine(media.chemin, quarantaine, motif)
                except OSError as erreur:
                    journal.incident(media.chemin, f"déplacement impossible ({erreur.strerror})")
                    continue
            liberes += media.poids_octets
    return liberes


# ──────────────────────────── La mesure de netteté ───────────────────────────

# Le laplacien se calcule sur une image réduite : au-delà, la variance suit la
# définition du capteur plutôt que la netteté, et un seuil fixe ne veut plus
# rien dire d'un appareil à l'autre. 1024 px de large est le compromis usuel.
LARGEUR_ANALYSE = 1024

# Le classifieur se construit une fois : le relire à chaque photo ajoutait une
# lecture de fichier XML par image, soit l'essentiel du temps sur un gros dossier.
_DETECTEUR = None
_DETECTEUR_CHERCHE = False


def _cv2():
    """OpenCV, importé au moment de servir — et un message clair s'il manque.

    En tête de fichier, cet import ferait payer trois secondes de démarrage à
    `organizer calendrier`, qui ne lit qu'un JSON.
    """
    try:
        import cv2  # noqa: PLC0415
    except ImportError:
        raise SystemExit(
            "OpenCV est absent : la détection de flou ne peut pas tourner.\n"
            "  pip install -r life-organizer/requirements.txt"
        )
    return cv2


def _detecteur_de_visages(cv2):
    """Le classifieur frontal de Haar, ou `None` si cet OpenCV ne le livre plus.

    OpenCV 5 a retiré `CascadeClassifier` des liaisons Python et
    `requirements.txt` accepte les deux branches : on le cherche donc au lieu de
    le supposer présent. La détection est grossière — elle ne voit pas un profil
    — et c'est acceptable, parce que son rôle est de **retenir** une photo,
    jamais d'en écarter une. Un visage manqué rend la photo à son seuil de
    netteté, il ne la condamne pas.
    """
    global _DETECTEUR, _DETECTEUR_CHERCHE
    if _DETECTEUR_CHERCHE:
        return _DETECTEUR
    _DETECTEUR_CHERCHE = True
    fabrique = getattr(cv2, "CascadeClassifier", None)
    if fabrique is None:
        return None
    cascade = fabrique(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    _DETECTEUR = None if cascade.empty() else cascade
    return _DETECTEUR


def detection_de_visages_disponible() -> bool:
    """Dit si le garde-fou « ne pas écarter un visage » peut réellement s'appliquer.

    La commande le demande **avant** d'analyser quoi que ce soit : découvrir
    après coup qu'une protection annoncée par la configuration n'a pas tourné,
    c'est l'apprendre une fois les photos déjà déplacées.
    """
    return _detecteur_de_visages(_cv2()) is not None


def mesurer_nettete(
    chemins: Iterable[Path],
    reglages: dict,
    consigner: Callable[[Path, str], None] | None = None,
) -> list[Media]:
    """Ouvre chaque photo une seule fois et en tire netteté et présence d'un visage.

    Une image illisible n'est pas une image floue : elle est consignée et
    enjambée, jamais jugée. C'est le même parti pris que `calculer_empreintes`.

    La date retenue est celle du fichier et non celle de l'EXIF, contrairement à
    la passe des doublons : ce que protège `ignorer_si_recente_jours`, c'est
    « je viens de l'importer et je ne l'ai pas encore regardée », pas « elle a
    été prise récemment ».
    """
    cv2 = _cv2()
    import numpy  # noqa: PLC0415

    chercher_visage = reglages.get("ignorer_si_visage_detecte", True)
    detecteur = _detecteur_de_visages(cv2) if chercher_visage else None

    medias: list[Media] = []
    for chemin in chemins:
        try:
            infos = chemin.stat()
            # `imdecode` sur les octets lus, et non `imread` : ce dernier échoue
            # en silence sur un chemin non ASCII sous Windows.
            donnees = numpy.fromfile(str(chemin), dtype=numpy.uint8)
            image = cv2.imdecode(donnees, cv2.IMREAD_COLOR) if donnees.size else None
        except OSError as erreur:
            if consigner:
                consigner(chemin, f"illisible ({erreur.strerror})")
            continue
        if image is None:
            if consigner:
                consigner(chemin, "image non décodable : laissée en place")
            continue

        hauteur, largeur = image.shape[:2]
        analyse = image
        if largeur > LARGEUR_ANALYSE:
            echelle = LARGEUR_ANALYSE / largeur
            analyse = cv2.resize(image, (LARGEUR_ANALYSE, max(1, int(hauteur * echelle))))

        gris = cv2.cvtColor(analyse, cv2.COLOR_BGR2GRAY)
        nettete = float(cv2.Laplacian(gris, cv2.CV_64F).var())

        visage = None
        if detecteur is not None:
            visage = len(detecteur.detectMultiScale(gris, scaleFactor=1.2, minNeighbors=5)) > 0

        medias.append(Media(
            chemin=chemin, poids_octets=infos.st_size, date_horodatage=infos.st_mtime,
            largeur=largeur, hauteur=hauteur, nettete=nettete, visage_detecte=visage,
        ))
    return medias


def ecarter_flous(decisions: list[Decision], quarantaine: Path, journal: Journal) -> int:
    """Déplace en quarantaine les photos jugées floues. Rend les octets libérés.

    L'échec d'un déplacement n'interrompt pas les autres : une photo verrouillée
    par une visionneuse ouverte est un incident courant, pas une raison de
    laisser le dossier à moitié traité.
    """
    liberes = 0
    for decision in decisions:
        if decision.geste != ECARTER:
            continue
        media = decision.media
        if journal.prevoir(f"quarantaine : {media.chemin} — {decision.motif}"):
            try:
                fichiers.mettre_en_quarantaine(media.chemin, quarantaine, decision.motif)
            except OSError as erreur:
                journal.incident(media.chemin, f"déplacement impossible ({erreur.strerror})")
                continue
        liberes += media.poids_octets
    return liberes


# ─────────────────────── Les redondances hors des images ─────────────────────

def relever_fiches(chemins: list[Path], exclusions: list[str],
                   journal: Journal | None = None) -> list[Fiche]:
    """Décrit chaque fichier sans l'ouvrir : chemin, poids, date de modification.

    La date est celle du système de fichiers, la seule disponible sans décoder.
    Elle ne sert ici qu'à départager deux copies, jamais à ranger — c'est
    `classement.source_de_la_date` qui décide de la date qui fait foi, et elle
    commence par l'EXIF pour de bonnes raisons.
    """
    releve: list[Fiche] = []
    # Nommé, et non positionnel : le deuxième paramètre de `parcourir` est
    # `extensions`, et l'y confondre filtre tout sans rien dire.
    for chemin in fichiers.parcourir(chemins, exclusions=exclusions,
                                     consigner=journal.incident if journal else None):
        try:
            etat = chemin.stat()
        except OSError:
            # Un lien qui boucle, un fichier disparu entre le parcours et ici :
            # on enjambe, un dossier réel en contient toujours.
            continue
        releve.append(Fiche(chemin=chemin, poids_octets=etat.st_size,
                            date_horodatage=etat.st_mtime))
    return releve


def empreintes_de_contenu(fiches: list[Fiche], journal: Journal) -> dict[Path, str]:
    """Hache le contenu des seuls fichiers qu'un homonyme rend suspects.

    Hacher tout un Drive coûterait des minutes pour rien : seuls les groupes de
    même nom de base peuvent conclure à une redondance, et un fichier sans
    homonyme n'a aucune chance d'en faire partie.
    """
    par_base: dict[str, list[Fiche]] = {}
    for fiche in fiches:
        par_base.setdefault(variantes.nom_de_base(fiche.chemin), []).append(fiche)

    empreintes: dict[Path, str] = {}
    for groupe in par_base.values():
        if len(groupe) < 2:
            continue
        for fiche in groupe:
            try:
                empreintes[fiche.chemin] = fichiers.empreinte(fiche.chemin)
            except OSError as erreur:
                journal.incident(fiche.chemin, f"lecture impossible ({erreur.strerror})")
    return empreintes


def ecarter_redondances(
    redondances: list[variantes.Redondance],
    quarantaine: Path,
    journal: Journal,
) -> int:
    """Met les variantes en quarantaine. L'original n'est jamais touché.

    Le motif voyage avec le fichier : un mois plus tard, « même contenu que
    rapport.pdf » explique la quarantaine, là où « doublon » laisserait devant
    une énigme.
    """
    liberes = 0
    deja_vues: set[Path] = set()
    for redondance in redondances:
        for fiche in redondance.variantes:
            # Un fichier peut être à la fois copie de nom et dérivé recalculable :
            # le déplacer deux fois échouerait la seconde, bruyamment et pour rien.
            if fiche.chemin in deja_vues:
                continue
            deja_vues.add(fiche.chemin)
            if journal.prevoir(f"quarantaine : {fiche.chemin} — {redondance.motif}"):
                try:
                    fichiers.mettre_en_quarantaine(fiche.chemin, quarantaine, redondance.motif)
                except OSError as erreur:
                    journal.incident(fiche.chemin, f"déplacement impossible ({erreur.strerror})")
                    continue
            liberes += fiche.poids_octets
    return liberes
