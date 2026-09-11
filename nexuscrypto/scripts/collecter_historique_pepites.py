#!/usr/bin/env python3
"""Volet A du rejeu représentatif : un historique OHLCV pour des jetons qui
ont vraiment eu le profil « pépite », pas des majors.

**Pourquoi ce script existe.** Erwann a bloqué le rejeu prévu sur CoinMetrics
BTC/ETH/LINK : NexusCrypto vise des jetons dynamiquement découverts par le
scanner (`strategy/pepites.py`), pas les majors d'une watchlist figée — les
valider sur BTC/ETH/LINK ne prouve rien sur leur comportement une fois branché
sur des petites capitalisations. Et `pepites/temoin.py`, le banc d'essai du
radar, l'a déjà mesuré avant nous : « Il n'y a pas d'historique de pépites à
rejouer — DexScreener ne publie aucune archive, et aucun jeu figé ne porte des
paires de faible capitalisation. »

**Ce que ce script mesure, et ce qu'il ne mesure pas.** Il ne rejoue pas le
*scanner* — sa détection a besoin d'instantanés DexScreener dans le temps
(liquidité, croissance de volume), qui n'existent nulle part en historique. Il
fournit un historique **OHLCV** pour éprouver le *moteur* (seuil, stops ATR,
dimensionnement) sur un prix volatil et une liquidité fine, ce qu'aucune
donnée CoinMetrics ne permet.

**Le biais du survivant, et comment ce script l'évite.** Échantillonner « les
jetons qui ressemblent à une pépite aujourd'hui » ne ramènerait que des
survivants. `CANDIDATS` ci-dessous mélange volontairement des jetons qui ont
grandi depuis un lancement micro-cap et des jetons qui se sont effondrés — un
rejeu qui ne verrait que les premiers serait optimiste par construction.

**Ce qui n'est PAS vérifié d'ici, à dessein.** Le réseau de marché est bloqué
depuis une session distante (`CLAUDE.md` §7) — mesuré le 11/09/2026 sur
GeckoTerminal, DexScreener, Birdeye et DefiLlama, les quatre rendent
`connect_rejected`. Ce script s'écrit donc contre l'API réelle de GeckoTerminal
(publique, sans clé), s'éprouve entièrement hors ligne avec un `fetch` injecté,
et ne sera réellement mesuré qu'à l'exécution du workflow, sur le runner
GitHub — même parade que la voix off et le radar de pépites. La première vraie
exécution y est diagnostique, pas une simple formalité : voir `sonder()`.
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

BASE_GECKOTERMINAL = "https://api.geckoterminal.com/api/v2"
AGENT_UTILISATEUR = "nexuscrypto-collecte-pepites/1 (+github.com/Lefouzebreizh/amorce)"

# Type d'un « fetch » : une adresse et des paramètres de requête optionnels,
# rend le JSON déjà décodé. Un objet de test en rend un enregistré, sans
# réseau — même principe que le protocole `Fetcher` du cœur, en synchrone
# parce que ce script tourne seul, hors de la boucle de l'orchestrateur.
Fetch = Callable[[str, dict[str, Any] | None], Any]


@dataclass(frozen=True, slots=True)
class Candidat:
    """Un jeton à chercher, avec ce qu'on sait déjà de son issue réelle.

    `issue` n'est pas relu par le calcul : c'est une note humaine, écrite pour
    que quiconque relit `CANDIDATS` voie tout de suite que la liste n'est pas
    un survivorship bias déguisé.
    """

    symbole: str
    chaine: str          # identifiant réseau GeckoTerminal — « solana », « eth », « bsc »…
    issue: str           # ce qui lui est réellement arrivé, pour la transparence du mélange


# Volontairement mélangé : des survivants qui sont partis d'un lancement
# micro-cap, et des effondrements documentés. Les chaînes et symboles sont
# posés depuis la connaissance publique de ces affaires, jamais une adresse de
# contrat — celle-ci se résout en direct par recherche (`resoudre_pool`),
# parce qu'une adresse tapée de mémoire qui se trompe d'un caractère pointerait
# silencieusement vers un autre jeton.
CANDIDATS: tuple[Candidat, ...] = (
    Candidat("WIF", "solana", "survivant — lancement micro-cap fin 2023, plusieurs milliards ensuite"),
    Candidat("BONK", "solana", "survivant — lancement micro-cap fin 2022, plusieurs milliards ensuite"),
    Candidat("PEPE", "eth", "survivant — lancement micro-cap mi-2023, plusieurs milliards ensuite"),
    Candidat("SQUID", "bsc", "effondré — arnaque à la sortie documentée, fin 2021, cours à ~0 en quelques jours"),
    Candidat("TITAN", "polygon_pos", "effondré — perte de parité d'Iron Finance, mi-2021, cours à ~0 en un jour"),
)


class ErreurCollecte(Exception):
    """Une étape de la collecte a échoué pour un candidat donné."""


def fetch_reel(url: str, params: dict[str, Any] | None = None) -> Any:
    """Le seul endroit qui touche vraiment le réseau. `urllib`, en bibliothèque
    standard : ce script tourne seul dans un job, sans les dépendances du
    cœur."""

    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    requete = urllib.request.Request(url, headers={"User-Agent": AGENT_UTILISATEUR, "Accept": "application/json"})
    with urllib.request.urlopen(requete, timeout=20) as reponse:
        return json.loads(reponse.read().decode("utf-8"))


def sonder(fetch: Fetch = fetch_reel) -> bool:
    """Un aller-retour léger avant de dépenser tous les candidats. Même
    philosophie que `pepites/main.py sonde` : mieux vaut un rapport vide et
    explicite qu'un scan qui tourne sur une source muette sans que personne ne
    le voie."""

    try:
        reponse = fetch(f"{BASE_GECKOTERMINAL}/networks", {"page": 1})
    except Exception as erreur:  # noqa: BLE001 — sonde : on veut le nommer, pas le laisser remonter
        print(f"GeckoTerminal injoignable : {erreur}", file=sys.stderr)
        return False
    reseaux = (reponse or {}).get("data") or []
    if not reseaux:
        print("GeckoTerminal répond, mais sans réseau listé — forme inattendue.", file=sys.stderr)
        return False
    print(f"GeckoTerminal répond : {len(reseaux)} réseaux listés sur la première page.")
    return True


def resoudre_pool(fetch: Fetch, candidat: Candidat) -> str | None:
    """Cherche le pool le plus liquide pour ce symbole, sur la chaîne demandée.

    Rend `None` — jamais une adresse devinée — quand la recherche ne rend rien
    sur cette chaîne, ou quand aucun résultat ne porte vraiment le symbole
    attendu : un jeton homonyme sur une autre chaîne ne doit pas se glisser
    dans le lot.
    """

    try:
        reponse = fetch(f"{BASE_GECKOTERMINAL}/search/pools", {"query": candidat.symbole})
    except Exception as erreur:  # noqa: BLE001
        raise ErreurCollecte(f"{candidat.symbole} : recherche impossible ({erreur}).") from erreur

    resultats = (reponse or {}).get("data") or []
    correspondants = []
    for entree in resultats:
        attributs = (entree or {}).get("attributes") or {}
        relations = (entree or {}).get("relationships") or {}
        reseau = ((relations.get("network") or {}).get("data") or {}).get("id")
        nom = (attributs.get("name") or "").upper()
        if reseau != candidat.chaine:
            continue
        if candidat.symbole.upper() not in nom:
            continue
        correspondants.append(attributs)

    if not correspondants:
        return None

    # Le pool le plus liquide, comme `onchain.meilleure_paire` : le premier
    # rendu par une recherche n'est pas garanti être le mieux arbitré.
    meilleur = max(
        correspondants,
        key=lambda a: float(a.get("reserve_in_usd") or 0.0),
    )
    return meilleur.get("address")


def recuperer_ohlcv(
    fetch: Fetch, candidat: Candidat, adresse: str, *, jours: int = 365,
) -> list[tuple[int, float, float, float, float, float]]:
    """Bougies quotidiennes depuis la création du pool, ou `jours` au plus.

    Rendues triées du plus ancien au plus récent — l'ordre que `lire_csv`
    attend — sans faire confiance à celui de l'API, qui n'est pas garanti ici
    faute d'avoir pu le vérifier depuis cette session (voir l'en-tête).
    """

    url = f"{BASE_GECKOTERMINAL}/networks/{candidat.chaine}/pools/{adresse}/ohlcv/day"
    try:
        reponse = fetch(url, {"aggregate": 1, "limit": min(jours, 1000), "currency": "usd"})
    except Exception as erreur:  # noqa: BLE001
        raise ErreurCollecte(f"{candidat.symbole} : OHLCV impossible ({erreur}).") from erreur

    liste = (
        ((reponse or {}).get("data") or {}).get("attributes") or {}
    ).get("ohlcv_list") or []
    bougies = [
        (int(ligne[0]), float(ligne[1]), float(ligne[2]), float(ligne[3]), float(ligne[4]), float(ligne[5]))
        for ligne in liste
        if isinstance(ligne, (list, tuple)) and len(ligne) >= 6
    ]
    bougies.sort(key=lambda b: b[0])
    return bougies


def ecrire_csv(chemin: Path, bougies: Sequence[tuple[int, float, float, float, float, float]]) -> None:
    """Écrit au format que lit `rejeu.donnees.lire_csv` : horodatage en
    secondes, six colonnes, en-tête tolérée."""

    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="") as f:
        ecrivain = csv.writer(f)
        ecrivain.writerow(("horodatage", "ouverture", "haut", "bas", "cloture", "volume"))
        for horodatage_ms, o, h, b, c, v in bougies:
            ecrivain.writerow((horodatage_ms, o, h, b, c, v))


def collecter(
    dossier_sortie: Path, *, candidats: Sequence[Candidat] = CANDIDATS, fetch: Fetch = fetch_reel,
) -> dict[str, str]:
    """Collecte tous les candidats. Rend, par symbole, soit le chemin écrit
    soit le motif d'échec — jamais une exception qui arrêterait les suivants,
    même principe que `strategy/pepites.scanner` qui journalise plutôt que de
    faire tomber tout le lot pour un seul candidat mal formé."""

    resultats: dict[str, str] = {}
    for candidat in candidats:
        try:
            adresse = resoudre_pool(fetch, candidat)
            if adresse is None:
                resultats[candidat.symbole] = "aucun pool trouvé pour ce symbole sur cette chaîne"
                continue
            bougies = recuperer_ohlcv(fetch, candidat, adresse)
            if not bougies:
                resultats[candidat.symbole] = "pool trouvé, mais aucune bougie rendue"
                continue
            chemin = dossier_sortie / f"{candidat.symbole.lower()}_{candidat.chaine}.csv"
            ecrire_csv(chemin, bougies)
            resultats[candidat.symbole] = f"écrit : {chemin.name} ({len(bougies)} bougies)"
        except ErreurCollecte as erreur:
            resultats[candidat.symbole] = str(erreur)
    return resultats


def main(argv: Sequence[str] | None = None) -> int:
    import argparse

    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--sonde", action="store_true", help="vérifie seulement que GeckoTerminal répond")
    analyseur.add_argument("--sortie", type=Path, default=Path("nexuscrypto/donnees_pepites"),
                            help="dossier où écrire les CSV")
    arguments = analyseur.parse_args(argv)

    if arguments.sonde:
        return 0 if sonder() else 4

    if not sonder():
        print("Sonde négative : la collecte n'a pas lieu.", file=sys.stderr)
        return 4

    resultats = collecter(arguments.sortie)
    echecs = 0
    for symbole, motif in resultats.items():
        prefixe = "✅" if motif.startswith("écrit") else "❌"
        if prefixe == "❌":
            echecs += 1
        print(f"{prefixe} {symbole} : {motif}")
    return 1 if echecs == len(resultats) else 0


if __name__ == "__main__":
    raise SystemExit(main())
