"""Mesurer les fichiers, les encoder, et ne remplacer qu'au vu du résultat.

Ce fichier ne décide de rien : les seuils, les objectifs et le verdict final sont
dans `regles.py`, vérifiables sans encoder un seul octet.

Quatre choses le structurent :

1. **On encode d'abord à côté, on remplace ensuite.** Le fichier produit va dans
   un temporaire caché, posé dans le dossier de destination — donc sur le même
   disque, sinon le déplacement final recopierait tout une seconde fois. Rien ne
   bouge tant que le gain n'est pas mesuré et le résultat relu. C'est ce que dit
   `conversion.conserver_original_jusqua_verification`, et c'est le seul ordre
   qui protège d'un encodage interrompu par un disque plein.

2. **L'original part en quarantaine, jamais à la corbeille** (README, décision 3).
   Une conversion est une perte de qualité définitive : la seule chose qui la
   rend rattrapable est que l'original existe encore quelque part.

3. **Pillow et ffmpeg s'invoquent dans le corps des fonctions** (décision 2).
   `organizer verifier` ne lit qu'un JSON et n'a aucune raison de payer leur
   chargement.

4. **Un fichier qui résiste n'arrête pas le lot.** Un HEIC sans son décodeur, un
   MKV que ffmpeg refuse, un dossier en lecture seule : c'est consigné et
   enjambé. Sur deux mille fichiers, il y en a toujours un.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

from noyau import fichiers, outils_externes
from noyau.journal import Journal

from . import regles

# Les codecs de sous-titres que le MP4 ne sait pas porter : ce sont des images,
# pas du texte. Voir `regles._refus` pour ce qu'on en fait — et pourquoi on ne
# les jette pas en silence.
SOUS_TITRES_IMAGE = frozenset({"hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle", "xsub"})

# Le nom du format que Pillow attend à l'écriture. Il ne le déduit de l'extension
# que pour les noms usuels, et « .jpg » n'en fait pas partie sur toutes les
# versions : le lui donner explicitement coûte une table de trois lignes et
# évite un échec qui n'arrive que chez l'utilisateur.
FORMATS_PILLOW = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP", "tiff": "TIFF"}

DELAI_SONDE_SECONDES = 30
# Un remuxage recopie les flux : il va à la vitesse du disque, et dix minutes
# suffisent au plus gros film. Un réencodage, lui, peut légitimement occuper une
# heure — `preset: slow` sur deux heures de vidéo n'a rien d'anormal. Ces délais
# ne sont donc pas un budget : ce sont des garde-fous contre un fichier
# pathologique qui occuperait la machine indéfiniment.
DELAI_REMUXAGE_SECONDES = 600
DELAI_REENCODAGE_SECONDES = 7200


@dataclass(frozen=True)
class Resultat:
    """Ce qu'il est advenu d'un fichier, et la phrase qui le dit."""

    conversion: regles.Conversion
    remplace: bool
    motif: str
    poids_obtenu: int = 0
    # Le chemin réellement écrit, `None` quand l'original a été gardé.
    ecrit: Path | None = None


def capacites(regles_conversion: list[dict]) -> tuple[set[str], list[str]]:
    """Les familles de règles qui peuvent tourner, et ce qui manque aux autres.

    Demandé **avant** d'ouvrir le premier fichier (piège 3 du domaine) : une
    commande doit pouvoir annoncer « les vidéos ne seront pas converties » au
    départ, pas s'interrompre au millième fichier — les neuf cent quatre-vingt-
    dix-neuf premiers seraient à refaire.
    """
    familles: set[str] = set()
    manques: list[str] = []

    photo = [regle for regle in regles_conversion if not regles.est_video(regle)]
    video = [regle for regle in regles_conversion if regles.est_video(regle)]

    if photo:
        if _pillow_disponible():
            familles.add("photo")
            if _regles_heic(photo) and not _heif_disponible():
                manques.append(
                    "Les HEIC ne seront pas convertis : le décodeur manque.\n"
                    "  pip install pillow-heif"
                )
        else:
            manques.append("Les photos ne seront pas converties : Pillow est absent.\n"
                           "  pip install Pillow")

    if video:
        if outils_externes.trouver_ffprobe() is None:
            manques.append("Les vidéos ne seront pas converties : "
                           + outils_externes.message_installation("ffprobe"))
        elif outils_externes.trouver_ffmpeg() is None:
            manques.append("Les vidéos ne seront pas converties : "
                           + outils_externes.message_installation("ffmpeg"))
        else:
            familles.add("video")

    return familles, manques


def _pillow_disponible() -> bool:
    try:
        import PIL  # noqa: F401, PLC0415 — décision 2 du README
    except ImportError:
        return False
    return True


def _heif_disponible() -> bool:
    try:
        import pillow_heif  # noqa: F401, PLC0415
    except ImportError:
        return False
    return True


def _regles_heic(regles_photo: list[dict]) -> bool:
    return any("heic" in {regles.normaliser(e) for e in regle.get("de", [])}
               for regle in regles_photo)


def mesurer(chemins: Iterable[Path], regles_conversion: list[dict],
            familles: set[str],
            consigner: Callable[[Path, str], None] | None = None) -> list[regles.Source]:
    """Ce qu'il faut savoir de chaque fichier pour décider de son sort.

    Les mesures coûteuses ne sont prises que si une règle les réclame : la
    transparence d'un PNG demande de décoder son canal alpha, soit une image
    entière en mémoire, et personne n'a besoin de ce chiffre pour un HEIC.
    """
    sources: list[regles.Source] = []
    for chemin in chemins:
        # Un encodage interrompu (coupure de courant, session tuée) laisse son
        # temporaire sur place. Le passage suivant le trouverait au parcours et
        # le convertirait comme un fichier de l'utilisateur — puis mettrait en
        # quarantaine un demi-fichier qui n'a jamais été à personne.
        if _est_temporaire(chemin):
            if consigner:
                consigner(chemin, "reste d'une conversion interrompue")
            continue
        regle = regles.regle_pour(chemin, regles_conversion)
        if regle is None:
            continue
        try:
            infos = chemin.stat()
        except OSError as erreur:
            if consigner:
                consigner(chemin, f"illisible ({erreur.strerror})")
            continue

        if regles.est_video(regle):
            if "video" not in familles:
                continue
            source = _mesurer_video(chemin, infos.st_size, consigner)
        else:
            if "photo" not in familles:
                continue
            source = _mesurer_photo(chemin, infos.st_size, regle)
        if source is not None:
            sources.append(source)
    return sources


def _mesurer_photo(chemin: Path, poids: int, regle: dict) -> regles.Source:
    """Format réel, définition, animation, et transparence si la règle la réclame."""
    from PIL import Image, UnidentifiedImageError  # noqa: PLC0415

    try:  # Les HEIC des iPhone : Pillow ne les décode pas seul.
        import pillow_heif  # noqa: PLC0415

        pillow_heif.register_heif_opener()
    except ImportError:
        pass

    try:
        with Image.open(chemin) as image:
            transparence = _transparence(image) if regle.get("si_sans_transparence") else None
            return regles.Source(
                chemin=chemin,
                poids_octets=poids,
                format_reel=regles.normaliser(image.format or ""),
                largeur=image.width,
                hauteur=image.height,
                transparence=transparence,
                images=int(getattr(image, "n_frames", 1) or 1),
            )
    except UnidentifiedImageError:
        return regles.Source(chemin=chemin, poids_octets=poids, lisible=False,
                             diagnostic="format non reconnu")
    except OSError as erreur:
        return regles.Source(chemin=chemin, poids_octets=poids, lisible=False,
                             diagnostic=str(erreur.strerror or erreur))
    except Exception as erreur:  # noqa: BLE001
        # Pillow lève une famille entière selon le format : fichier tronqué,
        # profil couleur exotique, décodeur absent. Aucune ne doit arrêter le lot.
        return regles.Source(chemin=chemin, poids_octets=poids, lisible=False,
                             diagnostic=f"{type(erreur).__name__}: {erreur}")


def _transparence(image) -> bool | None:
    """La transparence est-elle *utilisée* ? (voir décision 4 de `regles.py`)

    La moitié des captures d'écran sont en RGBA sans qu'un seul pixel ne soit
    transparent : répondre sur le mode de l'image reviendrait à refuser en bloc
    le gros du volume que `si_sans_transparence` protège. On regarde donc le
    canal, ce qui coûte de décoder l'image — et c'est pourquoi on ne le fait que
    lorsqu'une règle le demande.
    """
    if "A" not in image.getbands():
        # La palette d'un GIF ou d'un PNG 8 bits porte sa transparence ailleurs.
        return "transparency" in image.info
    try:
        minimum, _ = image.getchannel("A").getextrema()
    except (OSError, ValueError):
        return None
    return minimum < 255


def _mesurer_video(chemin: Path, poids: int,
                   consigner: Callable[[Path, str], None] | None) -> regles.Source | None:
    """Ce que ffprobe lit dans l'en-tête : codecs, définition, sous-titres."""
    import json  # noqa: PLC0415
    import subprocess  # noqa: PLC0415

    ffprobe = outils_externes.trouver_ffprobe()
    if ffprobe is None:
        return None

    try:
        sortie = subprocess.run(
            [str(ffprobe), "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", "--", str(chemin)],
            capture_output=True, text=True, timeout=DELAI_SONDE_SECONDES,
        )
    except subprocess.TimeoutExpired:
        if consigner:
            consigner(chemin, f"ffprobe n'a pas répondu en {DELAI_SONDE_SECONDES} s")
        return None
    except OSError as erreur:
        return regles.Source(chemin=chemin, poids_octets=poids, lisible=False,
                             diagnostic=f"ffprobe injoignable ({erreur.strerror})")

    if sortie.returncode != 0:
        return regles.Source(chemin=chemin, poids_octets=poids, lisible=False,
                             diagnostic=_premiere_ligne(sortie.stderr))
    try:
        donnees = json.loads(sortie.stdout or "{}")
    except json.JSONDecodeError:
        return regles.Source(chemin=chemin, poids_octets=poids, lisible=False,
                             diagnostic="ffprobe n'a rendu aucune description")

    flux = donnees.get("streams") or []
    # Une pochette d'album est un flux « video » d'une seule image : la compter
    # ferait passer un fichier sonore pour une vidéo, et le module tenterait de
    # réencoder une jaquette en H.264.
    images = [
        piste for piste in flux
        if piste.get("codec_type") == "video"
        and (piste.get("disposition") or {}).get("attached_pic") != 1
    ]
    sons = [piste for piste in flux if piste.get("codec_type") == "audio"]
    sous_titres_image = sum(
        1 for piste in flux
        if piste.get("codec_type") == "subtitle"
        and str(piste.get("codec_name", "")).lower() in SOUS_TITRES_IMAGE
    )

    return regles.Source(
        chemin=chemin,
        poids_octets=poids,
        format_reel="",
        lisible=bool(flux),
        diagnostic="" if flux else "aucun flux dans le conteneur",
        largeur=int(images[0].get("width") or 0) if images else 0,
        hauteur=int(images[0].get("height") or 0) if images else 0,
        codec_video=str(images[0].get("codec_name") or "") if images else "",
        codec_audio=str(sons[0].get("codec_name") or "") if sons else "",
        piste_video=bool(images),
        sous_titres_image=sous_titres_image,
    )


def convertir(conversions: list[regles.Conversion], config: dict, journal: Journal,
              quarantaine: Path | None,
              annoncer: Callable[[Resultat], None] | None = None) -> list[Resultat]:
    """Encode, mesure, puis remplace — ou garde l'original. Rend un résultat par fichier.

    Le journal décide seul s'il faut agir : en simulation, rien n'est encodé du
    tout. C'est un choix, et il se dit à l'utilisateur — le gain réel d'une
    conversion ne s'obtient qu'en la faisant, et réencoder une photothèque
    entière « pour voir » coûterait des heures de machine pour un chiffre qu'on
    jetterait aussitôt.

    `annoncer` reçoit chaque résultat dès qu'il est connu : un réencodage vidéo
    occupe la machine plusieurs minutes par fichier, et une commande muette
    pendant une heure ne se distingue pas d'une commande bloquée. La mise en
    forme reste à l'appelant — ce fichier ne sait pas à quoi ressemble un écran.
    """
    resultats: list[Resultat] = []

    def noter(resultat: Resultat) -> Resultat:
        resultats.append(resultat)
        if annoncer:
            annoncer(resultat)
        return resultat

    for conversion in conversions:
        if not conversion.a_convertir:
            continue
        source = conversion.source
        if not journal.prevoir(f"encoder pour mesurer : {source.chemin} → "
                               f"{conversion.destination} ({conversion.motif})"):
            resultats.append(Resultat(conversion, False, "à mesurer en appliquant"))
            continue

        temporaire = _temporaire(conversion.destination)
        echec = _encoder(conversion, temporaire)
        if echec:
            # Consigné comme « gardé » et non comme incident : pour l'utilisateur,
            # un fichier que l'encodeur refuse et un fichier dont le gain est
            # insuffisant ont exactement la même suite — l'original n'a pas
            # bougé. Les compter dans deux listes séparées faisait apparaître
            # deux fois le même fichier dans le compte rendu.
            _effacer(temporaire)
            journal.prevoir(f"garder l'original : {source.chemin} ({echec})")
            noter(Resultat(conversion, False, echec))
            continue

        poids = _poids(temporaire)
        retenu, motif = regles.verdict(conversion, poids, config)
        if retenu and not _relire(temporaire, regles.est_video(conversion.regle)):
            retenu, motif = False, "le fichier produit ne se relit pas : l'original est gardé"

        if not retenu:
            _effacer(temporaire)
            journal.prevoir(f"garder l'original : {source.chemin} ({motif})")
            noter(Resultat(conversion, False, motif, poids))
            continue

        try:
            ecrit = _placer(temporaire, conversion.destination)
        except OSError as erreur:
            _effacer(temporaire)
            journal.incident(source.chemin, f"écriture impossible ({erreur.strerror or erreur})")
            noter(Resultat(conversion, False, str(erreur.strerror or erreur), poids))
            continue

        journal.prevoir(f"remplacer : {source.chemin} → {ecrit} ({motif})")
        _ecarter_l_original(source.chemin, quarantaine, conversion.motif, journal)
        noter(Resultat(conversion, True, motif, poids, ecrit))
    return resultats


def _ecarter_l_original(chemin: Path, quarantaine: Path | None, motif: str,
                        journal: Journal) -> None:
    """L'original rejoint la quarantaine, une fois la copie en place et relue.

    Sans dossier de quarantaine configuré, il reste où il est : ce module ne
    supprime pas, et un original laissé à côté de sa conversion est un désordre
    réparable — l'inverse ne l'est pas.
    """
    if quarantaine is None:
        journal.incident(chemin, "conservé sur place : aucun dossier de quarantaine configuré")
        return
    try:
        fichiers.mettre_en_quarantaine(chemin, quarantaine, f"converti — {motif}")
    except OSError as erreur:
        journal.incident(chemin, f"quarantaine impossible ({erreur.strerror or erreur})")


def _encoder(conversion: regles.Conversion, temporaire: Path) -> str:
    """Écrit le fichier converti. Rend une chaîne vide si tout s'est bien passé."""
    try:
        temporaire.parent.mkdir(parents=True, exist_ok=True)
    except OSError as erreur:
        return f"dossier de destination inaccessible ({erreur.strerror or erreur})"
    if regles.est_video(conversion.regle):
        return _encoder_video(conversion, temporaire)
    return _encoder_photo(conversion, temporaire)


def _encoder_photo(conversion: regles.Conversion, temporaire: Path) -> str:
    from PIL import Image  # noqa: PLC0415

    try:
        import pillow_heif  # noqa: PLC0415

        pillow_heif.register_heif_opener()
    except ImportError:
        pass

    regle = conversion.regle
    vers = regles.normaliser(regle.get("vers", ""))
    try:
        with Image.open(conversion.source.chemin) as image:
            image.load()
            exif = image.info.get("exif") if regle.get("conserver_exif") else None
            if conversion.redimensionner:
                image = image.resize(conversion.redimensionner, Image.LANCZOS)

            options: dict = {}
            if vers in ("jpg", "jpeg"):
                # Le JPEG ne porte ni canal alpha ni palette. La conversion est
                # sûre ici : les images réellement transparentes ont été écartées
                # par `regles._refus`, celles qui arrivent jusqu'ici ne perdent
                # qu'un canal entièrement opaque.
                image = image.convert("RGB")
                options = {"quality": int(regle.get("qualite", 88)),
                           "optimize": True, "progressive": True}
                if exif:
                    options["exif"] = exif
            image.save(temporaire, format=FORMATS_PILLOW.get(vers), **options)
    except OSError as erreur:
        return f"encodage impossible ({erreur.strerror or erreur})"
    except Exception as erreur:  # noqa: BLE001 — voir `_mesurer_photo`
        return f"encodage impossible ({type(erreur).__name__}: {erreur})"
    return ""


def _encoder_video(conversion: regles.Conversion, temporaire: Path) -> str:
    import subprocess  # noqa: PLC0415

    ffmpeg = outils_externes.trouver_ffmpeg()
    if ffmpeg is None:
        return "ffmpeg est absent"

    regle = conversion.regle
    # `-nostdin` : sans lui, ffmpeg consomme l'entrée du terminal et la commande
    # se retrouve muette après le premier fichier.
    arguments = [str(ffmpeg), "-nostdin", "-v", "error", "-y",
                 "-i", str(conversion.source.chemin)]
    # Les flux sont nommés un par un : « -map 0 » emporterait aussi les polices
    # attachées d'un MKV, que le MP4 ne sait pas porter — et ffmpeg échouerait
    # après avoir travaillé, pas avant.
    arguments += ["-map", "0:v", "-map", "0:a?", "-map", "0:s?"]

    if conversion.remuxer:
        arguments += ["-c", "copy"]
    else:
        arguments += ["-c:v", str(regle.get("codec_video", "libx264")),
                      "-crf", str(regle.get("crf", 21)),
                      "-preset", str(regle.get("preset", "slow")),
                      "-c:a", str(regle.get("codec_audio", "aac")),
                      "-b:a", str(regle.get("debit_audio", "160k"))]
        if conversion.redimensionner:
            largeur, hauteur = conversion.redimensionner
            arguments += ["-vf", f"scale={largeur}:{hauteur}"]

    # Les sous-titres texte deviennent du `mov_text`, seul format que le MP4
    # accepte. Les sous-titres image, eux, ont fait refuser le fichier bien plus
    # tôt (`regles._refus`) : les perdre en silence serait pire que ne rien faire.
    arguments += ["-c:s", "mov_text"]
    if regle.get("conserver_metadonnees", True):
        arguments += ["-map_metadata", "0"]
    # L'index en tête du fichier : c'est ce qui permet de commencer à lire une
    # vidéo avant de l'avoir entièrement chargée.
    arguments += ["-movflags", "+faststart", str(temporaire)]

    delai = DELAI_REMUXAGE_SECONDES if conversion.remuxer else DELAI_REENCODAGE_SECONDES
    try:
        sortie = subprocess.run(arguments, capture_output=True, text=True, timeout=delai)
    except subprocess.TimeoutExpired:
        return f"encodage interrompu après {delai} s"
    except OSError as erreur:
        return f"ffmpeg injoignable ({erreur.strerror})"
    if sortie.returncode != 0:
        return _premiere_ligne(sortie.stderr) or f"ffmpeg a rendu le code {sortie.returncode}"

    # Mesuré sur un dossier d'essai : une vidéo tronquée se remuxe **sans
    # erreur**. ffmpeg recopie ce qu'il trouve, écrit « File ended prematurely »
    # sur sa sortie d'erreur et rend malgré tout le code 0 ; le MP4 produit est
    # aussi abîmé que son original, mais il a l'air neuf. Sans ce contrôle, la
    # conversion blanchit un fichier mort et met le seul exemplaire d'origine en
    # quarantaine — où il sera purgé au bout de trente jours.
    # Un encodage sain n'écrit rien du tout à ce niveau de verbosité.
    plainte = _premiere_ligne(sortie.stderr)
    if plainte:
        return (f"entrée abîmée ({plainte}) : la convertir ne la réparerait pas — "
                "passer « organizer nettoyer » d'abord")
    return ""


def _relire(chemin: Path, est_video: bool) -> bool:
    """Le fichier produit s'ouvre-t-il vraiment ?

    Le pendant de `securite.verifier_empreinte_apres_deplacement` : une copie se
    vérifie par son empreinte, un encodage ne le peut pas — il n'y a rien à quoi
    le comparer. Ce qu'on peut vérifier, c'est qu'il se relit. Un encodage
    interrompu par un disque plein produit un fichier d'apparence normale, plus
    petit que l'original, et que le seuil de gain accueillerait à bras ouverts.
    """
    if est_video:
        return _relire_video(chemin)
    try:
        from PIL import Image  # noqa: PLC0415

        with Image.open(chemin) as image:
            image.load()
        return True
    except Exception:  # noqa: BLE001
        return False


def _relire_video(chemin: Path) -> bool:
    import subprocess  # noqa: PLC0415

    ffprobe = outils_externes.trouver_ffprobe()
    if ffprobe is None:
        return True
    try:
        sortie = subprocess.run(
            [str(ffprobe), "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=codec_name", "-of", "csv=p=0", "--", str(chemin)],
            capture_output=True, text=True, timeout=DELAI_SONDE_SECONDES,
        )
    except (subprocess.TimeoutExpired, OSError):
        return False
    return sortie.returncode == 0 and bool(sortie.stdout.strip())


# Ce qui distingue un fichier de travail d'un fichier de l'utilisateur. Le point
# de tête le cache déjà sur les systèmes de type Unix ; ce marqueur-ci le nomme,
# ce qui vaut mieux qu'un fichier caché dont plus personne ne sait d'où il vient.
MARQUEUR_TEMPORAIRE = ".en-cours"


def _est_temporaire(chemin: Path) -> bool:
    return chemin.name.startswith(".") and MARQUEUR_TEMPORAIRE in chemin.name


def _temporaire(destination: Path) -> Path:
    """Un nom de travail, caché, à côté de la destination et sur le même disque.

    L'extension est celle du fichier visé : ffmpeg comme Pillow choisissent leur
    conteneur d'après elle, et un temporaire sans extension leur ferait écrire
    du Matroska dans un fichier annoncé MP4.
    """
    return destination.with_name(
        f".{destination.stem}{MARQUEUR_TEMPORAIRE}{destination.suffix}")


def _placer(temporaire: Path, destination: Path) -> Path:
    """Donne au temporaire son nom définitif, sans jamais écraser un voisin."""
    final = fichiers.nom_disponible(destination)
    temporaire.rename(final)
    return final


def _effacer(chemin: Path) -> None:
    """Le seul effacement du module, et il ne porte que sur notre propre temporaire."""
    try:
        chemin.unlink(missing_ok=True)
    except OSError:
        pass


def _poids(chemin: Path) -> int:
    try:
        return chemin.stat().st_size
    except OSError:
        return 0


def _premiere_ligne(texte: str) -> str:
    """La première ligne utile de ce qu'a dit l'outil, sans son préfixe technique."""
    import re  # noqa: PLC0415

    for ligne in (texte or "").splitlines():
        ligne = re.sub(r"^\[[^\]]*@\s*0x[0-9a-f]+\]\s*", "", ligne.strip())
        if ligne:
            return ligne
    return ""
