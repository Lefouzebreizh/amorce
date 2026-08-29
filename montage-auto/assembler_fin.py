#!/usr/bin/env python3
"""Assemble le son du film et celui du carton, chacun dans son repère.

    assembler_fin.py DUREE_VIDEO [RECETTE]

Lancé par `finir_episode.sh` depuis le répertoire de travail, où il lit
`_sf.wav` et `sfx_library/` et écrit `_at.wav`.
"""
import sys, json
from pathlib import Path
import numpy as np, soundfile as sf
sys.path.insert(0, str(Path(__file__).resolve().parent))
import monter_episode as M

ICI = Path(__file__).resolve().parent

dv = float(sys.argv[1]); D = 2.9
RECETTE = Path(sys.argv[2]) if len(sys.argv) > 2 else (ICI / 'references' / 'aznaroth-recut.json')
r = json.loads(RECETTE.read_text())

# LA QUEUE DU FILM, dans le repère du film : elle porte ce qui doit traverser
# la coupe — la fin du cri, les queues de réverbération.
piste = np.atleast_2d(M.couche_effets(r['effets'], Path('sfx_library'), dv + D,
                                      reverberation_s=r['reverberation_s']))
if piste.shape[0] < piste.shape[1]:
    piste = piste.T

# LE SON DU CARTON, dans SON repère à lui, de 0 à D. Le calculer aux instants
# absolus du film le faisait tomber à côté : la durée annoncée du montage,
# celle du flux vidéo et celle du flux audio diffèrent de quelques centièmes,
# et cet écart suffit à poser les sons hors de la tranche qu'on découpe
# ensuite. Mesuré : un carton à −45 dB alors que six sons y étaient posés.
# Un repère local ne peut pas se décaler.
#
# Les niveaux, eux, se lisent sur la DYNAMIQUE du film entier et non sur le
# carton seul : pose à -17 dB il ne « manquait » nulle part, et il relevait le
# plancher au point de faire tomber la plage de 21,4 à 9,8 LU. Un carton de fin
# doit s'entendre sans exister — une dizaine de décibels sous le climax.
carte = np.atleast_2d(M.couche_effets([
    {"son": "nappe_sombre", "instant": 0.0, "gain": -10, "distance": "lointain",
     "telephone": 1.4,
     "parametres": {"duree": D, "fondamentale": 46.0, "graine": 301}},
    {"son": "souffle_caverne", "instant": 0.05, "gain": -9, "distance": "moyen",
     "telephone": 1.3},
    {"son": "grondement_braises", "instant": 0.05, "gain": -11, "distance": "moyen"},
    {"son": "braam", "instant": 0.18, "gain": 1, "distance": "moyen",
     "parametres": {"duree": 1.6, "fondamentale": 58.0, "graine": 302}},
    {"son": "eclat", "instant": 0.22, "gain": -1, "distance": "proche",
     "parametres": {"duree": 0.7, "graine": 303, "densite": 150.0}},
    {"son": "crepitement", "instant": 0.20, "gain": -10, "distance": "moyen",
     "parametres": {"duree": D - 0.3, "densite": 70.0, "graine": 775}},
], Path('sfx_library'), D, reverberation_s=1.2))
if carte.shape[0] < carte.shape[1]:
    carte = carte.T

film, _ = sf.read('_sf.wav', dtype='float64')
n = int(round((dv + D) * M.TAUX))
tout = np.zeros((n, 2))
k = min(len(film), n)
tout[:k] = film[:k]
f = int(0.04 * M.TAUX)
for source in (piste[k:n], carte):
    m = min(len(source), n - k)
    if m <= 0:
        continue
    poids = np.ones(m)
    poids[:min(f, m)] = np.linspace(0, 1, min(f, m))
    tout[k:k + m] += source[:m] * poids[:, None]
crete = float(np.abs(tout).max())
if crete > 0.97:
    tout *= 0.97 / crete
sf.write('_at.wav', tout, M.TAUX, subtype='FLOAT')
q = tout[k:]
print(f"assemble {n / M.TAUX:.2f} s · carton a "
      f"{20 * np.log10(max(np.abs(q).mean(), 1e-9)):.1f} dB moyen")
