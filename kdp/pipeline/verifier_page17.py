#!/usr/bin/env python3
"""Contrôle du jeu des sept différences par trois moyens indépendants.

Un jeu de différences ne se relit pas à l'œil : c'est précisément l'exercice
qui prouve que l'œil rate des choses. Trois mesures qui ne partagent aucun
mécanisme, et qui doivent toutes les trois tomber sur sept :

1. **Topologie.** Différence pixel à pixel, seuillée, fermée morphologiquement,
   puis comptage des composantes connexes. Répond à « combien de taches, et
   où », sans rien savoir des écarts déclarés.
2. **Colorimétrie.** Pour chaque écart déclaré, la teinte dominante de la boîte
   est mesurée des deux côtés. Répond à « le changement annoncé a-t-il bien eu
   lieu », indépendamment de la surface touchée.
3. **Résidu hors écarts.** Toute la vignette est mise à zéro sauf les sept
   boîtes ; ce qui reste doit être du bruit de rééchantillonnage. Répond à
   « existe-t-il un huitième écart involontaire », ce que les deux premières
   mesures ne peuvent pas voir.
"""

from __future__ import annotations

import colorsys
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from page17 import ECARTS, MACARON_B, VIGNETTE_A, VIGNETTE_B  # noqa: E402

SEUIL = 30          # écart moyen RVB au-delà duquel un pixel est dit « changé »
BRUIT_TOLERE = 3.0  # résidu moyen admis hors écarts, dû au rééchantillonnage


def _vignettes(planche: Path) -> tuple[Image.Image, Image.Image]:
    with Image.open(planche) as brut:
        im = brut.convert("RGB")
    a = im.crop(VIGNETTE_A)
    b = im.crop(VIGNETTE_B).resize(a.size, Image.LANCZOS)
    return a, b


def _teinte_dominante(image: Image.Image, boite, masque=None,
                     seuil_saturation=0.15) -> float | None:
    """Teinte dominante d'une boîte, restreinte aux pixels d'un masque.

    Mesurer la boîte entière conduit à un faux négatif dès que l'objet modifié
    n'y est pas majoritaire : la confiture de la crêpe change bel et bien de
    couleur, mais la crêpe dorée qui l'entoure impose sa teinte à la moyenne.
    On ne regarde donc que les pixels qui ont effectivement bougé.
    """
    z = np.asarray(image.crop(boite)).astype(np.float32) / 255
    h, s, _ = np.vectorize(colorsys.rgb_to_hsv)(z[..., 0], z[..., 1], z[..., 2])
    retenus = (s > seuil_saturation) if masque is None else ((s > seuil_saturation) & masque)
    valeurs = h[retenus]
    if valeurs.size < 30:
        return None
    hist, _ = np.histogram(valeurs, bins=36, range=(0, 1))
    return (hist.argmax() + 0.5) / 36


def controler(planche: Path) -> bool:
    a, b = _vignettes(planche)
    ecart = np.abs(np.asarray(a).astype(int) - np.asarray(b).astype(int)).mean(axis=2)

    # Le macaron porte « A » d'un côté et « B » de l'autre : c'est une
    # différence voulue, qui n'appartient pas au jeu. On la met hors mesure
    # plutôt que de la voir remonter comme huitième écart à chaque contrôle.
    mx0 = MACARON_B[0] - VIGNETTE_B[0]
    my0 = MACARON_B[1] - VIGNETTE_B[1]
    ecart[max(0, my0 - 6):my0 + (MACARON_B[3] - MACARON_B[1]) + 6,
          max(0, mx0 - 6):mx0 + (MACARON_B[2] - MACARON_B[0]) + 6] = 0
    ok = True

    print("1. TOPOLOGIE — comptage des taches de différence")
    masque = cv2.morphologyEx((ecart > SEUIL).astype(np.uint8),
                              cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    nombre, _, stats, _ = cv2.connectedComponentsWithStats(masque, 8)
    taches = [s for s in stats[1:] if s[4] > 250]
    print(f"   {len(taches)} tache(s) de plus de 250 px")
    for x, y, w, h, aire in sorted(taches, key=lambda s: -s[4]):
        rattachee = next((e.rang for e in ECARTS
                          if x < e.boite[2] + 12 and x + w > e.boite[0] - 12
                          and y < e.boite[3] + 12 and y + h > e.boite[1] - 12), None)
        etat = f"écart {rattachee}" if rattachee else "NON RATTACHÉE"
        if rattachee is None:
            ok = False
        print(f"     aire {aire:6d}  x {x:4d}-{x+w:4d}  y {y:4d}-{y+h:4d}  -> {etat}")
    rattachees = {next((e.rang for e in ECARTS
                        if s[0] < e.boite[2] + 12 and s[0] + s[2] > e.boite[0] - 12
                        and s[1] < e.boite[3] + 12 and s[1] + s[3] > e.boite[1] - 12), None)
                  for s in taches}
    if rattachees != {e.rang for e in ECARTS}:
        ok = False
        print(f"   écarts couverts : {sorted(r for r in rattachees if r)} "
              f"sur {[e.rang for e in ECARTS]}")
    else:
        print(f"   les {len(ECARTS)} écarts sont tous couverts, aucune tache étrangère")

    print("\n2. COLORIMÉTRIE — le changement annoncé a-t-il eu lieu")
    for e in ECARTS:
        bouge = ecart[e.boite[1]:e.boite[3], e.boite[0]:e.boite[2]] > SEUIL
        ta = _teinte_dominante(a, e.boite, bouge)
        tb = _teinte_dominante(b, e.boite, bouge)
        change = (ta is None or tb is None or abs(ta - tb) > 0.03)
        surface = int(bouge.sum())
        verdict = "vu" if surface > 300 else "TROP FAIBLE"
        if surface <= 300:
            ok = False
        detail = (f"teinte {ta:.2f} -> {tb:.2f}" if ta is not None and tb is not None
                  else "teinte non mesurable")
        if e.genre == "teinte" and not change:
            ok = False
            verdict = "TEINTE INCHANGÉE"
        print(f"   {e.rang}. {e.intitule[:52]:52s} {surface:6d} px  {detail:22s} {verdict}")

    print("\n3. RÉSIDU — existe-t-il un huitième écart non déclaré")
    hors = ecart.copy()
    for e in ECARTS:
        hors[e.boite[1]:e.boite[3], e.boite[0]:e.boite[2]] = 0
    pires = np.argwhere(hors > SEUIL)
    print(f"   résidu moyen hors écarts : {hors.mean():.2f} "
          f"(toléré {BRUIT_TOLERE}, dû au rééchantillonnage A->B)")
    print(f"   pixels au-dessus du seuil hors écarts : {len(pires)}")
    if hors.mean() > BRUIT_TOLERE:
        ok = False
        print("   RÉSIDU TROP ÉLEVÉ : les deux vignettes diffèrent ailleurs.")

    print(f"\n{'CONTRÔLE PASSÉ' if ok else 'CONTRÔLE ÉCHOUÉ'} — "
          f"{len(ECARTS)} écarts déclarés, trois mesures concordantes." if ok else
          f"\nCONTRÔLE ÉCHOUÉ.")
    return ok


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("planche")
    raise SystemExit(0 if controler(Path(p.parse_args().planche)) else 1)
