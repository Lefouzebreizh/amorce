#!/usr/bin/env python3
"""D'une planche régénérée à une page prête, en une commande — verdict compris.

Remplacer une planche demandait cinq gestes et deux mesures à la main : greffer
dans le cadre, lettrer, mesurer l'ancienne, mesurer la nouvelle, comparer. Sur
un dépôt tenu depuis un téléphone, cinq gestes, c'est quatre occasions d'en
oublier un — et la comparaison, refaite de mémoire, ne se refait pas.

**Le verdict fait partie du travail, pas de son commentaire.** Une régénération
peut sortir moins piquée que la planche qu'elle remplace : c'est arrivé, 808
contre 853, alors que la nouvelle était deux fois moins agrandie. Sans mesure
posée à côté du résultat, on garde la moins bonne en croyant avoir progressé.

Le piqué se mesure **à la taille d'impression et sur les cases seules**. À taille
normalisée il dit la netteté intrinsèque, ce qui n'est pas la question ; bordure
et texte comprises, il mesure le lettrage vectoriel plutôt que le dessin.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import fitz
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.greffe import greffer  # noqa: E402
from pipeline import lettrage  # noqa: E402

# Fenêtre de mesure : les quatre cases, sans la bordure ni le bandeau du titre.
CASES = (0.08, 0.10, 0.92, 0.88)


def pique(gris: np.ndarray) -> float:
    """Raideur des contours francs — indépendante de la quantité de détail."""
    g = gris.astype(np.float32)
    m = np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3),
                 cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    return float(m[m >= np.percentile(m, 99)].mean())


def _cases(img: np.ndarray) -> np.ndarray:
    h = img.shape[0]
    return img[int(CASES[1] * h):int(CASES[3] * h), int(CASES[0] * h):int(CASES[2] * h)]


def pique_du_pdf(pdf: Path, cote: int = 2600) -> float:
    page = fitz.open(pdf)[0]
    z = cote / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(z, z), colorspace=fitz.csGRAY)
    return pique(_cases(np.frombuffer(pix.samples, np.uint8)
                        .reshape(pix.height, pix.width)))


def remplacer(neuve: Path, page: int, dossier: Path, travail: Path,
              tome: int = 1, donneuse: Path | None = None,
              ancienne: Path | None = None, reperes: bool = False) -> dict:
    pages = lettrage._dossier(dossier)
    if page not in pages:
        raise SystemExit(f"page {page} absente de {dossier}")
    sommaire = {p.numero: p for p in charte.pages(tome)}
    nom = f"RoussyEtZephy_Page{page:02d}_{sommaire[page].slug}"

    # La donneuse doit être de même nature que la receveuse : le cadre d'une
    # page de garde n'a pas de grille 2 × 2, et son crème n'est pas cadré de la
    # même façon. Prise au hasard, elle donne une page qui ne ressemble à rien.
    planches = travail / "normalisees2"
    if donneuse is None:
        soeurs = [p for p in charte.pages(tome)
                  if p.nature == sommaire[page].nature and p.numero != page]
        for soeur in soeurs:
            candidate = planches / f"RoussyEtZephy_Page{soeur.numero:02d}_{soeur.slug}.png"
            if candidate.exists():
                donneuse = candidate
                break
    if donneuse is None:
        raise SystemExit(
            f"aucune planche donneuse de nature « {sommaire[page].nature} » "
            f"dans {planches} — en désigner une avec --donneuse")

    sortie = travail / "remplacees"
    greffee = sortie / f"{nom}.png"
    greffer(neuve, donneuse, greffee)

    pdf = sortie / f"{nom}.pdf"
    lettrage.composer(greffee, pdf, pages[page], tome, page, reperes=reperes)

    mesures = {"nouvelle": pique_du_pdf(pdf)}
    ancienne = ancienne or (planches / f"{nom}.png")
    if ancienne.exists():
        img = cv2.imread(str(ancienne), cv2.IMREAD_GRAYSCALE)
        mesures["ancienne"] = pique(_cases(img))

    print(f"\n  piqué à la taille d'impression, sur les cases seules")
    for quoi, v in mesures.items():
        print(f"    {quoi:<10} {v:6.0f}")
    if "ancienne" in mesures:
        ecart = mesures["nouvelle"] - mesures["ancienne"]
        if ecart >= 0:
            print(f"\n  VERDICT : la nouvelle gagne {ecart:.0f} points. À garder.")
        else:
            print(f"\n  VERDICT : la nouvelle PERD {-ecart:.0f} points.")
            print(f"    Le texte est vectoriel, ce qui reste un gain — mais sur le")
            print(f"    dessin, la planche d'origine est meilleure. Regarder les deux")
            print(f"    à l'échelle réelle avant de trancher.")
    print(f"\n  page prête : {pdf}")
    return {"pdf": pdf, "planche": greffee, "mesures": mesures}


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--neuve", required=True, help="planche régénérée, sans texte ni bordure")
    a.add_argument("--page", type=int, required=True)
    a.add_argument("--tome", type=int, default=1, choices=sorted(charte.TOMES))
    a.add_argument("--dossier", help="DOSSIER.md du tome (déduit du tome si absent)")
    a.add_argument("--travail", default=".travail")
    a.add_argument("--donneuse", help="planche dont on prend le cadre")
    a.add_argument("--reperes", action="store_true",
                   help="tracer les boîtes à vide plutôt que lettrer")
    args = a.parse_args()
    dossier = Path(args.dossier) if args.dossier else \
        Path(__file__).parents[1] / f"tome{args.tome}/DOSSIER.md"
    remplacer(Path(args.neuve), args.page, dossier, Path(args.travail),
              args.tome, Path(args.donneuse) if args.donneuse else None,
              reperes=args.reperes)
