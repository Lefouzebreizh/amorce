#!/usr/bin/env python3
"""Ce qui circule d'un skill à l'autre.

Le pipeline est un entonnoir, et chaque étage a son type : `Paire` en entrée du
radar, `Candidat` après regroupement, `Metriques` puis `Note` après le calcul
pur, `Securite` après le bouclier, `Pepite` en sortie. Un étage ne peut pas
recevoir la sortie d'un autre par accident.

Trois décisions tiennent ce fichier :

1. **Le regroupement se fait par jeton, pas par paire.** Un jeton dont la
   liquidité est répartie sur trois pools paraît trois fois moins profond qu'il
   n'est, et se ferait éliminer par le filtre de liquidité alors qu'il le passe
   largement. `Candidat.depuis_paires` additionne les pools d'un même jeton sur
   une même chaîne — et rien au-delà : la même adresse sur deux chaînes est
   deux jetons, reliés par un pont dont la profondeur n'est pas garantie.

2. **Le cours de référence est celui du pool le plus profond.** Faire une
   moyenne des variations de prix pondérée par la liquidité serait plus
   élégant et moins vrai : un pool de 4 000 $ affiche des variations
   fantaisistes qui n'ont aucune chance d'être arbitrées.

3. **Tout est figé.** Un candidat traverse cinq skills ; s'il pouvait être
   modifié en route, la raison d'une note deviendrait introuvable. Les skills
   produisent de nouveaux objets, ils n'en corrigent jamais un.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

HEURE = 3600.0


# ---------------------------------------------------------------------------
# Fonction d'appartenance
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Trapeze:
    """Zone saine d'un critère, et pente de part et d'autre.

    Un seuil est binaire, et tout manipulateur se place juste au-dessus. Une
    note linéaire récompense l'extrême, or l'extrême est presque toujours
    fabriqué. Le trapèze dit la seule chose vraie : il existe une plage
    normale, et s'en éloigner *dans les deux sens* est un mauvais signe.
    """

    entree: float
    plateau_bas: float
    plateau_haut: float
    sortie: float

    def __post_init__(self) -> None:
        bornes = (self.entree, self.plateau_bas, self.plateau_haut, self.sortie)
        if list(bornes) != sorted(bornes):
            raise ValueError(f"trapèze non croissant : {bornes}")
        if self.entree == self.sortie:
            raise ValueError(f"trapèze plat, il ne noterait jamais : {bornes}")

    def appartenance(self, valeur: float) -> float:
        """Rend 0 (hors zone), 1 (au cœur), ou l'entre-deux linéaire."""
        if valeur <= self.entree or valeur >= self.sortie:
            return 0.0
        if self.plateau_bas <= valeur <= self.plateau_haut:
            return 1.0
        if valeur < self.plateau_bas:
            return (valeur - self.entree) / (self.plateau_bas - self.entree)
        return (self.sortie - valeur) / (self.sortie - self.plateau_haut)

    @classmethod
    def depuis_liste(cls, valeurs: list[float]) -> Trapeze:
        if len(valeurs) != 4:
            raise ValueError(f"un trapèze s'écrit avec quatre bornes, reçu {valeurs!r}")
        return cls(*(float(v) for v in valeurs))


# ---------------------------------------------------------------------------
# Identité
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Chaine:
    """Une blockchain, et ses quatre noms selon l'interlocuteur."""

    cle: str                       # identifiant DexScreener : `solana`, `bsc`…
    nom: str                       # libellé lisible, pour les alertes
    goplus: str                    # `56`, ou `solana` pour le point d'entrée dédié
    honeypot_is: int | None        # simulateur d'achat/revente, absent hors ETH/BSC/Base
    explorateur: str
    liquidite_min_usd: float
    quotes: frozenset[str]
    sensible_a_la_casse: bool = False

    @property
    def est_evm(self) -> bool:
        return self.goplus.isdigit()

    def normaliser(self, adresse: str) -> str:
        """Met une adresse sous la forme comparable de sa chaîne.

        Les adresses EVM se comparent en minuscules ; celles de Solana sont en
        base58, où `A` et `a` désignent deux comptes différents. Confondre les
        deux ferait passer un faux USDC pour le vrai.
        """
        return adresse if self.sensible_a_la_casse else adresse.lower()

    def est_quote_de_reference(self, adresse: str) -> bool:
        return self.normaliser(adresse) in self.quotes

    def lien_explorateur(self, adresse: str) -> str:
        return f"{self.explorateur}{adresse}"


@dataclass(frozen=True)
class Jeton:
    chaine: Chaine
    adresse: str
    symbole: str
    nom: str

    @property
    def identite(self) -> tuple[str, str]:
        """Clé de regroupement et de stockage : une chaîne, une adresse."""
        return (self.chaine.cle, self.chaine.normaliser(self.adresse))


# ---------------------------------------------------------------------------
# Étage 1 : ce que rend le radar
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Paire:
    """Un pool d'échange, tel que DexScreener le décrit à l'instant du relevé."""

    adresse: str
    dex: str
    jeton: Jeton
    quote_adresse: str
    quote_symbole: str
    prix_usd: float
    liquidite_usd: float
    market_cap: float
    fdv: float
    creee_le: datetime | None
    volume_h1: float
    volume_h6: float
    volume_h24: float
    variation_h1: float
    variation_h6: float
    variation_h24: float
    achats_h1: int
    ventes_h1: int
    achats_h24: int
    ventes_h24: int
    releve_le: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def age_heures(self) -> float:
        """Âge du pool. Sans date de création, on répond 0 : le filtre d'âge
        minimal écartera le candidat, ce qui est le bon sens de l'échec — un
        pool dont on ignore la date est un pool sur lequel on ne mise pas."""
        if self.creee_le is None:
            return 0.0
        return max(0.0, (self.releve_le - self.creee_le).total_seconds() / HEURE)

    @property
    def cotee_en_reference(self) -> bool:
        return self.jeton.chaine.est_quote_de_reference(self.quote_adresse)

    @property
    def lien_dexscreener(self) -> str:
        return f"https://dexscreener.com/{self.jeton.chaine.cle}/{self.adresse}"


# ---------------------------------------------------------------------------
# Étage 2 : un jeton, tous pools confondus
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Candidat:
    """Un jeton sur une chaîne, ses pools additionnés."""

    jeton: Jeton
    paire_principale: Paire        # le pool le plus profond : la référence de cours
    nombre_de_pools: int
    liquidite_usd: float
    volume_h1: float
    volume_h6: float
    volume_h24: float
    achats_h1: int
    ventes_h1: int
    achats_h24: int
    ventes_h24: int
    market_cap: float
    fdv: float
    age_heures: float

    @classmethod
    def depuis_paires(cls, paires: list[Paire]) -> Candidat:
        """Additionne les pools d'un même jeton sur une même chaîne.

        Les volumes et la liquidité s'additionnent — ce sont des quantités.
        La capitalisation ne s'additionne pas : c'est la même offre vue depuis
        chaque pool, et la sommer la multiplierait par le nombre de pools. On
        prend celle du pool le plus profond, qui est la mieux arbitrée.
        """
        if not paires:
            raise ValueError("aucune paire à regrouper")
        identites = {p.jeton.identite for p in paires}
        if len(identites) != 1:
            raise ValueError(f"paires de jetons différents : {sorted(identites)}")

        principale = max(paires, key=lambda p: p.liquidite_usd)
        return cls(
            jeton=principale.jeton,
            paire_principale=principale,
            nombre_de_pools=len(paires),
            liquidite_usd=sum(p.liquidite_usd for p in paires),
            volume_h1=sum(p.volume_h1 for p in paires),
            volume_h6=sum(p.volume_h6 for p in paires),
            volume_h24=sum(p.volume_h24 for p in paires),
            achats_h1=sum(p.achats_h1 for p in paires),
            ventes_h1=sum(p.ventes_h1 for p in paires),
            achats_h24=sum(p.achats_h24 for p in paires),
            ventes_h24=sum(p.ventes_h24 for p in paires),
            market_cap=principale.market_cap,
            fdv=principale.fdv,
            # Le pool le plus ancien date la découverte du jeton : c'est depuis
            # lui qu'il est achetable, quels que soient les pools ouverts après.
            age_heures=max(p.age_heures for p in paires),
        )

    @property
    def variation_h1(self) -> float:
        return self.paire_principale.variation_h1

    @property
    def variation_h24(self) -> float:
        return self.paire_principale.variation_h24

    @property
    def transactions_h1(self) -> int:
        return self.achats_h1 + self.ventes_h1

    @property
    def transactions_h24(self) -> int:
        return self.achats_h24 + self.ventes_h24


# ---------------------------------------------------------------------------
# Étage 3 : le calcul pur
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Metriques:
    """Les huit nombres que note la convergence, tous sans dimension sauf deux.

    Aucun appel réseau ne les produit : c'est de l'arithmétique sur un
    `Candidat`. C'est ce qui permet d'en calculer mille par seconde et de ne
    dépenser les quotas d'API que sur les vingt-cinq meilleurs.
    """

    acceleration: float            # (volume 1 h × 24) / volume 24 h
    pression: float                # volume 1 h / capitalisation
    discretion: float              # variation du cours sur 1 h, en %
    rotation: float                # volume 24 h / liquidité
    desequilibre: float            # achats / (achats + ventes) sur 1 h
    profondeur: float              # liquidité / capitalisation
    taille_moyenne: float          # ticket moyen sur 1 h, en dollars
    age_heures: float


@dataclass(frozen=True)
class Note:
    """Le détail d'une note, jamais le seul total.

    Une note de 74 ne dit rien ; « 74, dont 22 d'accélération et 0 de
    profondeur » dit qu'il faut regarder le pool avant d'acheter. Le rapport et
    l'alerte affichent le détail, c'est la moitié de l'intérêt de l'outil.
    """

    total: float
    detail: dict[str, float]       # critère → points obtenus
    valeurs: dict[str, float]      # critère → valeur mesurée, pour le rapport
    drapeaux: tuple[str, ...] = ()

    @property
    def retenu(self) -> bool:
        return not self.drapeaux


# ---------------------------------------------------------------------------
# Étage 4 : le bouclier
# ---------------------------------------------------------------------------

class Verdict(Enum):
    SUR = "sûr"
    SUSPECT = "suspect"
    REJETE = "rejeté"
    INCONNU = "inconnu"            # aucune source n'a répondu : ne vaut pas quitus


@dataclass(frozen=True)
class Securite:
    """Ce que les analyseurs de contrat disent du jeton.

    `facteur` multiplie la note de convergence. Un jeton rejeté vaut 0 quelle
    que soit sa note : aucune accélération de volume ne rachète un contrat dont
    on ne peut pas sortir.
    """

    verdict: Verdict
    facteur: float
    rejets: tuple[str, ...] = ()
    avertissements: tuple[str, ...] = ()
    taxe_achat_pct: float | None = None
    taxe_vente_pct: float | None = None
    lp_verrouillee_pct: float | None = None
    top10_detenteurs_pct: float | None = None
    sources: tuple[str, ...] = ()


# ---------------------------------------------------------------------------
# Étage 5 : les portefeuilles
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SmartMoney:
    """Portefeuilles déjà vus tôt sur d'autres jetons qui ont ensuite monté.

    C'est un indice, jamais une thèse : d'où un bonus plafonné et non un
    facteur. Deux adresses réputées peuvent se tromper ensemble — et c'est
    même la mécanique de la plupart des sorties organisées.
    """

    portefeuilles: tuple[str, ...] = ()
    apparitions: dict[str, int] = field(default_factory=dict)
    bonus: float = 0.0


# ---------------------------------------------------------------------------
# Sortie
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Pepite:
    """Un candidat qui a traversé les cinq étages."""

    candidat: Candidat
    metriques: Metriques
    note: Note
    securite: Securite
    smart_money: SmartMoney
    note_finale: float
    vu_le: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def lien_dexscreener(self) -> str:
        return self.candidat.paire_principale.lien_dexscreener

    @property
    def lien_explorateur(self) -> str:
        return self.candidat.jeton.chaine.lien_explorateur(self.candidat.jeton.adresse)
