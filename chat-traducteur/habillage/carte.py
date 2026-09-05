"""Un verdict devient une carte verticale 1080 × 1920, prête à partager.

Trois contraintes viennent de `CLAUDE.md` §2 et ne se négocient pas :

1. **La bande utile va de 12 à 45 % de la hauteur**, soit 230 à 865 px sur
   1920. C'est l'*intersection* des zones sûres de TikTok, Instagram et
   Facebook — jamais la plus permissive, puisqu'une même carte part sur les
   trois. Instagram est le plus serré : il ferme dès 63 %.
2. **Gros contrastes**, au moins 7:1 — le minimum légal de 4,5:1 ne tient pas
   en plein soleil sur le terrain de référence.
3. **Aucun texte ne s'étire.** Un titre trop long passe à la ligne. C'est le
   défaut de l'épisode 1 de `motion/`, où un titre avait été étiré de 9,8 % à
   94,7 % et se faisait manger par les boutons de Facebook.

Et une quatrième, propre à ce projet et plus importante que les trois autres :

**La carte ne peut pas afficher un score que le modèle n'a pas mesuré.** Ce
n'est pas une consigne laissée à la discipline de l'appelant — `blocs()` ne
fabrique le bloc de confiance que si `source is MESUREE`. Un verdict provisoire
ou indécis n'a aucun chemin de code menant à un pourcentage. C'est la règle du
§1 sur le procédé qui manipule, rendue **structurelle** : la seule façon
d'afficher un faux score serait de modifier ce fichier, ce qu'un test
interdit.
"""

from dataclasses import dataclass

from noyau.intentions import Source, habiller
from noyau.verdict import Verdict
from habillage.palette import palette

LARGEUR, HAUTEUR = 1080, 1920

# 12 % et 45 % de 1920. Écrits en pourcentage puis convertis, pour que la
# provenance reste lisible : ce sont les chiffres du §2, pas des marges
# choisies à l'œil.
HAUT_SUR = int(HAUTEUR * 0.12)   # 230
BAS_SUR = int(HAUTEUR * 0.45)    # 864

MARGE_LATERALE = 96              # laisse 888 px de colonne de texte
COLONNE = LARGEUR - 2 * MARGE_LATERALE

TAILLE_TITRE = 84
TAILLE_SOUS_TITRE = 52
TAILLE_MENTION = 30
INTERLIGNE = 1.22

# Largeur d'avance moyenne d'un caractère, en fraction de la taille de police,
# pour une sans-serif grasse sur du français mixte. Mesuré grossièrement et
# volontairement **surestimé** : une estimation trop large fait passer à la
# ligne un peu tôt, ce qui est laid ; trop étroite fait déborder, ce qui est
# un défaut. On préfère laid à faux.
AVANCE = 0.56


@dataclass(frozen=True)
class Ligne:
    """Une ligne de texte déjà placée. `y` est la ligne de base."""
    texte: str
    x: int
    y: int
    taille: int
    graisse: int
    couleur: str


def _echapper(texte: str) -> str:
    """XML : cinq caractères, et les oublier casse le fichier en silence."""
    return (texte.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                 .replace('"', "&quot;").replace("'", "&apos;"))


def couper(texte: str, taille: int, largeur: int = COLONNE) -> list[str]:
    """Passe à la ligne aux espaces, sans jamais couper un mot.

    Un mot plus large que la colonne est laissé tel quel et débordera : c'est
    délibéré. Le couper en deux rendrait un texte illisible sans que personne
    ne s'en aperçoive, alors qu'un débordement se voit immédiatement sur la
    planche de contrôle.
    """
    par_ligne = max(1, int(largeur / (taille * AVANCE)))
    lignes, courante = [], ""
    for mot in texte.split():
        essai = f"{courante} {mot}".strip()
        if len(essai) <= par_ligne or not courante:
            courante = essai
        else:
            lignes.append(courante)
            courante = mot
    if courante:
        lignes.append(courante)
    return lignes


# Ce que la mention dit, et ce qu'elle ne dit plus — décidé le 05/09/2026.
#
# **Le chiffre porte le son, jamais l'état.** La carte affichait `Purr · 15%` :
# le nom d'une classe de YAMNet, en anglais, collé à un pourcentage. Deux
# défauts dans quatre caractères.
#
# Le premier est de forme — « Purr » n'est pas du français et n'a rien à faire
# sur un artefact qui part sur TikTok.
#
# Le second est de fond, et c'est le propriétaire qui l'a tranché. Un chiffre a
# l'air d'une preuve : posé à côté de « il est content », il faisait passer pour
# mesuré un **état** que personne n'a mesuré. Ce que le modèle a mesuré est un
# **son**. Un référentiel de vulgarisation, lu le même jour, rappelle qu'un chat
# ronronne aussi malade, vulnérable ou grondé — donc l'état pouvait être
# l'exact contraire de ce que le pourcentage semblait certifier.
#
# « Ronronnement détecté · 15% » dit vrai des deux côtés : ce nombre-là décrit
# la confiance du modèle sur un **son**, et le titre de la carte reste
# l'interprétation assumée qu'on en tire. Le produit ne cesse pas d'interpréter,
# il cesse de faire passer son interprétation pour une mesure.
#
# Le dictionnaire n'a pas de valeur par défaut, à dessein : une classe qui
# entrerait dans `LECTURE_DIRECTE` sans phrase française serait rattrapée par
# `test_toute_lecture_directe_a_son_nom_francais`, jamais par un repli
# silencieux qui remettrait de l'anglais sur la carte.
NOM_FRANCAIS = {
    "Purr": "Ronronnement détecté",
}


def blocs(verdict: Verdict) -> list[Ligne]:
    """Place tout le texte de la carte dans la bande sûre, et rien en dehors.

    Le bloc est **centré verticalement** dans la bande plutôt que calé en
    haut : deux lignes de titre et cinq lignes de titre doivent rester
    également à l'aise, et un calage haut ferait sortir les cartes bavardes.
    """
    parure = habiller(verdict.intention)
    teintes = palette(verdict.intention)

    titre = couper(parure.titre, TAILLE_TITRE)
    sous = couper(parure.sous_titre, TAILLE_SOUS_TITRE)

    pas_titre = int(TAILLE_TITRE * INTERLIGNE)
    pas_sous = int(TAILLE_SOUS_TITRE * INTERLIGNE)
    ecart = 56  # respiration entre le titre et le sous-titre

    # ── La règle du §1, rendue structurelle ────────────────────────────────
    # Le bloc de confiance n'existe que pour une lecture MESUREE. Il n'y a
    # aucun autre chemin : un verdict PROVISOIRE ou AUCUNE ne peut pas
    # afficher de pourcentage, même si l'appelant le demandait.
    mention = None
    if verdict.source is Source.MESUREE:
        mention = f"{NOM_FRANCAIS[verdict.classe_dominante]} · {verdict.confiance:.0%}"

    total = (len(titre) * pas_titre + ecart + len(sous) * pas_sous
             + (int(TAILLE_MENTION * INTERLIGNE) + 40 if mention else 0))

    y = (HAUT_SUR + BAS_SUR) // 2 - total // 2 + TAILLE_TITRE
    sortie: list[Ligne] = []

    for ligne in titre:
        sortie.append(Ligne(ligne, MARGE_LATERALE, y, TAILLE_TITRE, 800, teintes.texte))
        y += pas_titre
    y += ecart
    for ligne in sous:
        sortie.append(Ligne(ligne, MARGE_LATERALE, y, TAILLE_SOUS_TITRE, 400, teintes.texte))
        y += pas_sous
    if mention:
        y += 40
        sortie.append(Ligne(mention, MARGE_LATERALE, y, TAILLE_MENTION, 600, teintes.accent))

    return sortie


def en_svg(verdict: Verdict) -> str:
    """Rend la carte complète. Aucune dépendance, aucun fichier externe."""
    teintes = palette(verdict.intention)
    lignes = blocs(verdict)

    # La barre d'accent tient lieu de signature visuelle : une seule couleur
    # d'accent par carte, règle de style du dépôt. Elle est posée **dans** la
    # bande sûre, sinon elle disparaît sous l'habillage de la plateforme.
    haut_barre = min(l.y for l in lignes) - TAILLE_TITRE - 44

    corps = "\n".join(
        f'  <text x="{l.x}" y="{l.y}" font-size="{l.taille}" font-weight="{l.graisse}" '
        f'fill="{l.couleur}">{_echapper(l.texte)}</text>'
        for l in lignes
    )

    # L'identifiant du dégradé porte l'intention, et ce n'est pas cosmétique.
    #
    # Un `id` est global au **document**, pas au SVG. Deux cartes inlinées dans
    # la même page avec `id="fond"` font que les deux `url(#fond)` résolvent
    # vers le premier dégradé : la seconde carte prend la couleur de la
    # première. Chaque fichier pris isolément reste juste, si bien que rien ne
    # le signale — c'est la planche de contrôle qui l'a montré, cinq cartes
    # toutes vertes alors que les cinq palettes étaient bonnes.
    #
    # Le cas n'est pas théorique : ces cartes ont vocation à être posées dans
    # une page web, plusieurs à la fois.
    cle = verdict.intention.value

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{LARGEUR}" height="{HAUTEUR}" viewBox="0 0 {LARGEUR} {HAUTEUR}">
  <defs>
    <linearGradient id="fond-{cle}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{teintes.fond}"/>
      <stop offset="100%" stop-color="{teintes.fond_bas}"/>
    </linearGradient>
  </defs>
  <rect width="{LARGEUR}" height="{HAUTEUR}" fill="url(#fond-{cle})"/>
  <rect x="{MARGE_LATERALE}" y="{haut_barre}" width="120" height="10" rx="5" fill="{teintes.accent}"/>
  <g font-family="Inter, Roboto, 'Helvetica Neue', Arial, sans-serif">
{corps}
  </g>
</svg>
'''
