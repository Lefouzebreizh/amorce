#!/usr/bin/env python3
"""Les trois avis de sécurité sur un contrat : GoPlus, honeypot.is, RugCheck.

Trois services, trois questions différentes, et c'est leur recoupement qui fait
le verdict. **GoPlus** lit le contrat — autorités, taxes déclarées, porteurs.
**honeypot.is** ne lit rien : il *simule* un achat puis une revente, ce qui
attrape les pièges qu'aucune lecture statique ne voit, mais seulement sur
Ethereum, BNB Chain et Base. **RugCheck** ne connaît que Solana, où les deux
autres sont aveugles ou absents.

Aucune ne suffit seule, et c'est voulu : un contrat qui passe la lecture
statique peut piéger la revente, et une simulation qui réussit ne dit rien
d'une liquidité non verrouillée.

**Aucune clé d'API n'est requise.** Les trois répondent sans inscription, ce
qui est la raison pour laquelle ce sont ces trois-là : un garde-fou qui dépend
d'un abonnement est un garde-fou qu'on finira par désactiver.

**Une source qui ne répond pas rend `None`, jamais un constat vide.** La
distinction porte tout le module : un constat vide se lirait comme « rien à
signaler », et c'est exactement le faux quitus que le bouclier existe pour
empêcher. Le silence remonte jusqu'à `juger`, qui rend `INCONNU`.

Les identifiants de chaîne sont recopiés ici plutôt qu'importés du radar
`pepites/` : les deux outils vivent dans des processus séparés, avec des piles
HTTP différentes — `aiohttp` ici, `requests` là-bas —, et un import croisé
entre deux projets du dépôt lierait leurs cycles de vie sans rien apporter.
"""

from __future__ import annotations

import asyncio

from ..core.journal import obtenir
from ..core.reseau import Fetcher
from ..strategy.bouclier import Constat

_journal = obtenir("data_engine.securite")

GOPLUS_EVM = "https://api.gopluslabs.io/api/v1/token_security/{chaine}"
GOPLUS_SOLANA = "https://api.gopluslabs.io/api/v1/solana/token_security"
HONEYPOT = "https://api.honeypot.is/v2/IsHoneypot"
RUGCHECK = "https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary"

# Identifiant DexScreener → identifiant numérique EVM. Une chaîne absente d'ici
# n'est pas une erreur : elle n'a simplement pas de source, et le bouclier rend
# `INCONNU` — ce qui bloque l'achat par défaut, le bon sens de l'échec.
CHAINES_EVM = {
    "ethereum": "1", "bsc": "56", "base": "8453", "arbitrum": "42161",
    "avalanche": "43114", "polygon": "137", "optimism": "10",
}

# Le simulateur d'achat/revente ne couvre que ces trois-là.
CHAINES_HONEYPOT = {"ethereum": 1, "bsc": 56, "base": 8453}


def est_evm(chaine: str) -> bool:
    return chaine in CHAINES_EVM


def _drapeau(valeur) -> bool | None:
    """GoPlus rend « 1 », « 0 », ou omet le champ. Les trois cas mènent ici, et
    l'omission doit rester `None` : elle veut dire « je ne sais pas », pas
    « non »."""

    if valeur in (None, ""):
        return None
    return str(valeur) == "1"


def _pourcent(valeur) -> float | None:
    """GoPlus exprime ses taxes en fraction (« 0.05 »), honeypot.is en
    pourcentage. On normalise en pourcentage ici, une bonne fois."""

    if valeur in (None, ""):
        return None
    try:
        return float(valeur) * 100
    except (TypeError, ValueError):
        return None


def _nombre(valeur) -> float | None:
    if valeur in (None, ""):
        return None
    try:
        return float(valeur)
    except (TypeError, ValueError):
        return None


def _part_verrouillee(detenteurs) -> float | None:
    """Part de la liquidité tenue par des adresses marquées verrouillées."""

    if not isinstance(detenteurs, list) or not detenteurs:
        return None
    total = 0.0
    for entree in detenteurs:
        if not isinstance(entree, dict):
            continue
        if str(entree.get("is_locked", "0")) == "1":
            total += _nombre(entree.get("percent")) or 0.0
    return total * 100


def _concentration(detenteurs) -> float | None:
    """Part de l'offre tenue par les dix premiers porteurs, hors contrats de
    pool : le pool *est* la liquidité, le compter comme une concentration
    ferait rejeter tous les jetons sains."""

    if not isinstance(detenteurs, list) or not detenteurs:
        return None
    parts = []
    for entree in detenteurs:
        if not isinstance(entree, dict):
            continue
        if str(entree.get("is_contract", "0")) == "1":
            continue
        part = _nombre(entree.get("percent"))
        if part is not None:
            parts.append(part)
    if not parts:
        return None
    return sum(sorted(parts, reverse=True)[:10]) * 100


def _extraire_goplus(reponse, adresse: str) -> dict | None:
    """La réponse est indexée par adresse, dont la casse ne correspond pas
    toujours à celle qu'on a envoyée."""

    if not isinstance(reponse, dict):
        return None
    resultat = reponse.get("result")
    if not isinstance(resultat, dict) or not resultat:
        return None
    for cle, valeur in resultat.items():
        if cle.lower() == adresse.lower() and isinstance(valeur, dict):
            return valeur
    premier = next(iter(resultat.values()), None)
    return premier if isinstance(premier, dict) else None


async def goplus(fetcher: Fetcher, chaine: str, adresse: str) -> Constat | None:
    identifiant = CHAINES_EVM.get(chaine)
    url = GOPLUS_EVM.format(chaine=identifiant) if identifiant else GOPLUS_SOLANA
    try:
        reponse = await fetcher.json(url, params={"contract_addresses": adresse})
    except Exception as erreur:                       # noqa: BLE001
        _journal.debug("goplus muet sur %s : %s", adresse, erreur)
        return None

    brut = _extraire_goplus(reponse, adresse)
    if not brut:
        return None

    if identifiant:
        return Constat(
            source="GoPlus",
            honeypot=_drapeau(brut.get("is_honeypot")),
            taxe_achat_pct=_pourcent(brut.get("buy_tax")),
            taxe_vente_pct=_pourcent(brut.get("sell_tax")),
            emission_possible=_drapeau(brut.get("is_mintable")),
            gel_possible=_drapeau(brut.get("transfer_pausable")),
            lp_verrouillee_pct=_part_verrouillee(brut.get("lp_holders")),
            top10_detenteurs_pct=_concentration(brut.get("holders")),
        )

    # Solana : d'autres noms de champs, et la simulation n'existe pas.
    return Constat(
        source="GoPlus",
        emission_possible=_drapeau((brut.get("mintable") or {}).get("status")),
        gel_possible=_drapeau((brut.get("freezable") or {}).get("status")),
        top10_detenteurs_pct=_concentration(brut.get("holders")),
    )


async def honeypot_is(fetcher: Fetcher, chaine: str, adresse: str) -> Constat | None:
    identifiant = CHAINES_HONEYPOT.get(chaine)
    if identifiant is None:
        return None                       # chaîne non couverte, pas un échec
    try:
        reponse = await fetcher.json(
            HONEYPOT, params={"address": adresse, "chainID": identifiant}
        )
    except Exception as erreur:                       # noqa: BLE001
        _journal.debug("honeypot.is muet sur %s : %s", adresse, erreur)
        return None
    if not isinstance(reponse, dict):
        return None

    resultat = reponse.get("honeypotResult") or {}
    simulation = reponse.get("simulationResult") or {}
    piege = resultat.get("isHoneypot")
    remarques = []
    if reponse.get("simulationSuccess") is False:
        # La simulation elle-même a échoué : ce n'est pas un quitus, et le dire
        # évite qu'un `isHoneypot` absent se lise comme un « non ».
        remarques.append("simulation d'achat/revente impossible")
    return Constat(
        source="honeypot.is",
        honeypot=bool(piege) if piege is not None else None,
        taxe_achat_pct=_nombre(simulation.get("buyTax")),
        taxe_vente_pct=_nombre(simulation.get("sellTax")),
        remarques=tuple(remarques),
    )


async def rugcheck(fetcher: Fetcher, chaine: str, adresse: str) -> Constat | None:
    if chaine != "solana":
        return None
    try:
        reponse = await fetcher.json(RUGCHECK.format(mint=adresse))
    except Exception as erreur:                       # noqa: BLE001
        _journal.debug("rugcheck muet sur %s : %s", adresse, erreur)
        return None
    if not isinstance(reponse, dict):
        return None

    # Les intitulés de risque sont du texte libre : on ne reconnaît que ceux qui
    # ont une conséquence mécanique, le reste devient une remarque. Reconnaître
    # un intitulé de travers coûterait un rejet injustifié.
    emission = gel = None
    remarques: list[str] = []
    for risque in reponse.get("risks") or []:
        if not isinstance(risque, dict):
            continue
        nom = str(risque.get("name", "")).lower()
        if "mint authority" in nom:
            emission = True
        elif "freeze authority" in nom:
            gel = True
        else:
            remarques.append(str(risque.get("name", ""))[:60])

    return Constat(
        source="RugCheck",
        emission_possible=emission,
        gel_possible=gel,
        remarques=tuple(remarques[:3]),
    )


async def constats(fetcher: Fetcher, chaine: str, adresse: str,
                   delai_s: float = 8.0) -> list[Constat]:
    """Les trois avis, demandés **en parallèle** et bornés dans le temps.

    En série, trois services lents additionnent leurs délais dans le chemin
    d'achat — et une pépite se décide en secondes. Le délai global est un
    plafond, pas une cible : le dépasser rend les constats obtenus, et le
    bouclier tranche sur ce qu'il a.
    """

    taches = [
        goplus(fetcher, chaine, adresse),
        honeypot_is(fetcher, chaine, adresse),
        rugcheck(fetcher, chaine, adresse),
    ]
    try:
        rendus = await asyncio.wait_for(
            asyncio.gather(*taches, return_exceptions=True), timeout=delai_s
        )
    except asyncio.TimeoutError:
        _journal.warning("bouclier : délai dépassé sur %s (%s)", adresse, chaine)
        return []
    return [c for c in rendus if isinstance(c, Constat)]
