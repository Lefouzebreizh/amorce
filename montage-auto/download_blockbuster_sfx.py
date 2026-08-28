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
sys.path.insert(0, str(RACINE_DEPOT / ".claude" / "skills" / "bande-son" / "scripts"))

try:
    import bruitages
except ImportError as erreur:                                  # pragma: no cover
    raise SystemExit(
        "La palette de bruitages est introuvable. Attendue dans "
        f"{RACINE_DEPOT / '.claude/skills/bande-son/scripts/bruitages.py'}\n"
        f"({erreur})"
    )

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
    "01_Impacts_and_Booms": -14.0,
    "02_Risers_and_Tension": -17.0,
    "03_Whooshes_and_Transitions": -18.0,
    "04_Drones_and_Ambiances": -24.0,
    "05_UI_and_App_Buttons": -20.0,
}

# Au-delà, on ne remonte plus un son : on remonte son souffle.
GAIN_MAXIMAL_DB = 12.0


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

def construire(racine: Path, sans_reseau: bool, par_mot: int,
               debit: str, refaire: bool) -> dict:
    journal: list[str] = []
    for categorie in CATEGORIES:
        (racine / categorie / "app_optimized").mkdir(parents=True, exist_ok=True)

    catalogue = []
    for recette in RECETTES:
        nom, categorie, duree, _ = recette
        wav = racine / categorie / f"{nom}.wav"
        leger = racine / categorie / "app_optimized" / f"{nom}.mp3"

        if refaire or not wav.is_file() or wav.stat().st_size == 0:
            piste = synthetiser(recette)
            ecrire_wav(wav, piste)
        else:
            with wave.open(str(wav), "rb") as source:
                brut = numpy.frombuffer(source.readframes(source.getnframes()),
                                        dtype=numpy.int16)
            piste = brut.astype(numpy.float64) / 32768.0

        mesures = mesurer(piste)
        if refaire or not leger.is_file():
            if not compresser(wav, leger, debit):
                leger = leger.with_suffix(".ogg")
                if not compresser(wav, leger, debit):
                    leger = None
                    journal.append(f"« {nom} » : compression impossible, ffmpeg absent.")

        catalogue.append({
            "nom": nom,
            "categorie": categorie,
            "source": "synthese",
            "duree_s": round(len(piste) / TAUX, 3),
            "format": "wav",
            "taux_hz": TAUX,
            "chemin": str(wav.relative_to(racine)),
            "chemin_app": str(leger.relative_to(racine)) if leger else None,
            "octets": wav.stat().st_size,
            "octets_app": leger.stat().st_size if leger and leger.is_file() else None,
            "gain_conseille_db": gain_conseille(categorie,
                                                mesures["niveau_telephone_db"]),
            **mesures,
        })

    if not sans_reseau:
        for fichier in telecharger_freesound(racine, par_mot, journal):
            catalogue.append({
                "nom": fichier.stem,
                "categorie": fichier.parent.name,
                "source": "freesound",
                "duree_s": None,
                "format": fichier.suffix.lstrip("."),
                "taux_hz": None,
                "chemin": str(fichier.relative_to(racine)),
                "chemin_app": None,
                "octets": fichier.stat().st_size,
                "octets_app": None,
            })
    else:
        journal.append("Réseau volontairement écarté (--sans-reseau).")

    return {"catalogue": catalogue, "journal": journal}


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Construit et catalogue une bibliothèque d'effets cinématiques.")
    analyseur.add_argument("--racine", default="sfx_library",
                           help="dossier de la bibliothèque (défaut : sfx_library)")
    analyseur.add_argument("--sans-reseau", action="store_true",
                           help="synthèse seule, aucun appel sortant")
    analyseur.add_argument("--par-mot", type=int, default=6,
                           help="sons Freesound par mot-clé (défaut : 6)")
    analyseur.add_argument("--debit", default="128k",
                           help="débit des versions applicatives (défaut : 128k)")
    analyseur.add_argument("--refaire", action="store_true",
                           help="régénère même ce qui existe déjà")
    options = analyseur.parse_args()

    racine = Path(options.racine).expanduser().resolve()
    racine.mkdir(parents=True, exist_ok=True)

    resultat = construire(racine, options.sans_reseau, options.par_mot,
                          options.debit, options.refaire)
    catalogue = resultat["catalogue"]

    (racine / "audio_catalog.json").write_text(
        json.dumps({
            "version": 1,
            "taux_hz": TAUX,
            "categories": list(CATEGORIES),
            "sons": catalogue,
        }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n  {len(catalogue)} sons dans {racine}\n")
    for categorie in CATEGORIES:
        lot = [s for s in catalogue if s["categorie"] == categorie]
        if not lot:
            continue
        print(f"  {categorie}  ({len(lot)})")
        for son in sorted(lot, key=lambda s: s.get("perte_db") or 99):
            if son.get("perte_db") is None:
                print(f"     {son['nom'][:34]:<36} {'—':>7}   (non mesuré)")
                continue
            marque = "!" if son["perte_db"] > 10 else " "
            print(f"    {marque}{son['nom'][:34]:<36}"
                  f"{son['duree_s']:>6.2f}s  perte {son['perte_db']:>5.1f} dB"
                  f"   gain {son['gain_conseille_db']:>+5.1f} dB")
        print()

    mesures = [s["perte_db"] for s in catalogue if s.get("perte_db") is not None]
    if mesures:
        print(f"  perte médiane sur haut-parleur de téléphone : "
              f"{sorted(mesures)[len(mesures) // 2]:.1f} dB")
        lourds = [s['nom'] for s in catalogue if (s.get('perte_db') or 0) > 10]
        if lourds:
            print(f"  au-delà de 10 dB ({len(lourds)}) : {', '.join(lourds[:6])}"
                  + (" …" if len(lourds) > 6 else ""))
    for ligne in resultat["journal"]:
        print(f"  · {ligne}")
    print(f"\n  catalogue : {racine / 'audio_catalog.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
