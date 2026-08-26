"""Les types que les six modules s'échangent.

Ils vivent ici et non dans les modules parce qu'un module n'en appelle jamais un
autre : le classement reçoit le type détecté par le scan en argument, il ne va
pas le chercher. Sans ce fichier commun, la seule façon de partager une notion
serait un import croisé — et la chaîne deviendrait indémêlable au troisième
module.

Reste à écrire : `Document` (fiche + date, émetteur, montant). `Fiche`, `Media`,
`Doublon` et `Decision` sont posés ici parce que le nettoyage en a besoin.

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


@dataclass(frozen=True)
class Decision:
    """Le geste à poser sur un fichier, et la phrase qui le justifie.

    Le motif voyage avec le geste et n'est pas reconstruit à l'affichage :
    l'utilisateur doit lire exactement la raison qui a décidé, sinon une
    quarantaine devient une énigme un mois plus tard.
    """

    media: Media
    geste: str
    motif: str
