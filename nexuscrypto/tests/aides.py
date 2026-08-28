#!/usr/bin/env python3
"""Fabriques partagées par les tests.

Nommé hors du motif `test*.py` pour ne pas être ramassé comme une suite.

Toutes les données sont **construites**, jamais téléchargées : la suite entière
tourne sans réseau et sans clé. C'est ce qui permet de la lancer dans une
intégration continue qui n'installe que trois bibliothèques, et c'est la raison
pour laquelle chaque source du système reçoit son `Fetcher` par le constructeur.
"""

from __future__ import annotations

import logging
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

from src.core.config import charger  # noqa: E402
from src.core.modeles import (  # noqa: E402
    Bougie, CarnetOrdres, Contexte, MetriqueOnchain, Portefeuille, Position,
    SerieOHLCV, SignalSentiment,
)

# Les tests n'ont pas besoin du journal du moteur. Sans ce silence, chaque
# refus *attendu* — coupe-circuit déclenché, ordre trop petit — écrit une ligne
# d'avertissement, et la sortie de la suite devient assez bruyante pour qu'on
# cesse de lire les vraies erreurs au milieu.
logging.getLogger("nexus").addHandler(logging.NullHandler())
logging.getLogger("nexus").propagate = False

MAINTENANT = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


def config(**remplacements):
    """La configuration réellement livrée, pour que les tests gardent aussi
    `config/config.yaml` — un fichier livré avec des poids qui ne somment pas
    à 100 casserait le démarrage sans qu'aucun test ne le voie."""

    return charger(RACINE / "config" / "config.yaml", **remplacements)


def serie(
    *,
    symbole: str = "BTC/USDT",
    nombre: int = 260,
    depart: float = 100.0,
    pente: float = 0.0,
    amplitude: float = 0.0,
    volume: float = 1000.0,
    volume_final: float | None = None,
    intervalle_heures: int = 4,
) -> SerieOHLCV:
    """Une série paramétrable. `pente` est la dérive par bougie, `amplitude`
    l'oscillation sinusoïdale autour d'elle."""

    bougies = []
    for i in range(nombre):
        # Un prix ne descend pas sous zéro : sans ce plancher, une pente
        # forte sur 260 bougies fabrique des bougies que `Bougie` refuse.
        prix = max(depart + pente * i + amplitude * math.sin(i / 7.0), 0.01)
        v = volume
        if volume_final is not None and i == nombre - 1:
            v = volume_final
        bougies.append(
            Bougie(
                horodatage=MAINTENANT - timedelta(hours=intervalle_heures * (nombre - 1 - i)),
                ouverture=prix,
                haut=prix * 1.01,
                bas=prix * 0.99,
                cloture=prix,
                volume=v,
            )
        )
    return SerieOHLCV(symbole=symbole, intervalle="4h", bougies=tuple(bougies))


def carnet(
    *, symbole: str = "BTC/USDT", milieu: float = 100.0, taille: float = 10.0,
    lignes: int = 5, pas: float = 0.001,
) -> CarnetOrdres:
    return CarnetOrdres(
        symbole=symbole,
        achats=tuple((milieu * (1 - pas * (i + 1)), taille) for i in range(lignes)),
        ventes=tuple((milieu * (1 + pas * (i + 1)), taille) for i in range(lignes)),
        horodatage=MAINTENANT,
    )


def contexte(
    *,
    actif: str = "BTC/USDT",
    fear_greed: int | None = 50,
    score_social: float | None = None,
    onchain: MetriqueOnchain | None = None,
    actualites: tuple = (),
    avec_carnet: bool = True,
    **arguments_serie,
) -> Contexte:
    ohlcv = serie(symbole=actif, **arguments_serie)
    return Contexte(
        actif=actif,
        releve_le=MAINTENANT,
        serie=ohlcv,
        carnet=carnet(symbole=actif, milieu=ohlcv.dernier_prix) if avec_carnet else None,
        onchain=onchain,
        sentiment=(
            SignalSentiment(fear_greed=fear_greed, score_social=score_social)
            if fear_greed is not None or score_social is not None
            else None
        ),
        actualites=actualites,
    )


def portefeuille(
    *, liquidites: float = 10_000.0, positions: dict[str, Position] | None = None
) -> Portefeuille:
    return Portefeuille(liquidites_usd=liquidites, positions=dict(positions or {}))


def position(
    *, actif: str = "BTC/USDT", quantite: float = 1.0, prix_moyen: float = 100.0,
    plus_haut: float = 0.0,
) -> Position:
    return Position(
        actif=actif, quantite=quantite, prix_moyen=prix_moyen,
        ouverte_le=MAINTENANT - timedelta(days=30), plus_haut_atteint=plus_haut or prix_moyen,
    )


class FetcherFactice:
    """Un `Fetcher` qui rend des réponses enregistrées.

    C'est la brique qui permet d'éprouver toute la chaîne d'ingestion sans
    `aiohttp` et sans réseau. Une URL absente de la table lève, exprès : un test
    qui interroge une adresse à laquelle personne n'a pensé doit échouer
    bruyamment plutôt que de recevoir `None` et de conclure « source vide ».
    """

    def __init__(self, reponses: dict[str, object] | None = None) -> None:
        self.reponses = reponses or {}
        self.appels: list[str] = []

    def _chercher(self, url: str):
        self.appels.append(url)
        for motif, reponse in self.reponses.items():
            if motif in url:
                if isinstance(reponse, Exception):
                    raise reponse
                return reponse
        raise AssertionError(f"URL non prévue par le test : {url}")

    async def json(self, url, *, params=None, entetes=None, corps=None):
        return self._chercher(url)

    async def texte(self, url, *, params=None, entetes=None):
        return self._chercher(url)
