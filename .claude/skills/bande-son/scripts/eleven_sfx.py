"""
Bruitages achetés chez ElevenLabs, mesurés avant d'être gardés.

Ce que ce fichier n'est pas : un remplacement de `bruitages.py`. La synthèse
locale couvre les impacts, grondements, crépitements et nappes, elle est
gratuite et instantanée. On vient ici pour ce qu'elle ne sait pas faire — une
gorge, une matière, un lieu — et `sonotheque/SKILL.md` explique pourquoi une
synthèse fabrique un orgue là où il fallait une bête.

TROIS CHOSES QUI DÉCIDENT DE CE CODE, ET AUCUNE N'EST TECHNIQUE.

1. **Ça coûte de l'argent.** Chaque appel consomme des crédits du compte. Le
   script refuse donc de tourner sans `--je-confirme`, affiche ce qu'il
   s'apprête à demander, et s'arrête au premier échec au lieu d'enchaîner
   trente requêtes payantes contre un mur.

2. **La clé ne s'écrit jamais dans un fichier du dépôt.** Elle est lue dans
   `ELEVENLABS_API_KEY`. Une clé passée en argument de ligne de commande
   atterrit dans l'historique du terminal et dans la liste des processus ;
   c'est pour ça qu'aucune option ne la prend.

3. **Un bruitage acheté se mesure comme un bruitage fabriqué.** Le seuil du
   dépôt ne connaît pas la provenance : ce qui vit sous 400 Hz n'existe pas sur
   un haut-parleur de téléphone, qu'on l'ait synthétisé ou payé. Chaque fichier
   reçu est donc mesuré, et le script dit lequel ne portera pas — plutôt que de
   le ranger en silence dans la sonothèque.

    export ELEVENLABS_API_KEY=sk_...
    python3 eleven_sfx.py --texte "deep dragon growl, close mic" \
        --duree 3.0 --sortie dragon.wav --je-confirme
"""

import argparse
import os
import sys
import wave

# Le SDK officiel, dont la surface a été lue plutôt que devinée :
#   text_to_sound_effects.convert(text=…, output_format=…, loop=…,
#       duration_seconds=…, prompt_influence=…, model_id=…) -> Iterator[bytes]
# Le retour est un ITÉRATEUR, pas des octets : l'oublier rend un fichier vide
# sans lever la moindre erreur.

SOL_TELEPHONE = 400.0

# `pcm_48000` plutôt qu'un MP3 : la chaîne de montage travaille en 48 kHz de
# bout en bout (`finir_episode.sh` force `-ar 48000`), et un ré-encodage
# intermédiaire coûte une génération de perte pour rien.
FORMAT = "pcm_48000"
FREQUENCE = 48000
MODELE = "eleven_text_to_sound_v2"


def client():
    """Le client, ou un message qui dit quoi faire — jamais une trace de pile."""
    cle = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not cle:
        raise SystemExit(
            "ELEVENLABS_API_KEY est vide.\n"
            "  export ELEVENLABS_API_KEY=sk_...\n"
            "La clé ne se passe pas en argument : la ligne de commande est "
            "lisible dans l'historique du terminal et dans `ps`."
        )
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError:
        raise SystemExit("pip install elevenlabs")
    return ElevenLabs(api_key=cle)


def demander(cl, texte, duree, influence):
    """Un appel, ses octets rassemblés, ses erreurs traduites."""
    from elevenlabs.core.api_error import ApiError

    try:
        flux = cl.text_to_sound_effects.convert(
            text=texte,
            output_format=FORMAT,
            duration_seconds=duree,
            prompt_influence=influence,
            model_id=MODELE,
        )
        return b"".join(flux)
    except ApiError as e:
        # `status_code` porte la vraie cause, et les trois qui arrivent
        # méritent chacune une conduite différente.
        code = e.status_code
        if code == 401:
            raise SystemExit("401 — clé refusée. Est-elle révoquée ?")
        if code == 402:
            raise SystemExit("402 — crédits épuisés sur le compte.")
        if code == 422:
            raise SystemExit(f"422 — requête refusée : {e.body}")
        raise SystemExit(f"ElevenLabs a rendu {code} : {e.body}")


def ecrire_wav(octets, chemin):
    """Le PCM brut n'a pas d'en-tête : sans ce passage, rien ne le lira."""
    with wave.open(chemin, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)          # pcm_48000 est du 16 bits signé
        f.setframerate(FREQUENCE)
        f.writeframes(octets)


def mesurer(chemin):
    """Ce qu'un haut-parleur de téléphone en restituera, en décibels."""
    import numpy as np

    with wave.open(chemin, "rb") as f:
        x = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16)
    x = x.astype(np.float64) / 32768.0
    if x.size == 0:
        return None
    X = np.fft.rfft(x)
    f_hz = np.fft.rfftfreq(x.size, 1 / FREQUENCE)
    X[f_hz < SOL_TELEPHONE] = 0
    tel = np.fft.irfft(X, x.size)
    db = lambda v: 20 * np.log10(max(float(v), 1e-9))
    return {
        "duree_s": round(x.size / FREQUENCE, 2),
        "tout_db": round(db(np.sqrt((x ** 2).mean())), 1),
        "telephone_db": round(db(np.sqrt((tel ** 2).mean())), 1),
        "crete": round(float(abs(x).max()), 3),
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--texte", required=True, help="la description du bruitage, en anglais")
    p.add_argument("--sortie", required=True)
    p.add_argument("--duree", type=float, default=3.0, help="secondes, 0,5 à 22")
    p.add_argument(
        "--influence",
        type=float,
        default=0.3,
        help="0 laisse le modèle libre, 1 colle au texte. 0,3 par défaut.",
    )
    p.add_argument(
        "--je-confirme",
        action="store_true",
        help="obligatoire : chaque appel consomme des crédits payants",
    )
    a = p.parse_args()

    if not a.je_confirme:
        print(f"Demanderait : « {a.texte} », {a.duree} s.")
        raise SystemExit(
            "Rien n'a été envoyé. Cet appel est payant — relancer avec "
            "--je-confirme."
        )

    octets = demander(client(), a.texte, a.duree, a.influence)
    if not octets:
        raise SystemExit("Réponse vide — le flux n'a rendu aucun octet.")
    ecrire_wav(octets, a.sortie)

    m = mesurer(a.sortie)
    print(f"{a.sortie} — {m['duree_s']} s · {m['tout_db']} dB · "
          f"téléphone {m['telephone_db']} dB · crête {m['crete']}")

    # Le seuil de `sonotheque` : sous −22 dB au-dessus de 400 Hz, le son est
    # absent de l'appareil où la vidéo est regardée, pas discret.
    if m["telephone_db"] < -22:
        print(
            f"⚠ {m['telephone_db']} dB sur un téléphone : ce bruitage ne "
            "portera pas. Le regénérer en demandant du souffle, du "
            "grattement, de la matière aiguë — ou le garder pour le poids "
            "seul, filtré sous 400 Hz."
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
