"""La tête d'intention acoustique : hauteur et durée, d'après un référentiel.

Elle branche sur la couture prévue depuis le premier jour —
`juger(..., tete_intention=…)` — et elle n'est appelée que là où cette couture
mène : sur un **miaulement**. Ce n'est pas un détail d'implémentation, c'est ce
qui empêche la faute décrite plus bas.

Le référentiel vient d'une source de vulgarisation fournie par le propriétaire,
et son statut est écrit ici plutôt que supposé : **il n'est toujours pas validé
par une publication**, et rien dans ce fichier ne doit se lire comme mesuré. Ce
qui est mesuré porte une date.

    aigu + long    -> requête      faim, soif, litière sale, veut sortir
    aigu + court   -> salutation   chat bavard, content
    grave          -> alerte       douleur, stress, peur, défense

**La table ci-dessus a été confrontée à sa source le 04/09/2026**, dont la
transcription a été relue mot à mot. Elle est fidèle — ce qui écarte une erreur
de recopie, et rien de plus : une vidéo de vulgarisation vérifiée reste une
vidéo de vulgarisation. Ce qui change, c'est qu'on sait désormais ce qu'on
suit.

Et la source dit deux choses que la table ne portait pas. Toutes deux
contraignent ce module, donc elles sont écrites ici.

**1. Le même son ne dit pas la même chose selon le chat.** La source attache le
type *aigu et long* aux chats « qui ne sont pas spécialement bavards, qui ne
font pas de bruit en temps normal », et le type *aigu et court* aux races
bavardes qui vocalisent « sans raison particulière ». Ce n'est pas un trait
acoustique, c'est une **habitude de l'animal** — et aucune mesure faite sur un
seul enregistrement n'y donne accès. Une tête qui ignore la base de référence
d'un chat lit donc au mieux la moitié de ce que son propre référentiel décrit.
C'est la limite haute de ce module, et c'est aussi ce qui rend la
personnalisation par animal structurelle plutôt que décorative.

**2. Seule la durée sépare la requête de la salutation.** Les deux premiers
types sont *aigus* tous les deux ; la hauteur ne les départage pas. Tout le
poids du partage repose donc sur `FRONTIERE_LONG`, une hypothèse déclarée et
jamais mesurée — un seuil unique dont dépend, à lui seul, la différence entre
« il demande quelque chose » et « il te dit bonjour ». `FRONTIERE_AIGU`, lui,
ne fait que séparer l'alerte du reste.

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

Le référentiel associe le grave à « douleur » et conseille un vétérinaire —
confirmé dans la transcription du 04/09, qui parle de « mal-être physique ou
psychologique », de douleur, et conseille « un vétérinaire ou un
comportementaliste félin ». **Cette partie n'est pas implémentée et ne le sera
pas ainsi**, et le savoir de première main ne change pas la décision. Le dépôt porte
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
# changera rien.
#
# **La décision de produit a été prise le 04/09/2026** : une carte unique,
# `DEMANDE`, plutôt que deux cartes qu'aucune mesure ne départage. `REQUETE`
# rend donc une vraie intention et non plus `INDECIS` — ce qui change ce que
# l'application ose dire, pas ce qu'elle sait.
#
# Ne pas relire ce `DEMANDE` comme un progrès de la lecture : la tête n'en
# sait pas plus qu'hier. C'est la carte qui a cessé de promettre plus que la
# tête ne mesure.
CORRESPONDANCE: dict[TypeMiaulement, Intention] = {
    TypeMiaulement.REQUETE: Intention.DEMANDE,       # ne dit jamais *quoi*
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
