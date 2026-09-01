"""Le branchement de `organizer ranger` : arguments, affichage, code de sortie.

Aucun calcul ici. Deux partis pris d'affichage :

- **Le compte par dossier avant la liste des fichiers.** « 412 photos vers
  Photos/2019 » se lit ; quatre cent douze lignes de déplacement ne se lisent
  pas. La liste détaillée n'est qu'un échantillon — le journal, lui, porte tout.
- **Ce qui ne bouge pas est dit à la fin, et compté.** Un fichier laissé sur
  place parce que son extension est inconnue n'est pas un incident : c'est une
  ligne à ajouter à `classement.categories`, et l'utilisateur ne peut le faire
  que s'il l'apprend.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from noyau import fichiers, rapport
from noyau.journal import Journal

from . import regles, traitement

# Au-delà, la liste devient un mur qu'on ne lit plus (même choix que `nettoyer`).
LIGNES_AFFICHEES = 12


def ajouter_arguments(analyseur: argparse.ArgumentParser) -> None:
    analyseur.add_argument(
        "dossiers", nargs="*", type=Path,
        help="dossiers à ranger (défaut : dossiers.entree de la configuration)",
    )
    analyseur.add_argument(
        "--vers", metavar="DOSSIER", type=Path, default=None,
        help="bibliothèque de destination (défaut : dossiers.bibliotheque)",
    )
    analyseur.add_argument(
        "--appliquer", action="store_true",
        help="déplacer pour de vrai (par défaut : simulation)",
    )
    analyseur.add_argument(
        "--rapport", metavar="FICHIER.html", type=Path, nargs="?",
        const=Path("rapport-rangement.html"),
        help="écrire une page à ouvrir dans un navigateur, avec les vignettes",
    )


def executer(options: argparse.Namespace, config: dict) -> int:
    reglages = config.get("classement", {})
    categories = reglages.get("categories", {})
    if not categories:
        print("Aucune catégorie déclarée : voir classement.categories dans la configuration.")
        return 2

    dossiers_config = config.get("dossiers", {})
    bibliotheque = options.vers or _chemin(dossiers_config.get("bibliotheque"))
    if not bibliotheque:
        print("Aucune bibliothèque de destination : voir dossiers.bibliotheque, ou --vers.")
        return 2
    bibliotheque = Path(bibliotheque).expanduser()

    dossiers = regles.dossiers_a_parcourir(
        options.dossiers,
        [Path(d) for d in dossiers_config.get("entree", [])],
        bibliotheque,
    )
    if not dossiers:
        print("Aucun dossier à ranger : voir dossiers.entree dans la configuration.")
        print("(La bibliothèque elle-même n'est pas parcourue d'office — "
              "la nommer en argument pour la reprendre.)")
        return 2

    sources = reglages.get("source_de_la_date", ["exif", "nom_de_fichier", "modification"])
    ignorees = traitement.sources_ignorees(sources)
    if ignorees:
        print(f"  ⚠ Source(s) de date pas encore lue(s) par ce module : {', '.join(ignorees)}. "
              "Les fichiers concernés retomberont sur la source suivante.")

    simulation = not options.appliquer
    journal = Journal(_chemin(dossiers_config.get("journal")), simulation=simulation)

    # Pas de filtre par extension au parcours, contrairement à `nettoyer` :
    # c'est `regles.decider` qui juge, et c'est ainsi qu'on peut dire à
    # l'utilisateur quelles extensions traînent dans ses dossiers sans être
    # déclarées. Filtrer ici les rendrait invisibles — donc jamais ajoutées.
    chemins = list(fichiers.parcourir(
        dossiers,
        exclusions=dossiers_config.get("exclusions", []),
        consigner=journal.incident,
    ))
    print(f"{len(chemins)} fichier(s) trouvé(s) dans {len(dossiers)} dossier(s).")
    if not chemins:
        _incidents(journal)
        return 0

    lecture = reglages.get("lecture_du_document", {})
    lire = lecture.get("actif", True)
    rangements = [
        regles.decider(
            fiche, config, source,
            texte=_matiere(fiche, categories, lecture, lire, journal),
            bibliotheque=bibliotheque,
        )
        for fiche, source in traitement.dater(chemins, sources, consigner=journal.incident)
    ]
    if lire:
        illisibles = sum(1 for r in rangements
                         if r.a_deplacer and "Divers" in str(r.destination))
        if illisibles:
            print(f"  ⚠ {illisibles} document(s) sans thème reconnu — aucun mot-clé de "
                  "classement.themes n'apparaît dans leur nom ni dans leur texte. "
                  "Un PDF scanné n'a d'ailleurs aucune couche texte à lire.")
    a_deplacer = [rangement for rangement in rangements if rangement.a_deplacer]

    if not a_deplacer:
        print("Rien à ranger : tout est déjà en place ou hors des catégories déclarées.")
        _laisses_sur_place(rangements)
        _incidents(journal)
        return 0

    print(f"\nVers {bibliotheque} :")
    for dossier, combien in sorted(regles.compter(rangements).items()):
        print(f"  {combien:>4}  {dossier}")

    print()
    for rangement in a_deplacer[:LIGNES_AFFICHEES]:
        print(f"  {rangement.fiche.chemin.name} → {rangement.destination.parent}")
        print(f"     {rangement.motif}")
    if len(a_deplacer) > LIGNES_AFFICHEES:
        print(f"  … et {len(a_deplacer) - LIGNES_AFFICHEES} autre(s)")

    if getattr(options, "rapport", None):
        chemin = rapport.ecrire(
            [rapport.Ligne(chemin=a.fiche.chemin, action="À ranger", motif=a.motif,
                           destination=a.destination)
             for a in a_deplacer],
            options.rapport, "Life-Organizer — rangement proposé",
            f"{len(a_deplacer)} fichier(s) à ranger vers {bibliotheque}. "
            "Rien n'a été déplacé : c'est une proposition.",
        )
        print(f"\nPage à ouvrir : {chemin}")

    verifier = config.get("securite", {}).get("verifier_empreinte_apres_deplacement", True)
    ranges = traitement.ranger(rangements, bibliotheque, journal, verifier_empreinte=verifier)

    print(f"\n{ranges} fichier(s) {'seraient rangés' if simulation else 'rangés'}.")
    _laisses_sur_place(rangements)
    if simulation:
        print("Simulation : rien n'a été déplacé. Pour appliquer : --appliquer")
    _incidents(journal)
    return 0


def _matiere(fiche, categories: dict, lecture: dict, lire: bool, journal) -> str:
    """Ce dans quoi chercher un thème : le nom, et le texte du document s'il en a un.

    Seuls les documents sont ouverts. Lire une photo n'apprendrait rien et
    coûterait un décodage par fichier — sur une bibliothèque de vacances, c'est
    la différence entre une commande qui répond et une commande qu'on
    interrompt.
    """
    nom = fiche.chemin.name
    if not lire or regles.categorie(fiche.chemin, categories) != "Documents":
        return nom
    texte = traitement.texte_du_document(
        fiche.chemin,
        pages_max=lecture.get("pages_max", 2),
        caracteres_max=lecture.get("caracteres_max", 2000),
        consigner=journal.incident,
    )
    return regles.matiere_a_theme(nom, texte, lecture.get("caracteres_max", 2000))


def _laisses_sur_place(rangements: list[regles.Rangement]) -> None:
    """Ce qui n'a pas bougé, par raison. Deux raisons, deux suites différentes."""
    deja = sum(1 for r in rangements if not r.a_deplacer and r.motif == "déjà rangé")
    inconnus = [r for r in rangements if not r.a_deplacer and r.motif != "déjà rangé"]
    if deja:
        print(f"{deja} fichier(s) déjà à leur place.")
    if inconnus:
        extensions = sorted({r.fiche.chemin.suffix.lower().lstrip(".") for r in inconnus})
        print(f"{len(inconnus)} fichier(s) laissé(s) sur place — extension(s) inconnue(s) : "
              f"{', '.join(extensions)}. À ajouter à classement.categories pour les ranger.")


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
