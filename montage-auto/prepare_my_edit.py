#!/usr/bin/env python3
"""Dérushage automatique dans DaVinci Resolve — troisième et dernier maillon.

Crée un projet, y importe les rushes d'un dossier et les pose bout à bout sur
une timeline, prêts à être montés. Ce que le script fait faire à Resolve tient
en une phrase : ouvrir le logiciel sur un montage déjà dérushé plutôt que sur un
projet vide.

Cinq décisions tiennent ce fichier :

1. **La cadence se lit avant l'import, pas après.** Resolve verrouille
   `timelineFrameRate` dès qu'un média entre dans le chutier : le réglage est
   silencieusement refusé, et la timeline se retrouve en 24 im/s avec des rushes
   en 30, ce qui décale progressivement le son. La cadence du premier rush est
   donc lue par `ffprobe`, *hors* de Resolve, et posée sur un projet encore vide.
2. **Un projet existant n'est jamais réutilisé.** Si « Nouveau_Montage_Auto »
   existe déjà, on crée « Nouveau_Montage_Auto_2 ». Charger l'existant et y
   rajouter les mêmes rushes doublerait la timeline d'un travail de la veille —
   un script d'automatisation ne doit pas pouvoir abîmer ce qui est déjà monté.
3. **L'ordre vient des noms de fichiers, pas de Resolve.** L'API ne garantit pas
   l'ordre de ce que rend l'import. Le tri alphabétique est refait sur les
   éléments importés, en s'appuyant sur leur chemin réel : c'est la seule façon
   d'obtenir « plan_01, plan_02, plan_10 » plutôt que l'ordre du système de
   fichiers.
4. **Chaque échec de l'API est nommé.** Les méthodes de Resolve rendent `None`
   ou `False` sans jamais lever d'exception : sans contrôle explicite à chaque
   étape, le script « réussit » et l'utilisateur découvre une timeline vide.
5. **Rien n'est supposé du chemin d'installation.** Le module de script de
   Resolve n'est pas sur le `sys.path` : il est cherché dans les emplacements
   officiels des trois systèmes, et les variables d'environnement l'emportent.

Usage :
    python prepare_my_edit.py                      # tous les rushes du dossier courant
    python prepare_my_edit.py --file rendu_final.mp4
"""

from __future__ import annotations

import argparse
import os
import platform
import subprocess
import sys
from pathlib import Path

NOM_PROJET = "Nouveau_Montage_Auto"
NOM_TIMELINE = "Master_Cut"

LARGEUR, HAUTEUR = 1920, 1080
CADENCE_PAR_DEFAUT = 24.0

EXTENSIONS_VIDEO = (".mp4", ".mov", ".mkv")


# --------------------------------------------------------------------------
# 1. Connexion
# --------------------------------------------------------------------------

def _emplacements_module() -> list[Path]:
    """Emplacements officiels du module de script, par système.

    L'ordre place les variables d'environnement en tête : une installation dans
    un chemin non standard doit pouvoir se déclarer sans modifier ce fichier.
    """
    chemins: list[Path] = []

    if api := os.getenv("RESOLVE_SCRIPT_API"):
        chemins.append(Path(api) / "Modules")

    systeme = platform.system()
    if systeme == "Darwin":
        chemins.append(Path("/Library/Application Support/Blackmagic Design/"
                            "DaVinci Resolve/Developer/Scripting/Modules"))
    elif systeme == "Windows":
        programdata = os.getenv("PROGRAMDATA", r"C:\ProgramData")
        chemins.append(Path(programdata) / "Blackmagic Design" / "DaVinci Resolve"
                       / "Support" / "Developer" / "Scripting" / "Modules")
    else:
        chemins.append(Path("/opt/resolve/Developer/Scripting/Modules"))
        chemins.append(Path("/home/resolve/Developer/Scripting/Modules"))

    return chemins


def _bibliotheque_par_defaut() -> Path | None:
    """Chemin de `fusionscript`, que le module charge sans le chercher lui-même.

    Sans `RESOLVE_SCRIPT_LIB`, l'import du module échoue sur certaines
    installations par une erreur qui ne nomme pas la bibliothèque manquante.
    """
    systeme = platform.system()
    if systeme == "Darwin":
        return Path("/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/"
                    "Libraries/Fusion/fusionscript.so")
    if systeme == "Windows":
        programfiles = os.getenv("PROGRAMFILES", r"C:\Program Files")
        return Path(programfiles) / "Blackmagic Design" / "DaVinci Resolve" / "fusionscript.dll"
    return Path("/opt/resolve/libs/Fusion/fusionscript.so")


def connecter_resolve():
    """Rend l'objet `Resolve` de l'instance ouverte, ou `None` en l'ayant expliqué."""
    for chemin in _emplacements_module():
        if (chemin / "DaVinciResolveScript.py").is_file():
            sys.path.append(str(chemin))
            break
    else:
        print(
            "Module de script DaVinci Resolve introuvable.\n"
            "  Il est livré avec Resolve (édition Studio ou gratuite, version 17 ou plus).\n"
            "  Emplacements cherchés :\n"
            + "".join(f"    {chemin}\n" for chemin in _emplacements_module())
            + "  Si Resolve est installé ailleurs :\n"
            "    export RESOLVE_SCRIPT_API=\"/chemin/vers/Developer/Scripting\"",
            file=sys.stderr,
        )
        return None

    if "RESOLVE_SCRIPT_LIB" not in os.environ:
        bibliotheque = _bibliotheque_par_defaut()
        if bibliotheque and bibliotheque.is_file():
            os.environ["RESOLVE_SCRIPT_LIB"] = str(bibliotheque)

    try:
        import DaVinciResolveScript as script_resolve  # type: ignore[import-not-found]
    except ImportError as erreur:
        print(
            f"Le module de script n'a pas pu être chargé : {erreur}\n"
            "  Cause la plus fréquente : la bibliothèque « fusionscript » est introuvable.\n"
            "    export RESOLVE_SCRIPT_LIB=\"/chemin/vers/fusionscript.so\"",
            file=sys.stderr,
        )
        return None

    resolve = script_resolve.scriptapp("Resolve")
    if resolve is None:
        # Le module se charge très bien sans Resolve ouvert : c'est ici, et
        # seulement ici, qu'on apprend que le logiciel ne tourne pas.
        print(
            "DaVinci Resolve ne répond pas.\n"
            "  Le logiciel doit être **ouvert** avant de lancer ce script.\n"
            "  Vérifier aussi que le scripting externe est autorisé :\n"
            "    Preferences → System → General → « External scripting using » = Local",
            file=sys.stderr,
        )
        return None

    print(f"── Connecté à {resolve.GetProductName()} {resolve.GetVersionString()}")
    return resolve


# --------------------------------------------------------------------------
# 2. Rushes et cadence
# --------------------------------------------------------------------------

def rassembler_rushes(dossier: Path, fichiers: list[str] | None) -> list[Path]:
    """Liste les rushes à importer, triés par nom de fichier.

    Le tri est insensible à la casse : sur un système sensible, « Plan_02 »
    passerait sinon avant « plan_01 », ce qui n'a de sens pour personne.
    """
    if fichiers:
        chemins = [Path(fichier).expanduser().resolve() for fichier in fichiers]
        manquants = [chemin for chemin in chemins if not chemin.is_file()]
        if manquants:
            for chemin in manquants:
                print(f"Fichier introuvable : {chemin}", file=sys.stderr)
            return []
    else:
        chemins = [
            enfant.resolve()
            for enfant in dossier.iterdir()
            if enfant.is_file() and enfant.suffix.lower() in EXTENSIONS_VIDEO
        ]

    return sorted(chemins, key=lambda chemin: chemin.name.lower())


def detecter_cadence(rush: Path) -> float:
    """Cadence du rush en images par seconde, ou la valeur par défaut.

    Lue par `ffprobe` et non par Resolve : voir la décision 1 en tête de fichier,
    la cadence doit être posée sur un projet encore vide.
    """
    import shutil

    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        print(f"   ffprobe absent : cadence supposée à {CADENCE_PAR_DEFAUT:g} im/s.")
        return CADENCE_PAR_DEFAUT

    try:
        resultat = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate",
             "-of", "default=noprint_wrappers=1:nokey=1", str(rush)],
            capture_output=True, text=True, timeout=30, check=True,
        )
        # ffprobe rend une fraction exacte (« 24000/1001 ») : la garder évite
        # d'écrire 23.98 là où Resolve attend 23.976.
        numerateur, _, denominateur = resultat.stdout.strip().partition("/")
        cadence = float(numerateur) / float(denominateur or 1)
        return round(cadence, 3) if cadence > 0 else CADENCE_PAR_DEFAUT
    except (subprocess.SubprocessError, ValueError, ZeroDivisionError):
        print(f"   Cadence illisible : {CADENCE_PAR_DEFAUT:g} im/s retenue.")
        return CADENCE_PAR_DEFAUT


# --------------------------------------------------------------------------
# 3. Projet, médias, timeline
# --------------------------------------------------------------------------

def creer_projet(resolve, cadence: float):
    """Crée un projet vide et le configure en 1080p à la cadence donnée.

    Le nom est suffixé s'il est déjà pris — voir la décision 2 en tête de
    fichier : on n'ouvre jamais un projet existant pour y ajouter des rushes.
    """
    gestionnaire = resolve.GetProjectManager()
    if gestionnaire is None:
        print("Gestionnaire de projets inaccessible.", file=sys.stderr)
        return None

    nom = NOM_PROJET
    projet = gestionnaire.CreateProject(nom)
    suffixe = 2
    while projet is None and suffixe < 100:
        nom = f"{NOM_PROJET}_{suffixe}"
        projet = gestionnaire.CreateProject(nom)
        suffixe += 1

    if projet is None:
        print(
            f"Impossible de créer un projet nommé « {NOM_PROJET} ».\n"
            "  Vérifier qu'une base de données de projets est bien ouverte dans Resolve.",
            file=sys.stderr,
        )
        return None

    print(f"── Projet « {nom} »")

    # Les réglages ne s'écrivent qu'en chaînes de caractères ; passer un entier
    # est accepté sans effet, ce qui donne un projet muet en 1920×1080 par
    # défaut et une cadence inchangée.
    reglages = {
        "timelineResolutionWidth": str(LARGEUR),
        "timelineResolutionHeight": str(HAUTEUR),
        "timelineFrameRate": f"{cadence:g}",
    }
    for cle, valeur in reglages.items():
        if not projet.SetSetting(cle, valeur):
            print(f"   Réglage refusé : {cle} = {valeur}", file=sys.stderr)

    print(f"   {LARGEUR}×{HAUTEUR} à {cadence:g} im/s")
    return projet


def importer_rushes(resolve, projet, rushes: list[Path]) -> list:
    """Importe les rushes dans le chutier et rend les éléments, triés par nom."""
    chutier = projet.GetMediaPool()
    if chutier is None:
        print("Chutier inaccessible.", file=sys.stderr)
        return []

    print(f"── Import de {len(rushes)} rush(es)")
    stockage = resolve.GetMediaStorage()
    elements = stockage.AddItemListToMediaPool([str(chemin) for chemin in rushes]) or []

    if not elements:
        # `AddItemListToMediaPool` échoue en silence sur certaines versions
        # quand le dossier n'est pas déclaré dans le stockage média ; la seconde
        # voie ne dépend pas de cette déclaration.
        elements = chutier.ImportMedia([str(chemin) for chemin in rushes]) or []

    if not elements:
        print(
            "Aucun média n'a pu être importé.\n"
            "  Formats ou codecs non reconnus par Resolve, ou fichiers illisibles.",
            file=sys.stderr,
        )
        return []

    if len(elements) < len(rushes):
        importes = {Path(element.GetClipProperty("File Path") or "").name for element in elements}
        for rush in rushes:
            if rush.name not in importes:
                print(f"   Ignoré par Resolve : {rush.name}", file=sys.stderr)

    # Voir la décision 3 : l'ordre de retour de l'API n'est pas garanti, on le
    # refait à partir du chemin réel de chaque élément.
    def cle_de_tri(element):
        chemin = element.GetClipProperty("File Path") or element.GetName() or ""
        return Path(chemin).name.lower()

    elements = sorted(elements, key=cle_de_tri)
    for element in elements:
        print(f"   {cle_de_tri(element)}")
    return elements


def construire_timeline(projet, elements: list):
    """Crée « Master_Cut » et y pose tous les plans bout à bout."""
    chutier = projet.GetMediaPool()
    print(f"── Timeline « {NOM_TIMELINE} »")

    timeline = chutier.CreateEmptyTimeline(NOM_TIMELINE)
    if timeline is None:
        print(
            f"Impossible de créer la timeline « {NOM_TIMELINE} ».\n"
            "  Une timeline de ce nom existe peut-être déjà dans le projet.",
            file=sys.stderr,
        )
        return None

    # `AppendToTimeline` travaille sur la timeline courante ; `CreateEmptyTimeline`
    # vient de la rendre courante, mais on le pose explicitement : l'ordre des
    # appels a changé entre versions de Resolve.
    projet.SetCurrentTimeline(timeline)

    poses = chutier.AppendToTimeline(elements)
    if not poses:
        print("Les plans n'ont pas pu être posés sur la timeline.", file=sys.stderr)
        return None

    print(f"   {len(poses)} plan(s) posé(s), dans l'ordre alphabétique")
    return timeline


def preparer_montage(rushes: list[Path]) -> bool:
    """Enchaîne connexion, projet, import et timeline. Rend `True` si tout a tenu.

    Sortie de `main()` le jour où l'orchestrateur a eu besoin de la même
    séquence : la dupliquer aurait laissé les deux versions diverger sur
    l'ordre des appels, qui est précisément ce que ce fichier a de délicat.
    """
    resolve = connecter_resolve()
    if resolve is None:
        return False

    # La cadence est lue avant toute création de projet : c'est elle qui décide
    # du réglage, et le réglage doit précéder le premier import.
    cadence = detecter_cadence(rushes[0])

    projet = creer_projet(resolve, cadence)
    if projet is None:
        return False

    elements = importer_rushes(resolve, projet, rushes)
    if not elements:
        return False

    if construire_timeline(projet, elements) is None:
        return False

    resolve.OpenPage("edit")
    print("\nTerminé : Resolve est sur la page Montage, timeline prête.")
    return True


# --------------------------------------------------------------------------
# Ligne de commande
# --------------------------------------------------------------------------

def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Crée un projet DaVinci Resolve dérushé à partir d'un dossier de rushes.",
        epilog=(
            "Exemples :\n"
            "  python prepare_my_edit.py                       # tout le dossier courant\n"
            "  python prepare_my_edit.py --file rendu_final.mp4\n"
            "  python prepare_my_edit.py --dossier ~/Rushes\n\n"
            "DaVinci Resolve doit être ouvert."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    analyseur.add_argument(
        "--dossier", default=".",
        help="Dossier à scanner (défaut : le dossier courant).",
    )
    analyseur.add_argument(
        "--file", nargs="+", dest="fichiers",
        help="Fichiers précis à importer, au lieu de scanner un dossier.",
    )
    arguments = analyseur.parse_args()

    dossier = Path(arguments.dossier).expanduser().resolve()
    if not arguments.fichiers and not dossier.is_dir():
        print(f"Dossier introuvable : {dossier}", file=sys.stderr)
        return 1

    rushes = rassembler_rushes(dossier, arguments.fichiers)
    if not rushes:
        if not arguments.fichiers:
            print(
                f"Aucune vidéo dans {dossier}\n"
                f"  Extensions cherchées : {', '.join(EXTENSIONS_VIDEO)}",
                file=sys.stderr,
            )
        return 1

    return 0 if preparer_montage(rushes) else 1


if __name__ == "__main__":
    sys.exit(main())
