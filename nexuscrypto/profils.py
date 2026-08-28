#!/usr/bin/env python3
"""L'effet des réglages sur six marchés connus.

À lancer **après tout changement de seuil, de pondération ou de
multiplicateur** — et seulement là. Les tests unitaires diraient qu'ils passent
sans dire que le prix moyen d'achat du profil « chute puis reprise » est passé
sous celui du témoin.

    python3 profils.py                 # le tableau
    python3 profils.py --detail        # et le détail de chaque scénario
    python3 profils.py --sortie x.md   # écrit un rapport Markdown

C'est le pendant du `profils.py` du radar `pepites/`, et pour la même raison :
un réglage se juge sur son effet, pas sur son intention.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

from src.core.config import ConfigurationInvalide, charger  # noqa: E402
from src.rejeu import rapport as mise_en_forme  # noqa: E402
from src.rejeu.donnees import scenarios  # noqa: E402
from src.rejeu.rejeu import rejouer_scenario  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    analyseur = argparse.ArgumentParser(
        description="L'effet des réglages courants sur six marchés connus."
    )
    analyseur.add_argument("--config", default=None)
    analyseur.add_argument("--detail", action="store_true", help="le détail de chaque scénario")
    analyseur.add_argument("--sortie", default=None, help="écrire un rapport Markdown")
    arguments = analyseur.parse_args(argv)

    try:
        config = charger(arguments.config)
    except ConfigurationInvalide as erreur:
        print(f"❌ {erreur}", file=sys.stderr)
        return 2

    lignes = []
    details = []
    comparaisons = []
    for scenario in scenarios():
        dynamique, temoin = rejouer_scenario(config, scenario)
        lignes.append(
            (scenario.nom,
             mise_en_forme.ligne_comparaison(dynamique, temoin, scenario.prix_moyen_marche))
        )
        comparaisons.append((scenario.nom, dynamique, temoin))
        details.append(mise_en_forme.rapport_scenario(scenario, dynamique, temoin))

    tableau = mise_en_forme.tableau(lignes)
    conclusion = mise_en_forme.verdict(comparaisons)

    print(tableau)
    print()
    print(conclusion)
    if arguments.detail:
        print()
        print("\n\n".join(details))

    if arguments.sortie:
        chemin = Path(arguments.sortie)
        chemin.write_text(
            "# NexusCrypto — effet des réglages\n\n"
            f"{conclusion}\n\n{tableau}\n\n"
            "## Détail\n\n" + "\n\n".join(details) + "\n",
            encoding="utf-8",
        )
        print(f"\nRapport écrit : {chemin}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
