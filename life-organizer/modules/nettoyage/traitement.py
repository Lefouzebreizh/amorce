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

import re
from collections.abc import Callable, Iterable
from pathlib import Path

from noyau import fichiers, outils_externes
from noyau.journal import Journal
from noyau.modele import ECARTER, Decision, Doublon, Fiche, Media, Video

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


def ecarter_decidees(decisions: list[Decision], quarantaine: Path, journal: Journal) -> int:
    """Déplace en quarantaine ce que les décisions écartent. Rend les octets libérés.

    Photos floues ou vidéos abîmées : le geste ne regarde que le chemin et le
    motif, et les deux passes le posent à l'identique.

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


# ────────────────────────── L'intégrité des vidéos ───────────────────────────
#
# Les vidéos ne passent ni par la netteté ni par les doublons : un film n'a pas
# de variance du laplacien qui veuille dire quelque chose, et deux plans du même
# lieu ne sont pas deux fichiers en trop. Ce qu'on cherche ici est autre chose —
# le fichier qui ne s'ouvrira plus le jour où on voudra le revoir.

# Les conteneurs qu'on inspecte. Volontairement larges : un fichier abîmé est
# souvent un fichier dont on ne se sert plus, donc dans un format ancien.
EXTENSIONS_VIDEO = (
    "mp4", "mov", "m4v", "avi", "mkv", "webm", "mpg", "mpeg",
    "wmv", "3gp", "mts", "m2ts", "ts", "flv", "ogv",
)

# Le décodage ne porte que sur la fin du fichier. C'est là qu'est la coupure
# d'un transfert interrompu, d'une carte mémoire retirée trop tôt ou d'une
# copie sur un disque plein — et décoder l'intégralité coûterait plusieurs
# minutes par gigaoctet pour le même constat. Ce que cela ne voit pas est dit
# dans le README : une corruption au milieu d'un fichier par ailleurs complet.
SECONDES_DE_FIN_DECODEES = 3

# Un fichier pathologique peut occuper ffmpeg indéfiniment. Passé ce délai on
# renonce à le juger — et on ne l'écarte pas : une mesure qui n'a pas abouti
# n'est pas une mesure mauvaise, c'est le même parti pris que `nettete = None`.
DELAI_SONDE_SECONDES = 30
DELAI_DECODAGE_SECONDES = 120


def inspecter_videos(
    chemins: Iterable[Path],
    consigner: Callable[[Path, str], None] | None = None,
) -> list[Video]:
    """Ouvre chaque vidéo par ffprobe, puis décode sa fin par ffmpeg.

    Deux passages parce qu'ils ne trouvent pas la même chose : ffprobe lit
    l'en-tête et repère le conteneur mort, le fichier sans image, la durée
    aberrante — en quelques millisecondes. Il ne voit pas le fichier tronqué,
    dont l'en-tête est intact et continue d'annoncer la durée d'origine ; seul
    un décodage réel le révèle, et il suffit d'en décoder la fin.

    Sans ffprobe, la fonction ne rend rien : l'appelant l'a déjà annoncé
    (`integrite_disponible`) et n'aurait pas dû arriver ici.
    """
    import subprocess  # noqa: PLC0415 — décision 2 du README

    ffprobe = outils_externes.trouver_ffprobe()
    if ffprobe is None:
        return []
    ffmpeg = outils_externes.trouver_ffmpeg()

    videos: list[Video] = []
    for chemin in chemins:
        try:
            infos = chemin.stat()
        except OSError as erreur:
            if consigner:
                consigner(chemin, f"illisible ({erreur.strerror})")
            continue

        sonde = _sonder(subprocess, ffprobe, chemin)
        if sonde is None:
            if consigner:
                consigner(chemin, f"ffprobe n'a pas répondu en {DELAI_SONDE_SECONDES} s")
            continue

        erreur_de_fin = None
        # Rien à décoder si le conteneur est déjà mort, et rien à quoi se fier
        # si la durée est inconnue : `-sseof` ne sait pas d'où reculer, et son
        # échec ressemblerait à une corruption.
        if sonde.lisible and sonde.duree_secondes is not None and ffmpeg is not None:
            erreur_de_fin = _decoder_la_fin(subprocess, ffmpeg, chemin, consigner)

        videos.append(Video(
            chemin=chemin,
            poids_octets=infos.st_size,
            date_horodatage=infos.st_mtime,
            lisible=sonde.lisible,
            diagnostic=sonde.diagnostic,
            duree_secondes=sonde.duree_secondes,
            largeur=sonde.largeur,
            hauteur=sonde.hauteur,
            piste_video=sonde.piste_video,
            erreur_de_fin=erreur_de_fin,
        ))
    return videos


def _sonder(subprocess, ffprobe: Path, chemin: Path) -> Video | None:
    """Ce que l'en-tête déclare. `None` si ffprobe n'a pas rendu la main à temps.

    Le résultat voyage dans un `Video` de travail : ses champs sont exactement
    ceux que l'inspection produit, et en fabriquer un second type pour les mêmes
    six valeurs n'apprendrait rien de plus à personne.
    """
    import json  # noqa: PLC0415

    try:
        sortie = subprocess.run(
            [str(ffprobe), "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", "--", str(chemin)],
            capture_output=True, text=True, timeout=DELAI_SONDE_SECONDES,
        )
    except subprocess.TimeoutExpired:
        return None
    except OSError as erreur:
        return Video(chemin=chemin, poids_octets=0, date_horodatage=0.0,
                     lisible=False, diagnostic=f"ffprobe injoignable ({erreur.strerror})")

    if sortie.returncode != 0:
        return Video(chemin=chemin, poids_octets=0, date_horodatage=0.0,
                     lisible=False, diagnostic=_premiere_ligne(sortie.stderr))

    try:
        donnees = json.loads(sortie.stdout or "{}")
    except json.JSONDecodeError:
        return Video(chemin=chemin, poids_octets=0, date_horodatage=0.0,
                     lisible=False, diagnostic="ffprobe n'a rendu aucune description")

    flux = donnees.get("streams") or []
    # Une pochette d'album est un flux « video » d'une seule image : la compter
    # ferait passer un enregistrement sonore pour une vidéo, et le signalement
    # « aucune piste vidéo » ne se déclencherait jamais sur les fichiers qu'il
    # vise précisément.
    images = [
        piste for piste in flux
        if piste.get("codec_type") == "video"
        and (piste.get("disposition") or {}).get("attached_pic") != 1
    ]

    duree = _nombre(donnees.get("format", {}).get("duration"))
    if duree is None and images:
        # Un MKV n'annonce sa durée que sur ses flux : l'absence au niveau du
        # conteneur ne veut pas dire que personne ne la connaît.
        duree = _nombre(images[0].get("duration"))

    return Video(
        chemin=chemin, poids_octets=0, date_horodatage=0.0,
        lisible=bool(flux),
        diagnostic="" if flux else "aucun flux dans le conteneur",
        duree_secondes=duree,
        largeur=int(images[0].get("width") or 0) if images else 0,
        hauteur=int(images[0].get("height") or 0) if images else 0,
        piste_video=bool(images),
    )


def _decoder_la_fin(
    subprocess, ffmpeg: Path, chemin: Path,
    consigner: Callable[[Path, str], None] | None,
) -> str | None:
    """La première erreur rencontrée en décodant la fin du fichier, ou rien.

    `-sseof` recule depuis la fin, ce qui évite de traverser tout le fichier
    pour atteindre l'endroit où la coupure se trouve. Un dépassement de délai
    n'est pas une corruption : il est consigné et la vidéo n'est pas jugée
    dessus.
    """
    try:
        sortie = subprocess.run(
            [str(ffmpeg), "-v", "error", "-sseof", f"-{SECONDES_DE_FIN_DECODEES}",
             "-i", str(chemin), "-f", "null", "-"],
            capture_output=True, text=True, timeout=DELAI_DECODAGE_SECONDES,
        )
    except subprocess.TimeoutExpired:
        if consigner:
            consigner(chemin, f"décodage interrompu après {DELAI_DECODAGE_SECONDES} s")
        return None
    except OSError as erreur:
        if consigner:
            consigner(chemin, f"ffmpeg injoignable ({erreur.strerror})")
        return None

    if sortie.returncode == 0 and not sortie.stderr.strip():
        return None
    return _premiere_ligne(sortie.stderr) or f"ffmpeg a rendu le code {sortie.returncode}"


# ffmpeg préfixe ses erreurs du composant et de son adresse mémoire :
# « [NULL @ 0x55cc278aef80] Invalid NAL unit size ». L'adresse change à chaque
# exécution — la garder ferait porter au même fichier un motif différent à
# chaque passage, et rendrait deux quarantaines incomparables.
_PREFIXE_FFMPEG = re.compile(r"^\[[^\]]*@\s*0x[0-9a-f]+\]\s*")


def _premiere_ligne(texte: str) -> str:
    """La première ligne utile de ce qu'a dit l'outil, sans son préfixe technique.

    Une seule ligne : ffmpeg répète la même erreur une fois par image abîmée, et
    déverser deux cents lignes identiques dans un motif de quarantaine rendrait
    le manifeste illisible.
    """
    for ligne in (texte or "").splitlines():
        ligne = _PREFIXE_FFMPEG.sub("", ligne.strip())
        if ligne:
            return ligne
    return ""


def _nombre(valeur: object) -> float | None:
    """Un flottant, ou `None` — ffprobe écrit « N/A » quand il ne sait pas."""
    try:
        nombre = float(str(valeur))
    except (TypeError, ValueError):
        return None
    return nombre if nombre == nombre and nombre >= 0 else None


def integrite_disponible() -> tuple[bool, str]:
    """Dit si la passe vidéo peut tourner, et ce qu'il manque sinon.

    Demandé **avant** d'inspecter quoi que ce soit : découvrir après coup qu'une
    passe annoncée par la configuration n'a pas tourné, c'est croire un dossier
    contrôlé alors qu'il ne l'a pas été.
    """
    if outils_externes.trouver_ffprobe() is None:
        return False, outils_externes.message_installation("ffprobe")
    if outils_externes.trouver_ffmpeg() is None:
        return True, (
            "L'en-tête des vidéos sera lu, mais leur fin ne sera pas décodée : "
            "un fichier tronqué passera inaperçu.\n"
            + outils_externes.message_installation("ffmpeg")
        )
    return True, ""


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

