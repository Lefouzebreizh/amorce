"""Les verdicts du noyau Python sur le corpus de **vrais** chats.

Les trois autres générateurs de témoins travaillent sur des signaux
fabriqués — un accord, du silence, un bruit, un glissando — pour comparer deux
moteurs sur les mêmes octets. Celui-ci fait l'inverse : il part de sons réels,
44,1 kHz, que les deux chaînes doivent **rééchantillonner chacune à sa façon**
— ffmpeg d'un côté, le navigateur de l'autre.

L'égalité bit pour bit est donc hors de portée, et ce n'est pas ce qu'on
cherche. On demande que les deux chaînes **concluent la même chose**, ce qui
est la seule question qui compte pour un utilisateur.

Le corpus n'est pas versionné (CC BY-NC, et binaire) : le récupérer d'abord
avec `scripts/mesurer_esc50.py`.

    python3 chat-traducteur/web/outils/engendrer-temoins-corpus.py
"""

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE.parent))

CORPUS = RACINE.parent / ".fixtures" / "esc50"
SORTIE = RACINE.parent / ".fixtures" / "esc50-python.json"


def principal() -> int:
    if not CORPUS.is_dir() or not any(CORPUS.glob("*.wav")):
        print(f"Corpus absent de {CORPUS}.", file=sys.stderr)
        print("Le récupérer : python3 chat-traducteur/scripts/mesurer_esc50.py",
              file=sys.stderr)
        return 3

    from adaptateurs.audio import charger, fenetrer   # noqa: E402
    from adaptateurs.yamnet import Yamnet             # noqa: E402
    from noyau.verdict import juger                   # noqa: E402

    modele = Yamnet(RACINE.parent / "modeles" / "yamnet.tflite")
    sortie = {}
    for f in sorted(CORPUS.glob("*.wav")):
        scores = [modele.scorer(b) for b in fenetrer(charger(f))]
        v = juger(scores)
        sortie[f.name] = {
            "intention": v.intention.value, "source": v.source.value,
            "classeDominante": v.classe_dominante, "fenetres": len(scores),
        }
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False) + "\n", encoding="utf-8")

    from collections import Counter
    chats = Counter(x["intention"] for k, x in sortie.items() if k.startswith("chat-"))
    temoins = Counter(x["intention"] for k, x in sortie.items() if k.startswith("temoin-"))
    print(f"{len(sortie)} verdicts -> {SORTIE.name}")
    print(f"  chats   : {dict(chats)}")
    print(f"  témoins : {dict(temoins)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
