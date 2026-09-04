#!/usr/bin/env python3
"""Vérification automatique du rythme d'un montage par Gemini, avant livraison.

Complète la liste de contrôle manuelle de `montage-sans-refaire` — ne la
remplace pas. Le point 9 ter de `SKILL.md` mesure le mouvement image par
image ; ça détecte un plan mort, pas un montage qui enchaîne trop de scènes
sans respiration. C'est ce que Gemini regarde ici : il voit la vidéo comme un
spectateur, pas comme une suite de pixels.

Clé lue dans `GEMINI_API_KEY` (variable d'environnement, ou fichier
`.claude/.env` — jamais en argument de ligne de commande, ça resterait dans
l'historique du terminal, et jamais dans `.env` à la racine : ce fichier-là
est le seul de l'app Amorce elle-même, documenté et testé comme tel dans
`.env.example` et `frontiere.test.ts` — une clé d'outillage n'y a pas sa
place).

Usage :
    python3 verifier_gemini.py chemin/vers/montage.mp4
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

MODELE = "gemini-3.6-flash"  # niveau gratuit, comprend nativement la vidéo
# gemini-2.5-flash retiré pour les nouveaux comptes en 09/2026 (constaté en
# direct via l'erreur 404 de l'API, pas dans la doc — Google recommande
# gemini-3.6-flash comme remplaçant).

PROMPT = """Tu regardes un montage vidéo vertical (format court, TikTok/Reels)
comme un vrai spectateur, pas comme un outil d'analyse de pixels.

Réponds UNIQUEMENT en JSON, avec cette forme exacte :

{
  "duree_s": <durée totale en secondes, un nombre>,
  "scenes": [
    {"debut_s": <nombre>, "fin_s": <nombre>, "description": "<ce qui se passe>"}
  ],
  "rythme": {
    "verdict": "ok" | "trop_rapide" | "trop_lent" | "irregulier",
    "probleme": "<description précise du défaut de rythme s'il y en a un,
                  sinon chaîne vide>",
    "scenes_sans_respiration": [<indices de scènes qui s'enchaînent sans
                                  aucune pause ou temps de pose, ou liste
                                  vide>]
  },
  "autres_problemes": ["<tout défaut visible et net — coupe brutale,
                         incohérence de style entre deux plans, créature ou
                         personnage qui reste figé, texte illisible —
                         seulement ce qui saute aux yeux, pas une supposition>"],
  "verdict_global": "livrable" | "a_revoir"
}

Sois concret et chiffré (secondes, pas d'adjectifs vagues). Le défaut à
chercher en priorité : est-ce que le montage donne le temps de voir chaque
scène, ou est-ce que ça enchaîne comme un diaporama sans respiration ? Ne
signale un problème que si tu le vois vraiment à l'écran — ne devine pas."""


def _cle() -> str:
    dossier_claude = Path(__file__).resolve().parents[3]  # .../amorce/.claude
    fichier_env = dossier_claude / ".env"
    load_dotenv(fichier_env)
    cle = os.environ.get("GEMINI_API_KEY")
    if not cle:
        sys.exit(
            "GEMINI_API_KEY introuvable — ni dans l'environnement, ni dans "
            f"{fichier_env}. Voir la documentation de ce script."
        )
    return cle


def verifier(chemin_video: Path) -> dict:
    client = genai.Client(api_key=_cle())

    fichier = client.files.upload(file=str(chemin_video))
    while fichier.state.name == "PROCESSING":
        time.sleep(2)
        fichier = client.files.get(name=fichier.name)
    if fichier.state.name != "ACTIVE":
        sys.exit(f"Échec du traitement côté Gemini : état {fichier.state.name}")

    reponse = client.models.generate_content(
        model=MODELE,
        contents=[fichier, PROMPT],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    client.files.delete(name=fichier.name)  # rien ne traîne côté Gemini après coup

    return json.loads(reponse.text)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage : python3 verifier_gemini.py chemin/vers/montage.mp4")

    chemin = Path(sys.argv[1])
    if not chemin.exists():
        sys.exit(f"Fichier introuvable : {chemin}")

    resultat = verifier(chemin)

    print(f"Vérification Gemini — {chemin.name}")
    print(f"  Durée détectée : {resultat.get('duree_s', '?')} s")
    print(f"  Scènes : {len(resultat.get('scenes', []))}")
    for s in resultat.get("scenes", []):
        print(f"    {s['debut_s']:5.1f}–{s['fin_s']:5.1f}s  {s['description']}")

    rythme = resultat.get("rythme", {})
    print(f"  Rythme : {rythme.get('verdict', '?')}")
    if rythme.get("probleme"):
        print(f"    → {rythme['probleme']}")

    for pb in resultat.get("autres_problemes", []):
        print(f"  ⚠ {pb}")

    verdict = resultat.get("verdict_global", "?")
    print(f"  Verdict global : {verdict}")

    if verdict != "livrable":
        sys.exit(1)


if __name__ == "__main__":
    main()
