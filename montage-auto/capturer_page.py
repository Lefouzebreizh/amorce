#!/usr/bin/env python3
"""Capturer une page d'artisan, entière ET à chaque étape de sa construction.

    python3 montage-auto/capturer_page.py \\
        --page artisan-express/public/demo/couverture-martin.html \\
        --sortie rushes/captures/martin

Rend `martin.png` — la page finie, celle que la scène fait défiler — et
`martin-00.png` … `martin-NN.png`, la même page avec les blocs révélés un à un.
La scène s'en sert pour montrer la fiche SE CONSTRUIRE avant de la parcourir.

CE QUI REND CES CAPTURES UTILISABLES : `visibility: hidden`, PAS `display`.

Un bloc masqué par `display:none` ne prend plus de place, donc chaque étape a
une hauteur différente et tout ce qui suit remonte. Les captures ne seraient
plus superposables : le montage montrerait une page qui se réarrange à chaque
image, pas une page qui se construit. Avec `visibility`, la géométrie est
identique dans les N+1 états — seuls les blocs apparaissent, chacun à sa place
définitive. C'est cette invariance qui permet de les enchaîner sans fondu.

Les étapes se déduisent du DOM, dans l'ordre du document : l'en-tête, les
boutons d'appel, chaque section, le pied de page. Une page d'artisan qui aurait
une section de plus donnerait donc une étape de plus, sans rien changer ici.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BLOCS = "header, main > .actions, main > section, footer"


def capturer(page: Path, sortie: Path, largeur: int, densite: int) -> int:
    from playwright.sync_api import sync_playwright

    sortie.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        navigateur = p.chromium.launch(
            executable_path=CHROME,
            args=["--no-sandbox", "--force-color-profile=srgb",
                  "--disable-lcd-text", "--hide-scrollbars"])
        onglet = navigateur.new_page(viewport={"width": largeur, "height": 1200},
                                     device_scale_factor=densite)
        onglet.goto(page.resolve().as_uri())
        onglet.wait_for_load_state("networkidle")
        total = onglet.eval_on_selector_all(BLOCS, "n => n.length")
        if not total:
            navigateur.close()
            sys.exit(f"{page} n'expose aucun bloc — le sélecteur « {BLOCS} » ne "
                     f"rend rien, la page n'a pas la structure attendue")

        entier = sortie.with_suffix(".png")
        onglet.screenshot(path=str(entier), full_page=True)
        hauteur = onglet.evaluate("() => document.documentElement.scrollHeight")

        for etape in range(total + 1):
            onglet.evaluate("""(n) => {
              const blocs = document.querySelectorAll('%s');
              blocs.forEach((b, i) => { b.style.visibility = i < n ? '' : 'hidden'; });
            }""" % BLOCS, etape)
            onglet.screenshot(path=str(sortie.with_name(f"{sortie.name}-{etape:02d}.png")),
                              full_page=True)
            apres = onglet.evaluate("() => document.documentElement.scrollHeight")
            if apres != hauteur:
                navigateur.close()
                sys.exit(f"l'étape {etape} change la hauteur de la page "
                         f"({hauteur} → {apres}) : les captures ne sont plus "
                         f"superposables, un bloc doit sortir du flux autrement "
                         f"que par `visibility`")
        navigateur.close()

    print(f"  {entier}  —  {largeur * densite} × {hauteur * densite} pixels")
    print(f"  {total + 1} étapes, de « rien » à la page entière, toutes superposables")
    return 0


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--page", required=True, type=Path)
    a.add_argument("--sortie", required=True, type=Path,
                   help="le préfixe : « …/martin » rend martin.png et martin-00.png…")
    a.add_argument("--largeur", type=int, default=420,
                   help="la largeur de MISE EN PAGE, en points CSS. 420 donne la "
                        "colonne d'un téléphone : c'est elle qui décide des "
                        "retours à la ligne, donc de la hauteur de la page, donc "
                        "des instants du défilement. La changer invalide tout le "
                        "minutage d'un récit déjà réglé.")
    a.add_argument("--densite", type=int, default=2,
                   help="le facteur d'échelle du rendu. À 2, une colonne de 420 "
                        "points rend une image de 840 px : la dalle fait 471 px "
                        "de large à l'écran, donc une capture à 1 serait "
                        "affichée plus grande qu'elle n'a été rendue.")
    o = a.parse_args()
    sys.exit(capturer(o.page, o.sortie, o.largeur, o.densite))


if __name__ == "__main__":
    main()
