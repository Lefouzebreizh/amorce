#!/usr/bin/env python3
"""Flux de marché : CCXT pour les plateformes centralisées, REST pour Hyperliquid.

**Pourquoi CCXT et pas les SDK officiels de chaque plateforme.** Trois
plateformes, trois SDK, trois formats de bougie et trois hiérarchies
d'exceptions à rattraper. CCXT normalise les trois et, surtout, rend les mêmes
symboles — ce qui évite la table de correspondance manuelle qui est la première
chose à se désynchroniser dans ce genre de système.

**Pourquoi Hyperliquid est à part.** Elle n'est pas couverte de la même façon
par CCXT selon la version installée, et son point d'entrée `/info` est un POST
JSON simple qui n'a besoin de rien d'autre qu'un client HTTP. Le passer par le
`Fetcher` commun le rend testable comme les autres sources, sans SDK.

Les deux implémentations rendent des `SerieOHLCV` identiques. Le reste du
système ne sait pas d'où viennent ses bougies, et c'est le but.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol, Sequence

from ..core.journal import obtenir
from ..core.modeles import Bougie, CarnetOrdres, SerieOHLCV, maintenant
from ..core.reseau import ErreurPermanente, ErreurTemporaire, Fetcher

_journal = obtenir("data_engine.marche")


class SourceMarche(Protocol):
    nom: str

    async def ohlcv(self, symbole: str, intervalle: str, profondeur: int) -> SerieOHLCV: ...

    async def carnet(self, symbole: str, profondeur: int) -> CarnetOrdres: ...


def _bougies_depuis_ccxt(brut: Sequence[Sequence[float]]) -> tuple[Bougie, ...]:
    """CCXT rend `[horodatage_ms, o, h, l, c, v]`.

    L'horodatage est en millisecondes et sans fuseau. Le convertir en UTC
    conscient ici, une fois, plutôt qu'à chaque usage : `Bougie` refuse un
    instant naïf, et c'est exactement ce contrôle qui a évité que la conversion
    soit oubliée dans la source Hyperliquid.
    """

    return tuple(
        Bougie(
            horodatage=datetime.fromtimestamp(ligne[0] / 1000, tz=timezone.utc),
            ouverture=float(ligne[1]),
            haut=float(ligne[2]),
            bas=float(ligne[3]),
            cloture=float(ligne[4]),
            volume=float(ligne[5]),
        )
        for ligne in brut
    )


class MarcheCCXT:
    """Binance, Bybit et les cent trente autres. `ccxt` est importé au
    constructeur, jamais au chargement du module."""

    def __init__(self, plateforme: str, *, cle: str | None = None, secret: str | None = None) -> None:
        try:
            import ccxt.async_support as ccxt
        except ImportError as erreur:  # pragma: no cover - dépend de l'installation
            raise ErreurPermanente(
                "ccxt n'est pas installé : l'ingestion en direct est indisponible. "
                "`pip install -r requirements.txt`."
            ) from erreur
        if not hasattr(ccxt, plateforme):
            raise ErreurPermanente(f"Plateforme inconnue de CCXT : {plateforme!r}.")
        self.nom = plateforme
        options: dict[str, Any] = {"enableRateLimit": True}
        if cle and secret:
            options |= {"apiKey": cle, "secret": secret}
        self._client = getattr(ccxt, plateforme)(options)

    async def fermer(self) -> None:
        await self._client.close()

    async def ohlcv(self, symbole: str, intervalle: str, profondeur: int) -> SerieOHLCV:
        try:
            brut = await self._client.fetch_ohlcv(symbole, timeframe=intervalle, limit=profondeur)
        except Exception as erreur:
            # CCXT a sa propre hiérarchie d'exceptions, qui n'est pas importable
            # sans la bibliothèque. On la traduit dans la nôtre pour que
            # l'agrégateur n'ait qu'un seul type à connaître.
            raise ErreurTemporaire(f"{self.nom} {symbole} : {erreur}") from erreur
        if not brut:
            raise ErreurTemporaire(f"{self.nom} {symbole} : aucune bougie rendue.")
        return SerieOHLCV(symbole=symbole, intervalle=intervalle, bougies=_bougies_depuis_ccxt(brut))

    async def carnet(self, symbole: str, profondeur: int) -> CarnetOrdres:
        try:
            brut = await self._client.fetch_order_book(symbole, limit=profondeur)
        except Exception as erreur:
            raise ErreurTemporaire(f"{self.nom} carnet {symbole} : {erreur}") from erreur
        return CarnetOrdres(
            symbole=symbole,
            achats=tuple((float(p), float(q)) for p, q in brut.get("bids", [])),
            ventes=tuple((float(p), float(q)) for p, q in brut.get("asks", [])),
            horodatage=maintenant(),
        )


# Correspondance des intervalles : Hyperliquid emploie les mêmes libellés que
# CCXT pour l'essentiel, mais pas pour les minutes.
_INTERVALLES_HYPERLIQUID = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
}


@dataclass
class MarcheHyperliquid:
    """Point d'entrée `/info`, en POST JSON. Aucun SDK.

    Le symbole y est un jeton nu (« HYPE »), pas une paire : `HYPE/USDC` est
    donc coupé avant l'appel. Envoyer la paire entière rend une réponse vide
    sans erreur — un cas particulièrement pénible, parce que le système conclut
    « pas de données » au lieu de « mauvaise requête ».
    """

    fetcher: Fetcher
    url: str = "https://api.hyperliquid.xyz/info"
    nom: str = "hyperliquid"

    @staticmethod
    def _jeton(symbole: str) -> str:
        return symbole.split("/")[0].split(":")[0].upper()

    async def ohlcv(self, symbole: str, intervalle: str, profondeur: int) -> SerieOHLCV:
        cle = _INTERVALLES_HYPERLIQUID.get(intervalle)
        if cle is None:
            raise ErreurPermanente(f"Intervalle non géré par Hyperliquid : {intervalle!r}.")
        secondes = _duree_secondes(intervalle)
        fin = int(maintenant().timestamp() * 1000)
        debut = fin - secondes * 1000 * profondeur
        brut = await self.fetcher.json(
            self.url,
            corps={
                "type": "candleSnapshot",
                "req": {"coin": self._jeton(symbole), "interval": cle,
                        "startTime": debut, "endTime": fin},
            },
        )
        if not brut:
            raise ErreurTemporaire(f"hyperliquid {symbole} : aucune bougie rendue.")
        bougies = tuple(
            Bougie(
                horodatage=datetime.fromtimestamp(int(ligne["t"]) / 1000, tz=timezone.utc),
                ouverture=float(ligne["o"]),
                haut=float(ligne["h"]),
                bas=float(ligne["l"]),
                cloture=float(ligne["c"]),
                volume=float(ligne["v"]),
            )
            for ligne in brut
        )
        return SerieOHLCV(symbole=symbole, intervalle=intervalle, bougies=bougies)

    async def carnet(self, symbole: str, profondeur: int) -> CarnetOrdres:
        brut = await self.fetcher.json(
            self.url, corps={"type": "l2Book", "coin": self._jeton(symbole)}
        )
        niveaux = (brut or {}).get("levels") or [[], []]
        achats = tuple(
            (float(n["px"]), float(n["sz"])) for n in niveaux[0][:profondeur]
        )
        ventes = tuple(
            (float(n["px"]), float(n["sz"])) for n in niveaux[1][:profondeur]
        )
        return CarnetOrdres(
            symbole=symbole, achats=achats, ventes=ventes, horodatage=maintenant()
        )


def _duree_secondes(intervalle: str) -> int:
    unites = {"m": 60, "h": 3600, "d": 86400, "w": 604800}
    nombre, unite = intervalle[:-1], intervalle[-1]
    if unite not in unites or not nombre.isdigit():
        raise ErreurPermanente(f"Intervalle illisible : {intervalle!r}.")
    return int(nombre) * unites[unite]
