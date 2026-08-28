#!/usr/bin/env python3
"""L'agrégateur : rassemble les quatre familles de sources en un `Contexte`.

C'est ici que se joue la tolérance aux pannes du système, et elle tient en deux
décisions.

**Tout part de front.** Les quatre familles ne se lisent pas l'une l'autre :
les mettre à la queue leu leu ne casse rien mais coûte, en silence. Sur les
cinq actifs du portefeuille et les quatre flux RSS, la différence entre le
séquentiel et le parallèle est d'un ordre de grandeur — et cette passe tourne
toutes les heures.

**Une source muette retire sa contribution, elle n'arrête rien.** Chaque panne
est nommée dans `Contexte.sources_en_panne`, le scoring redistribue les poids,
et la notification dit avec quoi la décision a été prise. Un moteur qui
s'arrête à la première panne de DeFiLlama ne tourne pas une semaine d'affilée ;
un moteur qui décide sans le dire est pire.

Le prix, lui, n'est pas facultatif : sans série de bougies, il n'y a pas de
contexte du tout, et l'actif est écarté de la passe.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Sequence

from ..core.journal import obtenir
from ..core.modeles import (
    Actualite, CarnetOrdres, Contexte, MetriqueOnchain, SerieOHLCV, SignalSentiment,
)
from .macro import IngestionMacro
from .marche import SourceMarche
from .onchain import IngestionOnchain
from .sentiment import IngestionSentiment

_journal = obtenir("data_engine.agregateur")


@dataclass
class Agregateur:
    marches: dict[str, SourceMarche]
    marche_defaut: str
    onchain: IngestionOnchain | None = None
    sentiment: IngestionSentiment | None = None
    ingestion_macro: IngestionMacro | None = None
    profondeur_carnet: int = 20

    def _marche(self, symbole: str, plateforme: str | None) -> SourceMarche:
        """Un actif peut avoir sa plateforme à lui — HYPE n'est pas sur Binance.
        Sans plateforme déclarée, on prend celle par défaut."""

        if plateforme and plateforme in self.marches:
            return self.marches[plateforme]
        return self.marches[self.marche_defaut]

    async def contexte(
        self,
        symbole: str,
        *,
        intervalle: str,
        profondeur: int,
        maintenant: datetime,
        plateforme: str | None = None,
        actualites: Sequence[Actualite] = (),
    ) -> Contexte | None:
        """Rend le contexte d'un actif, ou `None` si le prix est introuvable."""

        marche = self._marche(symbole, plateforme)
        pannes: list[str] = []

        taches: dict[str, asyncio.Future] = {
            "serie": asyncio.ensure_future(marche.ohlcv(symbole, intervalle, profondeur)),
            "carnet": asyncio.ensure_future(marche.carnet(symbole, self.profondeur_carnet)),
        }
        if self.onchain is not None:
            taches["onchain"] = asyncio.ensure_future(self.onchain.metrique(symbole))
        if self.sentiment is not None:
            taches["sentiment"] = asyncio.ensure_future(self.sentiment.signal(symbole))

        noms = list(taches)
        resultats = await asyncio.gather(*(taches[n] for n in noms), return_exceptions=True)
        obtenus = dict(zip(noms, resultats))

        serie = obtenus.get("serie")
        if isinstance(serie, Exception) or not isinstance(serie, SerieOHLCV):
            _journal.warning("%s : pas de série de prix (%s) — actif écarté.", symbole, serie)
            return None

        carnet = obtenus.get("carnet")
        if not isinstance(carnet, CarnetOrdres):
            pannes.append("carnet")
            carnet = None

        metrique = obtenus.get("onchain")
        if self.onchain is not None and not isinstance(metrique, MetriqueOnchain):
            pannes.append("onchain")
            metrique = None
        elif self.onchain is None:
            metrique = None

        signal = obtenus.get("sentiment")
        if self.sentiment is not None and not isinstance(signal, SignalSentiment):
            pannes.append("sentiment")
            signal = None
        elif self.sentiment is None:
            signal = None

        if pannes:
            _journal.info("%s : source(s) en panne — %s.", symbole, ", ".join(pannes))

        return Contexte(
            actif=symbole,
            releve_le=maintenant,
            serie=serie,
            carnet=carnet,
            onchain=metrique,
            sentiment=signal,
            actualites=tuple(actualites),
            sources_en_panne=tuple(pannes),
        )

    async def actualites(self, maintenant: datetime) -> tuple[Actualite, ...]:
        """La macro est relevée **une fois par passe**, pas une fois par actif :
        les mêmes flux RSS pour cinq actifs, ce sont vingt requêtes au lieu de
        quatre, et le même contenu."""

        if self.ingestion_macro is None:
            return ()
        try:
            return tuple(await self.ingestion_macro.actualites(maintenant))
        except Exception as erreur:
            _journal.info("Actualités macro indisponibles : %s", erreur)
            return ()

    async def tous(
        self,
        symboles: Sequence[str],
        *,
        intervalle: str,
        profondeur: int,
        maintenant: datetime,
        plateformes: dict[str, str | None] | None = None,
    ) -> dict[str, Contexte]:
        """Une passe complète, tous actifs de front."""

        nouvelles = await self.actualites(maintenant)
        plateformes = plateformes or {}
        taches = [
            self.contexte(
                symbole,
                intervalle=intervalle,
                profondeur=profondeur,
                maintenant=maintenant,
                plateforme=plateformes.get(symbole),
                actualites=nouvelles,
            )
            for symbole in symboles
        ]
        contextes = await asyncio.gather(*taches, return_exceptions=True)
        sortie: dict[str, Contexte] = {}
        for symbole, contexte in zip(symboles, contextes):
            if isinstance(contexte, Contexte):
                sortie[symbole] = contexte
            elif isinstance(contexte, Exception):
                _journal.warning("%s écarté de la passe : %s", symbole, contexte)
        return sortie
