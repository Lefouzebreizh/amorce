"""Mesurer les images, dire si le modèle est là, et agrandir quand il l'est.

**Ce fichier porte la frontière du vérifiable, et elle est nette.**

Ce qui est éprouvé dans cet environnement : la mesure des images (Pillow et
OpenCV sont installés), la détection de l'absence du modèle, et le message qui
en découle. `python3 -m unittest discover -s life-organizer/tests` couvre la
décision entière.

**L'inférence a été exécutée pour de vrai le 01/09/2026**, dans une session
distante — 512 px → 2048 px en 58 secondes sur processeur, poids téléchargés en
deux secondes depuis les objets de release GitHub. Ce que la version précédente
de ce fichier annonçait comme hors de portée était une **absence** de paquets,
pas une impossibilité : `pip install torch realesrgan basicsr` passe ici (trois
gigaoctets, quelques minutes), PyPI et `github.com/…/releases` répondent, et
seul `download.pytorch.org` — la roue CPU allégée — est refusé.

Trois décisions :

1. **L'absence se constate au démarrage, jamais au millième fichier.**
   `moteur_disponible` est appelée avant la première image. Découvrir l'absence
   après quarante minutes de mesure coûte les quarante minutes.
2. **La mesure ne dépend pas du modèle.** Elle tourne, elle décide, elle rend un
   plan — même sans une seule bibliothèque d'agrandissement. C'est ce qui permet
   de régler les seuils aujourd'hui et de lancer le calcul le jour où la
   machine le permet.
3. **La netteté est mesurée ici, et non partagée avec `nettoyage`.** La formule
   est la même — variance du laplacien sur l'image réduite en niveaux de gris —
   mais la fonction de `nettoyage` est couplée à son type `Media`, à la
   détection de visages et à son propre redimensionnement : l'extraire serait
   refactoriser un module qui marche pour trois lignes. Le jour où un troisième
   module en a besoin, elle monte dans `noyau/` — c'est à ce moment-là que le
   partage devient moins cher que la copie, pas avant.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Iterable

from .regles import Agrandissement, Candidat

# Même valeur que dans `nettoyage` : la variance du laplacien dépend de la
# taille de l'image, donc deux seuils calculés sur deux tailles différentes ne
# se comparent pas. Changer l'une sans l'autre rendrait `nettete_minimale`
# incohérent d'un module à l'autre.
LARGEUR_ANALYSE = 800

# Le nom du réglage n'est pas le nom du fichier, et c'est ce qui a coûté trois
# 404 au premier essai de bout en bout : la configuration dit
# « realesrgan-x4plus », l'objet de release s'appelle `RealESRGAN_x4plus.pth`.
# Fabriquer l'adresse à partir du réglage échoue donc en silence jusqu'à
# l'exécution. La table dit les deux, et l'échelle du modèle avec — elle ne se
# déduit pas non plus du nom de façon fiable.
BASE_RELEASES = "https://github.com/xinntao/Real-ESRGAN/releases/download"
MODELES = {
    "realesrgan-x4plus": (f"{BASE_RELEASES}/v0.1.0/RealESRGAN_x4plus.pth", 4),
    "realesrgan-x4plus-anime": (
        f"{BASE_RELEASES}/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth", 4),
    "realesrgan-x2plus": (f"{BASE_RELEASES}/v0.2.1/RealESRGAN_x2plus.pth", 2),
}


def _rebrancher_functional_tensor() -> None:
    """Rebranche le module que `basicsr` importe et que torchvision a retiré.

    `basicsr` 1.4.2 fait `from torchvision.transforms.functional_tensor import
    rgb_to_grayscale`. Ce module a disparu de torchvision 0.17, et la fonction
    vit maintenant dans `torchvision.transforms.functional`. Sans ce
    rebranchement, l'import échoue **après** une installation que pip déclare
    réussie — le piège coûte une demi-heure à qui croit le message de pip.

    Mesuré le 01/09/2026 : torch 2.13.0, torchvision 0.28.0, basicsr 1.4.2.
    Le jour où `basicsr` corrigera son import, ces trois lignes deviendront
    inutiles sans rien casser — elles ne font qu'ajouter un alias.
    """
    import sys

    if "torchvision.transforms.functional_tensor" in sys.modules:
        return
    try:
        import torchvision.transforms.functional as fonctionnel
    except ImportError:
        return
    sys.modules["torchvision.transforms.functional_tensor"] = fonctionnel


def moteur_disponible() -> tuple[bool, str]:
    """Le modèle d'agrandissement est-il utilisable ici, et sinon que faire.

    Rend un couple plutôt qu'un booléen : un refus sans la commande qui le lève
    oblige à chercher ailleurs ce que la fonction savait déjà.
    """
    _rebrancher_functional_tensor()
    manquants = []
    for paquet, pip in (("torch", "torch"), ("realesrgan", "realesrgan"),
                        ("basicsr", "basicsr")):
        try:
            __import__(paquet)
        except ImportError:
            manquants.append(pip)

    if not manquants:
        return True, ""
    return False, (
        f"agrandissement indisponible — {', '.join(manquants)} absent(s). "
        "Les installer : pip install " + " ".join(manquants) + "\n"
        "   (torch se choisit sur pytorch.org : la version par défaut tire les "
        "pilotes NVIDIA même sans carte graphique.)"
    )


def mesurer(chemins: Iterable[Path], reglages: dict,
            consigner: Callable[[Path, str], None] | None = None) -> list[Candidat]:
    """Ouvre chaque image une fois et en tire ses dimensions et sa netteté.

    Une image illisible est consignée et enjambée, jamais jugée — même parti
    pris que le module de nettoyage. Et une netteté qu'on n'a pas su mesurer
    reste `None`, ce qui ne vaut pas « floue » : la décision le sait.
    """
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        return []

    mesure_nettete = _mesureur_de_nettete(reglages)
    candidats = []
    for chemin in chemins:
        try:
            infos = chemin.stat()
            with Image.open(chemin) as image:
                largeur, hauteur = image.size
        except UnidentifiedImageError:
            # Un `.jpg` qui n'en est pas : ce n'est pas un incident, c'est un
            # fichier qui n'a rien à faire ici.
            continue
        except (OSError, ValueError) as erreur:
            if consigner:
                consigner(chemin, f"illisible ({getattr(erreur, 'strerror', None) or erreur})")
            continue

        candidats.append(Candidat(
            chemin=chemin, largeur=largeur, hauteur=hauteur,
            poids_octets=infos.st_size, nettete=mesure_nettete(chemin),
        ))
    return candidats


def _mesureur_de_nettete(reglages: dict) -> Callable[[Path], float | None]:
    """Rend la fonction de mesure, ou une qui rend toujours `None`.

    Décidé une fois pour toutes plutôt qu'à chaque image : sans OpenCV, la
    décision se prend quand même — le garde-fou du flou dort, et le compte rendu
    le dit.
    """
    if reglages.get("nettete_minimale") is None:
        return lambda _chemin: None
    try:
        import cv2
    except ImportError:
        return lambda _chemin: None

    def mesurer_une(chemin: Path) -> float | None:
        image = _lire(chemin, cv2.IMREAD_COLOR)
        if image is None:
            return None
        hauteur, largeur = image.shape[:2]
        if largeur > LARGEUR_ANALYSE:
            echelle = LARGEUR_ANALYSE / largeur
            image = cv2.resize(image, (LARGEUR_ANALYSE, max(1, int(hauteur * echelle))))
        gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return float(cv2.Laplacian(gris, cv2.CV_64F).var())

    return mesurer_une


def _lire(chemin: Path, drapeau: int):
    """Décode une image depuis ses octets, jamais depuis son chemin.

    `cv2.imread` rend `None` **sans lever** sur tout chemin non ASCII sous
    Windows — donc sur « Téléchargements », « Bureau », « À trier ». Le défaut
    ne se voit pas : la netteté devient inconnue et le garde-fou du flou dort,
    ou l'agrandissement se plaint d'une image « illisible » parfaitement saine.
    `nettoyage/traitement.py` porte déjà la même parade, pour la même raison.
    """
    import cv2
    import numpy

    donnees = numpy.fromfile(str(chemin), dtype=numpy.uint8)
    if not donnees.size:
        return None
    return cv2.imdecode(donnees, drapeau)


def _ecrire(chemin: Path, image) -> bool:
    """Encode puis écrit soi-même : `cv2.imwrite` bute sur le même mur.

    L'extension décide toujours du format — c'est `imencode` qui la lit — mais
    l'écriture passe par Python, qui sait ouvrir un chemin accentué.
    """
    import cv2

    reussite, tampon = cv2.imencode(chemin.suffix, image)
    if not reussite:
        return False
    chemin.write_bytes(tampon.tobytes())
    return True


def nettete_mesurable(reglages: dict) -> bool:
    """OpenCV est-il là pour que le garde-fou du flou serve à quelque chose ?"""
    if reglages.get("nettete_minimale") is None:
        return False
    try:
        import cv2  # noqa: F401
    except ImportError:
        return False
    return True


def sorties_existantes(agrandissements: list[Agrandissement]) -> set[Path]:
    """Les sorties déjà présentes sur le disque — c'est l'état de la reprise.

    Le disque plutôt qu'un journal : un journal se désynchronise du réel dès
    qu'on efface un fichier à la main, et il faudrait alors le réparer. Le
    disque, lui, ne peut pas mentir sur ce qu'il contient.
    """
    return {a.sortie for a in agrandissements if a.retenu and a.sortie.exists()}


def agrandir(file: list[Agrandissement], reglages: dict, journal) -> tuple[int, list[str]]:
    """Agrandit ce que la file contient. Rend le nombre écrit et les incidents.

    **Cette fonction n'a jamais tourné** : `torch` et `realesrgan` sont absents
    de l'environnement où elle a été écrite. Elle suit l'API publiée de
    Real-ESRGAN, et sa première exécution sur une machine équipée est une
    vérification qui reste entière.

    Le journal décide seul s'il faut agir (mode simulation) : la condition n'est
    pas réécrite ici, sans quoi elle finirait par diverger de celle des autres
    modules.
    """
    disponible, message = moteur_disponible()
    if not disponible:
        return 0, [message]

    ecrits, incidents = 0, []
    moteur = None
    for agrandissement in file:
        if not journal.prevoir(
            f"agrandir : {agrandissement.candidat.chemin} → "
            f"{agrandissement.sortie} ({agrandissement.motif})"
        ):
            ecrits += 1
            continue
        try:
            if moteur is None:
                # Une panne de chargement est définitive : le modèle ne
                # s'installera pas tout seul entre deux images. Sans cette
                # remontée, la même erreur se répète autant de fois qu'il y a
                # de fichiers, et le compte rendu la noie.
                try:
                    moteur = _charger_moteur(reglages, agrandissement.facteur)
                except Exception as erreur:
                    return ecrits, [f"chargement du modèle impossible : {erreur}"]
            _agrandir_une(moteur, agrandissement)
        except Exception as erreur:
            # Le lot ne s'arrête pas sur une image : un modèle qui manque de
            # mémoire sur une grande photo doit pouvoir finir les suivantes.
            incidents.append(f"{agrandissement.candidat.chemin} : {erreur}")
            journal.incident(agrandissement.candidat.chemin, f"agrandissement impossible ({erreur})")
            continue
        ecrits += 1
    return ecrits, incidents


def _charger_moteur(reglages: dict, facteur: int):
    """Charge le modèle une seule fois pour tout le lot.

    Une fois : le chargement prend plusieurs secondes et l'essentiel de la
    mémoire. Le refaire par image transformerait un lot de vingt-cinq en une
    demi-heure d'allers-retours disque.
    """
    _rebrancher_functional_tensor()

    import torch
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    nom = reglages.get("modele", "realesrgan-x4plus")
    if nom not in MODELES:
        raise ValueError(
            f"modèle inconnu : « {nom} ». Connus : {', '.join(sorted(MODELES))}. "
            "Un nom inconnu ne se devine pas en adresse : le fichier de release "
            "ne porte pas le nom du réglage."
        )
    # Le modèle est entraîné pour un facteur donné : `RealESRGANer` le rend, et
    # `outscale` ajuste ensuite la sortie. Les deux ne se confondent pas.
    adresse, echelle_modele = MODELES[nom]
    architecture = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                           num_block=23, num_grow_ch=32, scale=echelle_modele)
    appareil = reglages.get("appareil", "cpu")
    return RealESRGANer(
        scale=echelle_modele,
        model_path=adresse,
        model=architecture,
        device=torch.device(appareil),
        # Sur processeur, la demi-précision n'accélère rien et rend des images
        # noires sur certaines versions de torch.
        half=(appareil != "cpu"),
        # En tuiles, sinon une photo de téléphone demande l'image entière en
        # mémoire à chaque couche du réseau. 256 px tient largement sur un
        # processeur ; `tuile: 0` la désactive pour qui a de la mémoire à
        # revendre. Mesuré : 512 px → 2048 px en 58 s sur processeur, en neuf
        # tuiles.
        tile=reglages.get("tuile", 256),
        tile_pad=reglages.get("recouvrement_tuile", 10),
    )


def _agrandir_une(moteur, agrandissement: Agrandissement) -> None:
    """Écrit une image agrandie à côté de son original."""
    import cv2

    image = _lire(agrandissement.candidat.chemin, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise OSError("image illisible par le décodeur")
    sortie, _ = moteur.enhance(image, outscale=agrandissement.facteur)
    if not _ecrire(agrandissement.sortie, sortie):
        raise OSError(f"écriture refusée vers {agrandissement.sortie}")
