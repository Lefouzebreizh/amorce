#!/usr/bin/env python3
"""Vérifier que la dalle et le texte ne se recouvrent à AUCUNE image.

    python3 montage-auto/verifier_dalle.py montage-auto/scenes/recits/artisan-choc.json

`mesurer_textes.py` dit où va le texte. Il ne dit pas où va la dalle, et c'est
là que la faute était : le carton du prix descendait à 567 px pendant que le
haut de la dalle était à 470. Cent pixels de site sous les lettres, sur les six
dernières secondes, et « ARTISAN EXPRESS » posé en travers du téléphone.

Rien ne pouvait le signaler. Le test unitaire ne connaît que les bornes de la
zone sûre ; le mesureur de textes ne connaît que le texte ; et chercher le bord
de la dalle dans l'image rendue ne marche pas — son liseré est cyan, les rais
du portail aussi, et un détecteur de pixels l'a relevée à 558 là où elle était
à 608.

La scène publie donc son rectangle dans `window.__DALLE__` à chaque appel de
`dessiner`, et ce script le lit image par image. La dalle bouge (elle monte à
l'émergence, elle se range à la fin), les cartons se succèdent : l'écart entre
les deux ne se calcule pas une fois, il se relève sur toute la durée.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

SCENE = Path(__file__).resolve().parent / "scenes" / "portail.html"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
ECART_MINIMAL = 12          # px : sous cela, les deux se frôlent à l'écran


MESURE = """(t) => {
  window.dessiner(t);
  const d = window.__DALLE__ || null;
  const c = document.getElementById('c').getContext('2d');
  const L = 1080, BOITE = Math.round(L * (0.78 - 0.22)), PLANCHER = 48;
  const police = n => '700 ' + n + 'px "Liberation Sans","DejaVu Sans",sans-serif';
  const tient = (lignes, taille, esp) => {
    c.letterSpacing = esp + 'px';
    let n = taille;
    while (n > PLANCHER) { c.font = police(n);
      if (lignes.join(' ').split(' ').every(m => c.measureText(m).width <= BOITE)) break;
      n -= 2; }
    c.letterSpacing = '0px'; return n;
  };
  const couper = (lignes, taille, esp) => {
    c.letterSpacing = esp + 'px'; c.font = police(taille);
    const out = [];
    for (const l of lignes) {
      if (c.measureText(l).width <= BOITE) { out.push(l); continue; }
      let cur = '';
      for (const mot of l.split(' ')) {
        const essai = cur ? cur + ' ' + mot : mot;
        if (cur && c.measureText(essai).width > BOITE) { out.push(cur); cur = mot; }
        else cur = essai;
      }
      if (cur) out.push(cur);
    }
    c.letterSpacing = '0px'; return out;
  };
  /* Le bas d'un élément de texte VISIBLE à cet instant. Un carton qui n'a pas
     commencé, ou qui a fini de s'effacer, ne gêne personne. */
  const bas = [];
  for (const k of (window.__RECIT__.cartes || [])) {
    if (t < k.debut || t > k.fin) continue;
    const taille = tient(k.lignes, k.taille, 2);
    const lignes = couper(k.lignes, taille, 2);
    const inter = taille * 1.24;
    const y0 = (k.y || 390) - (lignes.length - 1) * inter / 2;
    bas.push({ quoi: k.lignes[0], y: y0 + (lignes.length - 1) * inter + taille * 1.12 - taille / 2 });
  }
  const sg = window.__RECIT__.signature;
  if (sg && t >= sg.debut) {
    const taille = tient([sg.texte], sg.taille, 9);
    bas.push({ quoi: sg.texte, y: sg.y + taille * 1.12 - taille / 2 });
    if (sg.trait) bas.push({ quoi: sg.texte + ' (trait)', y: sg.trait });
  }
  return { dalle: d, bas: bas };
}"""


def verifier(recit: Path, site: Path | None, cadence: int, depart: float) -> int:
    from playwright.sync_api import sync_playwright

    atelier = Path(tempfile.mkdtemp(prefix="dalle-"))
    try:
        shutil.copy(SCENE, atelier / "scene.html")
        if site:
            shutil.copy(site, atelier / "site.png")
        with sync_playwright() as p:
            navigateur = p.chromium.launch(
                executable_path=CHROME,
                args=["--no-sandbox", "--force-color-profile=srgb", "--disable-lcd-text"])
            page = navigateur.new_page(viewport={"width": 1080, "height": 1920},
                                       device_scale_factor=1)
            page.add_init_script("window.__RECIT__ = " + recit.read_text(encoding="utf-8"))
            page.goto((atelier / "scene.html").as_uri())
            if site and not page.evaluate("() => window.pret"):
                sys.exit("la capture ne s'est pas chargée — la dalle ne serait pas dessinée")
            duree = float(page.evaluate("() => window.DUREE"))

            pire = None
            releves = []
            # La scène peut commencer AVANT zéro — la construction de la fiche
            # occupe les deux secondes négatives du récit « choc ». Vérifier à
            # partir de zéro laisserait donc le hook entier hors contrôle.
            for n in range(int(round((duree - depart) * cadence)) + 1):
                t = depart + n / cadence
                r = page.evaluate(MESURE, t)
                if not r["dalle"] or not r["bas"]:
                    continue
                haut = r["dalle"]["y"]
                for e in r["bas"]:
                    ecart = haut - e["y"]
                    if pire is None or ecart < pire[0]:
                        pire = (ecart, t, e["quoi"], haut, e["y"])
                releves.append((t, haut, haut + r["dalle"]["h"]))
            navigateur.close()
    finally:
        shutil.rmtree(atelier, ignore_errors=True)

    if not releves:
        sys.exit("aucune image ne montre la dalle — récit sans dalle, ou capture absente")

    hauts = [h for _, h, _ in releves]
    bas = [b for _, _, b in releves]
    print(f"\n  dalle : haut {min(hauts):.0f} → {max(hauts):.0f}   bas {min(bas):.0f} → {max(bas):.0f}")
    print(f"  bas du cadre : {max(bas) / 1920 * 100:.1f} % "
          f"(l'interface TikTok commence à 72 %)")
    ecart, t, quoi, haut, y = pire
    print(f"\n  écart le plus faible : {ecart:.0f} px à {t:.2f} s")
    print(f"    « {quoi} » descend à {y:.0f}, la dalle commence à {haut:.0f}")
    if ecart < 0:
        print(f"\n  LE TEXTE PASSE SUR LE SITE de {-ecart:.0f} px.\n")
        return 1
    if ecart < ECART_MINIMAL:
        print(f"\n  ils se frôlent — moins de {ECART_MINIMAL} px.\n")
        return 1
    if max(bas) > 1920 * 0.72:
        print(f"\n  le bas de la dalle entre dans l'interface TikTok.\n")
        return 1
    print("\n  le site est entier, et il est sous le texte.\n")
    return 0


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("recit", type=Path)
    a.add_argument("--site", type=Path, default=None,
                   help="la capture ; sans elle la scène ne dessine pas de dalle")
    a.add_argument("--cadence", type=int, default=30)
    a.add_argument("--depart", type=float, default=0.0,
                   help="l'instant où commence le rendu — négatif si le récit "
                        "ouvre avant zéro")
    o = a.parse_args()
    sys.exit(verifier(o.recit, o.site, o.cadence, o.depart))


if __name__ == "__main__":
    main()
