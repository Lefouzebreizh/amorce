"""Les intentions que l'application ose nommer, et ce qui les habille.

Quatre intentions ont été demandées : faim, envie de sortir, stress,
contentement. Elles ne se valent pas, et ce fichier existe surtout pour écrire
**pourquoi** — la nuance disparaîtrait sinon au premier écran dessiné.

Deux d'entre elles sont *lues* dans le son par un modèle public :
YAMNet distingue déjà `Purr`, `Hiss` et `Caterwaul` parmi ses 521 classes.
Un ronronnement mesuré est un ronronnement, pas une supposition.

Les deux autres — faim, envie de sortir — sont deux façons de miauler, et
aucun modèle public ne les sépare. Elles demandent une tête entraînée sur des
miaulements étiquetés par contexte réel. Tant qu'elle n'existe pas, on rend
`INDECIS` : c'est le seul choix qui ne ment pas.

`CLAUDE.md` interdit le procédé qui manipule. Un pourcentage inventé sur un
écran de partage en est un — il a l'air d'une mesure.
"""

from dataclasses import dataclass
from enum import Enum


class Intention(Enum):
    """Ce que l'application peut conclure, `INDECIS` compris."""

    FAIM = "faim"
    SORTIR = "sortir"
    STRESS = "stress"
    CONTENTEMENT = "contentement"
    INDECIS = "indecis"


class Source(Enum):
    """D'où vient la conclusion — et c'est ce qui décide si on peut la montrer.

    La distinction n'est pas une coquetterie de journal : elle change ce que
    l'écran a le droit d'afficher. `MESUREE` autorise un score ; `PROVISOIRE`
    oblige à dire que c'est une hypothèse.
    """

    MESUREE = "mesuree"        # le modèle public a nommé la classe lui-même
    PROVISOIRE = "provisoire"  # règle acoustique en attendant la tête entraînée
    AUCUNE = "aucune"          # on ne conclut pas


@dataclass(frozen=True)
class Habillage:
    """Ce qu'on montre à l'écran, dans la voix du dépôt.

    Trois champs et pas un de plus : le titre qui se lit en une demi-seconde
    sur un écran de six pouces, la scène qui donne l'image, et le sous-titre
    qui part sur TikTok. Le sous-titre est **court à dessein** : le §2 borne le
    texte utile entre 12 et 45 % de la hauteur, ce qui laisse peu de lignes.
    """

    titre: str
    scene: str
    sous_titre: str


# L'habillage est une table, pas du code. On veut pouvoir en changer sans
# toucher à ce qui décide — et surtout pouvoir en tirer plusieurs variantes
# le jour où un même verdict doit rendre trois vidéos différentes.
HABILLAGES: dict[Intention, Habillage] = {
    Intention.FAIM: Habillage(
        titre="« La gamelle est vide. »",
        scene="gros plan sur une gamelle vide, lumière chaude de cuisine",
        sous_titre="Je ne demande rien. Je constate.",
    ),
    Intention.SORTIR: Habillage(
        titre="« Ouvre. »",
        scene="silhouette assise devant une porte vitrée, contre-jour bleuté",
        sous_titre="Le dehors existe. Tu le sais, ça ?",
    ),
    Intention.STRESS: Habillage(
        titre="« Recule. »",
        scene="oreilles basses, fond qui se resserre, lumière froide",
        sous_titre="Là, tout de suite, j'ai besoin d'espace.",
    ),
    Intention.CONTENTEMENT: Habillage(
        titre="« Reste. »",
        scene="fourrure en lumière rasante, plan très serré, presque immobile",
        sous_titre="C'est bien. Ne bouge pas.",
    ),
    Intention.INDECIS: Habillage(
        titre="« Je n'ai pas compris. »",
        scene="écran calme, aucune illustration — on ne décore pas un doute",
        sous_titre="J'ai bien entendu un chat. Mais je ne devine pas plus.",
    ),
}


def habiller(intention: Intention) -> Habillage:
    """Rend l'habillage d'une intention. Ne peut pas échouer.

    `INDECIS` a le sien, et c'est le point : l'écran du doute est un écran
    conçu, pas un message d'erreur. C'est aussi le plus souvent affiché tant
    que la tête d'intention n'est pas entraînée.
    """
    return HABILLAGES[intention]
