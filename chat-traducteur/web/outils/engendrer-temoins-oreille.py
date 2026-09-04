"""Engendre les témoins de l'oreille : les 521 scores, puis le verdict.

Ce que ces témoins gardent n'est pas « YAMNet a raison » — personne ne le
mesure ici — mais **les deux moteurs disent la même chose**. Le Python et le
WASM du navigateur reçoivent les mêmes échantillons et doivent rendre le même
vecteur, puis le même verdict.

Les signaux sont fabriqués par des formules exprimables à l'identique dans les
deux langages, générateur pseudo-aléatoire compris : un signal lu depuis un
fichier introduirait le décodage dans la comparaison, et on ne saurait plus si
un écart vient du moteur ou du décodeur.

    python3 chat-traducteur/web/outils/engendrer-temoins-oreille.py
"""

import json
import math
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE.parent))

import numpy as np                                        # noqa: E402
from ai_edge_litert.interpreter import Interpreter        # noqa: E402

from noyau.verdict import juger                           # noqa: E402

MODELE = RACINE.parent / "modeles" / "yamnet.tflite"
TAILLE = 15_600
FREQ = 16_000


def accord(n: int) -> list[float]:
    return [0.6 * math.sin(2 * math.pi * 440 * i / FREQ)
            + 0.3 * math.sin(2 * math.pi * 880 * i / FREQ)
            + 0.1 * math.sin(2 * math.pi * 1760 * i / FREQ) for i in range(n)]


def silence(n: int) -> list[float]:
    return [0.0] * n


def bruit(n: int) -> list[float]:
    """Congruence linéaire, pour que les deux langages produisent les mêmes
    octets. `Math.random()` aurait rendu la comparaison impossible.

    **MINSTD (48271, 2^31 - 1), et le choix du multiplicateur est le sujet.**
    Le premier jet utilisait le classique 1103515245, et l'épreuve du
    navigateur a signalé un écart de 1,7e-1 sur ce signal — les trois autres
    étant identiques au bit près.

    Le moteur n'y était pour rien : `1103515245 * etat` vaut jusqu'à 1,6e18,
    au-delà des 9,0e15 que JavaScript compte encore juste. Python calcule en
    entiers exacts, JavaScript arrondit en silence, et les deux langages
    produisaient deux bruits différents. Mesuré : au troisième tirage, Python
    dit 1449466924, JavaScript dit 1358247936.

    48271 × (2^31 - 2) vaut 1,04e14, largement sous la limite. Les deux
    langages comptent alors la même chose.
    """
    etat = 12345
    sortie = []
    for _ in range(n):
        etat = (48271 * etat) % 2147483647
        sortie.append(etat / 1073741823.5 - 1.0)
    return sortie


def balayage(n: int) -> list[float]:
    """Glissando de 200 à 1200 Hz : une hauteur qui bouge, ce qu'aucun sinus
    pur n'éprouve."""
    return [math.sin(2 * math.pi * (200 + 1000 * i / n) * i / FREQ) for i in range(n)]


SIGNAUX = [
    ("accord", accord, 1),
    ("silence", silence, 2),
    ("bruit", bruit, 1),
    ("balayage", balayage, 3),
]


def principal() -> int:
    it = Interpreter(model_path=str(MODELE))
    it.allocate_tensors()
    entree = it.get_input_details()[0]
    sortie = it.get_output_details()[0]

    etiquettes = json.loads((RACINE / "donnees" / "etiquettes.json").read_text("utf-8"))
    cas = []
    for nom, fabrique, fenetres in SIGNAUX:
        echantillons = fabrique(TAILLE * fenetres)
        scores_par_fenetre = []
        for f in range(fenetres):
            bloc = echantillons[f * TAILLE:(f + 1) * TAILLE]
            it.set_tensor(entree["index"], np.array(bloc, dtype=np.float32))
            it.invoke()
            scores_par_fenetre.append(it.get_tensor(sortie["index"])[0].tolist())

        nommees = [dict(zip(etiquettes, s)) for s in scores_par_fenetre]
        v = juger(nommees)
        cas.append({
            "nom": nom,
            "fenetres": fenetres,
            "scores": scores_par_fenetre,
            "verdict": {
                "intention": v.intention.value,
                "source": v.source.value,
                "confiance": v.confiance,
                "raison": v.raison,
                "classeDominante": v.classe_dominante,
            },
        })
        haut = max(range(521), key=lambda i: scores_par_fenetre[0][i])
        print(f"  {nom:10} {fenetres} fenêtre(s)  "
              f"top={etiquettes[haut]!r} {scores_par_fenetre[0][haut]:.4f}  "
              f"-> {v.intention.value}")

    (RACINE / "temoins" / "oreille.json").write_text(
        json.dumps({"cas": cas}, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(cas)} signaux écrits dans temoins/oreille.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
