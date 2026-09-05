#!/usr/bin/env python3
"""Mesurer la largeur réelle de chaque texte d'un récit, dans le navigateur.

La zone sûre a deux dimensions et les tests n'en tenaient qu'une. Un carton
peut rester entre 12 % et 45 % de la hauteur et sortir quand même du cadre par
les côtés : « 300 € — 200 € POUR LES PREMIERS » se lisait « 00 € — 200 € POUR
LES PREMIERS », coupé aux deux bords, et rien ne le signalait.

La largeur d'un texte dépend de la police et du rendu : elle ne se calcule pas
en comptant les caractères, elle se mesure. D'où ce script plutôt qu'un test
unitaire — il ouvre la scène, appelle `measureText`, et rend des pourcentages
du cadre.

    python3 montage-auto/mesurer_textes.py montage-auto/scenes/recits/artisan-choc.json

La boîte est celle de `motion/` : 22 % à 88 %. Au-delà, la scène réduit
d'elle-même la taille du carton — le script dit alors de combien.
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


def mesurer(recit: Path, scene: Path) -> int:
    from playwright.sync_api import sync_playwright

    atelier = Path(tempfile.mkdtemp(prefix="mesure-"))
    try:
        shutil.copy(scene, atelier / "scene.html")
        with sync_playwright() as p:
            navigateur = p.chromium.launch(
                executable_path=CHROME,
                args=["--no-sandbox", "--force-color-profile=srgb", "--disable-lcd-text"])
            page = navigateur.new_page(viewport={"width": 1080, "height": 1920},
                                       device_scale_factor=1)
            page.add_init_script("window.__RECIT__ = " + recit.read_text(encoding="utf-8"))
            page.goto((atelier / "scene.html").as_uri())
            releve = page.evaluate("""() => {
              const c = document.getElementById('c').getContext('2d');
              const L = 1080, BOITE = Math.round(L * (0.78 - 0.22)), PLANCHER = 48;
              const police = t => '700 ' + t + 'px "Liberation Sans","DejaVu Sans",sans-serif';
              const tient = (lignes, taille, esp) => {
                c.letterSpacing = esp + 'px';
                let t = taille;
                while (t > PLANCHER) { c.font = police(t);
                  if (lignes.join(' ').split(' ').every(m => c.measureText(m).width <= BOITE)) break;
                  t -= 2; }
                c.letterSpacing = '0px'; return t;
              };
              const couper = (lignes, taille, esp) => {
                c.letterSpacing = esp + 'px'; c.font = police(taille);
                const out = [];
                for (const ligne of lignes) {
                  if (c.measureText(ligne).width <= BOITE) { out.push(ligne); continue; }
                  let cur = '';
                  for (const mot of ligne.split(' ')) {
                    const essai = cur ? cur + ' ' + mot : mot;
                    if (cur && c.measureText(essai).width > BOITE) { out.push(cur); cur = mot; }
                    else cur = essai;
                  }
                  if (cur) out.push(cur);
                }
                c.letterSpacing = '0px'; return out;
              };
              const juger = (lignes, taille, esp, y) => {
                const t = tient(lignes, taille, esp);
                const dessinees = couper(lignes, t, esp);
                c.letterSpacing = esp + 'px'; c.font = police(t);
                const large = Math.max(...dessinees.map(l => c.measureText(l).width));
                c.letterSpacing = '0px';
                const inter = t * 1.24;
                const y0 = y - (dessinees.length - 1) * inter / 2;
                return { demande: taille, posee: t, lignes: dessinees, large,
                         haut: y0 - t / 2, bas: y0 + (dessinees.length - 1) * inter + t / 2,
                         boite: BOITE };
              };
              const sortie = [];
              for (const carte of (window.__RECIT__.cartes || []))
                sortie.push(Object.assign({ quoi: carte.lignes.join(' / ') },
                                          juger(carte.lignes, carte.taille, 2, carte.y || 390)));
              const s = window.__RECIT__.signature;
              if (s) sortie.push(Object.assign({ quoi: s.texte },
                                               juger([s.texte], s.taille, 9, s.y)));
              return sortie;
            }""")
            navigateur.close()
    finally:
        shutil.rmtree(atelier, ignore_errors=True)

    fautes = []
    print(f"  {'cadre':>9}  {'hauteur':>11}  {'px':>7}  texte")
    for e in releve:
        gauche = (1080 - e["large"]) / 2
        cadre = f"{gauche / 1080 * 100:.0f}→{(gauche + e['large']) / 1080 * 100:.0f} %"
        hauteur = f"{e['haut']:.0f}→{e['bas']:.0f}"
        taille = f"{e['posee']}" + ("" if e["posee"] == e["demande"] else f" (↓{e['demande']})")
        coupe = " ¶" if len(e["lignes"]) > e["quoi"].count(" / ") + 1 else "  "
        print(f"  {cadre:>9}  {hauteur:>11}  {taille:>7}{coupe}{e['quoi'][:46]}")
        if gauche < 1080 * 0.22 - 0.5:
            fautes.append(f"« {e['quoi'][:40]} » déborde à gauche ({gauche/10.8:.0f} %, minimum 22 %)")
        if e["haut"] < 230 or e["bas"] > 865:
            fautes.append(f"« {e['quoi'][:40]} » sort de la zone sûre "
                          f"({e['haut']:.0f}→{e['bas']:.0f}, bornes 230→865)")
    print(f"\n  boîte : {releve[0]['boite'] if releve else 0} px, soit 22 % → 78 % centrés."
          f"  ¶ = passé à la ligne.")
    for f in fautes:
        print(f"  ✗ {f}")
    if not fautes:
        print("  tout tient.")
    return 1 if fautes else 0


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("recit", type=Path)
    a.add_argument("--scene", type=Path, default=SCENE)
    o = a.parse_args()
    if not o.recit.is_file():
        sys.exit(f"Récit introuvable : {o.recit}")
    return mesurer(o.recit, o.scene)


if __name__ == "__main__":
    raise SystemExit(main())
