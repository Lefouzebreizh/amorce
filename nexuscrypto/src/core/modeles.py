#!/usr/bin/env python3
"""Ce qui circule d'un module à l'autre.

Tout est gelé (`frozen=True`). Ce n'est pas un tic de style : le contexte d'un
actif traverse quatre modules qui n'ont pas le même auteur ni le même rythme de
modification, et un objet mutable partagé entre le scoring et la gestion du
risque finit toujours par être corrigé au passage par l'un des deux. Une donnée
de marché est un relevé — elle ne se retouche pas, elle se remplace.

Les identifiants sont en anglais, les commentaires et les messages en français :
c'est la règle du dépôt.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from enum import Enum
from typing import Iterable


# --------------------------------------------------------------------------
# Énumérations
# --------------------------------------------------------------------------


class Mode(str, Enum):
    """Simulation ou argent réel. La valeur par défaut du système est SIMULATION,
    et le passage en RÉEL demande un geste explicite en ligne de commande."""

    SIMULATION = "simulation"
    REEL = "production"


class Action(str, Enum):
    """Ce que le moteur de décision peut proposer.

    `TEMPORISER` n'est pas `ATTENDRE` : le premier veut dire « le calendrier
    DCA dit d'acheter, mais la valorisation est en surchauffe, on reporte » ;
    le second veut dire « rien à faire aujourd'hui ». La distinction compte
    pour le récapitulatif : un report se raconte, une absence non.
    """

    ACHETER = "acheter"
    RENFORCER = "renforcer"
    TEMPORISER = "temporiser"
    ATTENDRE = "attendre"
    ALLEGER = "alleger"
    SORTIR = "sortir"


class Sens(str, Enum):
    ACHAT = "achat"
    VENTE = "vente"


class TypeOrdre(str, Enum):
    MARCHE = "marche"
    LIMITE = "limite"


class Gravite(int, Enum):
    """Gravité d'une actualité macro. Ordonnée pour pouvoir se comparer."""

    INFO = 0
    SURVEILLANCE = 1
    ELEVEE = 2
    CRITIQUE = 3


class Zone(str, Enum):
    """Zone de valorisation, telle que le DCA dynamique la lit."""

    PEUR_EXTREME = "peur_extreme"
    PEUR = "peur"
    NEUTRE = "neutre"
    AVIDITE = "avidite"
    AVIDITE_EXTREME = "avidite_extreme"


# --------------------------------------------------------------------------
# Marché
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Bougie:
    """Une bougie OHLCV. `horodatage` est toujours en UTC et conscient du fuseau
    — une comparaison entre un instant naïf et un instant conscient lève, et
    elle lèverait au pire endroit : au milieu d'un calcul de dérive."""

    horodatage: datetime
    ouverture: float
    haut: float
    bas: float
    cloture: float
    volume: float

    def __post_init__(self) -> None:
        if self.horodatage.tzinfo is None:
            raise ValueError("Une bougie doit porter un horodatage conscient du fuseau (UTC).")
        if self.bas > self.haut:
            raise ValueError(f"Bougie incohérente : bas {self.bas} au-dessus du haut {self.haut}.")
        if self.volume < 0:
            raise ValueError("Un volume négatif n'existe pas.")

    @property
    def amplitude(self) -> float:
        return self.haut - self.bas


@dataclass(frozen=True, slots=True)
class SerieOHLCV:
    """Une série de bougies, du plus ancien au plus récent."""

    symbole: str
    intervalle: str
    bougies: tuple[Bougie, ...]

    def __post_init__(self) -> None:
        horodatages = [b.horodatage for b in self.bougies]
        if horodatages != sorted(horodatages):
            raise ValueError(
                f"Les bougies de {self.symbole} ne sont pas dans l'ordre chronologique."
            )

    def __len__(self) -> int:
        return len(self.bougies)

    @property
    def clotures(self) -> tuple[float, ...]:
        return tuple(b.cloture for b in self.bougies)

    @property
    def volumes(self) -> tuple[float, ...]:
        return tuple(b.volume for b in self.bougies)

    @property
    def dernier_prix(self) -> float:
        if not self.bougies:
            raise ValueError(f"Série vide pour {self.symbole} : aucun prix à lire.")
        return self.bougies[-1].cloture


@dataclass(frozen=True, slots=True)
class CarnetOrdres:
    """Carnet d'ordres agrégé. `achats` et `ventes` sont des couples
    (prix, quantité), triés du meilleur au moins bon de chaque côté."""

    symbole: str
    achats: tuple[tuple[float, float], ...]
    ventes: tuple[tuple[float, float], ...]
    horodatage: datetime

    @property
    def meilleur_achat(self) -> float | None:
        return self.achats[0][0] if self.achats else None

    @property
    def meilleure_vente(self) -> float | None:
        return self.ventes[0][0] if self.ventes else None

    @property
    def milieu(self) -> float | None:
        if not self.achats or not self.ventes:
            return None
        return (self.achats[0][0] + self.ventes[0][0]) / 2

    @property
    def spread_relatif(self) -> float | None:
        """L'écart achat-vente rapporté au milieu. C'est le premier signal de
        liquidité utilisable : un spread qui triple pendant une chute dit que
        le carnet se vide, bien avant que le volume ne le montre."""

        milieu = self.milieu
        if milieu is None or milieu <= 0:
            return None
        return (self.ventes[0][0] - self.achats[0][0]) / milieu

    @property
    def desequilibre(self) -> float | None:
        """Entre -1 (mur de vente) et +1 (mur d'achat)."""

        poids_achat = sum(q for _, q in self.achats)
        poids_vente = sum(q for _, q in self.ventes)
        total = poids_achat + poids_vente
        if total <= 0:
            return None
        return (poids_achat - poids_vente) / total


# --------------------------------------------------------------------------
# On-chain, sentiment, macro
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class MetriqueOnchain:
    """Ce que les sources on-chain rendent pour un actif.

    `flux_reserves_exchanges_usd` est signé, et le signe est contre-intuitif :
    **négatif = sortie des plateformes**, donc jetons qui partent en portefeuille
    froid, donc lecture haussière. Le sens a été inversé une fois dans un
    brouillon et le score en devenait exactement l'opposé sans qu'aucun test ne
    le voie — d'où cette phrase, et le test qui la garde.
    """

    actif: str
    tvl_usd: float | None = None
    variation_tvl_7j: float | None = None
    volume_dex_24h_usd: float | None = None
    flux_reserves_exchanges_usd: float | None = None
    liquidite_dex_usd: float | None = None
    source: str = "inconnue"


@dataclass(frozen=True, slots=True)
class SignalSentiment:
    """Température communautaire.

    `fear_greed` est l'indice public 0-100. `score_social` est notre propre
    lecture, entre -1 et +1, calculée sur les messages relevés. Les deux sont
    gardés séparés parce qu'ils se contredisent utilement : un indice à 20
    pendant que le social remonte est le creux qu'on cherche.
    """

    fear_greed: int | None = None
    score_social: float | None = None
    volume_mentions: int | None = None
    sources: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.fear_greed is not None and not 0 <= self.fear_greed <= 100:
            raise ValueError(f"Indice Fear & Greed hors bornes : {self.fear_greed}.")
        if self.score_social is not None and not -1.0 <= self.score_social <= 1.0:
            raise ValueError(f"Score social hors bornes : {self.score_social}.")

    @property
    def zone(self) -> Zone:
        """La zone de valorisation telle que le DCA la lit. Sans indice, on
        renvoie NEUTRE : l'absence de donnée ne doit jamais pousser à acheter
        plus, seulement à ne rien changer."""

        if self.fear_greed is None:
            return Zone.NEUTRE
        if self.fear_greed <= 24:
            return Zone.PEUR_EXTREME
        if self.fear_greed <= 44:
            return Zone.PEUR
        if self.fear_greed <= 65:
            return Zone.NEUTRE
        if self.fear_greed <= 84:
            return Zone.AVIDITE
        return Zone.AVIDITE_EXTREME


@dataclass(frozen=True, slots=True)
class Actualite:
    """Une entrée de flux, avec la gravité qu'on lui a attribuée."""

    titre: str
    source: str
    publiee_le: datetime
    gravite: Gravite = Gravite.INFO
    mots_cles: tuple[str, ...] = ()
    lien: str = ""


# --------------------------------------------------------------------------
# Contexte et décision
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Contexte:
    """Tout ce qu'on sait d'un actif à un instant donné.

    Chaque champ est facultatif sauf la série de prix : une source qui tombe
    n'arrête pas le système, elle retire sa contribution du score et le dit.
    C'est la différence entre un moteur qui s'arrête à la première panne de
    DeFiLlama et un moteur qui continue en sachant qu'il voit moins bien.
    """

    actif: str
    releve_le: datetime
    serie: SerieOHLCV
    carnet: CarnetOrdres | None = None
    onchain: MetriqueOnchain | None = None
    sentiment: SignalSentiment | None = None
    actualites: tuple[Actualite, ...] = ()
    sources_en_panne: tuple[str, ...] = ()

    @property
    def prix(self) -> float:
        return self.serie.dernier_prix

    @property
    def gravite_macro(self) -> Gravite:
        if not self.actualites:
            return Gravite.INFO
        return max(a.gravite for a in self.actualites)


@dataclass(frozen=True, slots=True)
class Score:
    """L'indice de confiance, et surtout son détail.

    Le total seul est inutilisable : « 63 » ne dit pas s'il faut regarder le
    RSI ou le flux des plateformes. Chaque composante est donc conservée, et
    c'est elle qui part dans la notification.
    """

    total: float
    technique: float
    sentiment: float
    onchain: float
    poids_effectifs: dict[str, float] = field(default_factory=dict)
    raisons: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not 0 <= self.total <= 100:
            raise ValueError(f"Un indice de confiance vaut de 0 à 100, reçu {self.total}.")


@dataclass(frozen=True, slots=True)
class Decision:
    """Ce que la stratégie propose. Elle ne passe aucun ordre : elle décrit."""

    actif: str
    action: Action
    montant_usd: float
    score: Score
    prix_reference: float
    raisons: tuple[str, ...] = ()

    @property
    def agit(self) -> bool:
        return self.action in (Action.ACHETER, Action.RENFORCER, Action.ALLEGER, Action.SORTIR)


# --------------------------------------------------------------------------
# Exécution et portefeuille
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Ordre:
    identifiant: str
    actif: str
    sens: Sens
    type_ordre: TypeOrdre
    quantite: float
    prix_limite: float | None = None
    motif: str = ""

    def __post_init__(self) -> None:
        if self.quantite <= 0:
            raise ValueError(f"Ordre {self.identifiant} : quantité nulle ou négative.")
        if self.type_ordre is TypeOrdre.LIMITE and self.prix_limite is None:
            raise ValueError(f"Ordre {self.identifiant} : un ordre limite exige un prix.")


@dataclass(frozen=True, slots=True)
class Execution:
    """Le résultat d'un ordre. `glissement` est signé et exprimé en fraction du
    prix de référence : positif quand on a payé plus cher que prévu."""

    ordre: Ordre
    prix_execute: float
    quantite_executee: float
    frais_usd: float
    horodatage: datetime
    glissement: float = 0.0
    simule: bool = True

    @property
    def montant_usd(self) -> float:
        return self.prix_execute * self.quantite_executee


@dataclass(frozen=True, slots=True)
class Position:
    actif: str
    quantite: float
    prix_moyen: float
    ouverte_le: datetime
    plus_haut_atteint: float = 0.0

    def valeur(self, prix: float) -> float:
        return self.quantite * prix

    def pnl_latent(self, prix: float) -> float:
        return (prix - self.prix_moyen) * self.quantite

    def pnl_relatif(self, prix: float) -> float:
        if self.prix_moyen <= 0:
            return 0.0
        return (prix - self.prix_moyen) / self.prix_moyen

    def avec_achat(self, quantite: float, prix: float) -> "Position":
        """Renforcement : le prix moyen se recalcule, la date d'ouverture non.
        Garder la date de la *première* entrée est ce qui permet de lire l'âge
        réel d'une ligne DCA, qui se renforce vingt fois."""

        totale = self.quantite + quantite
        if totale <= 0:
            raise ValueError("Renforcement de quantité nulle.")
        moyen = (self.quantite * self.prix_moyen + quantite * prix) / totale
        return replace(self, quantite=totale, prix_moyen=moyen)

    def avec_vente(self, quantite: float) -> "Position | None":
        """Vente partielle ou totale. Rend `None` quand la ligne est soldée —
        une position à quantité zéro qui traîne fausse toutes les moyennes."""

        restante = self.quantite - quantite
        if restante <= 1e-12:
            return None
        return replace(self, quantite=restante)

    def avec_plus_haut(self, prix: float) -> "Position":
        return replace(self, plus_haut_atteint=max(self.plus_haut_atteint, prix))


@dataclass(frozen=True, slots=True)
class Portefeuille:
    """État du capital. Les positions sont indexées par actif."""

    liquidites_usd: float
    positions: dict[str, Position] = field(default_factory=dict)
    devise: str = "USDT"

    def valeur_totale(self, prix: dict[str, float]) -> float:
        engage = sum(p.valeur(prix.get(a, p.prix_moyen)) for a, p in self.positions.items())
        return self.liquidites_usd + engage

    def allocation(self, prix: dict[str, float]) -> dict[str, float]:
        """Poids réel de chaque ligne, en fraction du total. Sert à mesurer la
        dérive par rapport à l'allocation cible du portefeuille."""

        total = self.valeur_totale(prix)
        if total <= 0:
            return {}
        return {
            actif: position.valeur(prix.get(actif, position.prix_moyen)) / total
            for actif, position in self.positions.items()
        }


def moyenne(valeurs: Iterable[float]) -> float:
    """Moyenne tolérante au vide — rend 0.0 plutôt que de lever. Utilisée
    partout où l'absence de donnée doit produire une contribution neutre."""

    suite = list(valeurs)
    if not suite:
        return 0.0
    return sum(suite) / len(suite)


def borner(valeur: float, minimum: float, maximum: float) -> float:
    """Ramène une valeur entre deux bornes. Toutes les notes du système passent
    par ici avant d'être rendues : un score hors bornes lève dans `Score`, et il
    vaut mieux le borner à la source que découvrir l'exception en production."""

    if math.isnan(valeur):
        return minimum
    return max(minimum, min(maximum, valeur))


def maintenant() -> datetime:
    """Instant courant, toujours conscient du fuseau. Le système n'appelle
    jamais `datetime.now()` sans fuseau : la moitié des bugs d'horodatage de ce
    dépôt viennent de là."""

    return datetime.now(timezone.utc)
