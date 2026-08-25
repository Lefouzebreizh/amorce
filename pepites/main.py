#!/usr/bin/env python3
"""Point d'entrée du radar.

    python3 main.py scan              # un tour complet, écrit pepites_radar.md
    python3 main.py scan --bavard     # avec le détail des appels
    python3 main.py purger            # efface les vieux relevés

Un scan seul ne confirme rien : la persistance demande deux relevés espacés de
dix minutes. Le premier tour remplit la mémoire, les suivants s'en servent. En
usage réel, c'est une tâche planifiée toutes les quinze minutes.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pipeline                                   # noqa: E402
import rapport                                    # noqa: E402
from core.reglages import ReglagesInvalides, charger  # noqa: E402
from core.reseau import ReseauIndisponible            # noqa: E402
from core.stockage import BASE_PAR_DEFAUT, Memoire    # noqa: E402


def _journaliser(bavard: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if bavard else logging.INFO,
        format="%(asctime)s  %(message)s",
        datefmt="%H:%M:%S",
    )


def commande_scan(arguments) -> int:
    reglages = charger()
    with Memoire(arguments.base) as memoire:
        resultat = pipeline.scanner(reglages, memoire)
        texte = rapport.composer(
            resultat.observations, resultat.bilan, reglages,
            resultat.debut, resultat.secondes, resultat.appels,
        )
        chemin = rapport.ecrire(texte, arguments.rapport)

    confirmes = [o for o in resultat.observations if o.confirme and not o.note.drapeaux]
    print(f"\n{resultat.bilan.resume()} en {resultat.secondes:.0f} s")
    if confirmes:
        print(f"{len(confirmes)} signal(s) confirmé(s) :")
        for observation in confirmes[:10]:
            candidat = observation.candidat
            print(f"  {observation.note.total:5.0f}/100  {candidat.jeton.symbole:<12} "
                  f"{candidat.jeton.chaine.nom:<12} {observation.lien_dexscreener}")
    else:
        print("Aucun signal confirmé — c'est attendu au premier scan.")
    print(f"\nRapport : {chemin}")
    return 0


def commande_purger(arguments) -> int:
    with Memoire(arguments.base) as memoire:
        efface = memoire.purger(arguments.garder)
    print(f"{efface} relevés effacés.")
    return 0


def principal(argv: list[str] | None = None) -> int:
    analyseur = argparse.ArgumentParser(description="Radar de pépites multi-chaînes.")
    analyseur.add_argument("--base", default=BASE_PAR_DEFAUT, help="fichier SQLite")
    analyseur.add_argument("--bavard", action="store_true", help="journal détaillé")
    sous = analyseur.add_subparsers(dest="commande")

    scan = sous.add_parser("scan", help="un tour complet du radar")
    scan.add_argument("--rapport", default=rapport.RAPPORT_PAR_DEFAUT)
    scan.set_defaults(fonction=commande_scan)

    purge = sous.add_parser("purger", help="efface les vieux relevés")
    purge.add_argument("--garder", type=float, default=30.0, help="en jours")
    purge.set_defaults(fonction=commande_purger)

    arguments = analyseur.parse_args(argv)
    if not hasattr(arguments, "fonction"):
        arguments = analyseur.parse_args(["scan", *(argv or [])])

    _journaliser(arguments.bavard)
    try:
        return arguments.fonction(arguments)
    except ReglagesInvalides as erreur:
        print(f"Configuration inutilisable : {erreur}", file=sys.stderr)
        return 2
    except ReseauIndisponible as erreur:
        # Mieux vaut ce message qu'un rapport vide, qui se lirait comme un
        # marché calme.
        print(f"Réseau indisponible : {erreur}", file=sys.stderr)
        return 3
    except KeyboardInterrupt:
        print("\nInterrompu.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(principal())
