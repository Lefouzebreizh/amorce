#!/usr/bin/env python3
"""Données on-chain et DeFi : DeFiLlama et DexScreener.

Les deux sources répondent à des questions différentes et complémentaires.
**DeFiLlama** dit combien de capital est immobilisé dans les protocoles d'une
chaîne — un indicateur lent, qui ne ment pas et qui met des semaines à bouger.
**DexScreener** dit ce qui s'échange maintenant sur les pools — un indicateur
rapide, bruyant, et qu'on peut fabriquer avec deux portefeuilles.

Les croiser est ce qui donne le signal : un volume DEX qui explose *sans*
afflux de liquidité est un carrousel ; le même volume avec une liquidité qui
monte est un afflux réel.

Le flux des réserves de plateformes n'a pas de source gratuite fiable — les
fournisseurs qui le publient (CryptoQuant, Glassnode) sont payants. Il est donc
**approché** par la variation de TVL des ponts et protocoles suivis, et le champ
correspondant porte cette approximation dans son nom de source. Mieux vaut un
signal approché dont on connaît la nature qu'un signal absent qu'on remplace
mentalement par une intuition.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from ..core.journal import obtenir
from ..core.modeles import MetriqueOnchain
from ..core.reseau import ErreurTemporaire, Fetcher
from ..strategy.pepites import Candidat

_journal = obtenir("data_engine.onchain")


@dataclass
class SourceDeFiLlama:
    fetcher: Fetcher
    base: str = "https://api.llama.fi"

    async def tvl_protocole(self, protocole: str) -> tuple[float | None, float | None]:
        """Rend (TVL courante, variation sur 7 jours).

        La réponse de DeFiLlama contient l'historique complet, parfois plusieurs
        milliers de points. On ne garde que le dernier et celui d'il y a sept
        jours : garder la série entière en mémoire pour cinq protocoles à chaque
        passe fait grossir le processus sans rien apporter.
        """

        brut = await self.fetcher.json(f"{self.base}/protocol/{protocole}")
        serie = (brut or {}).get("tvl") or []
        if not serie:
            return None, None
        courante = float(serie[-1].get("totalLiquidityUSD", 0.0))
        # Un point par jour côté DeFiLlama, d'où l'index -8. Quand l'historique
        # est plus court, on ne calcule pas de variation plutôt que d'en
        # inventer une sur une base de trois jours.
        if len(serie) < 8 or courante <= 0:
            return courante or None, None
        reference = float(serie[-8].get("totalLiquidityUSD", 0.0))
        if reference <= 0:
            return courante, None
        return courante, (courante - reference) / reference


@dataclass
class SourceDexScreener:
    fetcher: Fetcher
    base: str = "https://api.dexscreener.com/latest/dex"

    async def paires_du_jeton(self, chaine: str, adresse: str) -> list[dict[str, Any]]:
        brut = await self.fetcher.json(f"{self.base}/tokens/{adresse}")
        paires = (brut or {}).get("pairs") or []
        return [p for p in paires if p.get("chainId") == chaine]

    async def rechercher(self, requete: str) -> list[dict[str, Any]]:
        brut = await self.fetcher.json(f"{self.base}/search", params={"q": requete})
        return (brut or {}).get("pairs") or []

    @staticmethod
    def meilleure_paire(paires: Sequence[dict[str, Any]]) -> dict[str, Any] | None:
        """La paire la plus liquide, pas la première rendue.

        DexScreener rend les pools d'un jeton dans un ordre qui n'est pas celui
        de la liquidité. Prendre le premier revient souvent à mesurer un pool
        mort de quarante dollars, et à conclure que le jeton n'a pas de
        liquidité.
        """

        if not paires:
            return None
        return max(paires, key=lambda p: float((p.get("liquidity") or {}).get("usd") or 0.0))


def candidat_depuis_paire(paire: dict[str, Any]) -> Candidat | None:
    """Traduit une paire DexScreener en candidat du scanner.

    Rend `None` sur une paire inexploitable plutôt que de lever : sur une liste
    de trois cents paires, une seule mal formée ne doit pas faire tomber le
    scan. C'est le seul endroit du système qui avale une erreur en silence, et
    c'est assumé — il est journalisé au niveau debug.
    """

    from datetime import datetime, timezone

    try:
        base = paire["baseToken"]
        liquidite = float((paire.get("liquidity") or {}).get("usd") or 0.0)
        volume_24h = float((paire.get("volume") or {}).get("h24") or 0.0)
        # Pas de volume moyen chez DexScreener : on l'approche par six fois le
        # volume des quatre dernières heures, ce qui vaut le volume 24 h quand
        # le marché est régulier. Le rapport des deux est donc bien une mesure
        # d'accélération, ce qu'on cherche.
        volume_4h = float((paire.get("volume") or {}).get("h6") or 0.0)
        moyen = volume_4h * 4 if volume_4h > 0 else volume_24h
        creee = paire.get("pairCreatedAt")
        variation_liquidite = (paire.get("liquidityChange") or {}).get("h24")
        return Candidat(
            symbole=base["symbol"],
            chaine=paire.get("chainId", "inconnue"),
            adresse=base["address"],
            prix_usd=float(paire.get("priceUsd") or 0.0),
            liquidite_usd=liquidite,
            volume_24h_usd=volume_24h,
            volume_moyen_usd=moyen,
            capitalisation_usd=float(paire["marketCap"]) if paire.get("marketCap") else None,
            variation_liquidite_24h=float(variation_liquidite) / 100 if variation_liquidite else None,
            creee_le=(
                datetime.fromtimestamp(int(creee) / 1000, tz=timezone.utc) if creee else None
            ),
        )
    except (KeyError, TypeError, ValueError) as erreur:
        _journal.debug("Paire DexScreener ignorée : %s", erreur)
        return None


@dataclass
class IngestionOnchain:
    """Rassemble les deux sources en une seule métrique par actif."""

    defillama: SourceDeFiLlama
    dexscreener: SourceDexScreener
    protocoles: dict[str, list[str]]

    async def metrique(self, actif: str) -> MetriqueOnchain:
        protocoles = self.protocoles.get(actif) or []
        if not protocoles:
            raise ErreurTemporaire(f"{actif} : aucun protocole on-chain configuré.")

        tvl_totale = 0.0
        variations: list[float] = []
        for protocole in protocoles:
            courante, variation = await self.defillama.tvl_protocole(protocole)
            if courante:
                tvl_totale += courante
            if variation is not None:
                variations.append(variation)

        return MetriqueOnchain(
            actif=actif,
            tvl_usd=tvl_totale or None,
            variation_tvl_7j=sum(variations) / len(variations) if variations else None,
            # Approximation assumée et nommée : voir le bloc d'en-tête.
            flux_reserves_exchanges_usd=(
                -tvl_totale * (sum(variations) / len(variations)) if variations and tvl_totale else None
            ),
            source="defillama (flux approché par la TVL)",
        )
