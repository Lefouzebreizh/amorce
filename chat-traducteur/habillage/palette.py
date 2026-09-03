"""Une palette par intention, et la raison de chacune.

Le §2 de `CLAUDE.md` demande de gros contrastes : le public vise des gens
fatigués, qui regardent dehors, souvent d'un œil. Chaque paire fond/texte
ci-dessous tient **au moins 7:1**, vérifié par un test — pas 4,5:1, qui est le
minimum légal et se révèle insuffisant en plein soleil sur un Redmi.

**Et les accents aussi, depuis le 03/09/2026.** Le §2 bis a posé un standard de
maison — accent à 7:1 sur la surface la plus claire du produit — et trois des
cinq étaient dessous : `sortir` 6,80, `stress` 6,24, `indecis` 5,59. Le test ne
demandait alors que 4,5:1, la barre légale, si bien que rien ne les signalait.

La correction n'a **pas** changé les teintes : même angle, même saturation,
seule la clarté monte de trois à neuf points. C'était la contrainte — un accent
choisi pour son registre émotionnel ne se remplace pas par une couleur qui
passe le calcul, sinon le violet du stress devient un violet quelconque.

Le choix des teintes n'est pas décoratif : c'est le registre émotionnel qui
décide. Un fond rouge vif sur « stress » ferait de l'alarme, et l'alarme est
précisément le procédé que ce dépôt s'interdit — on montre un chat qui demande
de l'espace, pas une urgence.
"""

from dataclasses import dataclass

from noyau.intentions import Intention


@dataclass(frozen=True)
class Palette:
    fond: str
    fond_bas: str   # dégradé : le bas plus sombre, pour asseoir le texte
    texte: str
    accent: str     # une seule couleur d'accent — règle de style du dépôt


PALETTES: dict[Intention, Palette] = {
    # Chaud, cuisine, fin de journée. Pas d'urgence : un chat qui a faim le
    # dit posément, il ne hurle pas.
    Intention.FAIM: Palette("#3A2417", "#1B0F08", "#FFF3E4", "#FFB35C"),
    # Bleu de dehors vu depuis dedans — la couleur du contre-jour à la porte
    # vitrée, qui est exactement la scène.
    Intention.SORTIR: Palette("#16293D", "#080F18", "#E6F1FF", "#7EBCFF"),
    # Violet froid, pas rouge. Le stress d'un chat se respecte, il ne
    # s'alarme pas — et le rouge sur un écran de partage fabrique de
    # l'urgence, ce que le §1 interdit.
    Intention.STRESS: Palette("#2B1B33", "#120A16", "#F4E9FA", "#C99DEB"),
    # Vert profond, presque immobile. Le seul cas où rien ne demande rien.
    Intention.CONTENTEMENT: Palette("#16301F", "#07130C", "#E8F7EC", "#7FD99A"),
    # Gris neutre, et volontairement le moins beau des cinq : on ne décore
    # pas un doute, on l'assume.
    Intention.INDECIS: Palette("#232323", "#0D0D0D", "#EDEDED", "#B1B1B1"),
}


def palette(intention: Intention) -> Palette:
    return PALETTES[intention]
