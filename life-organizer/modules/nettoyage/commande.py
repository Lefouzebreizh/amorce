"""Le branchement de `organizer nettoyer` : arguments, affichage, code de sortie.

Aucun calcul ici : la liste affichée et les déplacements viennent des mêmes
décisions, dans le même ordre, pour qu'une simulation soit une lecture fidèle de
ce que fera `--appliquer`.

Trois partis pris d'affichage :

- **La netteté passe avant les doublons**, et pas seulement dans le code. Une
  photo floue écartée n'a plus à être comparée : c'est un décodage de moins par
  photo jetée, et cela évite surtout qu'une photo nette soit retirée comme
  quasi-doublon de sa propre version ratée.
- **On montre d'abord ce qu'on garde, ensuite ce qu'on écarte.** Une liste qui
  commence par ce qu'on retire se lit comme une menace, alors que la commande,
  par défaut, ne retire rien.
- **Les vidéos viennent en dernier et à part.** Elles ne passent ni par la
  netteté ni par les doublons — ce qu'on y cherche n'est pas une photo ratée
  ni une photo en trop, c'est le fichier qui ne s'ouvrira plus le jour où on
  voudra le revoir.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from noyau import fichiers
from noyau.journal import Journal
from noyau.modele import ECARTER, SIGNALER

from . import regles, traitement, variantes

# Au-delà, la liste cesse d'être lue et devient un mur. Le journal, lui, porte
# tout : ce qui n'est pas affiché n'est pas pour autant caché.
LIGNES_AFFICHEES = 12


def ajouter_arguments(analyseur: argparse.ArgumentParser) -> None:
    analyseur.add_argument(
        "dossiers", nargs="*", type=Path,
        help="dossiers à examiner (défaut : dossiers.entree de la configuration)",
    )
    analyseur.add_argument(
        "--ressemblance", metavar="NIVEAU",
        help="à quel point deux photos doivent se ressembler : "
             + ", ".join(f"{nom} ({distance})" for nom, distance in regles.NIVEAUX_DE_RESSEMBLANCE.items())
             + ", ou un nombre de bits de 0 à 64 "
               "(défaut : nettoyage_medias.doublons.distance_max)",
    )
    analyseur.add_argument(
        "--appliquer", action="store_true",
        help="déplacer en quarantaine (par défaut : simulation)",
    )


def executer(options: argparse.Namespace, config: dict) -> int:
    medias_config = config.get("nettoyage_medias", {})
    reglages_flou = medias_config.get("flou", {})
    reglages_doublons = medias_config.get("doublons", {})
    reglages_videos = medias_config.get("videos", {})

    reglages_variantes = medias_config.get("variantes", {})

    photos_demandees = (reglages_flou.get("actif", True)
                        or reglages_doublons.get("actif", True))
    videos_demandees = reglages_videos.get("verifier_integrite", True)
    variantes_demandees = reglages_variantes.get("actif", True)
    if not photos_demandees and not videos_demandees and not variantes_demandees:
        print("Flou, doublons, intégrité vidéo et variantes sont tous "
              "désactivés dans la configuration.")
        return 0

    try:
        ressemblance = regles.resoudre_ressemblance(
            options.ressemblance, reglages_doublons.get("distance_max", 5)
        )
    except ValueError as erreur:
        print(erreur)
        return 2

    dossiers = options.dossiers or [
        Path(dossier) for dossier in config.get("dossiers", {}).get("entree", [])
    ]
    if not dossiers:
        print("Aucun dossier à examiner : voir dossiers.entree dans la configuration.")
        return 2

    # `--appliquer` est la seule façon de passer à l'acte. La configuration ne
    # peut qu'aller dans le sens de la prudence : une commande qui déplacerait
    # des photos parce qu'un JSON porte `simulation_par_defaut: false` quelque
    # part serait exactement la mauvaise surprise que la décision 3 évite.
    simulation = not options.appliquer
    journal = Journal(_chemin(config.get("dossiers", {}).get("journal")), simulation=simulation)
    quarantaine = _chemin(config.get("dossiers", {}).get("quarantaine"))

    # Le parcours n'a lieu qu'une fois : les trois passes travaillent sur la même
    # liste. Photos et vidéos sont demandées ensemble puis séparées ici, plutôt
    # que par deux parcours — le disque serait relu de bout en bout une seconde
    # fois pour retrouver les mêmes dossiers.
    extensions = ()
    if photos_demandees:
        extensions += traitement.EXTENSIONS_PHOTO
    if videos_demandees:
        extensions += traitement.EXTENSIONS_VIDEO
    chemins = list(fichiers.parcourir(
        dossiers,
        extensions=extensions,
        exclusions=config.get("dossiers", {}).get("exclusions", []),
        consigner=journal.incident,
    ))
    photos = _du_type(chemins, traitement.EXTENSIONS_PHOTO)
    videos = _du_type(chemins, traitement.EXTENSIONS_VIDEO)
    # Ne compter que ce qui a été cherché : annoncer « 0 photo » à qui a
    # désactivé les deux passes photo se lit comme « ce dossier n'en contient
    # pas », ce qui est faux.
    comptes = ([f"{len(photos)} photo(s)"] if photos_demandees else []) \
        + ([f"{len(videos)} vidéo(s)"] if videos_demandees else [])
    print(f"{' et '.join(comptes)} trouvée(s) dans {len(dossiers)} dossier(s).")
    # La passe des variantes a son propre parcours, sur tous les fichiers : un
    # dossier de PDF n'offre ni photo ni vidéo, et c'est justement là qu'elle sert.
    if not chemins and not variantes_demandees:
        _incidents(journal)
        return 0

    liberes = 0
    nettetes: dict[Path, float] = {}
    if reglages_flou.get("actif", True) and photos:
        photos, octets, nettetes = _passe_nettete(
            photos, reglages_flou, quarantaine, journal
        )
        liberes += octets

    if reglages_doublons.get("actif", True) and photos:
        liberes += _passe_doublons(
            photos, config, ressemblance, quarantaine, journal, nettetes
        )

    if videos_demandees and videos:
        liberes += _passe_videos(videos, reglages_videos, quarantaine, journal)

    if variantes_demandees:
        liberes += _passe_variantes(
            dossiers, config, reglages_variantes, quarantaine, journal
        )

    retention = config.get("securite", {}).get("retention_quarantaine_jours", 30)
    purges = fichiers.purger_quarantaine(quarantaine, retention, journal)
    if purges:
        print(f"\n{purges} dépôt(s) de quarantaine de plus de {retention} jours purgé(s) : "
              "c'est là que l'espace est réellement rendu.")

    print(f"\n{_taille(liberes)} à récupérer au total.")
    if simulation:
        print("Simulation : rien n'a été déplacé. Pour appliquer : --appliquer")
    else:
        print(f"Déplacé en quarantaine : {quarantaine}")
        print(f"Rien n'est supprimé — la purge attend {retention} jours.")
    _incidents(journal)
    return 0


def _passe_nettete(chemins, reglages, quarantaine, journal
                   ) -> tuple[list[Path], int, dict[Path, float]]:
    """Écarte les floues et rend ce qui reste, les octets libérés, et les netteté.

    Les netteté mesurées voyagent jusqu'à la passe des doublons : c'est ce qui
    lui permet de garder l'originale plutôt que la version ratée quand les deux
    ont la même définition.
    """
    if reglages.get("ignorer_si_visage_detecte", True) \
            and not traitement.detection_de_visages_disponible():
        # Annoncé avant d'analyser : découvrir après coup qu'une protection
        # promise par la configuration n'a pas tourné, c'est l'apprendre une
        # fois les photos déjà déplacées.
        print("  ⚠ Cet OpenCV ne fournit pas de détecteur de visages : la protection "
              "« ne pas écarter une photo où un visage est reconnu » ne s'appliquera pas.")

    medias = traitement.mesurer_nettete(chemins, reglages, consigner=journal.incident)
    maintenant = time.time()
    decisions = [regles.decider_nettete(media, reglages, maintenant) for media in medias]
    ecartees = [decision for decision in decisions if decision.geste == ECARTER]

    decompte = regles.compter(decisions)
    print(f"\nNetteté : {decompte.get(ECARTER, 0)} floue(s) sur {len(medias)} mesurée(s).")
    for decision in ecartees[:LIGNES_AFFICHEES]:
        print(f"  Écarter {decision.media.chemin} — {decision.motif}")
    if len(ecartees) > LIGNES_AFFICHEES:
        print(f"  … et {len(ecartees) - LIGNES_AFFICHEES} autre(s)")

    liberes = traitement.ecarter_decidees(decisions, quarantaine, journal)
    retirees = regles.chemins_ecartes(decisions)
    # Ce que la première passe n'a pas su ouvrir ne repart pas vers la seconde :
    # elle échouerait dessus à son tour et le consignerait une deuxième fois.
    restants = [media.chemin for media in medias if media.chemin not in retirees]
    nettetes = {media.chemin: media.nettete for media in medias
                if media.nettete is not None}
    return restants, liberes, nettetes


def _passe_doublons(chemins, config, ressemblance, quarantaine, journal, nettetes) -> int:
    """Regroupe les quasi-identiques parmi ce qui reste et rend les octets libérés."""
    print(f"\nRessemblance : {ressemblance.distance_max} bits sur "
          f"{regles.BITS_DU_HACHAGE} — {ressemblance.origine}")
    avertissement = regles.avertissement_ressemblance(ressemblance.distance_max)
    if avertissement:
        print(f"  ⚠ {avertissement}")

    doublons, examinees = traitement.detecter(
        chemins, config, ressemblance.distance_max, journal, nettetes
    )
    if not doublons:
        print(f"Aucune photo quasi-identique parmi les {examinees} restantes.")
        if ressemblance.distance_max < regles.NIVEAUX_DE_RESSEMBLANCE["large"]:
            print("Pour chercher plus large : --ressemblance large")
        return 0

    for doublon in doublons[:LIGNES_AFFICHEES]:
        print(f"\n  Garder  {doublon.conserve.chemin} "
              f"({doublon.conserve.largeur}×{doublon.conserve.hauteur}, "
              f"{_taille(doublon.conserve.poids_octets)})")
        for media in doublon.ecartes:
            distance = regles.distance_de_hamming(
                doublon.conserve.empreinte_perceptuelle, media.empreinte_perceptuelle
            )
            print(f"  Écarter {media.chemin} "
                  f"({media.largeur}×{media.hauteur}, {_taille(media.poids_octets)}, "
                  f"distance {distance})")
    if len(doublons) > LIGNES_AFFICHEES:
        print(f"\n  … et {len(doublons) - LIGNES_AFFICHEES} autre(s) groupe(s)")

    ecartees = sum(len(doublon.ecartes) for doublon in doublons)
    print(f"\n{len(doublons)} groupe(s), {ecartees} photo(s) en trop.")
    return traitement.ecarter(doublons, quarantaine, journal)


def _passe_videos(chemins, reglages, quarantaine, journal) -> int:
    """Inspecte les vidéos et écarte les abîmées. Rend les octets libérés.

    Rien n'est comparé entre vidéos : chacune est jugée seule, sur ce que ffprobe
    déclare et sur ce que ffmpeg parvient à décoder de sa fin.
    """
    disponible, message = traitement.integrite_disponible()
    if message:
        # Annoncé avant d'inspecter, comme la détection de visages : croire un
        # dossier contrôlé alors que la passe n'a pas tourné est pire que de
        # savoir qu'elle manque.
        print("\n  ⚠ " + message.replace("\n", "\n    "))
    if not disponible:
        return 0

    videos = traitement.inspecter_videos(chemins, consigner=journal.incident)
    maintenant = time.time()
    decisions = [regles.decider_video(video, reglages, maintenant) for video in videos]
    decompte = regles.compter(decisions)

    print(f"\nVidéos : {decompte.get(ECARTER, 0)} abîmée(s) sur "
          f"{len(videos)} inspectée(s).")
    ecartees = [decision for decision in decisions if decision.geste == ECARTER]
    for decision in ecartees[:LIGNES_AFFICHEES]:
        print(f"  Écarter {decision.media.chemin} — {decision.motif}")
    if len(ecartees) > LIGNES_AFFICHEES:
        print(f"  … et {len(ecartees) - LIGNES_AFFICHEES} autre(s)")

    # Les signalements à part, et après : ce sont des fichiers qu'on garde, et
    # les mêler à la liste de ce qui part en quarantaine ferait lire les uns
    # pour les autres.
    signalees = [decision for decision in decisions if decision.geste == SIGNALER]
    if signalees:
        print(f"\n  {len(signalees)} fichier(s) gardé(s) mais à connaître :")
        for decision in signalees[:LIGNES_AFFICHEES]:
            print(f"  · {decision.media.chemin} — {decision.motif}")
        if len(signalees) > LIGNES_AFFICHEES:
            print(f"  … et {len(signalees) - LIGNES_AFFICHEES} autre(s)")

    return traitement.ecarter_decidees(decisions, quarantaine, journal)


def _du_type(chemins: list[Path], extensions: tuple[str, ...]) -> list[Path]:
    """Le sous-ensemble des chemins portant l'une de ces extensions."""
    voulues = set(extensions)
    return [chemin for chemin in chemins if chemin.suffix.lower().lstrip(".") in voulues]


def _incidents(journal: Journal) -> None:
    """Les fichiers enjambés, en fin de course.

    En fin et non au fil de l'eau : un dossier de sauvegarde peut en produire
    des centaines, et ils noieraient la seule liste qui compte.
    """
    if not journal.incidents:
        return
    print(f"\n{len(journal.incidents)} fichier(s) ignoré(s) :")
    for incident in journal.incidents[:5]:
        print(f"  · {incident}")
    if len(journal.incidents) > 5:
        print(f"  … et {len(journal.incidents) - 5} autre(s)")


def _passe_variantes(dossiers, config, reglages, quarantaine, journal) -> int:
    """Copies de nom, exports recalculables, et relevé des fichiers volumineux.

    Parcours distinct de celui des photos : ces trois questions se posent sur
    tous les fichiers, et un dossier de PDF n'aurait aucune photo à offrir aux
    deux passes précédentes.
    """
    fiches = traitement.relever_fiches(
        dossiers, config.get("dossiers", {}).get("exclusions", []), journal
    )
    if not fiches:
        return 0
    print(f"\n{len(fiches)} fichier(s) au total, toutes natures confondues.")

    redondances: list[variantes.Redondance] = []

    if reglages.get("confirmer_par_empreinte", True):
        empreintes = traitement.empreintes_de_contenu(fiches, journal)
        copies = variantes.grouper_variantes_de_nom(fiches, empreintes)
        if copies:
            print(f"  {sum(len(r.variantes) for r in copies)} copie(s) de nom au contenu identique.")
        redondances += copies

    derives = variantes.derives_recalculables(fiches, reglages.get("derives_recalculables", {}))
    if derives:
        print(f"  {len(derives)} export(s) qu'une source encore présente permet de refabriquer.")
    redondances += derives

    # Le relevé du volume ne propose rien : il informe. Un master de tournage
    # pèse lourd sans être en trop, et c'est à l'utilisateur d'en décider.
    gros = variantes.volumineux(fiches, reglages.get("signaler_au_dela_de_mo", 0))
    if gros:
        print(f"\n  {len(gros)} fichier(s) de plus de "
              f"{reglages.get('signaler_au_dela_de_mo')} Mo — à regarder, rien n'est proposé :")
        for fiche in gros[:10]:
            print(f"    {_taille(fiche.poids_octets):>9}  {fiche.chemin}")
        if len(gros) > 10:
            print(f"    … et {len(gros) - 10} autre(s)")

    return traitement.ecarter_redondances(redondances, quarantaine, journal)


def _chemin(valeur: str | None) -> Path | None:
    return Path(valeur).expanduser() if valeur else None


def _taille(octets: int) -> str:
    for unite, seuil in (("Go", 1024 ** 3), ("Mo", 1024 ** 2), ("ko", 1024)):
        if octets >= seuil:
            return f"{octets / seuil:.1f} {unite}".replace(".", ",")
    return f"{octets} o"
