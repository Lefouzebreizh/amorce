"""Charte du recueil « Roussy & Zéphy » — données de référence du Tome 1.

Ce module ne contient que des données et des calculs de géométrie. Il est
délibérément séparé des outils (`kdp.py`) : l'ordre des pages et les cotes KDP
changent d'un tome à l'autre, alors que la mécanique d'assemblage, elle, ne
bouge pas. Ouvrir un seul fichier doit suffire pour préparer un Tome 2.

Les cotes viennent de la charte fournie par l'auteur. Là où elles s'écartent
des spécifications publiées par KDP, l'écart est signalé en commentaire plutôt
que corrigé en douce : c'est une décision éditoriale, pas un bug.
"""

from dataclasses import dataclass

# --- Géométrie ---------------------------------------------------------------

POUCE_EN_POINTS = 72.0  # unité native du PDF

FORMAT_ROGNE = 8.5      # format carré fini, en pouces
FOND_PERDU = 0.125      # débord de sécurité pour le massicot
DPI_CIBLE = 300         # résolution visée par KDP pour l'impression couleur

# Épaisseur de tranche par page, papier couleur standard KDP (blanc ou crème).
# Une valeur par feuille imprimée : la tranche se calcule sur le nombre de
# PAGES du PDF intérieur, pas sur le nombre de feuilles.
EPAISSEUR_PAR_PAGE = 0.002252

# KDP n'accepte pas un livre broché de moins de 24 pages, et refuse un nombre
# de pages impair. Les deux contraintes se contrôlent avant tout envoi.
PAGES_MINIMUM_KDP = 24

# Zone de sécurité : rien de signifiant (texte, macaron, bulle) ne doit tomber
# à moins de cette distance du bord rogné.
MARGE_SECURITE = 0.25


@dataclass(frozen=True)
class Gabarit:
    """Dimensions d'une page PDF, en pouces."""

    largeur: float
    hauteur: float

    @property
    def points(self) -> tuple[float, float]:
        return (self.largeur * POUCE_EN_POINTS, self.hauteur * POUCE_EN_POINTS)

    @property
    def rapport(self) -> float:
        return self.largeur / self.hauteur


# Gabarit intérieur demandé par la charte.
#
# ATTENTION — la charte se contredit d'une ligne à l'autre : « 0,125 pouce de
# fond perdu tout autour » donnerait 8,5 + 2 × 0,125 = 8,75 po, alors que le
# résultat annoncé est 8,625 po (répété en millimètres : 219,1 mm). On retient
# le chiffre, énoncé deux fois, plutôt que la dérivation : 8,625 × 8,625.
# Conséquence à connaître : cela ne laisse que 0,0625 po (1,6 mm) de débord par
# côté, soit la moitié de ce que réclame le massicot de KDP.
GABARIT_INTERIEUR = Gabarit(8.625, 8.625)

# Gabarit intérieur tel que KDP le spécifie réellement pour un fond perdu : le
# débord s'ajoute en haut, en bas et sur la tranche extérieure, mais JAMAIS
# côté reliure — d'où une page plus haute que large. Disponible sous
# `--kdp-strict` pour qui veut se conformer à la lettre de l'imprimeur.
GABARIT_INTERIEUR_KDP = Gabarit(
    FORMAT_ROGNE + FOND_PERDU,
    FORMAT_ROGNE + 2 * FOND_PERDU,
)


def gabarit_couverture(nombre_de_pages: int) -> tuple[Gabarit, float]:
    """Renvoie le gabarit de la couverture à plat et l'épaisseur de tranche.

    La couverture est une seule pièce : dos + tranche + face, avec du fond
    perdu tout autour. Sa largeur dépend donc du nombre de pages intérieures.
    """
    tranche = nombre_de_pages * EPAISSEUR_PAR_PAGE
    gabarit = Gabarit(
        2 * FORMAT_ROGNE + tranche + 2 * FOND_PERDU,
        FORMAT_ROGNE + 2 * FOND_PERDU,
    )
    return gabarit, tranche


# --- Nommage -----------------------------------------------------------------

PREFIXE = "RoussyEtZephy"
EXTENSION_CANONIQUE = ".webp"


def nom_de_page(numero: int, slug: str, extension: str = EXTENSION_CANONIQUE) -> str:
    """RoussyEtZephy_Page07_LAraigneeAuPlafond.webp"""
    return f"{PREFIXE}_Page{numero:02d}_{slug}{extension}"


# --- Ordre du Tome 1 ---------------------------------------------------------


@dataclass(frozen=True)
class Page:
    numero: int
    slug: str          # segment de nom de fichier, sans accent ni espace
    titre: str         # titre lisible, tel qu'il doit figurer sur l'illustration
    nature: str        # 'histoire' | 'atelier' | 'auteur'


# `titre` est la forme de référence : c'est elle qui doit apparaître dans le
# bandeau supérieur de l'illustration et dans le sommaire de la 4e de
# couverture. La casse suit la charte — minuscules sauf initiale et noms
# propres — et non la capitalisation à l'anglaise des rushes actuels.
TOME_1: tuple[Page, ...] = (
    Page(1,  "FaireLeSinge",                    "Faire le singe",                       "histoire"),
    Page(2,  "FaimDeLoup",                      "Avoir une faim de loup",               "histoire"),
    Page(3,  "TempsDeChien",                    "Un temps de chien",                    "histoire"),
    Page(4,  "ChatDansLaGorge",                 "Avoir un chat dans la gorge",          "histoire"),
    Page(5,  "DonnerSaLangueAuChat",            "Donner sa langue au chat",             "histoire"),
    Page(6,  "LaTeteDansLesNuages",             "La tête dans les nuages",              "histoire"),
    Page(7,  "LAraigneeAuPlafond",              "L'araignée au plafond",                "histoire"),
    Page(8,  "MonCerveauAOublieLeBoutonOff",    "Mon cerveau a oublié le bouton OFF",   "histoire"),
    Page(9,  "LaFlammeQuiSeteint",              "La flamme qui s'éteint",               "histoire"),
    Page(10, "FierCommeUnPaon",                 "Fier comme un paon",                   "histoire"),
    Page(11, "SeTenirACoeur",                   "Se tenir à cœur",                      "histoire"),
    Page(12, "LeSecretDeLHermine",              "Le secret de l'hermine",               "histoire"),
    # Titre au singulier, comme la planche ; le slug reste au pluriel parce que
    # c'est un identifiant de fichier fixé par la charte de nommage, pas un titre.
    Page(13, "TempetesEtBigorneaux",            "Tempête et bigorneaux",                "histoire"),
    Page(14, "LeSecretDesVaguesDYs",            "Le secret des vagues d'Ys",            "histoire"),
    # « Fest Noz » gardé tel que la planche l'écrit, comme « OFF » en page 8 :
    # traité en nom propre, il échappe à la mise en minuscules des titres.
    Page(15, "LaMagieDuFestNoz",                "La magie du Fest Noz",                 "histoire"),
    Page(16, "LeMurmureDesEtoiles",             "Le murmure des étoiles",               "histoire"),
    Page(17, "LeGouterDesMenhirs",              "Le goûter des menhirs",                "atelier"),
    Page(18, "DessineTonAnimal",                "Dessine ton propre animal magique",    "atelier"),
    Page(19, "Coloriage",                       "Coloriage",                            "atelier"),
    Page(20, "MonJournalDeLumiere",             "Mon journal de lumière",               "atelier"),
    Page(21, "MonHistoire",                     "Mon histoire",                         "auteur"),
)

# --- Ordre du Tome 2 ---------------------------------------------------------
#
# Même structure que le Tome 1 : douze aventures d'émotions, quatre escales
# bretonnes, quatre pages d'atelier, la page de l'auteur. Le détail de chaque
# histoire — texte de bulle, parchemin, prompt — est dans kdp/tome2/DOSSIER.md.

TOME_2: tuple[Page, ...] = (
    Page(1,  "LaBouleAuVentre",             "La boule au ventre",                "histoire"),
    Page(2,  "MarcherSurDesOeufs",          "Marcher sur des œufs",              "histoire"),
    Page(3,  "RireJaune",                   "Rire jaune",                        "histoire"),
    Page(4,  "LaTeteCommeUnePassoire",      "La tête comme une passoire",        "histoire"),
    Page(5,  "NePasEtreDansSonAssiette",    "Ne pas être dans son assiette",     "histoire"),
    Page(6,  "AvoirLeCafard",               "Avoir le cafard",                   "histoire"),
    Page(7,  "SeFaireDesCheveuxBlancs",     "Se faire des cheveux blancs",       "histoire"),
    Page(8,  "EtreACoteDeSesPompes",        "Être à côté de ses pompes",         "histoire"),
    Page(9,  "PrendreLaMouche",             "Prendre la mouche",                 "histoire"),
    Page(10, "AvoirUnPoilDansLaMain",       "Avoir un poil dans la main",        "histoire"),
    Page(11, "SeNoyerDansUnVerreDEau",      "Se noyer dans un verre d'eau",      "histoire"),
    Page(12, "AvoirLeCoeurGros",            "Avoir le cœur gros",                "histoire"),
    Page(13, "AvoirLePiedMarin",            "Avoir le pied marin",               "histoire"),
    Page(14, "ChercherMidiAQuatorzeHeures", "Chercher midi à quatorze heures",   "histoire"),
    Page(15, "AvoirLeVentEnPoupe",          "Avoir le vent en poupe",            "histoire"),
    Page(16, "LeSommeilDuKorrigan",         "Le sommeil du korrigan",            "histoire"),
    Page(17, "LeBalDesLucioles",            "Le bal des lucioles",               "atelier"),
    Page(18, "DessineTaTempete",            "Dessine ta propre tempête",         "atelier"),
    Page(19, "Coloriage",                   "Coloriage",                         "atelier"),
    Page(20, "MonCarnetDeCourage",          "Mon carnet de courage",             "atelier"),
    Page(21, "MonHistoire",                 "Mon histoire",                      "auteur"),
)

TOMES: dict[int, tuple[Page, ...]] = {1: TOME_1, 2: TOME_2}


def pages(tome: int = 1) -> tuple[Page, ...]:
    """Sommaire d'un tome. Les outils passent par là plutôt que par TOME_1.

    Le nommage, l'assemblage et le contrôle sont les mêmes d'un tome à l'autre :
    seul le sommaire change. Le câbler en dur aurait obligé à dupliquer la
    chaîne au Tome 2, avec la certitude que les deux copies divergeraient.
    """
    if tome not in TOMES:
        raise SystemExit(f"tome inconnu : {tome} (connus : {sorted(TOMES)})")
    return TOMES[tome]


COUVERTURE_FACE = "couverture_face"
COUVERTURE_DOS = "couverture_dos"
