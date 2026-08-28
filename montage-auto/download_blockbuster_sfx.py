#!/usr/bin/env python3
"""Constitue une bibliothèque d'effets sonores cinématiques, et la catalogue.

Deux sources, et l'ordre entre elles n'est pas une préférence de style.

**La synthèse d'abord.** Un braam téléchargé sur une banque hollywoodienne vit
presque entièrement sous 400 Hz — mesuré sur soixante-trois plans de ce dépôt,
la perte médiane sur un haut-parleur de téléphone atteint 8,5 dB, et 24 dB sur
les pires. Le format court se regarde sur un téléphone. Un son « massif » qu'on
n'entend pas n'est pas discret, il est absent, et c'est le défaut qui a fait
rejeter quatre jours de montages. Les bruitages fabriqués ici passent tous par
`porter_sur_telephone`, qui leur donne les harmoniques que l'appareil restitue.

**Le téléchargement ensuite**, quand une clé Freesound est présente et que le
réseau répond. Ce qui en vient est mesuré exactement comme le reste : le
catalogue porte pour chaque son sa perte sur téléphone, et c'est cette colonne
qui décide de son emploi, pas son nom de fichier.

Le script n'échoue jamais faute de réseau : sans clé ni accès, la bibliothèque
est intégralement synthétisée, et le rapport final dit ce qui manque.

    python3 montage-auto/download_blockbuster_sfx.py
    python3 montage-auto/download_blockbuster_sfx.py --racine ~/sons --sans-reseau
    FREESOUND_API_KEY=... python3 montage-auto/download_blockbuster_sfx.py --par-mot 8
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy

# La palette vit dans la compétence « bande-son » : la recopier ici ferait deux
# vérités pour un même son, et c'est celle qu'on ne corrige pas qui servirait.
RACINE_DEPOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(RACINE_DEPOT / ".claude" / "skills" / "bande-son" / "scripts"))

try:
    import bruitages
except ImportError as erreur:                                  # pragma: no cover
    raise SystemExit(
        "La palette de bruitages est introuvable. Attendue dans "
        f"{RACINE_DEPOT / '.claude/skills/bande-son/scripts/bruitages.py'}\n"
        f"({erreur})"
    )

import sfx_pro

TAUX = bruitages.TAUX

CATEGORIES = {
    "01_Impacts_and_Booms": ("cinematic impact", "boom", "sub bass drop", "braam"),
    "02_Risers_and_Tension": ("hollywood riser", "tension riser", "build up"),
    "03_Whooshes_and_Transitions": ("cinematic whoosh", "swoosh transition"),
    "04_Drones_and_Ambiances": ("epic drone", "dark ambience", "sci fi drone"),
    "05_UI_and_App_Buttons": ("ui click", "interface beep", "notification"),
}

# Chaque recette est un nom, une catégorie, et les couches à sommer. Les graines
# sont explicites : deux sons de même recette doivent différer à l'oreille, et
# une graine tirée au hasard rendrait la bibliothèque irreproductible.
RECETTES = [
    # ── 01 Impacts ────────────────────────────────────────────────────────────
    ("impact_lourd_court",      "01_Impacts_and_Booms", 1.8,
     [("boom", {"duree": 1.8, "hauteur": 46.0, "graine": 101}, 1.0)]),
    ("impact_lourd_long",       "01_Impacts_and_Booms", 3.2,
     [("boom", {"duree": 3.2, "hauteur": 34.0, "graine": 102}, 1.0)]),
    ("impact_metal_brise",      "01_Impacts_and_Booms", 2.0,
     [("boom", {"duree": 2.0, "hauteur": 52.0, "graine": 103}, 0.75),
      ("choc_metal", {"duree": 1.2, "fondamentale": 240.0, "graine": 104}, 0.55)]),
    ("impact_debris",           "01_Impacts_and_Booms", 2.6,
     [("boom", {"duree": 2.6, "hauteur": 40.0, "graine": 105}, 0.8),
      ("eclat", {"duree": 1.6, "graine": 106, "densite": 130.0}, 0.5)]),
    ("braam_court",             "01_Impacts_and_Booms", 1.6,
     [("braam", {"duree": 1.6, "fondamentale": 62.0, "graine": 107}, 1.0)]),
    ("braam_massif",            "01_Impacts_and_Booms", 3.4,
     [("braam", {"duree": 3.4, "fondamentale": 48.0, "graine": 108}, 1.0)]),
    ("braam_double",            "01_Impacts_and_Booms", 3.0,
     [("braam", {"duree": 3.0, "fondamentale": 55.0, "graine": 109}, 0.8),
      ("braam", {"duree": 3.0, "fondamentale": 82.5, "graine": 110}, 0.45)]),
    ("chute_sub",               "01_Impacts_and_Booms", 2.4,
     [("chute_sous_grave", {"duree": 2.4, "graine": 111}, 1.0)]),
    ("chute_sub_profonde",      "01_Impacts_and_Booms", 3.6,
     [("chute_sous_grave", {"duree": 3.6, "graine": 112, "depart_hz": 175.0}, 1.0)]),
    ("impact_puis_chute",       "01_Impacts_and_Booms", 3.4,
     [("boom", {"duree": 1.4, "hauteur": 58.0, "graine": 113}, 0.9),
      ("chute_sous_grave", {"duree": 3.4, "graine": 114}, 0.7)]),
    ("choc_acier",              "01_Impacts_and_Booms", 1.0,
     [("choc_metal", {"duree": 1.0, "fondamentale": 310.0, "graine": 115}, 1.0)]),
    ("choc_enclume",            "01_Impacts_and_Booms", 1.6,
     [("choc_metal", {"duree": 1.6, "fondamentale": 145.0, "graine": 116}, 1.0)]),

    # ── 02 Risers ─────────────────────────────────────────────────────────────
    ("riser_court",             "02_Risers_and_Tension", 1.5,
     [("montee", {"duree": 1.5, "graine": 201}, 1.0)]),
    ("riser_moyen",             "02_Risers_and_Tension", 3.0,
     [("montee", {"duree": 3.0, "graine": 202}, 1.0)]),
    ("riser_long",              "02_Risers_and_Tension", 6.0,
     [("montee", {"duree": 6.0, "graine": 203}, 1.0)]),
    ("riser_pulse",             "02_Risers_and_Tension", 4.0,
     [("montee", {"duree": 4.0, "graine": 204}, 0.75),
      ("pulsation", {"duree": 4.0, "graine": 205, "battements": 96.0}, 0.5)]),
    ("descente_tension",        "02_Risers_and_Tension", 2.5,
     [("montee", {"duree": 2.5, "graine": 206, "descendante": True}, 1.0)]),
    ("coeur_lent",              "02_Risers_and_Tension", 6.0,
     [("pulsation", {"duree": 6.0, "graine": 207, "battements": 46.0}, 1.0)]),
    ("coeur_panique",           "02_Risers_and_Tension", 5.0,
     [("pulsation", {"duree": 5.0, "graine": 208, "battements": 124.0}, 1.0)]),
    ("tension_sourde",          "02_Risers_and_Tension", 8.0,
     [("nappe_sombre", {"duree": 8.0, "fondamentale": 44.0, "graine": 209}, 0.8),
      ("pulsation", {"duree": 8.0, "graine": 210, "battements": 58.0}, 0.35)]),

    # ── 03 Whooshes ───────────────────────────────────────────────────────────
    ("whoosh_rapide",           "03_Whooshes_and_Transitions", 0.7,
     [("souffle", {"duree": 0.7, "graine": 301}, 1.0)]),
    ("whoosh_moyen",            "03_Whooshes_and_Transitions", 1.3,
     [("souffle", {"duree": 1.3, "graine": 302}, 1.0)]),
    ("whoosh_lourd",            "03_Whooshes_and_Transitions", 2.2,
     [("souffle", {"duree": 2.2, "graine": 303}, 0.85),
      ("chute_sous_grave", {"duree": 2.2, "graine": 304, "depart_hz": 96.0}, 0.45)]),
    ("whoosh_retour",           "03_Whooshes_and_Transitions", 1.1,
     [("souffle", {"duree": 1.1, "graine": 305, "montant": False}, 1.0)]),
    ("whoosh_tournant",         "03_Whooshes_and_Transitions", 2.0,
     [("souffle_tournant", {"duree": 2.0, "graine": 306}, 1.0)]),
    ("whoosh_tournant_long",    "03_Whooshes_and_Transitions", 3.5,
     [("souffle_tournant", {"duree": 3.5, "graine": 307}, 1.0)]),
    ("transition_eclair",       "03_Whooshes_and_Transitions", 1.2,
     [("souffle", {"duree": 1.2, "graine": 308}, 0.7),
      ("electricite", {"duree": 0.8, "graine": 309}, 0.6)]),
    ("transition_impact",       "03_Whooshes_and_Transitions", 2.4,
     [("souffle", {"duree": 1.4, "graine": 310}, 0.8),
      ("boom", {"duree": 2.0, "hauteur": 50.0, "graine": 311}, 0.85)]),

    # ── 04 Drones ─────────────────────────────────────────────────────────────
    ("drone_sombre",            "04_Drones_and_Ambiances", 12.0,
     [("nappe_sombre", {"duree": 12.0, "fondamentale": 41.0, "graine": 401}, 1.0)]),
    ("drone_grave",             "04_Drones_and_Ambiances", 12.0,
     [("nappe_sombre", {"duree": 12.0, "fondamentale": 55.0, "graine": 402}, 1.0)]),
    ("drone_tendu",             "04_Drones_and_Ambiances", 10.0,
     [("nappe_sombre", {"duree": 10.0, "fondamentale": 73.0, "graine": 403}, 1.0)]),
    ("drone_braam",             "04_Drones_and_Ambiances", 8.0,
     [("braam", {"duree": 8.0, "fondamentale": 44.0, "graine": 404}, 0.85),
      ("nappe_sombre", {"duree": 8.0, "fondamentale": 44.0, "graine": 405}, 0.45)]),
    ("grondement_terre",        "04_Drones_and_Ambiances", 9.0,
     [("grondement", {"duree": 9.0, "graine": 406}, 1.0)]),
    ("grondement_braises",      "04_Drones_and_Ambiances", 10.0,
     [("grondement", {"duree": 10.0, "graine": 407}, 0.7),
      ("crepitement", {"duree": 10.0, "densite": 55.0, "graine": 408}, 0.45)]),
    ("souffle_caverne",         "04_Drones_and_Ambiances", 7.0,
     [("respiration", {"duree": 7.0, "graine": 409}, 1.0)]),

    # ── 05 UI ─────────────────────────────────────────────────────────────────
    ("ui_validation",           "05_UI_and_App_Buttons", 0.45,
     [("carillon", {"duree": 0.45, "fondamentale": 880.0, "graine": 501}, 1.0)]),
    ("ui_notification",         "05_UI_and_App_Buttons", 0.7,
     [("carillon", {"duree": 0.7, "fondamentale": 660.0, "graine": 502}, 1.0)]),
    ("ui_erreur",               "05_UI_and_App_Buttons", 0.5,
     [("carillon", {"duree": 0.5, "fondamentale": 330.0, "graine": 503}, 1.0)]),
    ("ui_clic",                 "05_UI_and_App_Buttons", 0.16,
     [("choc_metal", {"duree": 0.16, "fondamentale": 1450.0, "graine": 504}, 1.0)]),
    ("ui_clic_doux",            "05_UI_and_App_Buttons", 0.22,
     [("choc_metal", {"duree": 0.22, "fondamentale": 920.0, "graine": 505}, 1.0)]),
    ("ui_bascule",              "05_UI_and_App_Buttons", 0.3,
     [("eclat", {"duree": 0.3, "graine": 506, "densite": 40.0}, 1.0)]),
    ("ui_apparition",           "05_UI_and_App_Buttons", 0.55,
     [("souffle", {"duree": 0.55, "graine": 507}, 0.8),
      ("carillon", {"duree": 0.45, "fondamentale": 1180.0, "graine": 508}, 0.5)]),
]


# Le niveau *entendu* visé par catégorie, en dB pleine échelle après le filtre du
# téléphone. Ce ne sont pas des cibles de mixage arbitraires : elles disent le
# rôle de chaque famille. Un lit se tient dix décibels sous une ponctuation,
# sinon il la mange.
#
# La raison d'être de ce tableau tient en une mesure. Normalisés à la même crête
# — la pratique courante d'une banque de sons — les quarante-deux bruitages de
# cette bibliothèque s'étalaient sur **33,2 dB de niveau entendu** : un impact
# lourd, dont toute l'énergie vit sous 400 Hz, tombait à −34,7 dB quand un clic
# d'interface atteignait −1,5 dB. Posés au même gain par un monteur, seul le
# clic s'entendait. La crête ne dit rien de ce qu'on entend.
REFERENCE_ENTENDUE = {
    # Trois décibels au-dessus du reste : une ponctuation qui sonne au niveau du
    # lit n'est plus une ponctuation.
    "01_Impacts_and_Booms": -11.0,
    "02_Risers_and_Tension": -17.0,
    "03_Whooshes_and_Transitions": -18.0,
    "04_Drones_and_Ambiances": -24.0,
    "05_UI_and_App_Buttons": -20.0,
}

# Le plafond existe parce qu'au-delà, sur un **enregistrement**, on ne remonte
# plus un son mais son souffle de bande. Fixé d'abord à 12 dB par emprunt à
# cette règle-là, il bridait huit impacts sur douze : `impact_lourd_long`
# réclamait +20,7 dB pour rejoindre ses voisins et s'arrêtait à +12 — huit
# décibels sous eux, et c'est très exactement pourquoi il ne perçait pas.
#
# Or ces sons sont **calculés**, pas enregistrés : il n'y a aucun souffle de
# bande à remonter, seulement du signal voulu jusqu'au dernier échantillon. La
# règle avait été transposée sans qu'on vérifie qu'elle s'appliquait ici.
#
# Le plafond n'est pas supprimé pour autant : il reste la garde qui empêche un
# son quasi muet — un lit à −60 dB, un fichier abîmé — de se voir prescrire un
# gain absurde.
GAIN_MAXIMAL_DB = 21.0


def gain_conseille(categorie: str, niveau_telephone_db: float) -> float:
    """Le gain qui met un son au niveau de ses voisins, sur un téléphone.

    Non appliqué au fichier : un WAV normalisé à sa crête garde toute sa marge,
    et c'est au montage de décider. Le catalogue le porte, le montage l'applique.
    """
    if niveau_telephone_db is None or niveau_telephone_db < -100:
        return 0.0
    vise = REFERENCE_ENTENDUE.get(categorie, -18.0)
    return round(max(-GAIN_MAXIMAL_DB, min(GAIN_MAXIMAL_DB,
                                           vise - niveau_telephone_db)), 1)


# ── mesure ────────────────────────────────────────────────────────────────────

def _decibels(signal_entrant) -> float:
    """Niveau efficace en dB pleine échelle. -180 dB pour un silence exact."""
    carre = float(numpy.mean(numpy.square(signal_entrant)))
    return -180.0 if carre <= 1e-18 else float(10.0 * numpy.log10(carre))


def mesurer(signal_entrant) -> dict:
    """Ce que vaut un son, et surtout ce qu'un téléphone en restituera.

    La colonne « perte » est celle qui décide d'un emploi. Un haut-parleur de
    téléphone ne rend rien sous 400 Hz : au-delà de 10 dB de perte, la moitié du
    sound design n'atteindra jamais l'auditeur.
    """
    entier = _decibels(signal_entrant)
    filtre = _decibels(bruitages._haut(signal_entrant, 400.0))
    return {
        "niveau_db": round(entier, 1),
        "niveau_telephone_db": round(filtre, 1),
        "perte_db": round(entier - filtre, 1),
        "crete": round(float(numpy.max(numpy.abs(signal_entrant))), 4),
    }


# ── écriture ──────────────────────────────────────────────────────────────────

def ecrire_wav(chemin: Path, signal_entrant, taux: int = TAUX) -> None:
    """WAV 16 bits mono. La normalisation à 0,89 laisse la marge d'un limiteur."""
    crete = float(numpy.max(numpy.abs(signal_entrant)))
    borne = signal_entrant / crete * 0.89 if crete > 0 else signal_entrant
    entiers = numpy.int16(numpy.clip(borne, -1.0, 1.0) * 32767)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    # On écrit à côté puis on renomme : une interruption laisse sinon un fichier
    # tronqué que le catalogue déclarera valide.
    partiel = chemin.with_suffix(chemin.suffix + ".partiel")
    with wave.open(str(partiel), "wb") as sortie:
        sortie.setnchannels(1)
        sortie.setsampwidth(2)
        sortie.setframerate(taux)
        sortie.writeframes(entiers.tobytes())
    partiel.replace(chemin)


def _outil_ffmpeg() -> str | None:
    """Le ffmpeg du système d'abord.

    Une installation par `imageio-ffmpeg` pose souvent un binaire réduit dans
    `/usr/local/bin`, compilé sans plusieurs encodeurs. Mesuré sur ce dépôt :
    celui-là n'a pas `drawtext`. On préfère donc celui de la distribution quand
    les deux existent.
    """
    for candidat in ("/usr/bin/ffmpeg", "ffmpeg"):
        trouve = shutil.which(candidat) if "/" not in candidat else (
            candidat if Path(candidat).is_file() else None)
        if trouve:
            return trouve
    return None


def compresser(source: Path, destination: Path, debit: str = "128k") -> bool:
    """Version légère pour l'application. MP3 si possible, OGG sinon."""
    ffmpeg = _outil_ffmpeg()
    if ffmpeg is None:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    codec = ["-c:a", "libmp3lame"] if destination.suffix == ".mp3" else ["-c:a", "libvorbis"]
    rendu = subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-i", str(source), *codec, "-b:a", debit,
         "-ar", "44100", str(destination)],
        capture_output=True, text=True)
    return rendu.returncode == 0 and destination.is_file()


# ── synthèse ──────────────────────────────────────────────────────────────────

def synthetiser(recette) -> numpy.ndarray:
    """Somme les couches d'une recette sur une piste unique."""
    nom, categorie, duree, couches = recette
    total = bruitages.secondes(duree)
    piste = numpy.zeros(total)
    for bruitage, parametres, gain in couches:
        if bruitage not in bruitages.BRUITAGES:
            raise SystemExit(f"« {nom} » : bruitage inconnu « {bruitage} »")
        son = bruitages.BRUITAGES[bruitage](**parametres)
        longueur = min(len(son), total)
        piste[:longueur] += son[:longueur] * gain
    return piste


# ── Freesound ─────────────────────────────────────────────────────────────────

def _requete(url: str, entetes: dict) -> dict | None:
    """Appel HTTP par `requests` si disponible, par la bibliothèque standard sinon."""
    try:
        import requests
        reponse = requests.get(url, headers=entetes, timeout=25)
        if reponse.status_code != 200:
            return {"_erreur": f"HTTP {reponse.status_code}"}
        return reponse.json()
    except ImportError:
        pass
    except Exception as erreur:                                # pragma: no cover
        return {"_erreur": str(erreur)[:120]}

    import urllib.error
    import urllib.request
    demande = urllib.request.Request(url, headers=entetes)
    try:
        with urllib.request.urlopen(demande, timeout=25) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as erreur:
        return {"_erreur": f"HTTP {erreur.code}"}
    except Exception as erreur:
        return {"_erreur": str(erreur)[:120]}


def telecharger_freesound(racine: Path, par_mot: int, journal: list) -> list:
    """Complète la bibliothèque depuis Freesound, si la clé et le réseau y sont.

    L'absence de clé n'est pas une erreur : c'est le cas courant, et la
    bibliothèque synthétisée se suffit. On le dit, on continue.
    """
    cle = os.getenv("FREESOUND_API_KEY", "").strip()
    if not cle:
        journal.append("Freesound ignoré : FREESOUND_API_KEY absente de l'environnement.")
        return []

    obtenus = []
    for categorie, mots in CATEGORIES.items():
        for mot in mots:
            url = ("https://freesound.org/apiv2/search/text/"
                   f"?query={mot.replace(' ', '+')}"
                   "&filter=duration:[0.2 TO 20] type:wav"
                   "&fields=id,name,duration,previews,license"
                   f"&page_size={par_mot}")
            charge = _requete(url, {"Authorization": f"Token {cle}"})
            if charge is None or "_erreur" in (charge or {}):
                motif = (charge or {}).get("_erreur", "réponse vide")
                journal.append(f"Freesound « {mot} » : {motif}")
                continue
            for entree in charge.get("results", []):
                lien = (entree.get("previews") or {}).get("preview-hq-mp3")
                if not lien:
                    continue
                sur = "".join(c if c.isalnum() or c in "-_" else "_"
                              for c in entree["name"])[:60]
                cible = racine / categorie / f"fs{entree['id']}_{sur}.mp3"
                if cible.is_file():
                    obtenus.append(cible)
                    continue
                charge_binaire = _telecharger_binaire(lien, cible)
                if charge_binaire:
                    obtenus.append(cible)
    if not obtenus and cle:
        journal.append("Freesound joignable mais aucun son récupéré "
                       "(réseau filtré, ou quota atteint).")
    return obtenus


def _telecharger_binaire(lien: str, cible: Path) -> bool:
    cible.parent.mkdir(parents=True, exist_ok=True)
    partiel = cible.with_suffix(cible.suffix + ".partiel")
    try:
        import urllib.request
        with urllib.request.urlopen(lien, timeout=40) as reponse, \
                open(partiel, "wb") as sortie:
            shutil.copyfileobj(reponse, sortie)
        partiel.replace(cible)
        return True
    except Exception:
        partiel.unlink(missing_ok=True)
        return False


# ── orchestration ─────────────────────────────────────────────────────────────

# Le plancher de durée vise les rebuts d'un téléchargement — un fichier tronqué,
# une amorce vide — et **jamais une recette**, dont la durée est écrite et
# voulue. Un clic d'interface de 160 ms n'est pas trop court : c'est un clic. Le
# confondre avec un déchet supprimait les deux sons les plus utilisés de la
# cinquième catégorie.
DUREE_MINIMALE_S = 0.3


def _dossier(categorie: str, nom: str) -> Path:
    """Où ranger un son : sous-dossier fin quand la famille en a un."""
    for sous, membres in sfx_pro.SOUS_DOSSIERS.get(categorie, {}).items():
        if nom in membres:
            return Path(categorie) / sous
    return Path(categorie)


def _retrouver(racine: Path, categorie: str, nom: str) -> Path | None:
    """Cherche un WAV déjà posé, au nouvel emplacement comme à l'ancien.

    L'introduction des sous-dossiers a déplacé la moitié des impacts. Sans cette
    recherche, une bibliothèque déjà construite serait intégralement refabriquée
    au premier passage — et le premier principe de cet enrichissement est de ne
    rien refaire de ce qui existe.
    """
    for candidat in (racine / _dossier(categorie, nom) / f"{nom}.wav",
                     racine / categorie / f"{nom}.wav"):
        if candidat.is_file() and candidat.stat().st_size > 0:
            return candidat
    return None


def construire(racine: Path, sans_reseau: bool, par_mot: int,
               debit: str, refaire: bool, limite: int | None = None,
               a_blanc: bool = False, apercus: bool = True) -> dict:
    journal: list[str] = []
    erreurs: list[str] = []
    for categorie in CATEGORIES:
        for sous in ([""] + list(sfx_pro.SOUS_DOSSIERS.get(categorie, {}))):
            (racine / categorie / sous).mkdir(parents=True, exist_ok=True)
    for annexe in ("app_optimized", "previews", "recipes", "my_signature_sounds"):
        (racine / annexe).mkdir(parents=True, exist_ok=True)

    recettes = RECETTES[:limite] if limite else RECETTES
    if a_blanc:
        for nom, categorie, duree, _ in recettes:
            etat = "réutilisé" if _retrouver(racine, categorie, nom) else "à fabriquer"
            journal.append(f"{nom:<26} {duree:>5.2f}s  {_dossier(categorie, nom)}  [{etat}]")
        return {"catalogue": [], "journal": journal, "erreurs": erreurs}

    try:
        from tqdm import tqdm
        avancement = tqdm(recettes, desc="  sons", unit="son", ncols=76)
    except ImportError:
        avancement = recettes

    catalogue, empreintes = [], {}
    for recette in avancement:
        nom, categorie, duree, couches = recette
        wav = racine / _dossier(categorie, nom) / f"{nom}.wav"
        existant = None if refaire else _retrouver(racine, categorie, nom)

        try:
            if existant is None:
                piste = synthetiser(recette)
                # Le rognage précède la mesure : un silence de tête fausse la
                # sonie intégrée, qui moyenne sur toute la durée.
                piste = sfx_pro.rogner_silence(piste, taux=TAUX)
                crete = float(numpy.max(numpy.abs(piste)))
                if crete > 0:
                    piste = piste / crete * 0.89
                # On compare au rognage, pas au plancher : ce qui est suspect
                # est un son qui *perd* sa substance, pas un son bref voulu.
                if len(piste) < min(DUREE_MINIMALE_S, duree * 0.5) * TAUX:
                    erreurs.append(f"{nom} : {len(piste) / TAUX:.2f}s après rognage "
                                   f"pour {duree:.2f}s demandées — écarté")
                    continue
                sfx_pro.ecrire_wav_24(wav, piste, TAUX)
            else:
                piste, taux_lu = sfx_pro.lire_wav(existant)
                if existant != wav:
                    wav.parent.mkdir(parents=True, exist_ok=True)
                    existant.replace(wav)
                    journal.append(f"{nom} déplacé vers {_dossier(categorie, nom)}")
        except Exception as erreur:                              # pragma: no cover
            erreurs.append(f"{nom} : {erreur}")
            continue

        signature = sfx_pro.empreinte(wav)
        if signature in empreintes:
            erreurs.append(f"{nom} : identique à {empreintes[signature]} — doublon")
            continue
        empreintes[signature] = nom

        mesures = mesurer(piste)
        humeur, intensite = sfx_pro.CARACTERE.get(nom, (None, None))

        legers = {}
        for extension, taux_binaire in ((".mp3", debit), (".ogg", "96k")):
            cible = racine / "app_optimized" / f"{nom}{extension}"
            if refaire or not cible.is_file():
                if not compresser(wav, cible, taux_binaire):
                    erreurs.append(f"{nom} : {extension} impossible (ffmpeg absent ?)")
                    continue
            legers[extension] = cible

        apercu = None
        if apercus:
            cible = racine / "previews" / f"{nom}.png"
            if refaire or not cible.is_file():
                if not sfx_pro.dessiner_apercu(wav, cible, mesures["perte_db"]):
                    erreurs.append(f"{nom} : aperçu impossible (matplotlib absent ?)")
            if cible.is_file():
                apercu = str(cible.relative_to(racine))

        catalogue.append({
            "nom": nom,
            "categorie": categorie,
            "source": "synthese",
            "license": "CC0 — synthétisé, aucune attribution requise",
            "source_url": None,
            "duree_s": round(len(piste) / TAUX, 3),
            "duration_ms": int(round(len(piste) / TAUX * 1000)),
            "format": "wav",
            "sample_rate": TAUX,
            "taux_hz": TAUX,
            "bits": 24,
            "chemin": str(wav.relative_to(racine)),
            "chemin_app": str(legers[".mp3"].relative_to(racine)) if ".mp3" in legers else None,
            "chemin_app_ogg": str(legers[".ogg"].relative_to(racine)) if ".ogg" in legers else None,
            "preview": apercu,
            "octets": wav.stat().st_size,
            "octets_app": legers[".mp3"].stat().st_size if ".mp3" in legers else None,
            "lufs": sfx_pro.mesurer_lufs(piste, TAUX),
            "true_peak_db": sfx_pro.mesurer_vrai_pic(piste),
            "mood": humeur,
            "intensity": intensite,
            "recipe_layering": [c[0] for c in couches],
            "gain_conseille_db": gain_conseille(categorie, mesures["niveau_telephone_db"]),
            "phone_loss_db": mesures["perte_db"],
            **mesures,
        })

    if not sans_reseau:
        for fichier in telecharger_freesound(racine, par_mot, journal):
            catalogue.append({
                "nom": fichier.stem, "categorie": fichier.parent.name,
                "source": "freesound", "license": "à vérifier sur la fiche du son",
                "source_url": f"https://freesound.org/s/{fichier.stem.split('_')[0][2:]}/",
                "duree_s": None, "duration_ms": None,
                "format": fichier.suffix.lstrip("."), "sample_rate": None,
                "taux_hz": None, "chemin": str(fichier.relative_to(racine)),
                "chemin_app": None, "preview": None,
                "octets": fichier.stat().st_size, "octets_app": None,
                "mood": None, "intensity": None, "recipe_layering": None,
            })
    else:
        journal.append("Réseau volontairement écarté (--sans-reseau).")

    return {"catalogue": catalogue, "journal": journal, "erreurs": erreurs}


def poser_signature(catalogue: list, racine: Path, combien: int = 20) -> list:
    """Les sons qui survivent le mieux à un haut-parleur de téléphone.

    Copiés, non déplacés : ce dossier est une sélection, pas un rangement. Un
    monteur pressé y pioche sans réfléchir, sûr que rien n'y disparaîtra sur le
    petit haut-parleur.
    """
    dossier = racine / "my_signature_sounds"
    dossier.mkdir(parents=True, exist_ok=True)
    for ancien in dossier.glob("*.wav"):
        ancien.unlink()
    mesures = [s for s in catalogue if s.get("perte_db") is not None]
    retenus = sorted(mesures, key=lambda s: s["perte_db"])[:combien]
    for son in retenus:
        shutil.copy2(racine / son["chemin"], dossier / Path(son["chemin"]).name)
    return retenus


def assembler_demo(catalogue: list, racine: Path) -> Path | None:
    """Une bande-annonce de trente secondes, montée selon la règle du grave.

    Le plan n'est pas décoratif : il applique `recipes/lit-qui-tient.md`. Un lit
    audible porté par un son qui traverse le filtre, un drone huit décibels
    dessous, et **un seul événement grave à la fois**. Les trois versions qui
    ont précédé cette règle mesuraient 11,0 puis 9,0 dB de perte ; celle-ci en
    perd moitié moins.
    """
    par_nom = {s["nom"]: s for s in catalogue}
    # Les appoints ne sont pas des retouches de goût : ils encodent la
    # hiérarchie d'une bande-annonce. **Un riser doit être avalé par l'impact
    # qu'il annonce**, jamais le dominer. Une version antérieure laissait
    # `riser_long` culminer à −0,3 dB de crête, soit le point le plus fort du
    # mixage : la normalisation divisait alors tout le reste par lui, et les
    # impacts sortaient plus bas que le lit. Les risers sont donc creusés, les
    # ponctuations relevées. Le lit avait un temps été creusé de cinq décibels
    # de plus ; c'était traiter un symptôme, car ce qui l'égalisait aux impacts
    # n'était pas son niveau mais la compression de `loudnorm` en une passe.
    # Une fois la normalisation rendue linéaire, le creusement n'avait plus de
    # raison d'être et fut retiré.
    plan = [("grondement_braises", 0.0, 0), ("souffle_caverne", 0.0, -3),
            ("drone_sombre", 0.0, -8), ("riser_long", 1.0, -5),
            ("whoosh_rapide", 6.6, 0), ("braam_massif", 7.0, 3),
            ("whoosh_tournant", 10.6, -1), ("riser_moyen", 10.8, -6),
            ("grondement_braises", 10.5, 0), ("souffle_caverne", 12.0, -3),
            ("impact_debris", 13.8, 3), ("whoosh_lourd", 16.3, 0),
            ("braam_double", 17.0, 3), ("riser_long", 19.0, -5),
            ("souffle_caverne", 20.0, -3), ("grondement_braises", 20.5, 0),
            ("whoosh_moyen", 24.6, 0),
            # `impact_metal_brise` occupait ce créneau et n'y dépassait pas le
            # lit : sa traîne de deux secondes étale son énergie au lieu de la
            # concentrer. Un final demande la frappe qui atterrit, pas la plus
            # riche.
            ("impact_puis_chute", 25.0, 4),
            ("braam_massif", 25.2, 3)]
    manquants = [n for n, _, _ in plan if n not in par_nom]
    if manquants:
        return None

    total = int(30.0 * TAUX)
    piste = numpy.zeros(total)
    for nom, instant, appoint in plan:
        son, _ = sfx_pro.lire_wav(racine / par_nom[nom]["chemin"])
        son = son * 10.0 ** ((par_nom[nom]["gain_conseille_db"] + appoint) / 20.0)
        debut = int(instant * TAUX)
        longueur = min(len(son), total - debut)
        if longueur > 0:
            piste[debut:debut + longueur] += son[:longueur]
    piste[-int(1.0 * TAUX):] *= numpy.linspace(1, 0, int(1.0 * TAUX))
    crete = float(numpy.max(numpy.abs(piste)))
    if crete > 0:
        piste = piste / crete * 0.89

    brut = racine / "_demo_brut.wav"
    sfx_pro.ecrire_wav_24(brut, piste, TAUX)
    sortie = racine / "DEMO_trailer_30s.mp3"
    ffmpeg = _outil_ffmpeg()
    if ffmpeg is None:
        brut.replace(racine / "DEMO_trailer_30s.wav")
        return racine / "DEMO_trailer_30s.wav"
    normaliser(brut, sortie, ffmpeg)
    brut.unlink(missing_ok=True)
    return sortie


def normaliser(source: Path, sortie: Path, ffmpeg: str, cible_lufs: float = -14.0,
               vrai_pic_db: float = -1.0) -> None:
    """Amène un mixage à sa sonie cible **sans toucher à sa dynamique**.

    `loudnorm` en une passe n'est pas un normaliseur : c'est un compresseur.
    Il remonte les passages calmes et écrase les forts pour tenir la cible en
    continu, et détruit donc précisément le contraste qu'un montage de
    bande-annonce cherche à construire. Mesuré : un impact qui sortait à
    −1,4 dB dans le mixage brut ressortait à −24 dB après, c'est-à-dire au
    niveau du lit qu'il était censé dominer.

    La parade est la seule qui convienne à un mixage déjà équilibré : mesurer
    la sonie, appliquer **un gain unique** à tout le fichier, puis limiter les
    crêtes qui dépassent. Le rapport entre les frappes et le lit reste
    exactement celui du montage.
    """
    mesure = subprocess.run(
        [ffmpeg, "-hide_banner", "-nostats", "-i", str(source),
         "-af", f"loudnorm=I={cible_lufs}:TP={vrai_pic_db}:print_format=json",
         "-f", "null", "-"], capture_output=True, text=True)
    depart = mesure.stderr.rfind("{")
    gain_db = 0.0
    if depart != -1:
        try:
            releve = json.loads(mesure.stderr[depart:])
            mesuree = float(releve["input_i"])
            if mesuree > -70:
                gain_db = cible_lufs - mesuree
        except (ValueError, KeyError):
            gain_db = 0.0

    limite = 10.0 ** (vrai_pic_db / 20.0)
    subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-i", str(source),
         "-af", f"volume={gain_db:.2f}dB,alimiter=limit={limite:.4f}:level=disabled",
         "-c:a", "libmp3lame", "-b:a", "192k", str(sortie)], check=True)


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Construit, mesure et catalogue une bibliothèque cinématique.")
    analyseur.add_argument("--racine", default="sfx_library")
    analyseur.add_argument("--sans-reseau", action="store_true",
                           help="synthèse seule, aucun appel sortant")
    analyseur.add_argument("--only-cc0", action="store_true",
                           help="n'garde que ce qui est monétisable sans attribution")
    analyseur.add_argument("--par-mot", type=int, default=6)
    analyseur.add_argument("--limit", type=int, default=None,
                           help="s'arrête après N recettes")
    analyseur.add_argument("--debit", default="128k")
    analyseur.add_argument("--refaire", action="store_true",
                           help="régénère même ce qui existe")
    analyseur.add_argument("--resume", action="store_true",
                           help="reprend sans rien refaire (comportement par défaut)")
    analyseur.add_argument("--dry-run", action="store_true",
                           help="annonce ce qui serait fait, n'écrit rien")
    analyseur.add_argument("--make-demo", action="store_true",
                           help="assemble en plus une bande-annonce de 30 s")
    analyseur.add_argument("--sans-apercus", action="store_true",
                           help="passe le tracé des spectrogrammes")
    options = analyseur.parse_args()

    if options.only_cc0:
        # Tout ce qui est synthétisé l'est déjà ; seul l'import peut ne pas l'être.
        options.sans_reseau = True

    racine = Path(options.racine).expanduser().resolve()
    racine.mkdir(parents=True, exist_ok=True)

    resultat = construire(racine, options.sans_reseau, options.par_mot,
                          options.debit, options.refaire and not options.resume,
                          limite=options.limit, a_blanc=options.dry_run,
                          apercus=not options.sans_apercus)

    if options.dry_run:
        print(f"\n  à blanc — rien écrit dans {racine}\n")
        for ligne in resultat["journal"]:
            print(f"    {ligne}")
        return 0

    catalogue = resultat["catalogue"]
    (racine / "audio_catalog.json").write_text(
        json.dumps({"version": 2, "taux_hz": TAUX, "categories": list(CATEGORIES),
                    "sons": catalogue}, ensure_ascii=False, indent=2), encoding="utf-8")

    retenus = poser_signature(catalogue, racine)
    page = sfx_pro.ecrire_page(catalogue, racine)
    bacs = sfx_pro.ecrire_bacs(catalogue, racine)
    sfx_pro.ecrire_recettes(racine)
    sfx_pro.ecrire_licences(catalogue, racine)

    if resultat["erreurs"]:
        (racine / "errors.log").write_text("\n".join(resultat["erreurs"]) + "\n",
                                           encoding="utf-8")

    print(f"\n  {len(catalogue)} sons dans {racine}\n")
    for categorie in CATEGORIES:
        lot = [s for s in catalogue if s["categorie"] == categorie]
        if not lot:
            continue
        print(f"  {categorie}  ({len(lot)})")
        for son in sorted(lot, key=lambda s: s.get("perte_db") or 99):
            if son.get("perte_db") is None:
                continue
            marque = "!" if son["perte_db"] > 10 else " "
            sonie = f"{son['lufs']:>6.1f} LUFS" if son.get("lufs") is not None else "     — LUFS"
            print(f"    {marque}{son['nom'][:30]:<32}{son['duree_s']:>6.2f}s"
                  f"  perte {son['perte_db']:>5.1f} dB  gain {son['gain_conseille_db']:>+5.1f} dB"
                  f" {sonie}")
        print()

    mesures = sorted(s["perte_db"] for s in catalogue if s.get("perte_db") is not None)
    if mesures:
        print(f"  perte médiane sur haut-parleur de téléphone : "
              f"{mesures[len(mesures) // 2]:.1f} dB")
    print(f"  {len(retenus)} sons dans my_signature_sounds/ "
          f"(perte {retenus[0]['perte_db']:.1f} à {retenus[-1]['perte_db']:.1f} dB)")

    if options.make_demo:
        demo = assembler_demo(catalogue, racine)
        print(f"  bande-annonce : {demo}" if demo
              else "  bande-annonce impossible : des sons du plan manquent")

    for ligne in resultat["journal"][:6]:
        print(f"  · {ligne}")
    if resultat["erreurs"]:
        print(f"  · {len(resultat['erreurs'])} anomalie(s) → {racine / 'errors.log'}")
    print(f"\n  catalogue  : {racine / 'audio_catalog.json'}")
    print(f"  page       : {page}")
    print(f"  bacs       : {', '.join(b.name for b in bacs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
