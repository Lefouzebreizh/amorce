#!/usr/bin/env python3
"""Ce qui circule d'un module à l'autre.

Tout est gelé (`frozen=True`), pour la même raison que dans NexusCrypto : un
relevé traverse trois couches — lecteurs, valorisation, rédaction — et un objet
mutable partagé finit toujours par être corrigé au passage par l'une d'elles.
Une valeur de patrimoine est une **photo à un instant**, elle ne se retouche
pas, elle se remplace.

Une distinction porte tout le fichier, et c'est la seule qu'il faut retenir :

    valeur = None   →  on ne sait pas
    valeur = 0.0    →  on sait, et c'est zéro

Les confondre est l'erreur qui rend un tableau de patrimoine dangereux plutôt
qu'inutile : une ligne sans prix comptée pour zéro donne un total plausible,
donc cru, donc suivi.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum


class Classe(str, Enum):
    """Les quatre poches. L'ordre de déclaration est l'ordre d'affichage :
    du plus liquide au plus dormant, parce qu'on lit un patrimoine en
    commençant par ce sur quoi on peut agir demain."""

    BOURSE = "bourse"
    CRYPTO = "crypto"
    IMMOBILIER = "immobilier"
    LIQUIDITES = "liquidites"


ETIQUETTES: dict[Classe, str] = {
    Classe.BOURSE: "Bourse",
    Classe.CRYPTO: "Crypto",
    Classe.IMMOBILIER: "Immobilier",
    Classe.LIQUIDITES: "Liquidités",
}


class Disponibilite(str, Enum):
    """L'état d'un lecteur, tel que `main.py sources` l'affiche.

    Trois états et non deux, parce que « rien remonté » a trois causes qui ne
    demandent pas le même geste — c'est la leçon de la sonde du radar : un
    rapport vide ne dit pas s'il faut attendre, réparer, ou remplir un fichier.
    """

    LUE = "lue"                  # la source répond et a rendu quelque chose
    VIDE = "vide"                # la source répond, elle n'a rien à dire
    ABSENTE = "absente"          # le fichier ou le dossier n'existe pas
    ILLISIBLE = "illisible"      # il existe et on ne sait pas le lire
    NON_BRANCHEE = "non_branchee"  # prévue, pas encore raccordée


@dataclass(frozen=True)
class EtatSource:
    """Ce qu'un lecteur rend de lui-même, en plus de ses lignes.

    Séparé des lignes à dessein : une source qui rend zéro ligne et une source
    qui n'a pas répondu produisent le même tableau, et ce sont deux situations
    opposées.
    """

    nom: str
    disponibilite: Disponibilite
    motif: str = ""
    chemin: str = ""
    lignes: int = 0

    @property
    def muette(self) -> bool:
        """Vrai quand la source n'a pas pu être lue — donc quand le total qui
        en découle est incomplet, quoi qu'affiche le reste du tableau."""
        return self.disponibilite in (Disponibilite.ABSENTE, Disponibilite.ILLISIBLE)


@dataclass(frozen=True)
class Ligne:
    """Une position, valorisée en euros.

    `valeur_eur is None` veut dire « prix inconnu », jamais « zéro ». Le
    `releve_le` accompagne le prix et non la ligne : c'est la fraîcheur du
    **cours** qui décide si le total veut dire quelque chose, pas la date à
    laquelle on a écrit le fichier.
    """

    classe: Classe
    nom: str
    detail: str
    source: str
    quantite: float | None = None
    prix_eur: float | None = None
    valeur_eur: float | None = None
    plus_value_eur: float | None = None
    rendement_pct: float | None = None
    releve_le: date | None = None

    def age_jours(self, aujourdhui: date) -> int | None:
        """Depuis combien de jours le cours de cette ligne n'a pas bougé.

        `None` quand la ligne n'a pas de cours à dater — un livret ou un bien
        immobilier ne se périment pas de la même façon qu'un cours de bourse.
        """
        if self.releve_le is None:
            return None
        return (aujourdhui - self.releve_le).days


@dataclass(frozen=True)
class Ecart:
    """La dérive d'une poche contre sa cible.

    Deux mesures et non une : `ecart_pts` dit de combien on s'écarte, en points
    de pourcentage ; `ecart_eur` dit ce que ça représente. La première décide
    s'il faut agir, la seconde combien — et afficher l'une sans l'autre donne
    soit un chiffre qu'on ne sait pas interpréter, soit un montant dont on
    ignore s'il est grave.
    """

    classe: Classe
    valeur_eur: float
    part_pct: float
    cible_pct: float
    ecart_pts: float
    ecart_eur: float        # négatif = sous-pondéré, positif = sur-pondéré
    hors_bande: bool


@dataclass(frozen=True)
class Bilan:
    """Le patrimoine à un instant, et ce qui manque pour le croire.

    `partiel` n'est pas déduit à l'affichage mais porté par le bilan lui-même :
    c'est ce qui permet à la rédaction de retenir son conseil sans avoir à
    refaire le raisonnement, et c'est ce qui garantit qu'elle ne peut pas
    l'oublier.
    """

    lignes: tuple[Ligne, ...]
    ecarts: tuple[Ecart, ...]
    sources: tuple[EtatSource, ...]
    total_eur: float
    partiel: bool
    avertissements: tuple[str, ...]

    @property
    def hors_bande(self) -> tuple[Ecart, ...]:
        return tuple(ecart for ecart in self.ecarts if ecart.hors_bande)
