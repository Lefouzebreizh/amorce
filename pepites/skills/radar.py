#!/usr/bin/env python3
"""Skill 1 — le radar multi-chaînes : découvrir, regrouper, éliminer.

La découverte est la partie fragile de tout l'outil, et il vaut mieux le savoir
en la lisant : **DexScreener n'expose aucun point d'entrée « toutes les paires
actives »**. On recoupe donc trois sources, dont aucune n'est exhaustive :

- les **fiches et mises en avant récentes**, de loin les plus riches en
  micro-caps, puisque c'est exactement leur public ;
- la **recherche par jeton de cotation**, qui donne de la largeur mais remonte
  surtout les grosses paires — que la bande de capitalisation écarte aussitôt ;
- notre **mémoire**, qui garantit qu'un jeton déjà repéré sera re-relevé même
  s'il sort du champ des deux premières.

Deux décisions ensuite, et ce sont elles qui font la valeur de cet étage.

**Le regroupement se fait par jeton, pas par paire.** Un jeton dont la liquidité
est répartie sur trois pools paraît trois fois moins profond qu'il n'est, et se
ferait éliminer par un plancher qu'il passe largement. Les jetons découverts par
la vitrine et par la mémoire passent d'ailleurs par `token-pairs`, qui rend
*tous* leurs pools : c'est plus cher d'un appel, et c'est le seul moyen d'avoir
une liquidité juste.

**Les éliminations sont comptées, pas seulement appliquées.** Un radar qui rend
zéro candidat sans dire pourquoi est indébogable — on ne sait pas s'il n'y a
rien ce soir, ou si un seuil est de travers. Le bilan remonte jusqu'au rapport.
"""

from __future__ import annotations

import hashlib
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

from core.modeles import Candidat, Chaine, Paire
from core.reglages import Filtres, Reglages
from core.reseau import ClientHttp
from core.stockage import Memoire
from sources import dexscreener

JOURNAL = logging.getLogger("pepites.radar")


@dataclass
class Bilan:
    """De quoi savoir si un scan vide est un marché calme ou un seuil de travers."""

    paires: int = 0
    jetons: int = 0
    retenus: int = 0
    rejets: Counter = field(default_factory=Counter)
    # Les jetons écartés retenus comme point de comparaison. Ils ne sont pas
    # des candidats et n'entrent nulle part ailleurs : le pipeline les relève,
    # le bulletin les compare, le radar les ignore.
    temoins: list[Candidat] = field(default_factory=list)

    def resume(self) -> str:
        return f"{self.paires} paires → {self.jetons} jetons → {self.retenus} candidats"


def decouvrir(client: ClientHttp, reglages: Reglages, memoire: Memoire | None = None,
              moment: datetime | None = None) -> list[Paire]:
    """Rassemble les paires du tour, par recoupement des trois sources.

    Toutes les paires d'un tour portent le **même** instant de relevé, alors
    que la découverte s'étale sur plusieurs minutes. C'est voulu : les âges et
    les écarts entre deux scans doivent se comparer entre eux, et un horodatage
    par appel ferait dépendre la persistance de l'ordre des requêtes.
    """
    releve_le = moment or datetime.now(timezone.utc)
    paires: dict[tuple[str, str], Paire] = {}      # (chaîne, adresse du pool) → paire

    def ajouter(nouvelles: list[Paire]) -> None:
        for paire in nouvelles:
            paires.setdefault((paire.jeton.chaine.cle, paire.adresse.lower()), paire)

    # 1. Largeur : une recherche par jeton de cotation et par chaîne.
    #
    # Attention : `chaine.quotes` contient les adresses **telles que rangées**
    # au chargement — minuscules sur EVM, casse préservée sur les chaînes qui la
    # distinguent. Elles servent ici de terme de recherche, ce qui donne à
    # `sensible_a_la_casse` un second rôle que son nom n'annonce pas : sur une
    # chaîne où l'adresse est sensible à la casse, l'oublier ne provoque aucune
    # erreur — la recherche ne correspond simplement à rien, la chaîne entière
    # devient muette, et le rapport se lit comme un marché calme.
    for chaine in reglages.chaines.values():
        for quote in sorted(chaine.quotes):
            ajouter(dexscreener.rechercher(client, quote, reglages.chaines, releve_le))

    # 2. Profondeur : les jetons qui viennent de se montrer, tous leurs pools.
    vitrine = dexscreener.jetons_en_vitrine(client, reglages.chaines)
    for chaine, adresse in vitrine[: reglages.radar.jetons_en_vitrine_max]:
        ajouter(dexscreener.paires_du_jeton(client, chaine, adresse, releve_le))

    # 3. Mémoire : ce qu'on suivait déjà, quoi qu'il arrive.
    if memoire is not None:
        suivis = memoire.jetons_suivis(
            depuis_heures=reglages.radar.suivi_depuis_heures,
            minimum=reglages.bouclier.note_minimale_pour_analyser,
            maintenant=releve_le,
        )
        for cle_chaine, adresse in suivis[: reglages.radar.jetons_suivis_max]:
            chaine = reglages.chaines.get(cle_chaine)
            if chaine is not None:
                ajouter(dexscreener.paires_du_jeton(client, chaine, adresse, releve_le))

    JOURNAL.info(
        "découverte : %d paires (%d jetons en vitrine, %d appels HTTP)",
        len(paires), len(vitrine), client.appels,
    )
    return list(paires.values())


def regrouper(paires: list[Paire], chaines: dict[str, Chaine]) -> tuple[list[Candidat], Counter]:
    """Un candidat par jeton, tous ses pools additionnés.

    Les paires cotées en un jeton hors référence sont écartées ici : une paire
    SCAM/AUTRESCAM laisse l'agrégateur convertir en dollars imaginaires, et
    c'est le montage exact du faux volume. Elles ne sont pas seulement inutiles,
    elles fausseraient la somme de liquidité du jeton.
    """
    rejets: Counter = Counter()
    par_jeton: dict[tuple[str, str], list[Paire]] = defaultdict(list)
    for paire in paires:
        if not paire.cotee_en_reference:
            rejets["cotée en un jeton hors référence"] += 1
            continue
        par_jeton[paire.jeton.identite].append(paire)

    return [Candidat.depuis_paires(lot) for lot in par_jeton.values()], rejets


def filtrer(candidats: list[Candidat], filtres: Filtres) -> tuple[list[Candidat], Counter]:
    """Les éliminations franches, avant toute note. Chacune est comptée."""
    rejets: Counter = Counter()
    retenus: list[Candidat] = []

    for candidat in candidats:
        chaine = candidat.jeton.chaine
        motif = None

        if candidat.liquidite_usd < chaine.liquidite_min_usd:
            motif = f"liquidité sous le plancher de {chaine.nom}"
        elif candidat.age_heures < filtres.age_min_heures:
            # Le filtre le plus important : sous six heures, l'accélération
            # explose par construction — le dénominateur sur 24 h n'existe pas
            # encore. Tout jeton de deux heures obtiendrait la note maximale,
            # et c'est exactement la fenêtre du retrait de liquidité.
            motif = "trop jeune (moins de 6 h)"
        elif candidat.age_heures > filtres.age_max_heures:
            motif = "trop vieux"
        elif candidat.market_cap < filtres.market_cap_min_usd:
            motif = "capitalisation trop faible"
        elif candidat.market_cap > filtres.market_cap_max_usd:
            motif = "capitalisation trop élevée"
        elif candidat.transactions_h24 < filtres.transactions_min_24h:
            motif = "trop peu de transactions sur 24 h"
        elif candidat.transactions_h1 < filtres.transactions_min_1h:
            motif = "trop peu de transactions sur 1 h"
        elif candidat.market_cap > 0 and candidat.liquidite_usd / candidat.market_cap < filtres.profondeur_min:
            motif = "pool trop mince pour la capitalisation affichée"
        elif candidat.market_cap > 0 and candidat.fdv / candidat.market_cap > filtres.fdv_sur_mcap_max:
            motif = "offre encore largement verrouillée (FDV/capitalisation)"
        elif candidat.variation_h1 > filtres.variation_1h_max_pct:
            motif = "déjà parti (+150 % en 1 h)"
        elif candidat.variation_h24 > filtres.variation_24h_max_pct:
            motif = "déjà parti (+400 % en 24 h)"

        if motif:
            rejets[motif] += 1
        else:
            retenus.append(candidat)

    return retenus, rejets


# Un écarté sur quatre sert de témoin. La part n'est pas un réglage fin : elle
# doit seulement remplir les vingt jetons jugeables qu'exige le bulletin en
# quelques jours, sans faire enfler la base — huit tours par jour sur ~185
# écartés donnent quelques centaines de lignes quotidiennes, que `purger`
# ramasse au bout de trente jours.
PART_TEMOIN = 4


def echantillon_temoin(ecartes: list[Candidat], part: int = PART_TEMOIN) -> list[Candidat]:
    """Un écarté sur `part`, choisi de façon **stable dans le temps**.

    C'est toute la difficulté, et un tirage au hasard la manquerait : un témoin
    n'a de valeur que relevé **plusieurs fois**, puisque le bulletin compare un
    premier et un dernier prix. Tiré à neuf à chaque tour, l'échantillon
    n'accumulerait jamais deux relevés du même jeton et resterait éternellement
    « indécidable ».

    Le choix se fait donc sur l'adresse, qui ne change pas — et par un hachage
    **explicite** plutôt que par `hash()`, dont Python randomise la valeur d'un
    processus à l'autre pour les chaînes. Avec `hash()`, chaque tour du workflow
    étant un processus neuf, l'échantillon aurait changé à chaque fois sans que
    rien ne le signale : le défaut aurait ressemblé à un marché instable.

    Aucun appel réseau ici, ni ailleurs pour les témoins : leurs données
    viennent du tour de découverte qui vient d'avoir lieu.
    """
    if part <= 1:
        return list(ecartes)
    garde = []
    for candidat in ecartes:
        empreinte = hashlib.blake2b(
            candidat.jeton.adresse.encode("utf-8"), digest_size=8
        ).digest()
        if int.from_bytes(empreinte, "big") % part == 0:
            garde.append(candidat)
    return garde


def scanner(client: ClientHttp, reglages: Reglages, memoire: Memoire | None = None,
            moment: datetime | None = None) -> tuple[list[Candidat], Bilan]:
    """Un tour complet du radar : de l'API aux candidats notables."""
    paires = decouvrir(client, reglages, memoire, moment)
    candidats, rejets_cotation = regrouper(paires, reglages.chaines)
    retenus, rejets_filtres = filtrer(candidats, reglages.filtres)

    gardes = {c.jeton.identite for c in retenus}
    ecartes = [c for c in candidats if c.jeton.identite not in gardes]

    bilan = Bilan(
        paires=len(paires), jetons=len(candidats), retenus=len(retenus),
        rejets=rejets_cotation + rejets_filtres,
        temoins=echantillon_temoin(ecartes),
    )
    JOURNAL.info("radar : %s", bilan.resume())
    return retenus, bilan
