#!/usr/bin/env python3
"""Conseiller Patrimoine — point d'entrée.

    python3 main.py verifier      # valide le fichier de patrimoine et sort
    python3 main.py sources       # qui répond, qui se tait, et ce qu'ils disent
    python3 main.py bilan         # l'inventaire et la répartition, sans conseil
    python3 main.py conseil       # tout, y compris le rééquilibrage

**Aucune de ces commandes n'écrit ailleurs que là où on le lui demande.** Le
conseiller lit ; il ne modifie ni NexusCrypto, ni le radar, ni quoi que ce soit
d'autre. La seule écriture possible est `--sortie`, qui dépose le rapport dans
un fichier que vous nommez.

**Commencer par `sources`, et surtout la première fois.** Un bilan qui affiche
un total surprenant ne dit pas pourquoi : fichier à moitié rempli, cours périmé,
radar jamais lancé et chemin de travers rendent tous un tableau plausible. La
commande `sources` tranche entre ces cas en une seconde, sans rien calculer.

`bilan` et `conseil` existent séparément pour une raison de sang-froid : on
regarde parfois où l'on en est sans vouloir qu'on nous dise quoi faire. Le
premier ne conseille jamais, même quand tout est vert.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

import rapport                                             # noqa: E402
from analyse import redaction                              # noqa: E402
from core.modeles import Disponibilite                     # noqa: E402
from core.reglages import ReglagesInvalides, charger       # noqa: E402


def _arguments() -> argparse.ArgumentParser:
    analyseur = argparse.ArgumentParser(
        prog="conseiller-patrimoine",
        description="Vue d'ensemble du patrimoine, en lecture seule.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    analyseur.add_argument(
        "--config", default=None,
        help="chemin d'un patrimoine.yaml (défaut : config/patrimoine.yaml)",
    )
    analyseur.add_argument(
        "--sortie", default=None,
        help="écrire le rapport dans ce fichier au lieu de l'afficher",
    )
    commandes = analyseur.add_subparsers(dest="commande", required=True)
    commandes.add_parser("verifier", help="valide la configuration et sort")
    commandes.add_parser("sources", help="qui répond, qui se tait")
    commandes.add_parser("bilan", help="inventaire et répartition, sans conseil")
    commandes.add_parser("conseil", help="tout, rééquilibrage compris")
    return analyseur


def _rendre(texte: str, sortie: str | None) -> None:
    if sortie is None:
        print(texte)
        return
    chemin = Path(sortie)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(texte, encoding="utf-8")
    print(f"Rapport écrit dans {chemin}")


def main(argv: list[str] | None = None) -> int:
    arguments = _arguments().parse_args(argv)

    try:
        reglages = charger(Path(arguments.config) if arguments.config else None)
    except ReglagesInvalides as erreur:
        print(f"Configuration : {erreur}", file=sys.stderr)
        return 2

    if arguments.commande == "verifier":
        cibles = ", ".join(
            f"{classe.value} {poids:g} %"
            for classe, poids in reglages.profil.cibles_pct.items()
        )
        print(f"Configuration valide. Cibles : {cibles}.")
        return 0

    bilan, notes = rapport.assembler(reglages)

    if arguments.commande == "sources":
        _rendre(redaction.rediger_sources(bilan, notes), arguments.sortie)
        # Une source illisible sort en code 1 : lancée par une tâche planifiée,
        # cette commande doit pouvoir alerter sans qu'on relise sa sortie. Une
        # source seulement absente ou non branchée n'est pas une anomalie.
        illisible = any(
            etat.disponibilite is Disponibilite.ILLISIBLE for etat in bilan.sources
        )
        return 1 if illisible else 0

    texte = redaction.rediger(
        bilan, reglages.profil, notes,
        avec_conseil=(arguments.commande == "conseil"),
    )
    _rendre(texte, arguments.sortie)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
