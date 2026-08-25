#!/usr/bin/env python3
"""Chargement et validation des deux fichiers de configuration.

Un détecteur se règle en bougeant des nombres, souvent, et rarement en pleine
concentration. Ce module part donc du principe qu'on va se tromper, et refuse
de démarrer plutôt que de noter de travers :

- des pondérations qui font 97 au lieu de 100 donneraient une note maximale à
  97, et le seuil d'alerte à 70 changerait de sens sans prévenir ;
- un trapèze décroissant noterait 0 partout, silencieusement, et le critère
  disparaîtrait de l'outil sans qu'aucune erreur ne le dise ;
- une adresse de jeton de cotation en majuscules sur une chaîne EVM ne
  correspondrait jamais, et toutes les paires de cette chaîne seraient rejetées
  comme « cotées en un jeton inconnu ».

Chacune de ces trois erreurs a la même signature à l'usage : le radar ne
trouve plus rien et l'on cherche du côté de l'API. D'où le contrôle ici.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

from .modeles import CHAMPS_METRIQUES, Chaine, Trapeze

RACINE = Path(__file__).resolve().parents[1]
DOSSIER_CONFIG = RACINE / "config"

# Une pondération totale doit tomber sur 100 — à un cheveu près, parce qu'un
# YAML peut contenir des décimales.
TOLERANCE_POIDS = 1e-6


class ReglagesInvalides(ValueError):
    """Configuration inutilisable. Levée au démarrage, jamais en plein scan."""


def _exiger(source: dict, cle: str, ou: str):
    if cle not in source:
        raise ReglagesInvalides(f"{ou} : clé « {cle} » manquante")
    return source[cle]


@dataclass(frozen=True)
class Critere:
    nom: str
    poids: float
    trapeze: Trapeze


@dataclass(frozen=True)
class ReglagesRadar:
    jetons_en_vitrine_max: int
    jetons_suivis_max: int
    suivi_depuis_heures: float


@dataclass(frozen=True)
class Filtres:
    """Les éliminations franches, avant toute note."""

    market_cap_min_usd: float
    market_cap_max_usd: float
    age_min_heures: float
    age_max_jours: float
    transactions_min_24h: int
    transactions_min_1h: int
    profondeur_min: float
    fdv_sur_mcap_max: float
    variation_1h_max_pct: float
    variation_24h_max_pct: float

    @property
    def age_max_heures(self) -> float:
        return self.age_max_jours * 24.0


@dataclass(frozen=True)
class Drapeaux:
    honeypot_ratio_achats: float
    honeypot_ventes_max: int
    lavage_symetrie_max: float
    lavage_rotation_min: float
    robot_ticket_max_usd: float
    robot_transactions_min: int


@dataclass(frozen=True)
class Persistance:
    releves_requis: int
    ecart_min_minutes: int
    chute_liquidite_max_pct: float


@dataclass(frozen=True)
class Convergence:
    criteres: tuple[Critere, ...]
    drapeaux: Drapeaux
    persistance: Persistance

    def critere(self, nom: str) -> Critere:
        for c in self.criteres:
            if c.nom == nom:
                return c
        raise KeyError(nom)


@dataclass(frozen=True)
class Bouclier:
    note_minimale_pour_analyser: float
    candidats_max_par_scan: int
    rejets: dict
    penalites: dict


@dataclass(frozen=True)
class ReglagesSmartMoney:
    premiers_acheteurs: int
    apparitions_min: int
    bonus_max: float


@dataclass(frozen=True)
class ReglagesAlertes:
    note_minimale: float
    silence_heures: float
    progression_pour_relancer: float
    max_par_scan: int


@dataclass(frozen=True)
class Reglages:
    chaines: dict[str, Chaine]
    radar: ReglagesRadar
    filtres: Filtres
    convergence: Convergence
    bouclier: Bouclier
    smart_money: ReglagesSmartMoney
    alertes: ReglagesAlertes


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------

def lire_chaines(donnees: dict) -> dict[str, Chaine]:
    if not donnees:
        raise ReglagesInvalides("aucune chaîne déclarée : le radar n'aurait rien à scanner")

    chaines: dict[str, Chaine] = {}
    for cle, brut in donnees.items():
        ou = f"chaîne « {cle} »"
        sensible = bool(brut.get("sensible_a_la_casse", False))
        quotes_brutes = _exiger(brut, "quotes", ou)
        if not quotes_brutes:
            raise ReglagesInvalides(
                f"{ou} : aucun jeton de cotation. Toutes ses paires seraient écartées."
            )
        # Les adresses EVM sont rangées en minuscules une fois pour toutes : la
        # comparaison se fait des milliers de fois par scan, et une casse
        # oubliée dans le fichier ne doit pas se payer à chaque paire.
        quotes = frozenset(q if sensible else q.lower() for q in quotes_brutes)

        goplus = str(_exiger(brut, "goplus", ou))
        honeypot = brut.get("honeypot_is")
        if honeypot is not None and not goplus.isdigit():
            raise ReglagesInvalides(
                f"{ou} : honeypot.is ne simule que des chaînes EVM"
            )

        chaines[cle] = Chaine(
            cle=cle,
            nom=_exiger(brut, "nom", ou),
            goplus=goplus,
            honeypot_is=honeypot,
            explorateur=_exiger(brut, "explorateur", ou),
            liquidite_min_usd=float(_exiger(brut, "liquidite_min_usd", ou)),
            quotes=quotes,
            sensible_a_la_casse=sensible,
        )
    return chaines


def lire_convergence(donnees: dict) -> Convergence:
    bruts = _exiger(donnees, "criteres", "convergence")
    criteres = []
    for nom, brut in bruts.items():
        ou = f"critère « {nom} »"
        if nom not in CHAMPS_METRIQUES:
            raise ReglagesInvalides(
                f"{ou} : rien ne le mesure. Critères connus : "
                f"{', '.join(sorted(CHAMPS_METRIQUES))}"
            )
        try:
            trapeze = Trapeze.depuis_liste(_exiger(brut, "trapeze", ou))
        except ValueError as erreur:
            raise ReglagesInvalides(f"{ou} : {erreur}") from erreur
        poids = float(_exiger(brut, "poids", ou))
        if poids <= 0:
            raise ReglagesInvalides(
                f"{ou} : poids nul ou négatif. Pour retirer un critère, "
                "supprimer son entrée — un poids à zéro se lit comme un oubli."
            )
        criteres.append(Critere(nom=nom, poids=poids, trapeze=trapeze))

    total = sum(c.poids for c in criteres)
    if abs(total - 100.0) > TOLERANCE_POIDS:
        raise ReglagesInvalides(
            f"les pondérations font {total:g} et non 100 : la note maximale "
            f"atteignable serait {total:g}, ce qui déplace en silence le seuil d'alerte"
        )

    drapeaux = _exiger(donnees, "drapeaux", "convergence")
    persistance = _exiger(donnees, "persistance", "convergence")
    return Convergence(
        criteres=tuple(criteres),
        drapeaux=Drapeaux(
            honeypot_ratio_achats=float(drapeaux["honeypot_ratio_achats"]),
            honeypot_ventes_max=int(drapeaux["honeypot_ventes_max"]),
            lavage_symetrie_max=float(drapeaux["lavage_symetrie_max"]),
            lavage_rotation_min=float(drapeaux["lavage_rotation_min"]),
            robot_ticket_max_usd=float(drapeaux["robot_ticket_max_usd"]),
            robot_transactions_min=int(drapeaux["robot_transactions_min"]),
        ),
        persistance=Persistance(
            releves_requis=int(persistance["releves_requis"]),
            ecart_min_minutes=int(persistance["ecart_min_minutes"]),
            chute_liquidite_max_pct=float(persistance["chute_liquidite_max_pct"]),
        ),
    )


def lire_reglages(donnees: dict, chaines: dict[str, Chaine]) -> Reglages:
    radar_brut = _exiger(donnees, "radar", "réglages")
    radar = ReglagesRadar(
        jetons_en_vitrine_max=int(radar_brut["jetons_en_vitrine_max"]),
        jetons_suivis_max=int(radar_brut["jetons_suivis_max"]),
        suivi_depuis_heures=float(radar_brut["suivi_depuis_heures"]),
    )
    if radar.jetons_en_vitrine_max + radar.jetons_suivis_max <= 0:
        raise ReglagesInvalides("le radar n'irait chercher aucun jeton")

    filtres_bruts = _exiger(donnees, "filtres", "réglages")
    filtres = Filtres(**{champ: filtres_bruts[champ] for champ in (
        "market_cap_min_usd", "market_cap_max_usd", "age_min_heures",
        "age_max_jours", "transactions_min_24h", "transactions_min_1h",
        "profondeur_min", "fdv_sur_mcap_max", "variation_1h_max_pct",
        "variation_24h_max_pct",
    )})
    if filtres.market_cap_min_usd >= filtres.market_cap_max_usd:
        raise ReglagesInvalides("bande de capitalisation vide : aucun jeton ne peut y entrer")

    convergence = lire_convergence(_exiger(donnees, "convergence", "réglages"))

    bouclier_brut = _exiger(donnees, "bouclier", "réglages")
    smart_brut = _exiger(donnees, "smart_money", "réglages")
    alertes_brut = _exiger(donnees, "alertes", "réglages")

    alertes = ReglagesAlertes(
        note_minimale=float(alertes_brut["note_minimale"]),
        silence_heures=float(alertes_brut["silence_heures"]),
        progression_pour_relancer=float(alertes_brut["progression_pour_relancer"]),
        max_par_scan=int(alertes_brut["max_par_scan"]),
    )
    bouclier = Bouclier(
        note_minimale_pour_analyser=float(bouclier_brut["note_minimale_pour_analyser"]),
        candidats_max_par_scan=int(bouclier_brut["candidats_max_par_scan"]),
        rejets=dict(bouclier_brut["rejets"]),
        penalites=dict(bouclier_brut["penalites"]),
    )
    # Le bouclier ne peut pas être plus exigeant que l'alerte : les candidats
    # entre les deux seuils seraient alertés sans avoir été contrôlés, ce qui
    # est précisément le contraire de ce que fait cet outil.
    if bouclier.note_minimale_pour_analyser > alertes.note_minimale:
        raise ReglagesInvalides(
            f"le bouclier n'analyse qu'à partir de {bouclier.note_minimale_pour_analyser:g} "
            f"alors que l'alerte part de {alertes.note_minimale:g} : des jetons seraient "
            "alertés sans contrôle de sécurité"
        )

    return Reglages(
        chaines=chaines,
        radar=radar,
        filtres=filtres,
        convergence=convergence,
        bouclier=bouclier,
        smart_money=ReglagesSmartMoney(
            premiers_acheteurs=int(smart_brut["premiers_acheteurs"]),
            apparitions_min=int(smart_brut["apparitions_min"]),
            bonus_max=float(smart_brut["bonus_max"]),
        ),
        alertes=alertes,
    )


def charger(dossier: Path | None = None) -> Reglages:
    """Lit `chaines.yaml` et `reglages.yaml`, et refuse tout ce qui cloche."""
    dossier = dossier or DOSSIER_CONFIG
    chaines = lire_chaines(yaml.safe_load((dossier / "chaines.yaml").read_text("utf-8")))
    donnees = yaml.safe_load((dossier / "reglages.yaml").read_text("utf-8"))
    return lire_reglages(donnees, chaines)
