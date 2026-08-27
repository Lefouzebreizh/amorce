"""Le branchement de `organizer convertir` : arguments, affichage, code de sortie.

Aucun calcul ici. Trois partis pris d'affichage :

- **Ce qui manque est dit avant de commencer**, pas au millième fichier. Une
  photothèque sans décodeur HEIC doit l'apprendre en une seconde, pas après
  vingt minutes de parcours.
- **Le plan est groupé par règle, le compte rendu par sort.** « 340 heic → jpg »
  se lit ; trois cent quarante lignes ne se lisent pas. À l'arrivée, ce qui
  compte n'est plus la règle appliquée mais ce qu'il est advenu : remplacé,
  gardé, échoué.
- **Chaque fichier converti s'affiche dès qu'il l'est.** Un réencodage vidéo
  occupe la machine plusieurs minutes ; une commande muette pendant une heure
  ne se distingue pas d'une commande bloquée.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from noyau import fichiers
from noyau.journal import Journal

from . import regles, traitement

# Au-delà, la liste devient un mur qu'on ne lit plus (même choix que `ranger`).
LIGNES_AFFICHEES = 12


def ajouter_arguments(analyseur: argparse.ArgumentParser) -> None:
    analyseur.add_argument(
        "dossiers", nargs="*", type=Path,
        help="dossiers à convertir (défaut : dossiers.entree de la configuration)",
    )
    analyseur.add_argument(
        "--seulement", choices=("photos", "videos"), default=None,
        help="ne traiter qu'une famille. Une photo se convertit en une seconde, "
             "une vidéo en plusieurs minutes : les mélanger rend la commande "
             "impossible à lancer sur un coin de table",
    )
    analyseur.add_argument(
        "--appliquer", action="store_true",
        help="convertir pour de vrai (par défaut : simulation)",
    )


def executer(options: argparse.Namespace, config: dict) -> int:
    reglages = config.get("conversion", {})
    regles_retenues = _regles_demandees(reglages.get("regles", []), options.seulement)
    if not regles_retenues:
        print("Aucune règle de conversion applicable : voir conversion.regles "
              "dans la configuration.")
        return 2

    familles, manques = traitement.capacites(regles_retenues)
    for manque in manques:
        print(f"  ⚠ {manque}")
    if not familles:
        return 2

    dossiers_config = config.get("dossiers", {})
    dossiers = options.dossiers or [Path(d) for d in dossiers_config.get("entree", [])]
    if not dossiers:
        print("Aucun dossier à convertir : voir dossiers.entree dans la configuration.")
        return 2

    simulation = not options.appliquer
    journal = Journal(_chemin(dossiers_config.get("journal")), simulation=simulation)
    quarantaine = _chemin(dossiers_config.get("quarantaine"))

    # Le parcours ne rend que les extensions qu'une règle réclame. Contrairement
    # au classement, une extension inconnue n'apprend rien à personne ici : il
    # n'y a pas de catégorie à lui ajouter, seulement le temps de l'ouvrir pour
    # rien.
    chemins = list(fichiers.parcourir(
        dossiers,
        extensions=regles.extensions_traitees(regles_retenues),
        exclusions=dossiers_config.get("exclusions", []),
        consigner=journal.incident,
    ))
    print(f"{len(chemins)} fichier(s) convertible(s) trouvé(s) dans {len(dossiers)} dossier(s).")
    if not chemins:
        _incidents(journal)
        return 0

    # La configuration transmise aux règles ne porte que les règles retenues :
    # sans cela, `--seulement photos` mesurerait bien les seules photos mais
    # `decider` continuerait de trouver la règle vidéo pour un `.mkv`.
    config_effective = {**config, "conversion": {**reglages, "regles": regles_retenues}}
    sources = traitement.mesurer(chemins, regles_retenues, familles,
                                 consigner=journal.incident)
    conversions = [regles.decider(source, config_effective) for source in sources]
    a_convertir = [conversion for conversion in conversions if conversion.a_convertir]

    _laisses_sur_place(conversions)
    if not a_convertir:
        print("Rien à convertir.")
        _incidents(journal)
        return 0

    print(f"\n{len(a_convertir)} fichier(s) à convertir :")
    for ligne, combien in _par_regle(a_convertir).items():
        print(f"  {combien:>4}  {ligne}")

    print()
    for conversion in a_convertir[:LIGNES_AFFICHEES]:
        print(f"  {_lisible(conversion.source.chemin.name)} → "
              f"{_lisible(conversion.destination.name)}")
        print(f"     {conversion.motif}")
    if len(a_convertir) > LIGNES_AFFICHEES:
        print(f"  … et {len(a_convertir) - LIGNES_AFFICHEES} autre(s)")

    if simulation:
        print("\nSimulation : rien n'a été encodé ni déplacé.")
        print("Le gain d'espace ne se connaît qu'en convertissant — et c'est lui "
              "qui décide,\nau moment d'appliquer, si le fichier produit remplace "
              "l'original ou non.")
        print("Pour appliquer : --appliquer")
        _incidents(journal)
        return 0

    print()
    resultats = traitement.convertir(conversions, config_effective, journal,
                                     quarantaine, annoncer=_afficher)
    _compte_rendu(resultats, quarantaine)
    _incidents(journal)
    return 0


def _regles_demandees(regles_conversion: list[dict], seulement: str | None) -> list[dict]:
    if seulement == "photos":
        return [regle for regle in regles_conversion if not regles.est_video(regle)]
    if seulement == "videos":
        return [regle for regle in regles_conversion if regles.est_video(regle)]
    return list(regles_conversion)


def _par_regle(conversions: list[regles.Conversion]) -> dict[str, int]:
    """Combien de fichiers par transformation, dans l'ordre où on les rencontre."""
    comptes: dict[str, int] = {}
    for conversion in conversions:
        depuis = regles.normaliser(conversion.source.chemin.suffix)
        vers = regles.normaliser(conversion.regle.get("vers", ""))
        geste = "remuxage" if conversion.remuxer else "conversion"
        cle = f"{depuis} → {vers}  ({geste}, {conversion.objectif})"
        comptes[cle] = comptes.get(cle, 0) + 1
    return comptes


def _afficher(resultat: traitement.Resultat) -> None:
    marque = "✓" if resultat.remplace else "·"
    print(f"  {marque} {_lisible(resultat.conversion.source.chemin.name)} — {resultat.motif}")


def _compte_rendu(resultats: list[traitement.Resultat], quarantaine: Path | None) -> None:
    remplaces = [resultat for resultat in resultats if resultat.remplace]
    gardes = [resultat for resultat in resultats if not resultat.remplace]

    avant, apres = regles.bilan(
        [(resultat.conversion.source.poids_octets, resultat.poids_obtenu)
         for resultat in remplaces]
    )
    print(f"\n{len(remplaces)} fichier(s) converti(s) : {_poids(avant)} → {_poids(apres)}")
    if remplaces:
        difference = avant - apres
        verbe = "rendus" if difference >= 0 else "consommés en plus"
        print(f"  {_poids(abs(difference))} {verbe}.")
        if quarantaine:
            print(f"  Les originaux sont dans {quarantaine}, rien n'a été supprimé.")

    if gardes:
        print(f"\n{len(gardes)} original(aux) gardé(s) :")
        for motif, combien in _par_motif(gardes).items():
            print(f"  {combien:>4}  {motif}")


def _par_motif(resultats: list[traitement.Resultat]) -> dict[str, int]:
    comptes: dict[str, int] = {}
    for resultat in resultats:
        comptes[resultat.motif] = comptes.get(resultat.motif, 0) + 1
    return comptes


def _laisses_sur_place(conversions: list[regles.Conversion]) -> None:
    """Ce qui n'a même pas été encodé, par raison.

    Affiché avant le plan et non après : ces refus-là sont des garde-fous qui
    ont joué (une transparence conservée, un film dont les sous-titres seraient
    tombés), et ce sont eux qui expliquent pourquoi le compte affiché est plus
    petit que le nombre de fichiers trouvés.
    """
    refuses = [conversion for conversion in conversions if not conversion.a_convertir]
    if not refuses:
        return
    comptes: dict[str, int] = {}
    for conversion in refuses:
        comptes[conversion.motif] = comptes.get(conversion.motif, 0) + 1
    print(f"\n{len(refuses)} fichier(s) laissé(s) tel(s) quel(s) :")
    for motif, combien in sorted(comptes.items(), key=lambda paire: -paire[1]):
        print(f"  {combien:>4}  {motif}")


def _incidents(journal: Journal) -> None:
    if not journal.incidents:
        return
    print(f"\n{len(journal.incidents)} fichier(s) ignoré(s) :")
    for incident in journal.incidents[:5]:
        print(f"  · {_lisible(incident)}")
    if len(journal.incidents) > 5:
        print(f"  … et {len(journal.incidents) - 5} autre(s)")


def _lisible(texte: str) -> str:
    """Un nom de fichier affichable sur une ligne.

    Un dossier réel contient un nom avec un saut de ligne (piège 4 du domaine),
    et il y suffit à couper en deux chaque ligne du compte rendu — jusqu'à
    donner l'impression qu'un fichier de plus a été traité. Les caractères de
    contrôle sont donc rendus visibles plutôt que joués.
    """
    return "".join(
        caractere if caractere.isprintable() or caractere == " " else "␊"
        for caractere in texte
    )


def _poids(octets: int) -> str:
    """Un poids lisible. Les octets bruts ne disent rien au-delà du kilooctet."""
    valeur = float(octets)
    for unite in ("o", "ko", "Mo", "Go"):
        if valeur < 1024 or unite == "Go":
            return f"{valeur:.0f} {unite}" if unite == "o" else f"{valeur:.1f} {unite}"
        valeur /= 1024
    return f"{valeur:.1f} Go"


def _chemin(valeur: str | None) -> Path | None:
    return Path(valeur).expanduser() if valeur else None
