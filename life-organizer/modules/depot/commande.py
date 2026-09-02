"""Le branchement de `organizer deposer` : arguments, affichage, code de sortie.

Aucun calcul ici, comme pour les autres commandes. Un parti pris propre à
celle-ci : elle prend un **fichier**, pas un dossier — le dépôt reçoit une
pièce à la fois, celle qu'on vient de recevoir ou de télécharger, jamais un
dossier entier à trier d'un coup (c'est le travail de `ranger`).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from noyau.journal import Journal

from . import regles, traitement


def ajouter_arguments(analyseur: argparse.ArgumentParser) -> None:
    analyseur.add_argument("fichier", type=Path, help="le fichier déposé à classer")
    analyseur.add_argument(
        "--projet", default=None,
        help="projet cible (défaut : depot.projet_par_defaut de la configuration)",
    )
    analyseur.add_argument(
        "--appliquer", action="store_true",
        help="déposer pour de vrai (par défaut : simulation)",
    )


def _chemin(valeur: str | None) -> Path | None:
    return Path(valeur).expanduser() if valeur else None


def executer(options: argparse.Namespace, config: dict) -> int:
    reglages = config.get("depot", {})
    if not reglages.get("actif", False):
        print("Le dépôt est désactivé : voir depot.actif dans la configuration.")
        return 2

    if not options.fichier.exists() or not options.fichier.is_file():
        print(f"Fichier introuvable : {options.fichier}")
        return 2

    if not traitement.type_pris_en_charge(options.fichier):
        print(f"Extension .{options.fichier.suffix.lstrip('.')} non prise en charge.")
        print("Types acceptés : "
              + ", ".join(sorted(traitement.EXTENSIONS_IMAGE | traitement.EXTENSIONS_VIDEO
                                  | traitement.EXTENSIONS_DOCUMENT)))
        return 2

    nom_projet = options.projet or reglages.get("projet_par_defaut")
    if not nom_projet or not regles.projet_connu(reglages, nom_projet):
        connus = ", ".join(sorted((reglages.get("projets") or {}).keys())) or "aucun"
        print(f"Projet inconnu : {nom_projet!r}. Projets déclarés : {connus}.")
        return 2

    try:
        classification = traitement.classifier(options.fichier, reglages, config)
    except traitement.ErreurDepot as erreur:
        print(f"⚠ {erreur}")
        return 2

    champs = {"annee": _annee_courante(), "mois": _mois_courant()}
    proposition = regles.proposer(classification, reglages, nom_projet, champs)
    if proposition is None:
        print(f"Aucune règle pour la catégorie « {classification.categorie} » "
              f"dans le projet « {nom_projet} ».")
        return 2

    racine = _chemin((reglages.get("projets", {}).get(nom_projet) or {}).get("racine_drive"))
    if not racine:
        print(f"Aucune racine Drive pour le projet « {nom_projet} » (depot.projets.{nom_projet}.racine_drive).")
        return 2

    print(f"{options.fichier.name} → {proposition.categorie} "
          f"(confiance {proposition.confiance:.0%}{'· INCERTAIN' if not proposition.fiable else ''})")
    print(f"  {proposition.raison}")
    print(f"  Destination : {racine / proposition.dossier_relatif / options.fichier.name}")

    if not proposition.fiable:
        print("\nClassement incertain : à valider avant d'appliquer, --projet ou un "
              "classement manuel restent possibles.")

    simulation = not options.appliquer
    journal = Journal(_chemin(config.get("dossiers", {}).get("journal")), simulation=simulation)

    destination = traitement.deposer(options.fichier, racine, proposition.dossier_relatif,
                                     journal, appliquer=options.appliquer)

    if simulation:
        print("\nSimulation : rien n'a été déposé. Pour appliquer : --appliquer")
    else:
        print(f"\nDéposé : {destination}")
    return 0


def _annee_courante() -> str:
    from datetime import date
    return str(date.today().year)


def _mois_courant() -> str:
    from datetime import date
    return f"{date.today().month:02d}"
