#!/usr/bin/env python3
"""Point d'entrée unique de Life-Organizer : une sous-commande par module.

Le point d'entrée est unique parce que les quatre modules partagent la même
configuration, le même journal et la même quarantaine. Quatre scripts séparés
auraient quatre façons de les lire, et un jour l'un d'eux supprimerait pour de
bon.

`verifier` doit fonctionner avant toutes les autres, puisque tout le reste
dépend de la configuration. `nettoyer` lui a succédé : photos floues, photos
quasi-identiques, puis vidéos abîmées, dans cet ordre. Puis `ranger`, qui vient
après pour une raison : ranger d'abord, c'est classer soigneusement des
doublons et des photos ratées. `convertir` se glisse entre les deux, et pour la
même raison : convertir avant d'avoir nettoyé, c'est réencoder pendant des
heures des vidéos qu'on allait écarter.

Un module écrit se branche ici en trois lignes : sa `commande.py` pose ses
arguments et reçoit la configuration déjà chargée. Le point d'entrée ne connaît
donc rien de ses réglages — sans quoi ce fichier grossirait d'autant de sections
qui ne se ressemblent pas.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Les quatre modules écrivent « → », « ✓ » et des tirets cadratins : 206 lignes
# du paquet en portent. Aucun n'existe dans la page de code cp1252 d'une console
# Windows française, et `print` y lève `UnicodeEncodeError` — jusqu'à
# `organizer.py --help`, qui plantait avant d'avoir rien fait. Le forçage tient
# au point d'entrée, une fois, plutôt que dans chaque module.
for _flux in (sys.stdout, sys.stderr):
    if hasattr(_flux, "reconfigure"):
        _flux.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modules.classement import commande as commande_classement  # noqa: E402
from modules.conversion import commande as commande_conversion  # noqa: E402
from modules.nettoyage import commande as commande_nettoyage  # noqa: E402
from modules.upscale import commande as commande_upscale  # noqa: E402
from noyau.config import charger, valider  # noqa: E402

RACINE = Path(__file__).resolve().parent

# Ordre d'apparition dans l'aide : celui du parcours réel d'un fichier, du
# document scanné jusqu'à son rangement — et non l'ordre alphabétique.
# `scan` et `calendrier` ont été retirés le 01/09/2026 : `paper-manager/` fait
# déjà l'extraction des champs, le nommage et le suivi des échéances. Les
# annoncer ici promettait deux commandes qui n'arriveront jamais — et une aide
# qui ment coûte plus cher qu'une aide incomplète. La raison est dans la fiche
# de chacun des deux modules, qu'on a gardée exprès.
MODULES = [
    ("nettoyer", "Écarter les photos floues, les quasi-doublons et les vidéos abîmées"),
    ("convertir", "HEIC → JPG, MKV → MP4, compression sans perte visible"),
    ("upscaler", "Agrandir les photos et vidéos basse définition"),
    ("ranger", "Classer par date, par type et par thématique"),
]


# La copie de travail vit hors du dépôt (README) : elle porte les vrais
# abonnements et les vrais chemins. Le repli à côté du script existe pour qui
# essaie le projet sans rien installer.
CONFIG_PERSONNELLE = Path.home() / ".config" / "life-organizer" / "config.json"


def config_utilisee(chemin: Path | None) -> Path:
    """Le fichier personnel s'il existe, le modèle versionné sinon.

    Deux fichiers volontairement distincts : la copie de travail porte les
    vraies données et n'est pas versionnée, `organizer_config.json` est le
    modèle. Les confondre reviendrait à publier ses abonnements dans le dépôt.
    """
    if chemin:
        return chemin
    for candidat in (CONFIG_PERSONNELLE, RACINE / "config.json"):
        if candidat.exists():
            return candidat
    return RACINE / "organizer_config.json"


def commande_verifier(options: argparse.Namespace) -> int:
    chemin = config_utilisee(options.config)
    config = charger(chemin)
    problemes = valider(config)

    print(f"Configuration : {chemin}")
    if chemin.name == "organizer_config.json":
        print(f"  (modèle livré — copier vers {CONFIG_PERSONNELLE} pour ses données)")

    if problemes:
        print(f"\n{len(problemes)} problème(s) :")
        for probleme in problemes:
            print(f"  · {probleme}")
        return 1

    abonnements = config.get("abonnements", [])
    echeances = config.get("echeances", [])
    entrees = config.get("dossiers", {}).get("entree", [])
    print(
        f"\nCohérente. {len(entrees)} dossier(s) surveillé(s), "
        f"{len(abonnements)} abonnement(s), {len(echeances)} échéance(s)."
    )
    if config.get("securite", {}).get("simulation_par_defaut", True):
        print("Mode simulation actif : les commandes diront ce qu'elles feraient.")
    return 0


def config_valide(options: argparse.Namespace) -> dict | None:
    """La configuration, ou `None` après avoir dit ce qui cloche.

    Refuser de travailler sur une configuration douteuse : les seuils en
    sortent, et un seuil aberrant met des photos en quarantaine ou range deux
    mille fichiers au mauvais endroit sans jamais échouer.
    """
    chemin = config_utilisee(options.config)
    config = charger(chemin)
    problemes = valider(config)
    if not problemes:
        return config
    print(f"Configuration inutilisable ({chemin}) :")
    for probleme in problemes:
        print(f"  · {probleme}")
    return None


def commande_nettoyer(options: argparse.Namespace) -> int:
    """Les photos floues, puis les quasi-identiques, puis les vidéos abîmées."""
    config = config_valide(options)
    return commande_nettoyage.executer(options, config) if config else 1


def commande_convertir(options: argparse.Namespace) -> int:
    """HEIC → JPG, MKV → MP4, et le gain mesuré avant tout remplacement."""
    config = config_valide(options)
    return commande_conversion.executer(options, config) if config else 1


def commande_upscaler(options: argparse.Namespace) -> int:
    """L'agrandissement : le plan se calcule ici, le modèle tourne ailleurs."""
    config = config_valide(options)
    return commande_upscale.executer(options, config) if config else 1


def commande_ranger(options: argparse.Namespace) -> int:
    """Le rangement dans la bibliothèque : catégorie, thème, date."""
    config = config_valide(options)
    return commande_classement.executer(options, config) if config else 1


def commande_a_venir(nom: str) -> int:
    print(f"« {nom} » n'est pas encore écrit.")
    print("La recette d'écriture d'un module est dans /module-life-organizer :")
    print(f"  regles.py, traitement.py, commande.py dans modules/<nom>/")
    return 2


def main() -> int:
    analyseur = argparse.ArgumentParser(
        prog="organizer",
        description="Assistant local de rangement : documents, photos, vidéos.",
        epilog="Aucun fichier ne quitte la machine. Rien n'est supprimé : "
               "ce qui est écarté passe par la quarantaine.",
    )
    analyseur.add_argument("--config", type=Path, help="fichier de configuration à utiliser")
    sous = analyseur.add_subparsers(dest="commande", metavar="commande")

    verifier = sous.add_parser("verifier", help="contrôler la configuration")
    verifier.set_defaults(faire=commande_verifier)

    for nom, aide in MODULES:
        module = sous.add_parser(nom, help=aide)
        if nom == "nettoyer":
            commande_nettoyage.ajouter_arguments(module)
            module.set_defaults(faire=commande_nettoyer)
            continue
        if nom == "convertir":
            commande_conversion.ajouter_arguments(module)
            module.set_defaults(faire=commande_convertir)
            continue
        if nom == "upscaler":
            commande_upscale.ajouter_arguments(module)
            module.set_defaults(faire=commande_upscaler)
            continue
        if nom == "ranger":
            commande_classement.ajouter_arguments(module)
            module.set_defaults(faire=commande_ranger)
            continue
        module.add_argument("--appliquer", action="store_true",
                            help="agir pour de vrai (par défaut : simulation)")
        module.set_defaults(faire=lambda _options, nom=nom: commande_a_venir(nom))

    options = analyseur.parse_args()
    if not options.commande:
        analyseur.print_help()
        return 0
    return options.faire(options)


if __name__ == "__main__":
    raise SystemExit(main())
