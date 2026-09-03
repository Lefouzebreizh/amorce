"""La tête d'intention acoustique : hauteur et durée, d'après un référentiel.

Elle branche sur la couture prévue depuis le premier jour —
`juger(..., tete_intention=…)` — et elle n'est appelée que là où cette couture
mène : sur un **miaulement**. Ce n'est pas un détail d'implémentation, c'est ce
qui empêche la faute décrite plus bas.

Le référentiel vient d'une source de vulgarisation fournie par le propriétaire,
et son statut est écrit ici plutôt que supposé : **il n'est pas validé par une
publication**, et rien dans ce fichier ne doit se lire comme mesuré. Ce qui est
mesuré porte une date.

    aigu + long    -> requête      faim, soif, litière sale, veut sortir
    aigu + court   -> salutation   chat bavard, content
    grave          -> alerte       douleur, stress, peur, défense

## La faute que ce module refuse de commettre

Appliqué **sans borne** au premier vrai enregistrement, le 03/09/2026, ce
référentiel a rendu « détresse » sur un chat parfaitement bien.

Le fichier dure huit secondes : le chat bâille bruyamment, puis ronronne. La
porte accepte les quinze fenêtres, la hauteur médiane tombe à **152 Hz** et la
durée à **7,8 s** — grave et long, donc « alerte, surveiller, vétérinaire ».
Et l'image montre un chat détendu, pendant que YAMNet nomme `Purr` à **1,00**
sur le dernier tiers.

La cause n'est pas le référentiel, elle est dans son application : **il classe
des miaulements, pas n'importe quel son de chat.** Un bâillement n'en est pas
un ; un ronronnement non plus. La tête ne parle donc que là où `Meow` répond,
et se tait partout ailleurs — ce que `verdict.juger` garantit déjà par
construction, puisque `Purr`, `Hiss` et `Caterwaul` sont lus en direct et ne
l'atteignent jamais.

## Ce qui n'est pas ici, et pourquoi

Le référentiel associe le grave à « douleur » et conseille un vétérinaire.
**Cette partie n'est pas implémentée et ne le sera pas ainsi.** Le dépôt porte
déjà la décision, dans `archives-backlog/ou-a-mal-mon-animal.md` : un outil qui
tranche sur la santé d'un animal produit du soulagement ou de l'alarme, et les
deux sont dangereux quand personne n'a examiné la bête. Le grave se lit ici en
`STRESS`, ce que l'application sait déjà dire, et rien de plus.
"""

from dataclasses import dataclass
from enum import Enum

from .intentions import Intention
from .traits import Traits


class TypeMiaulement(Enum):
    """Les trois types du référentiel, plus le refus de trancher."""

    REQUETE = "requete"        # aigu et long
    SALUTATION = "salutation"  # aigu et court
    ALERTE = "alerte"          # grave
    INDETERMINE = "indetermine"


@dataclass(frozen=True)
class Lecture:
    type_: TypeMiaulement
    intention: Intention
    confiance: float
    raison: str


# La correspondance type -> intention, et le seul endroit où elle se décide.
#
# **`REQUETE` ne se sépare pas en faim et envie de sortir**, et ce n'est pas une
# limite de l'outillage : le référentiel lui-même range « faim », « soif »,
# « litière sale » et « veut sortir » sous le *même* type. Les deux intentions
# demandées au départ sont acoustiquement la même chose, et aucun modèle n'y
# changera rien. C'est une décision de produit, pas une question technique :
# soit l'application dit « il demande quelque chose », soit elle garde deux
# cartes qu'elle ne saura jamais départager.
#
# En attendant cette décision, `REQUETE` rend `INDECIS` — le seul verdict qui
# ne choisit pas à la place du propriétaire.
CORRESPONDANCE: dict[TypeMiaulement, Intention] = {
    TypeMiaulement.REQUETE: Intention.INDECIS,
    TypeMiaulement.SALUTATION: Intention.CONTENTEMENT,
    TypeMiaulement.ALERTE: Intention.STRESS,
    TypeMiaulement.INDETERMINE: Intention.INDECIS,
}

# En dessous, la hauteur repose sur trop peu de fenêtres pour qu'on s'y fie.
# Deux, parce qu'une mesure isolée sur 0,975 s peut tomber sur une consonne de
# bruit ; observé sur les fichiers réels, une vocalisation nette en donne sept.
MESURES_MINIMUM = 2


def classer(traits: Traits) -> TypeMiaulement:
    """Range une vocalisation dans un des trois types, ou refuse."""
    if traits.hauteur is None or traits.mesures_fiables < MESURES_MINIMUM:
        return TypeMiaulement.INDETERMINE
    if not traits.aigu:
        return TypeMiaulement.ALERTE
    return TypeMiaulement.REQUETE if traits.long else TypeMiaulement.SALUTATION


def lire(traits: Traits) -> Lecture:
    """Rend le type, l'intention correspondante, et de quoi l'expliquer.

    La confiance est **délibérément plafonnée à 0,5** : elle repose sur deux
    frontières posées par hypothèse — 400 Hz et 0,7 s — qu'aucun corpus étiqueté
    n'a confirmées. La rendre haute ferait passer une hypothèse pour une mesure,
    ce que le §1 interdit. Elle ne s'affiche d'ailleurs pas : la source d'un
    verdict passé par ici est `PROVISOIRE`, et la carte ne montre de score que
    pour `MESUREE`.
    """
    type_ = classer(traits)
    intention = CORRESPONDANCE[type_]
    if type_ is TypeMiaulement.INDETERMINE:
        raison = (f"Miaulement reconnu, hauteur non mesurable "
                  f"({traits.mesures_fiables} fenêtre(s) fiable(s)).")
        return Lecture(type_, intention, 0.0, raison)
    raison = (f"{traits.hauteur:.0f} Hz sur {traits.duree:.1f} s "
              f"— {'aigu' if traits.aigu else 'grave'}, "
              f"{'long' if traits.long else 'court'} : {type_.value}.")
    return Lecture(type_, intention, 0.5, raison)


def tete_pour(traits: Traits):
    """Fabrique la fonction que `verdict.juger` attend sur sa couture."""
    def tete():
        lecture = lire(traits)
        return lecture.intention, lecture.confiance
    return tete
