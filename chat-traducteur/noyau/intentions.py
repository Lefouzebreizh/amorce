"""Les intentions que l'application ose nommer, et ce qui les habille.

Quatre intentions ont été demandées : faim, envie de sortir, stress,
contentement. **Il n'en reste que trois, et c'est une décision de produit, pas
un renoncement technique.**

Deux d'entre elles sont *lues* dans le son par un modèle public :
YAMNet distingue déjà `Purr`, `Hiss` et `Caterwaul` parmi ses 521 classes.
Un ronronnement mesuré est un ronronnement, pas une supposition.

Les deux autres — faim, envie de sortir — **ne se séparent pas**, et pas
seulement faute d'outillage : le référentiel qui fonde la lecture acoustique
range lui-même « faim », « soif », « litière sale » et « veut sortir » sous
un **seul** type de miaulement, vérifié à sa source le 04/09/2026. Ce ne sont
pas deux sons qu'on ne sait pas distinguer, c'est un seul son.

Le propriétaire a tranché le 04/09/2026 : **une carte unique, `DEMANDE`.**
L'autre option — garder deux cartes et tirer entre elles — aurait fabriqué
une précision que rien ne porte. On perd deux visuels sur cinq, on gagne de
ne jamais se tromper.

Ce qui est perdu est écrit ici plutôt que tu : la carte ne dira pas *quoi*.
C'est à la personne qui regarde son chat de savoir si c'est la gamelle ou la
porte — et elle le sait, elle. L'application lui dit ce qu'elle ne savait
pas : qu'il demande.

`CLAUDE.md` interdit le procédé qui manipule. Un pourcentage inventé sur un
écran de partage en est un — il a l'air d'une mesure.
"""

from dataclasses import dataclass
from enum import Enum


class Intention(Enum):
    """Ce que l'application peut conclure, `INDECIS` compris."""

    # `DEMANDE` remplace `FAIM` et `SORTIR`, qui n'existent plus. Ne pas les
    # remettre en croyant compléter la liste : le test
    # `test_faim_et_sortir_nexistent_plus` refuse leur retour, et l'entête
    # ci-dessus dit pourquoi.
    DEMANDE = "demande"
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
    # Le titre ne nomme pas l'objet de la demande, et c'est tout le sujet.
    # « Il a faim » serait une invention ; « il te veut » est vrai à tous les
    # coups — le référentiel dit que ce miaulement-là équivaut à un « allô ».
    Intention.DEMANDE: Habillage(
        titre="« Toi. Viens. »",
        scene="assis bien droit face à l'objectif, lumière chaude de cuisine, "
              "regard qui ne lâche pas",
        sous_titre="Je ne dirai pas quoi. Tu vas trouver.",
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
