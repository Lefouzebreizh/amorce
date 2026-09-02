"""Lecture et contrôle de `organizer_config.json`.

Deux décisions tiennent ce fichier :

1. **La validation dit tout ce qui ne va pas, d'un coup.** Un fichier de
   configuration se remplit à la main, souvent tard, et sur plusieurs sections.
   S'arrêter à la première erreur oblige à relancer huit fois : on collecte, on
   rend la liste complète.
2. **Rien n'est corrigé en silence.** Une clé absente prend sa valeur par
   défaut et c'est dit ; une valeur aberrante est refusée. Un outil qui range
   deux mille fichiers ne doit jamais avoir « à peu près » compris ce qu'on lui
   demandait.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path, PurePosixPath

SECTIONS_ATTENDUES = (
    "dossiers", "securite", "classement", "scan_ocr", "nettoyage_medias",
    "conversion", "upscale", "abonnements", "echeances", "alertes", "resiliation",
)
PERIODICITES = {"mensuel", "trimestriel", "semestriel", "annuel", "hebdomadaire"}
# Recopiés de `modules/conversion/regles.py` plutôt qu'importés : le noyau ne
# dépend d'aucun module, sans quoi `organizer verifier` chargerait les six pour
# lire un JSON. Deux valeurs qui ne bougeront pas valent moins cher que cette
# dépendance-là.
OBJECTIFS_DE_CONVERSION = {"espace", "compatibilite"}
STATUTS_ABONNEMENT = {"actif", "a_reexaminer", "resilie", "suspendu"}


def charger(chemin: Path) -> dict:
    """Lit le fichier. Un JSON invalide est signalé avec sa ligne, pas par une trace."""
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(
            f"Configuration introuvable : {chemin}\n"
            "Copier le modèle : cp organizer_config.json config.json"
        )
    except json.JSONDecodeError as erreur:
        raise SystemExit(
            f"Configuration illisible ({chemin}), ligne {erreur.lineno} : {erreur.msg}"
        )


def _date_valide(valeur: object) -> bool:
    if valeur is None:
        return True
    try:
        date.fromisoformat(str(valeur))
        return True
    except (TypeError, ValueError):
        return False


def _chemin_confine(valeur: object) -> str | None:
    """Ce qui cloche dans un chemin de rangement, ou `None` s'il est sain.

    Rend une fin de phrase, pas un booléen : `valider` compose des messages qui
    disent quoi corriger, et « chemin invalide » n'aide personne à trouver la
    ligne fautive dans son fichier de configuration.
    """
    if not isinstance(valeur, str) or not valeur.strip():
        return "vide ou absent"
    chemin = PurePosixPath(valeur.replace("\\", "/"))
    if chemin.is_absolute() or valeur.startswith("~"):
        return f"« {valeur} » est absolu : il sortirait de la bibliothèque"
    if ".." in chemin.parts:
        return f"« {valeur} » remonte avec « .. » : il sortirait de la bibliothèque"
    return None


def valider(config: dict) -> list[str]:
    """Rend la liste des problèmes. Vide = la configuration est utilisable."""
    problemes: list[str] = []

    for section in SECTIONS_ATTENDUES:
        if section not in config:
            problemes.append(f"Section absente : « {section} »")

    dossiers = config.get("dossiers", {})
    for cle in ("bibliotheque", "quarantaine"):
        if not dossiers.get(cle):
            problemes.append(f"dossiers.{cle} doit désigner un dossier")
    if not dossiers.get("entree"):
        problemes.append("dossiers.entree est vide : il n'y a rien à ranger")

    securite = config.get("securite", {})
    if securite.get("suppression_directe") is True:
        problemes.append(
            "securite.suppression_directe est activée. Le projet ne supprime pas : "
            "ce qui est écarté passe par la quarantaine (voir README, décision 1)"
        )
    retention = securite.get("retention_quarantaine_jours", 30)
    if not isinstance(retention, int) or retention < 1:
        problemes.append("securite.retention_quarantaine_jours doit être un entier ≥ 1")

    # Le seuil de ressemblance des doublons est le seul réglage de ce fichier
    # qui, mal saisi, ne fait pas échouer la commande : il la fait réussir en
    # rapprochant n'importe quoi. Un 50 tapé pour 5 met en quarantaine la moitié
    # d'un dossier de photos. Les autres réglages de la section (nom du hachage,
    # critères de départage) sont refusés par le module lui-même, dès le premier
    # appel et avant tout décodage — les redire ici en ferait une seconde source
    # de vérité à tenir à jour.
    doublons = config.get("nettoyage_medias", {}).get("doublons", {})
    distance = doublons.get("distance_max", 5)
    if not isinstance(distance, int) or isinstance(distance, bool) or not 0 <= distance <= 64:
        problemes.append(
            "nettoyage_medias.doublons.distance_max doit être un entier entre 0 et 64 "
            "(bits d'un pHash). Repères : 0 identiques, 2 stricte, 5 prudente, 10 large"
        )

    # Même danger que ci-dessus, sur les vidéos : un `duree_minimale_secondes`
    # saisi en minutes ne fait pas échouer la commande, il lui fait déclarer
    # abîmé tout un dossier de clips parfaitement lisibles. Le plafond n'est pas
    # une limite technique — c'est le point au-delà duquel le réglage ne décrit
    # plus une vidéo abîmée mais une vidéo courte.
    videos = config.get("nettoyage_medias", {}).get("videos", {})
    duree_minimale = videos.get("duree_minimale_secondes", 1.0)
    if not isinstance(duree_minimale, (int, float)) or isinstance(duree_minimale, bool) \
            or not 0 <= duree_minimale <= 60:
        problemes.append(
            "nettoyage_medias.videos.duree_minimale_secondes doit être un nombre de "
            "secondes entre 0 et 60. Au-delà, ce ne sont plus les vidéos abîmées "
            "qui partent en quarantaine, ce sont les vidéos courtes"
        )
    taille_minimale = videos.get("taille_minimale_ko", 64)
    if not isinstance(taille_minimale, int) or isinstance(taille_minimale, bool) or taille_minimale < 0:
        problemes.append(
            "nettoyage_medias.videos.taille_minimale_ko doit être un entier de kilooctets ≥ 0"
        )

    extensions_vues: dict[str, str] = {}
    for categorie, extensions in config.get("classement", {}).get("categories", {}).items():
        for extension in extensions:
            if extension != extension.lower().lstrip("."):
                problemes.append(
                    f"classement.categories.{categorie} : « {extension} » doit être "
                    "en minuscules et sans point"
                )
            # Une extension dans deux catégories rendrait le rangement dépendant
            # de l'ordre de lecture du JSON, donc imprévisible d'une fois sur l'autre.
            if extension in extensions_vues:
                problemes.append(
                    f"Extension « {extension} » réclamée par « {extensions_vues[extension]} » "
                    f"et « {categorie} » : le rangement serait arbitraire"
                )
            extensions_vues[extension] = categorie

    # Un chemin de rangement doit rester **relatif et descendant**. En Python,
    # `bibliotheque / "/tmp/ailleurs"` ne joint pas : l'opérande absolu remplace
    # le gauche, et le document part hors de la bibliothèque sans rien signaler.
    # Un `../..` en tête produit le même effet en remontant. Ce sont des relevés
    # bancaires et des avis d'imposition : le refus est ici, au démarrage, plutôt
    # qu'au moment où le fichier a déjà bougé.
    classement = config.get("classement", {})
    for theme in classement.get("themes", []):
        probleme = _chemin_confine(theme.get("dossier", ""))
        if probleme:
            problemes.append(
                f"classement.themes « {theme.get('nom', 'sans nom')} » : dossier {probleme}"
            )
    if "schema" in classement:
        probleme = _chemin_confine(classement["schema"])
        if probleme:
            problemes.append(f"classement.schema : {probleme}")

    identifiants: set[str] = set()
    for abonnement in config.get("abonnements", []):
        nom = abonnement.get("nom", "sans nom")
        identifiant = abonnement.get("id")
        if not identifiant:
            problemes.append(f"Abonnement « {nom} » sans identifiant « id »")
        elif identifiant in identifiants:
            problemes.append(f"Identifiant d'abonnement en double : « {identifiant} »")
        identifiants.add(identifiant)

        if abonnement.get("periodicite") not in PERIODICITES:
            problemes.append(
                f"Abonnement « {nom} » : périodicité « {abonnement.get('periodicite')} » "
                f"inconnue (attendu : {', '.join(sorted(PERIODICITES))})"
            )
        if abonnement.get("statut") not in STATUTS_ABONNEMENT:
            problemes.append(
                f"Abonnement « {nom} » : statut « {abonnement.get('statut')} » inconnu"
            )
        for cle in ("date_souscription", "date_prochain_prelevement", "fin_engagement"):
            if not _date_valide(abonnement.get(cle)):
                problemes.append(
                    f"Abonnement « {nom} » : {cle} n'est pas une date AAAA-MM-JJ"
                )

    for echeance in config.get("echeances", []):
        libelle = echeance.get("libelle", "sans libellé")
        if not _date_valide(echeance.get("date_limite")):
            problemes.append(f"Échéance « {libelle} » : date_limite illisible")
        rappels = echeance.get("rappels_jours_avant", [])
        if not all(isinstance(jour, int) and jour >= 0 for jour in rappels):
            problemes.append(
                f"Échéance « {libelle} » : rappels_jours_avant doit être une liste "
                "d'entiers positifs"
            )

    # Même danger que les deux seuils ci-dessus, et c'est le troisième du
    # fichier : mal saisis, ces réglages-là ne font pas échouer la commande, ils
    # la font réussir à côté. Un `seuil_gain_minimal_pct` à 100 ne convertit
    # plus rien et ressemble à un dossier déjà propre ; un `objectif` mal
    # orthographié retombe en silence sur « espace », et les photos d'iPhone —
    # qui grossissent toujours en JPEG — cessent d'être converties sans qu'une
    # seule ligne rouge n'apparaisse.
    conversion = config.get("conversion", {})
    gain_minimal = conversion.get("seuil_gain_minimal_pct", 15)
    if not isinstance(gain_minimal, (int, float)) or isinstance(gain_minimal, bool) \
            or not 0 <= gain_minimal < 100:
        problemes.append(
            "conversion.seuil_gain_minimal_pct doit être un pourcentage entre 0 et 99. "
            "À 100, aucune conversion d'espace ne serait jamais retenue"
        )
    inflation = conversion.get("inflation_max_pct", 100)
    if not isinstance(inflation, (int, float)) or isinstance(inflation, bool) or inflation < 0:
        problemes.append(
            "conversion.inflation_max_pct doit être un pourcentage positif : "
            "de combien une conversion de compatibilité a le droit d'alourdir un fichier"
        )

    for regle in conversion.get("regles", []):
        if not regle.get("de") or not regle.get("vers"):
            problemes.append("conversion.regles : une règle sans « de » ou sans « vers »")
        objectif = regle.get("objectif")
        if objectif is not None and objectif not in OBJECTIFS_DE_CONVERSION:
            problemes.append(
                f"conversion.regles : objectif « {objectif} » inconnu pour "
                f"« {', '.join(regle.get('de', []))} » (attendu : "
                f"{', '.join(sorted(OBJECTIFS_DE_CONVERSION))})"
            )

    for section, cle in (("scan_ocr", "api_vision"), ("upscale", "api")):
        api = config.get(section, {}).get(cle, {})
        for suspect in ("cle", "cle_api", "token", "api_key"):
            if api.get(suspect):
                problemes.append(
                    f"{section}.{cle}.{suspect} contient une clé en clair. "
                    "N'indiquer que le nom de la variable d'environnement "
                    "(cle_variable_env) : ce fichier se copie et se sauvegarde"
                )

    return problemes
