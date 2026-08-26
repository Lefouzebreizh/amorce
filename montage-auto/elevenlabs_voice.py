#!/usr/bin/env python3
"""Voix off de synthèse — premier maillon de la chaîne de montage automatisée.

Transforme un texte en fichier MP3 par l'API ElevenLabs. Ce fichier sert ensuite
de cible à `auto_lipsync.py`, puis atterrit sur la timeline par
`prepare_my_edit.py`.

Quatre décisions tiennent ce fichier :

1. **La clé ne vient que de l'environnement.** `ELEVENLABS_API_KEY`, jamais un
   argument de ligne de commande : un `--api-key` finit dans l'historique du
   shell et dans la liste des processus, où n'importe quel programme de la
   machine peut le lire. Elle n'est ni affichée, ni recopiée dans un message
   d'erreur — pas même tronquée, un préfixe suffit à reconnaître une clé.
2. **L'audio s'écrit au fil de l'eau.** L'API rend un flux de blocs ; les
   accumuler en mémoire avant d'écrire coûte la taille du fichier en RAM pour
   rien. Une réplique de dix secondes pèse peu, une narration de dix minutes
   commence à compter.
3. **Rien n'est publié tant que le flux n'est pas complet.** L'écriture va dans
   un fichier temporaire, renommé seulement à la fin. Une coupure réseau à
   mi-parcours laisserait sinon un MP3 tronqué, que le maillon suivant lirait
   sans broncher : la vidéo finale serait muette à partir du milieu, et le
   défaut ne se verrait qu'au visionnage.
4. **Chaque échec d'API se traduit en une phrase actionnable.** « 401 » ne dit
   pas quoi faire, « clé refusée, vérifier ELEVENLABS_API_KEY » si.

Le modèle par défaut est `eleven_multilingual_v2` : c'est le plus récent qui
soit ouvert à tous les comptes. `eleven_v3`, plus expressif, se demande par
`--model` — son accès dépend encore du compte, et un défaut qui échoue chez la
moitié des utilisateurs est pire qu'un défaut modeste.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Voix « Rachel » du catalogue public : elle existe sur tout compte, ce qui rend
# le script exécutable sans configuration préalable. Les voix personnelles se
# retrouvent dans l'onglet Voice Lab, chacune avec son identifiant.
VOIX_PAR_DEFAUT = "21m00Tcm4TlvDq8ikWAM"

MODELE_PAR_DEFAUT = "eleven_multilingual_v2"

# 44,1 kHz / 128 kbit/s : le maillon suivant (Wav2Lip) rééchantillonne de toute
# façon en 16 kHz mono pour l'analyse, mais c'est cette piste-là qui reste dans
# le montage final. Descendre en dessous s'entend au casque.
FORMAT_SORTIE = "mp3_44100_128"


def lire_cle_api() -> str | None:
    """Rend la clé ElevenLabs, ou `None` en l'ayant expliqué.

    Le message nomme la variable et la façon de la poser : une clé absente est
    l'échec le plus fréquent au premier lancement, et le seul que l'utilisateur
    puisse corriger en dix secondes s'il sait quoi taper.
    """
    cle = os.getenv("ELEVENLABS_API_KEY")
    if cle and cle.strip():
        return cle.strip()

    print(
        "Clé d'API absente.\n"
        "  La variable d'environnement ELEVENLABS_API_KEY n'est pas définie.\n"
        "  Sous Linux ou macOS :  export ELEVENLABS_API_KEY=\"sk_...\"\n"
        "  Sous Windows (PowerShell) :  $env:ELEVENLABS_API_KEY=\"sk_...\"\n"
        "  La clé se crée sur https://elevenlabs.io → Profile → API Keys.",
        file=sys.stderr,
    )
    return None


def _expliquer_erreur_api(erreur) -> str:
    """Traduit une erreur de l'API en une phrase qui dit quoi faire.

    Le code HTTP est le seul signal fiable : ElevenLabs ne définit pas de classe
    d'exception distincte pour le quota épuisé, qui arrive donc comme une
    `ApiError` générique. C'est pourquoi on trie sur `status_code` plutôt que
    sur le type.
    """
    code = getattr(erreur, "status_code", None)
    detail = getattr(erreur, "body", None)

    messages = {
        401: "Clé refusée par ElevenLabs. Vérifier ELEVENLABS_API_KEY "
             "(clé révoquée, recopiée avec un espace, ou d'un autre compte).",
        403: "Accès interdit. Ce modèle ou cette voix n'est pas ouvert à ce "
             "compte — essayer --model eleven_multilingual_v2.",
        404: "Voix introuvable. Vérifier l'identifiant passé à --voice : "
             "c'est un identifiant, pas le nom affiché de la voix.",
        422: "Requête rejetée. Texte vide, trop long, ou paramètre invalide.",
        429: "Trop de requêtes d'affilée, ou quota de caractères épuisé. "
             "Attendre, ou vérifier les crédits restants sur elevenlabs.io.",
    }
    if code == 402 or (code == 401 and "quota" in str(detail).lower()):
        return ("Crédits insuffisants : le quota de caractères du compte est "
                "épuisé. Vérifier l'abonnement sur elevenlabs.io.")

    base = messages.get(code, f"L'API a répondu par une erreur (code {code}).")
    # Le corps de la réponse porte souvent la vraie cause ; il est repris tel
    # quel, mais tronqué : certaines erreurs renvoient la requête entière.
    if detail:
        base += f"\n  Réponse du serveur : {str(detail)[:400]}"
    return base


def generate_speech(
    text: str,
    voice_id: str = VOIX_PAR_DEFAUT,
    output_path: str | Path = "voice.mp3",
    model_id: str = MODELE_PAR_DEFAUT,
) -> Path | None:
    """Synthétise `text` avec la voix `voice_id` et écrit le MP3 dans `output_path`.

    Rend le chemin du fichier écrit, ou `None` si la synthèse a échoué — l'échec
    est alors déjà expliqué sur la sortie d'erreur. Aucune exception ne remonte :
    l'appelant est un script d'automatisation, pas un humain devant une trace.
    """
    # Importé ici et non en tête de fichier pour que `--help` et le message de
    # clé manquante fonctionnent sur une machine où la bibliothèque n'est pas
    # encore installée.
    try:
        import httpx
        from elevenlabs.client import ElevenLabs
        from elevenlabs.core import ApiError
    except ImportError:
        print(
            "La bibliothèque « elevenlabs » n'est pas installée.\n"
            "  pip install -r requirements.txt   (ou : pip install elevenlabs)",
            file=sys.stderr,
        )
        return None

    if not text or not text.strip():
        print("Rien à synthétiser : le texte est vide.", file=sys.stderr)
        return None

    cle = lire_cle_api()
    if cle is None:
        return None

    destination = Path(output_path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Voir la décision 3 en tête de fichier : on n'écrit sous le nom demandé
    # qu'une fois le flux entièrement reçu.
    provisoire = destination.with_suffix(destination.suffix + ".partiel")

    print(f"Synthèse de {len(text)} caractères — modèle {model_id}, voix {voice_id}")

    try:
        client = ElevenLabs(api_key=cle)
        flux = client.text_to_speech.convert(
            voice_id,
            text=text,
            model_id=model_id,
            output_format=FORMAT_SORTIE,
        )

        octets = 0
        with open(provisoire, "wb") as sortie:
            for bloc in flux:
                if bloc:
                    sortie.write(bloc)
                    octets += len(bloc)

        # Un flux vide est renvoyé sans erreur HTTP dans certains cas limites.
        # Le laisser passer produirait un MP3 de zéro octet, et l'échec se
        # déplacerait jusqu'au lip-sync, où il serait beaucoup plus obscur.
        if octets == 0:
            provisoire.unlink(missing_ok=True)
            print(
                "L'API n'a renvoyé aucun audio. Vérifier que le texte n'est pas "
                "uniquement composé de ponctuation ou d'espaces.",
                file=sys.stderr,
            )
            return None

        provisoire.replace(destination)
        print(f"Voix écrite : {destination}  ({octets / 1024:.0f} Ko)")
        return destination

    except ApiError as erreur:
        provisoire.unlink(missing_ok=True)
        print(_expliquer_erreur_api(erreur), file=sys.stderr)
        return None

    except httpx.RequestError as erreur:
        # Les erreurs de transport d'httpx ne dérivent **pas** d'OSError : sans
        # cette branche, une coupure de connexion, un délai dépassé ou un proxy
        # qui refuse tomberaient dans le filet générique, avec « 403 Forbidden »
        # pour tout diagnostic et rien à faire de cette phrase.
        provisoire.unlink(missing_ok=True)
        print(
            f"La requête n'a pas abouti : {erreur}\n"
            "  Vérifier l'accès au réseau, et le proxy s'il y en a un "
            "(HTTPS_PROXY). Le compte ElevenLabs n'est pas en cause.",
            file=sys.stderr,
        )
        return None

    except OSError as erreur:
        # Écriture du fichier : droits sur le dossier, disque plein.
        provisoire.unlink(missing_ok=True)
        print(
            f"Impossible d'écrire {destination} : {erreur}",
            file=sys.stderr,
        )
        return None

    except Exception as erreur:  # noqa: BLE001 — filet de dernier recours
        # Un maillon d'une chaîne automatisée ne doit jamais s'arrêter sur une
        # trace Python : les deux scripts suivants lisent le code de retour.
        provisoire.unlink(missing_ok=True)
        print(f"Échec inattendu de la synthèse : {erreur}", file=sys.stderr)
        return None


# --------------------------------------------------------------------------
# Démonstration en ligne de commande
# --------------------------------------------------------------------------

def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Génère une voix off MP3 à partir d'un texte, via ElevenLabs.",
        epilog=(
            "Exemple :\n"
            "  export ELEVENLABS_API_KEY=\"sk_...\"\n"
            "  python elevenlabs_voice.py --text \"Bonjour à tous\" --output voice.mp3"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    analyseur.add_argument("--text", required=True, help="Le texte à faire dire.")
    analyseur.add_argument("--output", default="voice.mp3", help="Fichier MP3 à écrire (défaut : voice.mp3).")
    analyseur.add_argument("--voice", default=VOIX_PAR_DEFAUT, help="Identifiant de la voix ElevenLabs.")
    analyseur.add_argument(
        "--model",
        default=MODELE_PAR_DEFAUT,
        help=f"Modèle de synthèse (défaut : {MODELE_PAR_DEFAUT} ; eleven_v3 pour plus d'expressivité).",
    )
    arguments = analyseur.parse_args()

    resultat = generate_speech(
        text=arguments.text,
        voice_id=arguments.voice,
        output_path=arguments.output,
        model_id=arguments.model,
    )
    # Code de retour non nul en cas d'échec : c'est ce qui permet d'enchaîner
    # les trois scripts avec « && » sans lancer un lip-sync sur un fichier absent.
    return 0 if resultat else 1


if __name__ == "__main__":
    sys.exit(main())
