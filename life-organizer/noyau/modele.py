"""Les types que les six modules s'échangent.

Ils vivent ici et non dans les modules parce qu'un module n'en appelle jamais un
autre : le classement reçoit le type détecté par le scan en argument, il ne va
pas le chercher. Sans ce fichier commun, la seule façon de partager une notion
serait un import croisé — et la chaîne deviendrait indémêlable au troisième
module.

Reste à écrire : `Document` (fiche + date, émetteur, montant). `Fiche`, `Media`,
`Video`, `Doublon` et `Decision` sont posés ici parce que le nettoyage en a besoin.

Ces types sont **immuables et sans entrée-sortie** : ils traversent les fonctions
pures de `regles.py`, qui doivent rester vérifiables sans toucher au disque.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Fiche:
    """Un fichier et le peu qu'on en sait sans l'ouvrir."""

    chemin: Path
    poids_octets: int
    # Secondes depuis l'époque. Sa source est décidée ailleurs
    # (`classement.source_de_la_date` : EXIF d'abord, modification en dernier
    # recours) : ici on ne reçoit que le résultat, sinon chaque module
    # re-déciderait dans son coin quelle date fait foi.
    date_horodatage: float


@dataclass(frozen=True)
class Media(Fiche):
    """Une photo ou une vidéo, avec ce qu'il a fallu décoder pour la juger."""

    largeur: int
    hauteur: int
    # Empreinte perceptuelle en hexadécimal (pHash par défaut). Chaîne et non
    # entier : sa longueur porte la taille du hachage, et deux tailles
    # différentes ne se comparent pas.
    empreinte_perceptuelle: str = ""
    # Variance du laplacien. `None` quand la netteté n'a pas été mesurée — ce
    # qui n'est pas la même chose qu'une netteté nulle, et c'est toute la
    # différence entre « pas jugée » et « jugée floue ».
    nettete: float | None = None
    # `None` quand la recherche de visage n'a pas eu lieu (désactivée, ou
    # classifieur absent de cet OpenCV). Là encore, pas de visage trouvé et
    # recherche non faite ne se confondent pas.
    visage_detecte: bool | None = None

    @property
    def definition(self) -> int:
        return self.largeur * self.hauteur


@dataclass(frozen=True)
class Video(Fiche):
    """Une vidéo et ce que l'inspection en a tiré.

    Séparée de `Media` et non dérivée d'elle : une vidéo n'a ni empreinte
    perceptuelle ni variance du laplacien, et lui donner ces champs vides
    inviterait à la faire passer par le regroupement des doublons, qui la
    croirait identique à toutes les autres.

    Deux champs portent la même précaution que `Media.nettete` : `lisible` dit
    si l'outil a su ouvrir le conteneur, `duree_secondes` vaut `None` quand la
    durée n'a pas été mesurée. Une durée absente n'est pas une durée nulle —
    beaucoup de MKV et de flux enregistrés n'annoncent aucune durée alors qu'ils
    se lisent parfaitement, et les compter pour zéro mettrait en quarantaine
    tout un format.
    """

    lisible: bool = True
    # Ce que l'outil a dit quand il a refusé le fichier. Repris tel quel dans le
    # motif : « illisible » seul n'apprend rien à qui doit décider s'il retrouve
    # une sauvegarde ou s'il jette.
    diagnostic: str = ""
    duree_secondes: float | None = None
    largeur: int = 0
    hauteur: int = 0
    piste_video: bool = True
    # La ligne d'erreur rendue par le décodage de la fin du fichier, ou `None`
    # si la fin s'est décodée proprement. C'est le seul symptôme d'un transfert
    # interrompu : l'en-tête d'un fichier tronqué reste intact et continue
    # d'annoncer la durée d'origine.
    erreur_de_fin: str | None = None

    @property
    def definition(self) -> int:
        return self.largeur * self.hauteur


@dataclass(frozen=True)
class Doublon:
    """Un groupe de fichiers qui montrent la même chose, et celui qui reste.

    Le groupe porte celui qu'on garde plutôt que la liste brute : c'est la seule
    façon de garantir qu'un groupe ne peut pas être écarté en entier. Un bug de
    tri ferait au pire garder la mauvaise photo, jamais aucune.
    """

    conserve: Media
    ecartes: list[Media] = field(default_factory=list)
    distance_max_du_groupe: int = 0

    @property
    def octets_recuperables(self) -> int:
        return sum(media.poids_octets for media in self.ecartes)


GARDER = "garder"
ECARTER = "ecarter"
# Un troisième geste, parce que deux ne suffisaient plus : un .mp4 sans piste
# vidéo n'est pas abîmé, c'est un enregistrement sonore. Le mettre en
# quarantaine serait faux, le taire ferait chercher longtemps pourquoi la
# vidéo ne s'affiche pas.
SIGNALER = "signaler"


@dataclass(frozen=True)
class Decision:
    """Le geste à poser sur un fichier, et la phrase qui le justifie.

    Le motif voyage avec le geste et n'est pas reconstruit à l'affichage :
    l'utilisateur doit lire exactement la raison qui a décidé, sinon une
    quarantaine devient une énigme un mois plus tard.
    """

    # `Fiche` et non `Media` : la même décision porte une photo ou une vidéo,
    # et le geste qui la met en quarantaine ne regarde que le chemin.
    media: Fiche
    geste: str
    motif: str
