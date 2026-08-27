#!/usr/bin/env python3
"""Voir l'effet d'un réglage sur des profils de marché connus.

Régler un détecteur, c'est bouger un nombre et se demander ce qu'on vient de
casser ailleurs. Un scan réel ne répond pas à cette question : il dépend du
marché du moment, met une minute, et deux tours ne sont jamais comparables.

Ce script tient les six profils de côté et les fait passer par les mêmes
filtres et la même note que le radar, avec le `reglages.yaml` du moment. On
bouge un seuil, on relance, on lit la colonne qui a bougé. C'est instantané et
c'est reproductible.

    python3 profils.py

Les profils ne sont pas des cas limites choisis pour faire joli : ce sont les
cinq façons dont le radar peut se tromper, plus celle qu'on cherche.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.modeles import Candidat, Jeton, Paire  # noqa: E402
from core.reglages import charger  # noqa: E402
from skills.convergence import mesurer, noter  # noqa: E402
from skills.radar import filtrer  # noqa: E402

MAINTENANT = datetime.now(timezone.utc)


def profil(chaine, **remplacements) -> Candidat:
    quote = sorted(chaine.quotes)[0]
    defauts = dict(
        adresse="0xpool", dex="test",
        jeton=Jeton(chaine=chaine, adresse="0xjeton", symbole="TEST", nom="Test"),
        quote_adresse=quote, quote_symbole="REF",
        prix_usd=0.001, liquidite_usd=120_000, market_cap=1_500_000, fdv=1_500_000,
        creee_le=MAINTENANT - timedelta(hours=240),
        volume_h1=90_000, volume_h6=280_000, volume_h24=700_000,
        variation_h1=6.0, variation_h6=11.0, variation_h24=18.0,
        achats_h1=190, ventes_h1=120, achats_h24=2400, ventes_h24=2100,
        releve_le=MAINTENANT,
    )
    defauts.update(remplacements)
    return Candidat.depuis_paires([Paire(**defauts)])


def profils(chaine) -> list[tuple[str, str, Candidat]]:
    """Chaque profil, ce qu'on attend de lui, et les données qui le décrivent."""
    return [
        ("accumulation", "retenu",
         profil(chaine)),
        ("sommet en cours", "note basse",
         profil(chaine, volume_h1=6_000_000, volume_h24=7_000_000, variation_h1=90.0)),
        ("endormi", "note basse",
         profil(chaine, volume_h1=800, volume_h24=40_000, achats_h1=9, ventes_h1=8)),
        ("robot de volume", "drapeau",
         profil(chaine, achats_h1=6000, ventes_h1=5900)),
        ("lavage", "drapeau",
         profil(chaine, achats_h1=500, ventes_h1=501, liquidite_usd=60_000,
                volume_h24=900_000)),
        ("ventes bloquées", "drapeau",
         profil(chaine, achats_h1=400, ventes_h1=1)),
        ("pool de deux heures", "écarté",
         profil(chaine, creee_le=MAINTENANT - timedelta(hours=2))),
        ("déjà grand public", "écarté",
         profil(chaine, market_cap=90_000_000, fdv=90_000_000)),
    ]


def principal() -> int:
    reglages = charger()
    chaine = reglages.chaines["base"]
    seuil = reglages.bouclier.note_minimale_pour_analyser

    print(f"Seuil d'analyse {seuil:.0f}/100 · seuil d'alerte "
          f"{reglages.alertes.note_minimale:.0f}/100\n")
    print(f"{'profil':<20} {'attendu':<11} {'note':>6}  détail")
    print("-" * 100)

    for nom, attendu, candidat in profils(chaine):
        retenus, rejets = filtrer([candidat], reglages.filtres)
        if not retenus:
            print(f"{nom:<20} {attendu:<11} {'—':>6}  écarté : {next(iter(rejets))}")
            continue
        metriques = mesurer(candidat)
        note = noter(candidat, metriques, reglages.convergence)
        detail = " ".join(f"{n[:5]} {v:.0f}" for n, v in note.detail.items())
        print(f"{nom:<20} {attendu:<11} {note.total:6.1f}  {detail}")
        if note.drapeaux:
            print(f"{'':<39}⚑ {note.drapeaux[0]}")

    print("\nMesures du profil « accumulation » :")
    metriques = mesurer(profil(chaine))
    for champ, valeur in vars(metriques).items():
        print(f"  {champ:<16} {valeur:,.3f}".replace(",", " "))
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
