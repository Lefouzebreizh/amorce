"""Décider si un fichier vaut d'être converti, vers quoi, et si le résultat mérite
de remplacer l'original.

Sept décisions tiennent ce fichier :

1. **Deux objectifs, et donc deux seuils.** Une règle « espace » (PNG → JPG) ne
   convertit que si elle fait maigrir le fichier ; une règle « compatibilité »
   (HEIC → JPG, MKV → MP4) convertit même quand elle le fait grossir, parce que
   ce qu'elle achète n'est pas de la place mais un fichier qui s'ouvre ailleurs.
   Le distinguo n'est pas théorique : un HEIC d'iPhone repassé en JPEG **grossit
   presque toujours**, souvent du simple au double. Un seuil de gain unique
   n'aurait donc jamais laissé passer une seule photo d'iPhone — c'est-à-dire
   précisément ce que ce module existe pour faire.

2. **Le remuxage passe avant le réencodage.** Un MKV qui porte déjà du H.264 et
   de l'AAC devient un MP4 en recopiant ses flux tels quels : quelques secondes
   au lieu de plusieurs minutes, et pas une image retouchée. Son gain d'espace
   est nul par construction — deuxième raison pour laquelle la règle vidéo est
   une règle de compatibilité et non d'espace.

3. **L'extension ne décide pas seule** (piège 4 du domaine : un `.HEIC` qui est
   un PNG déguisé). C'est le format reconnu par le décodeur qui fait foi, et
   quand il est déjà celui visé, on ne convertit pas : recompresser un JPEG en
   JPEG lui coûte une génération de qualité pour zéro octet gagné.

4. **La transparence se mesure, elle ne se déduit pas du mode de l'image.** La
   moitié des captures d'écran sont en RGBA sans qu'un seul pixel ne soit
   transparent ; les refuser sur leur mode reviendrait à écarter le gros du
   volume que `si_sans_transparence` était censé protéger. Et une transparence
   *non mesurée* n'est pas une transparence absente : dans le doute on garde
   l'original, comme `nettete = None` ne vaut pas « nette ».

5. **Les dimensions réduites sont paires.** libx264 refuse une largeur ou une
   hauteur impaire, et l'échec arrive après le temps de réencodage, pas avant.

6. **Un sous-titre image fait renoncer au fichier entier.** Le MP4 porte du
   texte, pas les images d'un PGS ou d'un VobSub : les emporter est impossible,
   et les laisser tomber en silence retirerait ses sous-titres à un film sans
   que rien ne le dise. Le fichier reste donc dans son conteneur d'origine, et
   le compte rendu explique lequel et pourquoi.

7. **On ne remonte jamais une définition.** `largeur_max_photo` et
   `hauteur_max_video` sont des plafonds : un fichier en dessous les traverse
   sans être touché. Agrandir est le travail du module 5, avec son modèle et son
   « à côté de l'original, jamais à la place ».

Rien n'est ouvert ici : ce fichier ne juge que ce que `traitement.py` a mesuré.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Ce qu'une règle achète. `espace` doit rendre des octets pour être appliquée,
# `compatibilite` doit seulement ne pas en coûter de façon déraisonnable.
OBJECTIF_ESPACE = "espace"
OBJECTIF_COMPATIBILITE = "compatibilite"
OBJECTIFS = (OBJECTIF_ESPACE, OBJECTIF_COMPATIBILITE)

# Comment on sait qu'une règle parle de photos ou de vidéos : par son format de
# sortie, et non par ses extensions d'entrée. `de` se remplit à la main dans la
# configuration et finira par contenir une extension à laquelle personne n'avait
# pensé ; `vers` est le format qu'on écrit, il est donc toujours connu.
FORMATS_PHOTO = frozenset({"jpg", "jpeg", "png", "webp", "tiff", "tif"})
FORMATS_VIDEO = frozenset({"mp4", "mkv", "webm", "mov"})

# Deux noms pour le même format. Sans cette table, un JPEG que le décodeur nomme
# « jpeg » n'aurait jamais l'air d'être déjà au format « jpg » visé, et chaque
# passage le recompresserait une fois de plus.
SYNONYMES = {"jpeg": "jpg", "tif": "tiff", "heif": "heic"}

# Ce qu'un conteneur MP4 accepte sans réencodage. La liste est volontairement
# courte : y ajouter un codec au jugé fait produire un MP4 que rien ne lit, et
# le défaut ne se voit qu'à la lecture, longtemps après la mise en quarantaine
# de l'original.
CODECS_VIDEO_MP4 = frozenset({"h264", "hevc", "mpeg4", "av1"})
CODECS_AUDIO_MP4 = frozenset({"aac", "mp3", "ac3", "alac"})


@dataclass(frozen=True)
class Source:
    """Ce qu'on sait d'un fichier avant de décider s'il vaut d'être converti.

    Un seul type pour les photos et les vidéos, là où le nettoyage sépare
    `Media` et `Video` : là-bas, donner une empreinte perceptuelle vide à une
    vidéo l'aurait fait entrer dans le regroupement des doublons, qui l'aurait
    crue identique à toutes les autres. Ici la décision est une seule fonction,
    et c'est la règle appliquée qui dit lesquels de ces champs comptent — deux
    types imposeraient d'écrire `decider` deux fois.

    Les champs non renseignés valent `None` et non une valeur neutre : « pas
    mesuré » et « mesuré à zéro » n'appellent pas la même prudence.
    """

    chemin: Path
    poids_octets: int
    # Ce que le décodeur a reconnu, en minuscules et sans point — pas l'extension.
    format_reel: str = ""
    lisible: bool = True
    # Ce que l'outil a dit quand il a refusé le fichier, repris tel quel dans le
    # motif : « illisible » seul n'apprend rien à qui doit décider quoi en faire.
    diagnostic: str = ""
    largeur: int = 0
    hauteur: int = 0
    # `None` = la transparence n'a pas été cherchée (voir décision 4).
    transparence: bool | None = None
    # Nombre d'images du fichier : au-delà de 1, il est animé.
    images: int = 1
    codec_video: str = ""
    codec_audio: str = ""
    piste_video: bool = True
    # Nombre de pistes de sous-titres *image* (PGS, VobSub…). Comptées à part
    # des sous-titres texte parce que le MP4 sait porter les seconds et pas les
    # premiers — voir la décision 7.
    sous_titres_image: int = 0


@dataclass(frozen=True)
class Conversion:
    """Ce qu'on fera d'un fichier, et pourquoi.

    `destination` à `None` veut dire « ne pas y toucher », comme le `Rangement`
    du classement : le motif dit lequel des refus, parce qu'ils n'appellent pas
    les mêmes suites — une transparence conservée est un succès du garde-fou,
    une extension inconnue est une ligne à ajouter à la configuration.
    """

    source: Source
    destination: Path | None
    regle: dict | None = None
    motif: str = ""
    # `(largeur, hauteur)` quand le fichier dépasse un plafond, `None` sinon.
    redimensionner: tuple[int, int] | None = None
    # Recopier les flux au lieu de les réencoder (décision 2).
    remuxer: bool = False

    @property
    def a_convertir(self) -> bool:
        return self.destination is not None

    @property
    def objectif(self) -> str:
        return objectif_de(self.regle) if self.regle else OBJECTIF_ESPACE


def normaliser(format_ou_extension: str) -> str:
    """« .JPEG » et « jpg » désignent le même format : les deux rendent « jpg »."""
    nom = str(format_ou_extension or "").lower().lstrip(".")
    return SYNONYMES.get(nom, nom)


def objectif_de(regle: dict) -> str:
    """L'objectif déclaré par la règle. Par défaut : l'espace.

    Le défaut est le plus exigeant des deux — une règle dont l'objectif a été
    oublié ne convertira que si elle fait gagner de la place. L'inverse
    laisserait une règle mal remplie remplacer des fichiers pour rien.
    """
    objectif = str(regle.get("objectif", OBJECTIF_ESPACE)).lower()
    return objectif if objectif in OBJECTIFS else OBJECTIF_ESPACE


def regle_pour(chemin: Path, regles: list[dict]) -> dict | None:
    """La première règle qui réclame cette extension, ou `None`.

    La première et non la meilleure : l'ordre de la liste est un ordre de
    priorité que l'utilisateur maîtrise, comme les thèmes du classement.
    """
    extension = normaliser(chemin.suffix)
    for regle in regles:
        if extension in {normaliser(entree) for entree in regle.get("de", [])}:
            return regle
    return None


def extensions_traitees(regles: list[dict]) -> tuple[str, ...]:
    """Toutes les extensions que ces règles savent convertir, sans doublon.

    C'est ce qui filtre le parcours : contrairement au classement, un fichier
    sans règle n'a rien à apprendre à personne ici — il n'y a pas de « à ajouter
    à la configuration » à en tirer, seulement le temps de l'ouvrir pour rien.
    """
    vues: list[str] = []
    for regle in regles:
        for entree in regle.get("de", []):
            extension = normaliser(entree)
            if extension and extension not in vues:
                vues.append(extension)
    return tuple(vues)


def est_video(regle: dict) -> bool:
    """La règle produit-elle une vidéo ? (voir FORMATS_VIDEO)"""
    return normaliser(regle.get("vers", "")) in FORMATS_VIDEO


def remuxable(codec_video: str, codec_audio: str, vers: str) -> bool:
    """Les flux peuvent-ils être recopiés tels quels dans le conteneur visé ?

    Une piste audio absente ne l'interdit pas : une vidéo muette se remuxe très
    bien. Un codec inconnu, si — c'est le seul cas où l'on préfère réencoder
    quelques minutes plutôt que produire un fichier que rien ne lira.
    """
    if normaliser(vers) != "mp4":
        return False
    if codec_video.lower() not in CODECS_VIDEO_MP4:
        return False
    return not codec_audio or codec_audio.lower() in CODECS_AUDIO_MP4


def dimensions_cibles(largeur: int, hauteur: int,
                      largeur_max: int | None = None,
                      hauteur_max: int | None = None) -> tuple[int, int] | None:
    """La définition à viser, ou `None` s'il n'y a rien à réduire.

    Le rapport de forme est conservé — réduire la seule dimension qui dépasse
    déformerait l'image — et les deux côtés sont ramenés à un nombre pair, que
    libx264 exige et dont l'absence ne se découvre qu'après le réencodage.
    """
    if largeur <= 0 or hauteur <= 0:
        return None
    facteur = 1.0
    if largeur_max and largeur > largeur_max:
        facteur = min(facteur, largeur_max / largeur)
    if hauteur_max and hauteur > hauteur_max:
        facteur = min(facteur, hauteur_max / hauteur)
    if facteur >= 1.0:
        return None
    return _pair(round(largeur * facteur)), _pair(round(hauteur * facteur))


def _pair(cote: int) -> int:
    return max(2, cote - cote % 2)


def decider(source: Source, config: dict) -> Conversion:
    """Ce qu'il faut faire de ce fichier. Pure : ni disque, ni décodage.

    Tous les refus sont rendus comme une `Conversion` sans destination, jamais
    comme une exception : sur deux mille fichiers, un refus est un événement
    ordinaire, et il doit se compter et s'afficher comme les autres.
    """
    reglages = config.get("conversion", {})
    regle = regle_pour(source.chemin, reglages.get("regles", []))
    if regle is None:
        return Conversion(source, None, motif="aucune règle pour cette extension")

    vers = normaliser(regle.get("vers", ""))
    if not vers:
        return Conversion(source, None, regle, "règle sans format de sortie « vers »")

    refus = _refus(source, regle, vers)
    if refus:
        return Conversion(source, None, regle, refus)

    if est_video(regle):
        cible = dimensions_cibles(source.largeur, source.hauteur,
                                  hauteur_max=reglages.get("hauteur_max_video"))
        # Recopier les flux et les redimensionner s'excluent : réduire une image
        # suppose de la décoder puis de la réencoder. Le plafond l'emporte, parce
        # que c'est un réglage que l'utilisateur a posé exprès.
        remux = bool(regle.get("remuxer_si_compatible", True)) and cible is None \
            and remuxable(source.codec_video, source.codec_audio, vers)
    else:
        cible = dimensions_cibles(source.largeur, source.hauteur,
                                  largeur_max=reglages.get("largeur_max_photo"))
        remux = False

    return Conversion(
        source=source,
        destination=source.chemin.with_suffix(f".{vers}"),
        regle=regle,
        motif=_motif(source, vers, cible, remux, objectif_de(regle)),
        redimensionner=cible,
        remuxer=remux,
    )


def _refus(source: Source, regle: dict, vers: str) -> str:
    """La raison de ne pas convertir ce fichier, ou une chaîne vide."""
    if not source.lisible:
        return f"illisible : {source.diagnostic}" if source.diagnostic else "illisible"

    depuis = normaliser(source.chemin.suffix)
    if depuis == vers:
        return f"déjà en {vers}"

    # Piège 4 du domaine : le `.HEIC` qui est un PNG déguisé. C'est le décodeur
    # qui a raison, pas le nom du fichier.
    if source.format_reel and normaliser(source.format_reel) == vers:
        return (f"déjà en {vers} malgré son extension « {depuis} » : "
                "le convertir le recompresserait une seconde fois")

    if source.images > 1:
        return f"animé ({source.images} images) : la conversion ne garderait que la première"

    if regle.get("si_sans_transparence"):
        if source.transparence is None:
            return "transparence non mesurée : l'original est gardé par prudence"
        if source.transparence:
            return "transparence utilisée : le JPEG l'aplatirait sur du noir"

    if est_video(regle) and not source.piste_video:
        return "aucune piste vidéo : c'est un enregistrement sonore, pas une vidéo"

    if est_video(regle) and source.sous_titres_image:
        return (f"{source.sous_titres_image} piste(s) de sous-titres image, que le "
                f"{vers} ne sait pas porter : le fichier reste en {depuis}")

    return ""


def _motif(source: Source, vers: str, cible: tuple[int, int] | None,
           remux: bool, objectif: str) -> str:
    depuis = normaliser(source.chemin.suffix)
    geste = "remuxage" if remux else "conversion"
    motif = f"{geste} {depuis} → {vers} ({objectif})"
    if cible:
        motif += f", réduite de {source.largeur}×{source.hauteur} à {cible[0]}×{cible[1]}"
    return motif


def gain_pct(poids_avant: int, poids_apres: int) -> float:
    """Le pourcentage d'espace rendu. Négatif quand le fichier a grossi."""
    if poids_avant <= 0:
        return 0.0
    return (poids_avant - poids_apres) * 100.0 / poids_avant


def verdict(conversion: Conversion, poids_obtenu: int, config: dict) -> tuple[bool, str]:
    """Le fichier produit remplace-t-il l'original ? Et la phrase qui le dit.

    Appelée **après** l'encodage et **avant** le remplacement : c'est le seul
    moment où le gain est un fait mesuré et non une promesse. Un encodage qui
    n'a rien fait gagner a coûté du temps machine — il ne coûtera pas en plus
    une photo recompressée pour rien.
    """
    reglages = config.get("conversion", {})
    gain = gain_pct(conversion.source.poids_octets, poids_obtenu)

    if poids_obtenu <= 0:
        return False, "le fichier produit est vide"

    if conversion.objectif == OBJECTIF_ESPACE:
        seuil = _nombre(reglages.get("seuil_gain_minimal_pct"), 15)
        if gain >= seuil:
            return True, f"{gain:.0f} % d'espace rendu"
        if gain < 0:
            # Le cas le plus fréquent des règles d'espace, et le plus mal dit si
            # l'on s'en tient au calcul : une capture d'écran d'aplats grossit
            # de 79 % en JPEG, et « −79 % d'espace rendu » se lit à l'envers.
            return False, (f"le fichier produit est {-gain:.0f} % plus lourd : "
                           "l'original est gardé")
        return False, (f"{gain:.0f} % d'espace rendu, sous le seuil de {seuil:.0f} % : "
                       "l'original est gardé")

    plafond = _nombre(reglages.get("inflation_max_pct"), 100)
    if -gain > plafond:
        return False, (f"le fichier produit est {-gain:.0f} % plus lourd, au-delà des "
                       f"{plafond:.0f} % tolérés : l'original est gardé")
    if gain >= 0:
        return True, f"{gain:.0f} % d'espace rendu"
    return True, f"{-gain:.0f} % d'espace en plus, accepté pour la compatibilité"


def _nombre(valeur: object, defaut: float) -> float:
    try:
        return float(valeur)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return defaut


def bilan(remplacements: list[tuple[int, int]]) -> tuple[int, int]:
    """Octets avant et après, pour les seules conversions retenues.

    Rendu comme deux totaux et non comme un pourcentage : « 1,2 Go → 900 Mo »
    se vérifie d'un coup d'œil sur le disque, là où « −25 % » ne se rattache à
    rien de visible.
    """
    return sum(avant for avant, _ in remplacements), sum(apres for _, apres in remplacements)
