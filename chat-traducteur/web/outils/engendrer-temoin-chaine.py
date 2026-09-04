"""Le témoin de la chaîne complète : un fichier son, et ce qu'il devient.

Les témoins précédents comparaient les deux moteurs sur des échantillons déjà
prêts. Celui-ci part d'un **fichier**, et fait donc entrer dans la comparaison
tout ce qui se trouve avant le modèle : le décodage, le rééchantillonnage, le
fenêtrage. C'est là que deux implémentations divergent le plus facilement, et
c'est la partie que rien ne couvrait.

Le fichier est un WAV **déjà en 16 kHz mono** à dessein : ni ffmpeg ni le
navigateur n'ont alors à rééchantillonner, et l'on compare les deux chaînes
plutôt que deux filtres. Un fichier à 44,1 kHz ferait diverger les deux sans
que cela dise quoi que ce soit du code.

    python3 chat-traducteur/web/outils/engendrer-temoin-chaine.py
"""

import json
import math
import struct
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE.parent))

from adaptateurs.audio import charger, fenetrer            # noqa: E402
from adaptateurs.yamnet import Yamnet                        # noqa: E402
from noyau.verdict import juger                              # noqa: E402


def fabriquer_signal(chemin: Path) -> None:
    """Écrit le WAV d'épreuve. **Il n'est pas versionné**, comme le modèle et
    comme tout binaire ici — il se refabrique à l'identique en une seconde.

    16 kHz mono à dessein : ni ffmpeg ni le navigateur n'ont alors à
    rééchantillonner, et l'on compare deux chaînes plutôt que deux filtres.
    Un glissando plutôt qu'un sinus pur : une hauteur qui bouge éprouve le
    fenêtrage, qu'un ton fixe traverserait sans rien dire.
    """
    freq, n = 16_000, 16_000 * 2
    ech = [0.5 * math.sin(2 * math.pi * (300 + 700 * i / n) * i / freq) for i in range(n)]
    octets = b"".join(struct.pack("<h", max(-32768, min(32767, int(v * 32767)))) for v in ech)
    entete = (b"RIFF" + struct.pack("<I", 36 + len(octets)) + b"WAVEfmt "
              + struct.pack("<IHHIIHH", 16, 1, 1, freq, freq * 2, 2, 16)
              + b"data" + struct.pack("<I", len(octets)))
    chemin.write_bytes(entete + octets)


def principal() -> int:
    son = RACINE / "temoins" / "signal.wav"
    fabriquer_signal(son)
    echantillons = charger(son)
    fenetres = fenetrer(echantillons)

    modele = Yamnet(RACINE.parent / "modeles" / "yamnet.tflite")
    scores = [modele.scorer(f) for f in fenetres]
    v = juger(scores)

    etiquettes = json.loads((RACINE / "donnees" / "etiquettes.json").read_text("utf-8"))
    (RACINE / "temoins" / "chaine.json").write_text(json.dumps({
        "fichier": "signal.wav",
        "echantillons": len(echantillons),
        "fenetres": len(fenetres),
        "scores": [[f[e] for e in etiquettes] for f in scores],
        "verdict": {
            "intention": v.intention.value, "source": v.source.value,
            "confiance": v.confiance, "raison": v.raison,
            "classeDominante": v.classe_dominante,
        },
    }, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(echantillons)} échantillons, {len(fenetres)} fenêtres "
          f"-> {v.intention.value} ({v.source.value})")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
