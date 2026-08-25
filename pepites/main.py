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

# Les clés et le jeton Telegram vivent dans un `.env` non versionné. Chargé
# avant tout import de skill : `Messager` lit son jeton dans l'environnement.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:      # l'outil marche sans, il n'alerte simplement pas
    pass

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
        chemin = rapport.ecrire(rapport.composer(resultat, reglages), arguments.rapport)

    retenues = resultat.retenues
    print(f"\n{resultat.bilan.resume()} en {resultat.secondes:.0f} s")
    if retenues:
        print(f"{len(retenues)} pépite(s) retenue(s) :")
        for pepite in retenues[:10]:
            candidat = pepite.candidat
            print(f"  {pepite.note_finale:5.0f}/100  {candidat.jeton.symbole:<12} "
                  f"{candidat.jeton.chaine.nom:<12} {pepite.securite.verdict.value:<9} "
                  f"{pepite.lien_dexscreener}")
    else:
        print("Aucune pépite retenue — c'est attendu au premier scan.")
    if resultat.alertes:
        print(f"{len(resultat.alertes)} alerte(s) envoyée(s) sur Telegram.")
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
