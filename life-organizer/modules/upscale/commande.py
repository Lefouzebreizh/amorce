"""Le branchement de `organizer upscaler` : arguments, affichage, code de sortie.

Un parti pris d'affichage gouverne ce fichier : **le plan se montre même quand
le modèle est absent.** C'est ce qui fait qu'on peut régler les seuils, lire ce
qui serait agrandi et corriger la configuration aujourd'hui, sur une machine où
l'inférence est hors de portée — puis lancer le calcul ailleurs sans rien
redécouvrir. Une commande qui se contenterait de dire « torch manque » et de
sortir rendrait le module inutilisable jusqu'au jour de son installation.

Deux autres choix, hérités des modules voisins :

- **L'absence est annoncée avant la mesure**, pas après. Découvrir au bout de
  quarante minutes qu'aucune image ne sera écrite coûte les quarante minutes.
- **Les refus sont comptés par cause**, pas listés par fichier. « 312 déjà assez
  définies » se lit ; trois cent douze lignes ne se lisent pas.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from noyau import fichiers
from noyau.journal import Journal

from . import regles, traitement

LIGNES_AFFICHEES = 12


def ajouter_arguments(analyseur: argparse.ArgumentParser) -> None:
    analyseur.add_argument(
        "dossiers", nargs="*", type=Path,
        help="dossiers à examiner (défaut : dossiers.entree de la configuration)",
    )
    analyseur.add_argument(
        "--facteur", type=int, choices=[f for f in regles.FACTEURS if f > 1],
        help="agrandissement voulu (défaut : upscale.facteur)",
    )
    analyseur.add_argument(
        "--lot", type=int, metavar="N",
        help="nombre d'images à traiter en un passage (défaut : upscale.lot_maximal)",
    )
    analyseur.add_argument(
        "--appliquer", action="store_true",
        help="écrire les images agrandies (par défaut : simulation)",
    )


def executer(options: argparse.Namespace, config: dict) -> int:
    reglages = dict(config.get("upscale", {}))
    if options.facteur:
        reglages["facteur"] = options.facteur

    if not reglages.get("actif", False):
        print("L'agrandissement est désactivé : mettre upscale.actif à true dans la "
              "configuration pour l'utiliser.")
        return 0

    # Annoncé avant tout : ce qui suit ne sert qu'à préparer, et il vaut mieux
    # le savoir en lisant le plan qu'en attendant des fichiers qui ne viendront pas.
    disponible, message = traitement.moteur_disponible()
    if not disponible:
        print(f"  ⚠ {message}")
        print("  Le plan ci-dessous est calculé quand même : les seuils se règlent "
              "ici, le calcul se lance là où le modèle existe.")
    if reglages.get("nettete_minimale") is not None \
            and not traitement.nettete_mesurable(reglages):
        print("  ⚠ OpenCV absent : le refus des photos floues ne s'appliquera pas. "
              "Une netteté non mesurée ne vaut pas « nette », donc elles seront agrandies.")

    dossiers_config = config.get("dossiers", {})
    dossiers = options.dossiers or [Path(d) for d in dossiers_config.get("entree", [])]
    if not dossiers:
        print("Aucun dossier à examiner : voir dossiers.entree dans la configuration.")
        return 2

    simulation = not options.appliquer
    journal = Journal(_chemin(dossiers_config.get("journal")), simulation=simulation)

    # Les sorties du module ne sont pas des entrées : les compter parmi les
    # refus ferait dire au compte rendu deux fois la même chose — « 1 déjà
    # agrandie » pour le fichier produit, puis « 1 reprise » pour son original.
    # Le refus reste dans `regles.decider` : c'est le filet, pas le filtre.
    suffixe = reglages.get("suffixe", "_hd")
    # Un seul parcours pour les deux : les extensions vidéo entrent dans le
    # filtre non pour être traitées, mais pour être **comptées et nommées**.
    # Sans elles, un dossier de films rendait « 0 image trouvée », ce qui se lit
    # comme une panne du module plutôt que comme son périmètre.
    extensions_image = reglages.get("extensions", ["jpg", "jpeg", "png", "webp"])
    chemins, videos = [], 0
    for chemin in fichiers.parcourir(
        dossiers,
        extensions=list(extensions_image) + list(regles.EXTENSIONS_VIDEO),
        exclusions=dossiers_config.get("exclusions", []),
        consigner=journal.incident,
    ):
        if regles.est_video(chemin):
            videos += 1
        elif not regles.deja_agrandie(chemin, suffixe):
            chemins.append(chemin)
    print(f"{len(chemins)} image(s) trouvée(s) dans {len(dossiers)} dossier(s).")
    if videos:
        print(f"{videos} vidéo(s) laissée(s) de côté : le modèle agrandit image par "
              "image — 2 min 13 pour du 512 × 512 sur ce genre de processeur, soit "
              "1 800 passages pour une minute de film.")
    if not chemins:
        _incidents(journal)
        return 0

    candidats = traitement.mesurer(chemins, reglages, consigner=journal.incident)
    agrandissements = [regles.decider(c, {"upscale": reglages}) for c in candidats]
    retenus = [a for a in agrandissements if a.retenu]

    _laisses_sur_place(agrandissements)
    if not retenus:
        print("Rien à agrandir.")
        _incidents(journal)
        return 0

    lot = options.lot if options.lot is not None else reglages.get("lot_maximal", 25)
    file, restants = regles.file_a_traiter(
        agrandissements, traitement.sorties_existantes(agrandissements), lot)

    deja = len(retenus) - len(file) - restants
    if deja:
        print(f"{deja} image(s) déjà agrandie(s) lors d'un passage précédent — reprise "
              "là où elle s'était arrêtée.")
    if not file:
        print("Rien à faire : tout ce qui devait être agrandi l'est déjà.")
        _incidents(journal)
        return 0

    print(f"\n{len(file)} image(s) à agrandir"
          + (f", {restants} au-delà du lot de {lot}" if restants else "") + " :")
    for agrandissement in file[:LIGNES_AFFICHEES]:
        print(f"  {agrandissement.candidat.chemin.name} → "
              f"{agrandissement.sortie.name}  ({agrandissement.motif})")
    if len(file) > LIGNES_AFFICHEES:
        print(f"  … et {len(file) - LIGNES_AFFICHEES} autre(s)")

    if not disponible:
        print("\nPlan seulement : le modèle n'est pas installé ici, rien ne sera écrit.")
        _incidents(journal)
        return 0

    ecrits, incidents = traitement.agrandir(file, reglages, journal)
    verbe = "seraient écrites" if simulation else "écrites"
    print(f"\n{ecrits} image(s) {verbe}, à côté de leurs originaux.")
    for incident in incidents[:5]:
        print(f"  ✗ {incident}")
    if simulation:
        print("Simulation : rien n'a été écrit. Pour appliquer : --appliquer")
    elif restants:
        print(f"Relancer la commande pour les {restants} suivante(s).")
    _incidents(journal)
    return 0


def _laisses_sur_place(agrandissements: list[regles.Agrandissement]) -> None:
    """Les refus, comptés par cause : chacune appelle une suite différente."""
    compte = regles.compter(agrandissements)
    if not compte:
        return
    for cause, combien in sorted(compte.items(), key=lambda p: -p[1]):
        print(f"  {combien:>4}  {cause}")


def _incidents(journal: Journal) -> None:
    if not journal.incidents:
        return
    print(f"\n{len(journal.incidents)} fichier(s) ignoré(s) :")
    for incident in journal.incidents[:5]:
        print(f"  · {incident}")
    if len(journal.incidents) > 5:
        print(f"  … et {len(journal.incidents) - 5} autre(s)")


def _chemin(valeur: str | None) -> Path | None:
    return Path(valeur).expanduser() if valeur else None
