#!/usr/bin/env python3
"""Client DexScreener : la seule source de découverte et de métriques.

**La contrainte à connaître avant tout le reste : il n'existe aucun point
d'entrée « toutes les paires actives ».** Beaucoup de tutoriels le supposent ;
il n'existe pas. La découverte se construit donc par recoupement de trois
sources, et c'est la partie la plus fragile de l'outil :

1. **La recherche par jeton de cotation.** `search?q={adresse de WETH}` rend les
   paires les plus significatives cotées en WETH. C'est le gros du volume, mais
   la réponse est plafonnée : on ne voit qu'une fenêtre, pas le marché.
2. **Les fiches et mises en avant récentes.** Un jeton dont l'équipe paie une
   fiche sort de l'anonymat. Signal faible, mais bon point de départ — et à
   n'utiliser que pour *découvrir* : payer une mise en avant est autant le
   signe d'une équipe active que d'une sortie organisée. Ça ne note jamais.
3. **Notre propre mémoire.** Tout jeton déjà relevé est re-relevé, quoi qu'il
   arrive. La découverte de DexScreener est irrégulière, et sans cela un jeton
   pourrait disparaître d'un tour sans que rien ne lui soit arrivé — donc ne
   jamais être confirmé.

Ce module ne décide de rien : il traduit du JSON en `Paire`. Pas un seuil, pas
une élimination — sauf celles qui rendent un objet impossible à construire.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.modeles import Chaine, Jeton, Paire
from core.reseau import ClientHttp

JOURNAL = logging.getLogger("pepites.dexscreener")

BASE = "https://api.dexscreener.com"
RECHERCHE = f"{BASE}/latest/dex/search"
PAIRES_DU_JETON = f"{BASE}/token-pairs/v1/{{chaine}}/{{adresse}}"
PROFILS = f"{BASE}/token-profiles/latest/v1"
MISES_EN_AVANT = f"{BASE}/token-boosts/latest/v1"
MISES_EN_AVANT_TOP = f"{BASE}/token-boosts/top/v1"

# Débits annoncés par DexScreener, en requêtes par minute. `ClientHttp` prend
# sa marge dessus ; deux compteurs, parce que les deux familles de points
# d'entrée n'ont pas du tout le même plafond.
DEBITS = {
    "dexscreener.paires": 300.0,
    "dexscreener.profils": 60.0,
}


def _nombre(valeur, defaut: float = 0.0) -> float:
    """DexScreener rend ses prix en chaînes de caractères et omet les champs
    absents plutôt que de les mettre à zéro. Les deux cas mènent ici."""
    if valeur is None:
        return defaut
    try:
        return float(valeur)
    except (TypeError, ValueError):
        return defaut


def _entier(valeur) -> int:
    return int(_nombre(valeur))


def paire_depuis_json(brut: dict, chaines: dict[str, Chaine],
                      releve_le: datetime | None = None) -> Paire | None:
    """Traduit une paire DexScreener, ou rend `None` si elle est inexploitable.

    Trois refus, tous pour la même raison : sans ces champs, la paire ne peut
    pas être *comparée* aux autres, et une note calculée sur des zéros par
    défaut serait pire qu'une absence de note.
    """
    if not isinstance(brut, dict):
        return None
    chaine = chaines.get(brut.get("chainId", ""))
    if chaine is None:
        return None                       # chaîne hors périmètre : pas une erreur
    base = brut.get("baseToken") or {}
    quote = brut.get("quoteToken") or {}
    adresse_paire = brut.get("pairAddress")
    if not adresse_paire or not base.get("address") or not quote.get("address"):
        return None

    cree = brut.get("pairCreatedAt")
    creee_le = (
        datetime.fromtimestamp(cree / 1000, tz=timezone.utc)
        if isinstance(cree, (int, float)) and cree > 0
        else None
    )

    txns = brut.get("txns") or {}
    h1 = txns.get("h1") or {}
    h24 = txns.get("h24") or {}
    volume = brut.get("volume") or {}
    variation = brut.get("priceChange") or {}
    liquidite = brut.get("liquidity") or {}

    # La capitalisation manque sur les jetons dont l'offre en circulation n'est
    # pas connue de l'indexeur. La FDV la remplace alors — c'est une majoration,
    # donc un jugement plus sévère, ce qui est le bon sens de l'échec ici.
    fdv = _nombre(brut.get("fdv"))
    market_cap = _nombre(brut.get("marketCap"), defaut=fdv)

    return Paire(
        adresse=adresse_paire,
        dex=brut.get("dexId", "?"),
        jeton=Jeton(
            chaine=chaine,
            adresse=base["address"],
            symbole=base.get("symbol", "?"),
            nom=base.get("name", "?"),
        ),
        quote_adresse=quote["address"],
        quote_symbole=quote.get("symbol", "?"),
        prix_usd=_nombre(brut.get("priceUsd")),
        liquidite_usd=_nombre(liquidite.get("usd")),
        market_cap=market_cap,
        fdv=fdv or market_cap,
        creee_le=creee_le,
        volume_h1=_nombre(volume.get("h1")),
        volume_h6=_nombre(volume.get("h6")),
        volume_h24=_nombre(volume.get("h24")),
        variation_h1=_nombre(variation.get("h1")),
        variation_h6=_nombre(variation.get("h6")),
        variation_h24=_nombre(variation.get("h24")),
        achats_h1=_entier(h1.get("buys")),
        ventes_h1=_entier(h1.get("sells")),
        achats_h24=_entier(h24.get("buys")),
        ventes_h24=_entier(h24.get("sells")),
        releve_le=releve_le or datetime.now(timezone.utc),
    )


def _traduire(liste, chaines: dict[str, Chaine], releve_le: datetime) -> list[Paire]:
    if not isinstance(liste, list):
        return []
    paires = [paire_depuis_json(brut, chaines, releve_le) for brut in liste]
    return [p for p in paires if p is not None]


def rechercher(client: ClientHttp, terme: str, chaines: dict[str, Chaine],
               releve_le: datetime | None = None) -> list[Paire]:
    """Paires correspondant à un terme — le plus souvent une adresse de cotation."""
    releve_le = releve_le or datetime.now(timezone.utc)
    reponse = client.json("dexscreener.paires", RECHERCHE, params={"q": terme})
    if not isinstance(reponse, dict):
        return []
    return _traduire(reponse.get("pairs"), chaines, releve_le)


def paires_du_jeton(client: ClientHttp, chaine: Chaine, adresse: str,
                    releve_le: datetime | None = None) -> list[Paire]:
    """Tous les pools d'un jeton. C'est ce qui permet le regroupement : un jeton
    dont la liquidité est éclatée sur trois pools passe le plancher, pool par
    pool il ne le passerait pas."""
    releve_le = releve_le or datetime.now(timezone.utc)
    reponse = client.json(
        "dexscreener.paires",
        PAIRES_DU_JETON.format(chaine=chaine.cle, adresse=adresse),
    )
    return _traduire(reponse, {chaine.cle: chaine}, releve_le)


def _jetons_annonces(reponse, chaines: dict[str, Chaine]) -> list[tuple[Chaine, str]]:
    if not isinstance(reponse, list):
        return []
    trouves: list[tuple[Chaine, str]] = []
    vus: set[tuple[str, str]] = set()
    for entree in reponse:
        if not isinstance(entree, dict):
            continue
        chaine = chaines.get(entree.get("chainId", ""))
        adresse = entree.get("tokenAddress")
        if chaine is None or not adresse:
            continue
        cle = (chaine.cle, chaine.normaliser(adresse))
        if cle not in vus:
            vus.add(cle)
            trouves.append((chaine, adresse))
    return trouves


def jetons_en_vitrine(client: ClientHttp, chaines: dict[str, Chaine]) -> list[tuple[Chaine, str]]:
    """Jetons qui viennent de publier une fiche ou de payer une mise en avant.

    Sert à découvrir, jamais à noter : voir le bloc en tête de fichier.
    """
    trouves: list[tuple[Chaine, str]] = []
    vus: set[tuple[str, str]] = set()
    for url in (PROFILS, MISES_EN_AVANT, MISES_EN_AVANT_TOP):
        for chaine, adresse in _jetons_annonces(client.json("dexscreener.profils", url), chaines):
            cle = (chaine.cle, chaine.normaliser(adresse))
            if cle not in vus:
                vus.add(cle)
                trouves.append((chaine, adresse))
    JOURNAL.debug("vitrine : %d jetons", len(trouves))
    return trouves
