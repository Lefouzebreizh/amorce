#!/usr/bin/env python3
"""Sentiment : indice Fear & Greed, et lecture des messages communautaires.

**Pourquoi un lexique pondéré et pas un modèle.** Un modèle de classification
de sentiment généraliste, même léger, est entraîné sur des avis de produits et
des critiques de films. Sur « BTC dumping hard, buying the blood », il rend
« négatif » — alors que le message dit qu'on achète. Le vocabulaire crypto
inverse la polarité de la moitié des mots forts du domaine général : *dump*,
*bleed*, *capitulation* sont négatifs pour un modèle et **haussiers** pour qui
accumule.

Un modèle spécialisé demanderait un corpus annoté qu'on n'a pas, 400 Mo de
poids, et un téléchargement depuis un hôte que le mandataire de ce dépôt
refuse. Le lexique ci-dessous est réglé sur le domaine, tient en cinquante
lignes, se corrige en dix secondes quand il se trompe, et s'exécute sans rien
installer. Il est moins fin qu'un modèle spécialisé, et il le reste : le
sentiment ne pèse que 20 % de l'indice de confiance, précisément parce que
c'est le signal le plus faible et le plus manipulable des trois.

Ce qu'il ne sait pas faire, et qu'il faut savoir : l'ironie, et les campagnes
coordonnées. Un jeton dont mille comptes vantent la lune obtient un bon score
social. C'est pourquoi `mentions_minimum` existe, et pourquoi le score social ne
décide jamais seul.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from ..core.journal import obtenir
from ..core.modeles import SignalSentiment, borner
from ..core.reseau import ErreurTemporaire, Fetcher

_journal = obtenir("data_engine.sentiment")

# Poids de -1 à +1. Le vocabulaire est celui du domaine, pas celui d'un
# dictionnaire général : « dump » vaut -0.6 parce que c'est une chute, mais
# « buying the dip » vaut +0.7 alors que les deux parlent de la même chute.
LEXIQUE: dict[str, float] = {
    # Haussier
    "bullish": 0.7, "moon": 0.5, "pump": 0.5, "rally": 0.6, "breakout": 0.6,
    "accumulate": 0.6, "accumulating": 0.6, "buying": 0.5, "long": 0.4,
    "support": 0.3, "hodl": 0.4, "undervalued": 0.7, "oversold": 0.6,
    "haussier": 0.7, "achat": 0.5, "accumulation": 0.6, "rebond": 0.5,
    "sous-évalué": 0.7, "survendu": 0.6,
    # Baissier
    "bearish": -0.7, "dump": -0.6, "crash": -0.8, "rekt": -0.8, "scam": -0.9,
    "rug": -0.9, "rugpull": -0.9, "liquidated": -0.7, "selling": -0.5,
    "short": -0.4, "overbought": -0.6, "bubble": -0.6, "capitulation": -0.5,
    "baissier": -0.7, "krach": -0.8, "arnaque": -0.9, "vente": -0.5,
    "surchauffe": -0.6, "suracheté": -0.6,
    # Ambivalents, tranchés par le contexte des expressions ci-dessous
    "correction": -0.3, "volatile": -0.2, "consolidation": 0.1,
}

# Les expressions priment sur les mots isolés, et c'est tout l'intérêt :
# « buying the dip » contient « dip », qui serait compté négatif seul.
EXPRESSIONS: dict[str, float] = {
    "buy the dip": 0.8, "buying the dip": 0.8, "acheter le creux": 0.8,
    "buying the blood": 0.8, "generational bottom": 0.7, "creux générationnel": 0.7,
    "dead cat bounce": -0.6, "chat mort": -0.6, "bull trap": -0.7,
    "exit liquidity": -0.8, "liquidité de sortie": -0.8,
    "to the moon": 0.4, "vers la lune": 0.4,
}

NEGATIONS = frozenset({"not", "no", "never", "pas", "jamais", "aucun", "sans"})
INTENSIFICATEURS = {"very": 1.4, "extremely": 1.6, "super": 1.3, "très": 1.4, "hyper": 1.5}

_MOTS = re.compile(r"[a-zàâäéèêëïîôöùûüç'-]+", re.IGNORECASE)


def analyser_texte(texte: str) -> float | None:
    """Rend un score entre -1 et +1, ou `None` si rien de connu n'apparaît.

    `None` et 0.0 sont deux choses différentes : le premier veut dire « ce
    message ne parle pas de marché », le second « il en parle et il est
    neutre ». Les confondre noierait le signal sous les messages hors sujet.
    """

    minuscule = texte.lower()
    scores: list[float] = []

    for expression, poids in EXPRESSIONS.items():
        if expression in minuscule:
            scores.append(poids)
            minuscule = minuscule.replace(expression, " ")

    mots = _MOTS.findall(minuscule)
    for indice, mot in enumerate(mots):
        poids = LEXIQUE.get(mot)
        if poids is None:
            continue
        # La négation regarde les deux mots précédents : « not bullish » et
        # « not really bullish » doivent tous deux s'inverser.
        contexte = mots[max(0, indice - 2) : indice]
        if any(m in NEGATIONS for m in contexte):
            poids = -poids
        for m in contexte:
            if m in INTENSIFICATEURS:
                poids *= INTENSIFICATEURS[m]
        scores.append(poids)

    if not scores:
        return None
    return borner(sum(scores) / len(scores), -1.0, 1.0)


@dataclass
class SourceFearGreed:
    fetcher: Fetcher
    url: str = "https://api.alternative.me/fng/"

    async def indice(self) -> int:
        brut = await self.fetcher.json(self.url, params={"limit": 1, "format": "json"})
        donnees = (brut or {}).get("data") or []
        if not donnees:
            raise ErreurTemporaire("Fear & Greed : réponse vide.")
        return int(donnees[0]["value"])


@dataclass
class SourceReddit:
    """Lecture du flux public JSON, sans authentification.

    Reddit accepte `/r/<sub>/hot.json` sans jeton tant que l'agent utilisateur
    est renseigné — c'est la seule condition, et un agent par défaut se fait
    refuser en 429 au bout de quelques appels. L'agent est donc posé par le
    client HTTP, une fois, pour toutes les sources.
    """

    fetcher: Fetcher
    url: str = "https://www.reddit.com/r/CryptoCurrency/hot.json"

    async def titres(self, limite: int = 50) -> list[str]:
        brut = await self.fetcher.json(self.url, params={"limit": limite})
        enfants = ((brut or {}).get("data") or {}).get("children") or []
        return [
            enfant["data"]["title"]
            for enfant in enfants
            if isinstance(enfant, dict) and enfant.get("data", {}).get("title")
        ]


def agreger(
    textes: Iterable[str], *, mentions_minimum: int, symbole: str | None = None
) -> tuple[float | None, int]:
    """Score social et nombre de mentions exploitables.

    Filtrer sur le symbole avant de noter est ce qui rend le score utile : le
    sentiment général de r/CryptoCurrency ne dit rien de SOL en particulier, et
    l'appliquer à SOL reviendrait à noter cinq actifs avec le même nombre.
    """

    retenus = list(textes)
    if symbole:
        racine = symbole.split("/")[0].lower()
        retenus = [t for t in retenus if racine in t.lower()]

    scores = [s for s in (analyser_texte(t) for t in retenus) if s is not None]
    if len(scores) < mentions_minimum:
        _journal.debug(
            "Sentiment social ignoré pour %s : %d mention(s) exploitable(s), minimum %d.",
            symbole or "le marché", len(scores), mentions_minimum,
        )
        return None, len(scores)
    return borner(sum(scores) / len(scores), -1.0, 1.0), len(scores)


@dataclass
class IngestionSentiment:
    fear_greed: SourceFearGreed
    reddit: SourceReddit
    mentions_minimum: int = 15

    async def signal(self, symbole: str | None = None) -> SignalSentiment:
        """Les deux sources sont interrogées séparément : l'indice public est
        stable et presque toujours disponible, le social tombe souvent. Perdre
        le second ne doit pas faire perdre le premier."""

        sources: list[str] = []
        indice: int | None = None
        try:
            indice = await self.fear_greed.indice()
            sources.append("alternative.me")
        except Exception as erreur:
            _journal.info("Indice Fear & Greed indisponible : %s", erreur)

        score: float | None = None
        mentions: int | None = None
        try:
            titres = await self.reddit.titres()
            score, mentions = agreger(
                titres, mentions_minimum=self.mentions_minimum, symbole=symbole
            )
            sources.append("reddit")
        except Exception as erreur:
            _journal.info("Reddit indisponible : %s", erreur)

        return SignalSentiment(
            fear_greed=indice,
            score_social=score,
            volume_mentions=mentions,
            sources=tuple(sources),
        )
