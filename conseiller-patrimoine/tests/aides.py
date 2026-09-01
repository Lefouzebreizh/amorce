#!/usr/bin/env python3
"""Fabriques partagées par les tests. Nommé hors du motif `test*.py` pour ne pas
être ramassé comme une suite.

Tous les cours sont **injectés**, jamais relevés : c'est le seul moyen d'écrire
un test qui rend le même verdict demain qu'aujourd'hui. Le patrimoine d'exemple
est choisi pour tomber sur des nombres ronds — 5 000 € de bourse, 5 000 € de
crypto, 40 000 € d'immobilier net, 10 000 € de liquidités — parce qu'un test
dont on doit calculer l'attendu à la machine ne se relit pas.
"""

import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from core.reglages import valider  # noqa: E402

AUJOURDHUI = date(2026, 9, 1)
HIER = date(2026, 8, 31)
VIEUX = date(2026, 6, 1)          # 92 jours : bien au-delà de la fraîcheur admise

PROFIL = {
    "appetence_risque": "equilibre",
    "horizon_annees": 15,
    "apport_mensuel_eur": 500,
    "cibles_pct": {"bourse": 50, "crypto": 10, "immobilier": 30, "liquidites": 10},
    "bande_tolerance_pct": 5,
    "fraicheur_max_jours": 30,
}

ACTIFS = {
    "bourse": [{
        "nom": "Monde", "ticker": "CW8.PA", "enveloppe": "PEA",
        "quantite": 10, "pru_eur": 400.0, "prix_eur": 500.0, "releve_le": HIER,
    }],                                                   # 10 × 500 = 5 000 €
    "crypto": [{
        "nom": "Bitcoin", "symbole": "BTC",
        "quantite": 0.1, "pru_eur": 30000.0, "prix_eur": 50000.0, "releve_le": HIER,
    }],                                                   # 0,1 × 50 000 = 5 000 €
    "immobilier": [{
        "nom": "Studio", "valeur_estimee_eur": 100000, "capital_restant_du_eur": 60000,
        "loyer_mensuel_brut_eur": 500, "charges_annuelles_eur": 1200,
    }],                                                   # 100 000 − 60 000 = 40 000 €
    "liquidites": [{"nom": "Livret A", "montant_eur": 10000, "taux_annuel_pct": 1.7}],
}


def reglages(profil: dict | None = None, actifs: dict | None = None, sources: dict | None = None):
    """Des réglages valides, éventuellement amendés poche par poche."""
    brut = {
        "profil": {**PROFIL, **(profil or {})},
        "actifs": {**ACTIFS, **(actifs or {})},
    }
    if sources is not None:
        brut["sources"] = sources
    return valider(brut)
