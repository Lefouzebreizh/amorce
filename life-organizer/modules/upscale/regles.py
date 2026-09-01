"""Décider ce qui mérite un agrandissement, de combien, et où le poser.

Six décisions tiennent ce fichier — et aucune n'a besoin du modèle, ce qui est
tout l'intérêt : le module se juge, se règle et se corrige alors que l'inférence
reste hors de portée.

1. **Agrandir n'est pas restaurer.** Une photo floue agrandie est une photo
   floue, en plus grand — et en dix fois plus lourde. Quand la netteté a été
   mesurée et qu'elle est sous le seuil, on refuse. Une netteté **non mesurée**
   ne vaut pas « nette » : dans le doute on agrandit, parce que le coût d'un
   refus injustifié est une photo qui reste en basse définition, alors que le
   coût d'un agrandissement inutile est quelques minutes de calcul et un fichier
   posé à côté qu'on peut effacer.

2. **Le facteur se borne par la largeur obtenue, pas par le réglage.** Un
   ×4 demandé sur une image de 1200 px donnerait 4800 px : personne n'en a
   besoin, et le calcul coûte seize fois celui d'un ×1. Le facteur effectif est
   donc le plus grand facteur autorisé qui ne dépasse pas
   `largeur_cible_maximale`. S'il tombe à 1, il n'y a rien à faire.

3. **On écrit à côté, jamais à la place.** Un agrandissement raté ne doit pas
   coûter l'original — c'est la règle du module, et elle est dans le nom de
   sortie plutôt que dans une consigne : `photo.jpg` donne `photo_hd.jpg`.

4. **Une sortie déjà présente vaut travail déjà fait.** C'est ce qui rend la
   commande reprenable : interrompue au bout de quarante images sur deux cents,
   elle repart à la quarante et unième. Sans cela, un lot long ne se lance
   qu'une fois — et un agrandissement sur processeur prend des minutes par
   image, donc il *sera* interrompu.

5. **Une image déjà agrandie n'est jamais un candidat.** `photo_hd.jpg`
   rencontrée au passage suivant produirait `photo_hd_hd.jpg`, puis
   `photo_hd_hd_hd.jpg`. Le suffixe se reconnaît sur le nom, avant tout examen.

6. **Le lot est borné.** `lot_maximal` coupe la file, et le compte rendu dit
   combien restent. Proposer deux mille agrandissements à quelqu'un qui en
   lancera vingt-cinq n'informe pas, cela décourage.

Rien ici n'ouvre un fichier : `traitement.py` mesure, ce fichier juge.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Au-delà, l'agrandissement ne se voit plus sur un écran et le fichier devient
# encombrant. Valeur de repli quand la configuration ne dit rien.
LARGEUR_CIBLE_PAR_DEFAUT = 4000

# Les facteurs qu'un modèle d'agrandissement sait rendre. Real-ESRGAN est
# entraîné en ×2 et ×4 ; un ×3 se fabrique en réduisant un ×4, ce qui coûte le
# prix du ×4 pour un résultat moindre. On ne le propose donc pas.
FACTEURS = (1, 2, 4)


@dataclass(frozen=True)
class Candidat:
    """Ce qu'on sait d'une image avant de décider de l'agrandir.

    `nettete` à `None` veut dire « pas mesurée », et non « nulle » — la
    distinction décide de la décision 1.
    """

    chemin: Path
    largeur: int
    hauteur: int
    poids_octets: int = 0
    nettete: float | None = None

    @property
    def definition(self) -> int:
        return self.largeur * self.hauteur


@dataclass(frozen=True)
class Agrandissement:
    """Ce qu'on ferait de cette image, et pourquoi.

    `sortie` à `None` veut dire « on n'y touche pas ». Le motif dit lequel des
    refus s'applique : ils appellent des suites différentes — relever un seuil,
    nettoyer d'abord, ou ne rien faire du tout.
    """

    candidat: Candidat
    facteur: int
    sortie: Path | None
    motif: str
    # La raison du refus, en une étiquette stable. Le motif, lui, porte les
    # valeurs mesurées et diffère donc d'une image à l'autre : regrouper sur le
    # motif ferait autant de catégories que de fichiers, ce qui est exactement
    # ce qu'un compte rendu doit éviter.
    cause: str = ""

    @property
    def retenu(self) -> bool:
        return self.sortie is not None

    @property
    def largeur_obtenue(self) -> int:
        return self.candidat.largeur * self.facteur


def deja_agrandie(chemin: Path, suffixe: str) -> bool:
    """Le fichier porte-t-il déjà la marque d'un agrandissement ?

    Sur le nom seul, et avant tout examen : c'est ce qui empêche la chaîne
    `photo_hd_hd_hd.jpg` au fil des passages.
    """
    return bool(suffixe) and chemin.stem.endswith(suffixe)


def nom_de_sortie(chemin: Path, suffixe: str) -> Path:
    """`photo.jpg` → `photo_hd.jpg`, dans le même dossier.

    Le même dossier, parce qu'un agrandissement se compare à son original :
    l'envoyer ailleurs oblige à ouvrir deux fenêtres pour juger s'il valait le
    coup.
    """
    return chemin.with_name(f"{chemin.stem}{suffixe}{chemin.suffix}")


def facteur_effectif(largeur: int, facteur_voulu: int,
                     largeur_cible_maximale: int = LARGEUR_CIBLE_PAR_DEFAUT) -> int:
    """Le plus grand facteur autorisé qui ne dépasse pas la largeur visée.

    Rend 1 quand même le plus petit agrandissement dépasserait la cible — et 1
    signifie « rien à faire », que `decider` traduit en refus.
    """
    autorises = [f for f in FACTEURS if f <= max(1, facteur_voulu)]
    retenus = [f for f in autorises if largeur * f <= largeur_cible_maximale]
    return max(retenus) if retenus else 1


def decider(candidat: Candidat, config: dict) -> Agrandissement:
    """Ce qu'il faut faire de cette image. Pure : ni disque, ni modèle."""
    reglages = config.get("upscale", {})
    suffixe = reglages.get("suffixe", "_hd")

    def refus(cause: str, motif: str) -> Agrandissement:
        return Agrandissement(candidat, 1, None, motif, cause)

    if deja_agrandie(candidat.chemin, suffixe):
        return refus("déjà agrandie", f"porte déjà le suffixe « {suffixe} »")

    largeur_max = reglages.get("largeur_source_maximale", 1280)
    if candidat.largeur > largeur_max:
        return refus("déjà assez définie",
                     f"{candidat.largeur} px de large, au-delà du seuil de {largeur_max} px")

    minimale = reglages.get("largeur_source_minimale", 0)
    if candidat.largeur < minimale:
        # Une vignette de soixante pixels agrandie quatre fois reste une
        # vignette : il n'y a pas d'information à retrouver, seulement des
        # pixels à inventer.
        return refus("trop petite",
                     f"{candidat.largeur} px de large, trop peu pour qu'il reste "
                     f"quelque chose à retrouver (seuil {minimale} px)")

    seuil_nettete = reglages.get("nettete_minimale")
    if seuil_nettete is not None and candidat.nettete is not None \
            and candidat.nettete < seuil_nettete:
        # Décision 1 : agrandir n'est pas restaurer.
        return refus("floue",
                     f"netteté {candidat.nettete:.0f} sous le seuil {seuil_nettete} — "
                     "agrandir une photo floue la rend floue et lourde")

    facteur = facteur_effectif(
        candidat.largeur,
        reglages.get("facteur", 2),
        reglages.get("largeur_cible_maximale", LARGEUR_CIBLE_PAR_DEFAUT),
    )
    if facteur <= 1:
        return refus("aucun facteur utile",
                     f"aucun facteur ne tient sous "
                     f"{reglages.get('largeur_cible_maximale', LARGEUR_CIBLE_PAR_DEFAUT)} px")

    return Agrandissement(
        candidat, facteur, nom_de_sortie(candidat.chemin, suffixe),
        f"{candidat.largeur} px → {candidat.largeur * facteur} px (×{facteur})",
    )


def file_a_traiter(agrandissements: list[Agrandissement], deja_faits: set[Path],
                   lot_maximal: int = 0) -> tuple[list[Agrandissement], int]:
    """La file du passage, et combien restent après elle.

    Deux choses en une, et c'est voulu : une file qui ne dirait pas ce qu'elle
    laisse derrière ferait croire le travail fini à chaque passage.

    `deja_faits` est l'ensemble des sorties qui existent déjà sur le disque.
    C'est là toute la reprise : elle ne demande ni journal, ni base, ni état à
    tenir à jour — le disque *est* l'état, et il ne peut pas mentir sur ce qu'il
    contient.
    """
    restants = [a for a in agrandissements if a.retenu and a.sortie not in deja_faits]
    if lot_maximal and len(restants) > lot_maximal:
        return restants[:lot_maximal], len(restants) - lot_maximal
    return restants, 0


def compter(agrandissements: list[Agrandissement]) -> dict[str, int]:
    """Les refus par cause, pour un compte rendu qui tienne en trois lignes.

    Sur la cause et non sur le motif : le motif porte les valeurs mesurées, et
    regrouper dessus rendrait « 1500 px de large » et « 1600 px de large »
    différents alors que c'est le même refus.
    """
    compte: dict[str, int] = {}
    for agrandissement in agrandissements:
        if agrandissement.retenu:
            continue
        compte[agrandissement.cause] = compte.get(agrandissement.cause, 0) + 1
    return compte
