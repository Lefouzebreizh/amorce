#!/usr/bin/env python3
"""Détection de pépites : les jetons dont le volume et la liquidité s'emballent.

Le principe tient en une phrase : **une anomalie de volume précède toujours le
mouvement de prix**, parce que quelqu'un achète avant que le prix ne bouge. Le
scanner ne prédit rien, il repère cette anomalie et vérifie qu'elle repose sur
de la liquidité réelle plutôt que sur un carrousel entre deux portefeuilles.

L'ordre des filtres n'est pas négociable, et c'est la seule décision
d'architecture de ce fichier : les filtres **gratuits** — volume, âge,
capitalisation — s'appliquent avant ceux qui coûtent un appel réseau. Sur une
liste de plusieurs centaines de paires ramenées par DexScreener, l'ordre inverse
épuise le quota de l'API avant d'avoir regardé le dixième candidat. C'est la
même leçon que le radar `pepites/` du dépôt a payée une fois.

Ce que ce module ne fait pas, et qu'il faut savoir avant d'y mettre un dollar :
il ne vérifie ni le contrat, ni la revente possible, ni le verrouillage de la
liquidité. Une pépite détectée ici est un **candidat à examiner**, jamais un
achat. Le gestionnaire d'ordres refuse d'ailleurs d'en acheter au-delà du
plafond par jeton fixé dans la configuration.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..core.config import ConfigPepites
from ..core.modeles import borner


@dataclass(frozen=True, slots=True)
class Candidat:
    """Une paire vue par DexScreener ou par un carnet centralisé."""

    symbole: str
    chaine: str
    adresse: str
    prix_usd: float
    liquidite_usd: float
    volume_24h_usd: float
    volume_moyen_usd: float
    capitalisation_usd: float | None
    variation_liquidite_24h: float | None
    creee_le: datetime | None
    source: str = "dexscreener"

    @property
    def croissance_volume(self) -> float:
        """Volume du jour rapporté à sa moyenne. Une moyenne nulle rend 0.0 et
        non l'infini : un jeton sans historique n'est pas une pépite, c'est un
        inconnu."""

        if self.volume_moyen_usd <= 0:
            return 0.0
        return self.volume_24h_usd / self.volume_moyen_usd

    def age_heures(self, maintenant: datetime) -> float | None:
        if self.creee_le is None:
            return None
        return (maintenant - self.creee_le).total_seconds() / 3600.0


@dataclass(frozen=True, slots=True)
class Pepite:
    candidat: Candidat
    score: float
    raisons: tuple[str, ...]


def _filtres_gratuits(
    candidat: Candidat, config: ConfigPepites, maintenant: datetime
) -> str | None:
    """Rend le motif de rejet, ou `None` si le candidat passe. Aucun appel
    réseau ici — c'est tout l'intérêt."""

    if candidat.liquidite_usd < config.liquidite_min_usd:
        return f"liquidité {candidat.liquidite_usd:,.0f} $ sous le plancher"
    if candidat.croissance_volume < config.croissance_volume_min:
        return f"volume ×{candidat.croissance_volume:.1f}, sous ×{config.croissance_volume_min:g}"
    age = candidat.age_heures(maintenant)
    if age is not None and age < config.age_minimum_heures:
        return f"paire âgée de {age:.0f} h, sous {config.age_minimum_heures:g} h"
    if (
        candidat.capitalisation_usd is not None
        and candidat.capitalisation_usd > config.capitalisation_max_usd
    ):
        return "capitalisation au-dessus du plafond : ce n'est plus une pépite"
    if (
        candidat.variation_liquidite_24h is not None
        and candidat.variation_liquidite_24h < config.variation_liquidite_24h_min
    ):
        return (
            f"liquidité {candidat.variation_liquidite_24h:+.0%} sur 24 h : "
            "le volume monte sans afflux de liquidité"
        )
    return None


def noter(candidat: Candidat, config: ConfigPepites) -> tuple[float, list[str]]:
    """Note de 0 à 100. Trois composantes, à parts égales."""

    raisons: list[str] = []

    croissance = candidat.croissance_volume
    note_volume = borner((croissance / (config.croissance_volume_min * 3)) * 100.0, 0.0, 100.0)
    raisons.append(f"volume ×{croissance:.1f} par rapport à sa moyenne")

    # Rotation du pool : le volume vaut mieux quand il traverse une vraie
    # liquidité. Un million de volume sur cinquante mille de liquidité est un
    # carrousel, pas un afflux.
    rotation = candidat.volume_24h_usd / max(candidat.liquidite_usd, 1.0)
    note_rotation = borner(100.0 - abs(rotation - 1.5) * 40.0, 0.0, 100.0)
    if rotation > 4:
        raisons.append(f"rotation {rotation:.1f}× : volume disproportionné à la liquidité")

    if candidat.variation_liquidite_24h is None:
        note_liquidite = 50.0
    else:
        note_liquidite = borner(50.0 + candidat.variation_liquidite_24h * 200.0, 0.0, 100.0)
        if candidat.variation_liquidite_24h >= 0.3:
            raisons.append(f"liquidité +{candidat.variation_liquidite_24h:.0%} sur 24 h")

    note = (note_volume + note_rotation + note_liquidite) / 3.0
    return note, raisons


def scanner(
    candidats: list[Candidat], config: ConfigPepites, maintenant: datetime
) -> tuple[list[Pepite], dict[str, str]]:
    """Filtre puis note. Rend les pépites retenues et le journal des rejets.

    Le journal des rejets n'est pas décoratif : c'est lui qui permet de régler
    les seuils. Un scanner qui rend une liste vide sans dire pourquoi se règle
    à l'aveugle, et on finit par ouvrir les vannes en grand.
    """

    retenues: list[Pepite] = []
    rejets: dict[str, str] = {}

    for candidat in candidats:
        motif = _filtres_gratuits(candidat, config, maintenant)
        if motif is not None:
            rejets[candidat.symbole] = motif
            continue
        note, raisons = noter(candidat, config)
        if note < config.score_minimum:
            rejets[candidat.symbole] = f"note {note:.0f}/100 sous le seuil {config.score_minimum:g}"
            continue
        retenues.append(Pepite(candidat=candidat, score=note, raisons=tuple(raisons)))

    retenues.sort(key=lambda p: p.score, reverse=True)
    return retenues[: config.candidats_max], rejets
