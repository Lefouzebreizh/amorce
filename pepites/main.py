#!/usr/bin/env python3
"""Point d'entrée du radar.

    python3 main.py sonde             # les sources répondent-elles, et se lisent-elles ?
    python3 main.py scan              # un tour complet, écrit pepites_radar.md
    python3 main.py scan --bavard     # avec le détail des appels
    python3 main.py purger            # efface les vieux relevés

Un scan seul ne confirme rien : la persistance demande deux relevés espacés de
dix minutes. Le premier tour remplit la mémoire, les suivants s'en servent. En
usage réel, c'est une tâche planifiée toutes les quinze minutes.

**Commencer par `sonde`, et surtout la première fois.** Un scan qui ne trouve
rien ne dit pas pourquoi : marché calme, service muet et format qui a bougé
rendent le même rapport vide. La sonde tranche entre les trois en une vingtaine
d'appels, sans rien écrire ni alerter.
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

import bilan                                      # noqa: E402
import pipeline                                   # noqa: E402
import rapport                                    # noqa: E402
import sonde                                      # noqa: E402
from core.reglages import ReglagesInvalides, charger  # noqa: E402
from core.reseau import ReseauIndisponible            # noqa: E402
from core.stockage import BASE_PAR_DEFAUT, Memoire    # noqa: E402
from core.verrou import ScanDejaEnCours, Verrou       # noqa: E402


def _journaliser(bavard: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if bavard else logging.INFO,
        format="%(asctime)s  %(message)s",
        datefmt="%H:%M:%S",
    )


def commande_scan(arguments) -> int:
    reglages = charger()
    # Le verrou entoure le tour entier, pas la seule écriture : ce qu'il
    # protège d'abord est la cadence des appels, qui se compte par processus.
    with Verrou(Path(arguments.base).with_suffix(".verrou")), \
            Memoire(arguments.base) as memoire:
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


def commande_sonde(arguments) -> int:
    """Code de sortie 4 sur une source muette ou dérivée : une tâche planifiée
    doit pouvoir s'en apercevoir sans lire le tableau."""
    reglages = charger()
    constats = sonde.sonder(reglages)
    print(sonde.resumer(constats))
    return 4 if any(c.grave for c in constats) else 0


def commande_purger(arguments) -> int:
    with Memoire(arguments.base) as memoire:
        efface = memoire.purger(arguments.garder)
    print(f"{efface} relevés effacés.")
    return 0


def commande_bilan(arguments) -> int:
    """Ce que les pépites sont devenues. Aucun appel réseau : tout se calcule
    sur la base locale, donc la commande répond aussi bien depuis une machine
    sans accès aux API de marché."""
    with Memoire(arguments.base) as memoire:
        liste = bilan.parcours(memoire, arguments.note)
        print(bilan.tableau(liste, bilan.juger(liste)))
    return 0


def principal(argv: list[str] | None = None) -> int:
    analyseur = argparse.ArgumentParser(description="Radar de pépites multi-chaînes.")
    analyseur.add_argument("--base", default=BASE_PAR_DEFAUT, help="fichier SQLite")
    analyseur.add_argument("--bavard", action="store_true", help="journal détaillé")
    sous = analyseur.add_subparsers(dest="commande")

    scan = sous.add_parser("scan", help="un tour complet du radar")
    scan.add_argument("--rapport", default=rapport.RAPPORT_PAR_DEFAUT)
    scan.set_defaults(fonction=commande_scan)

    sous.add_parser(
        "sonde", help="les sources répondent-elles, et se lisent-elles ?"
    ).set_defaults(fonction=commande_sonde)

    bil = sous.add_parser("bilan", help="ce que les pépites sont devenues")
    bil.add_argument("--note", type=float, default=0.0,
                     help="ne montrer que les jetons ayant atteint cette note")
    bil.set_defaults(fonction=commande_bilan)

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
    except ScanDejaEnCours as erreur:
        print(f"Scan sauté : {erreur}", file=sys.stderr)
        return 5
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
