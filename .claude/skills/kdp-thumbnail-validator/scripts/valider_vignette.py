#!/usr/bin/env python3
"""Juge une couverture à la taille où elle sera vue : cent cinquante pixels.

Une couverture d'autoédition se décide dans une liste marchande, en vignette.
À cette taille, la beauté du grand format ne compte plus : ce qui compte est
qu'on reconnaisse le sujet.

**Ce script sépare ce qui est rattrapable de ce qui ne l'est pas**, et c'est
tout son propos :

- **La présence du sujet ne se rattrape pas.** Si les personnages occupent trop
  peu de la vignette, aucune typographie ne sauvera la couverture : il faut
  refaire l'illustration. C'est le seul verdict que ce script rend.
- **Le calme du bandeau de titre se rattrape**, par un voile ou un bandeau. Le
  script le mesure et prévient, sans condamner.

Deux mesures ont été écartées après calibration, et il vaut mieux le dire :

Une mesure de « concentration au centre » — le sujet doit-il faire une
silhouette centrale — **classait exactement à l'envers**. Elle pénalisait la
couverture retenue, dont les ailes déployées touchent les bords, et récompensait
celles où les personnages étaient petits et bien groupés. Un sujet qui remplit
le cadre est une force, pas un défaut.

Une mesure de « contraste du titre » prise sur l'illustration nue mesurait en
réalité l'agitation du ciel, puisque le titre n'y est pas encore. Elle
récompensait donc un ciel chargé, c'est-à-dire le pire endroit où poser un
titre. Elle est conservée mais inversée : un bandeau calme est un bon bandeau.

La leçon vaut au-delà de ce script : un contrôle qu'on n'a pas confronté à un
cas bon et à un cas mauvais connus ne vaut rien. Celui-ci a été calibré sur
trois couvertures dont le verdict humain était établi avant toute mesure — et
la première version le contredisait.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

COTE_VIGNETTE = 150

# Familles de teinte qui identifient le sujet. Par défaut celles de Roussy &
# Zéphy ; --teintes permet de les redéfinir pour un autre livre.
TEINTES_DEFAUT = {"violet": (0.740, 0.055), "cuivre": (0.065, 0.030)}
SATURATION_MIN, CLARTE_MIN = 0.25, 0.22

# Bandeau où se pose le titre, en fraction de hauteur.
BANDEAU_TITRE = (0.07, 0.30)

# Part de la vignette occupée par le sujet, en pour mille. Calibré sur trois
# couvertures de verdict humain connu : 107 et 162 pour deux jugées trop
# petites, 352 pour celle retenue.
#
# Trois cas ne justifient pas une décision au point près, et le prétendre serait
# pire qu'inutile — un chiffre porte une autorité qu'il n'a pas méritée ici.
# D'où trois états plutôt que deux : en dessous du pire cas connu on refait, au
# dessus du meilleur on passe, et entre les deux **on regarde**. La zone
# d'incertitude est large, et elle est honnête.
PRESENCE_REFAIRE = 170.0
PRESENCE_SURE = 300.0

# Au-delà de cet écart de luminance, le bandeau du titre est trop agité pour
# accueillir du texte tel quel. Ce n'est pas un échec : le composeur pose un
# voile ou un bandeau. C'est un avertissement, pas un verdict.
BANDEAU_AGITE = 40.0


@dataclass
class Mesure:
    nom: str
    valeur: float
    seuil: float
    unite: str = ""
    passe: bool = field(init=False)

    def __post_init__(self) -> None:
        self.passe = self.valeur >= self.seuil


def _teintes(a: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Teinte et masque des pixels assez colorés pour compter."""
    maxi, mini = a.max(axis=2), a.min(axis=2)
    delta = np.maximum(maxi - mini, 1e-6)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    teinte = np.where(maxi == r, ((g - b) / delta) % 6,
                      np.where(maxi == g, (b - r) / delta + 2,
                               (r - g) / delta + 4)) / 6 % 1.0
    retenus = (delta / np.maximum(maxi, 1e-6) > SATURATION_MIN) & (maxi > CLARTE_MIN)
    return teinte, retenus


def mesurer(chemin: Path, teintes_sujet: dict[str, tuple[float, float]]) -> dict:
    with Image.open(chemin) as brut:
        vignette = brut.convert("RGB").resize((COTE_VIGNETTE, COTE_VIGNETTE), Image.LANCZOS)
    a = np.asarray(vignette).astype(np.float32) / 255

    teinte, retenus = _teintes(a)
    sujet = np.zeros(teinte.shape, bool)
    for centre, largeur in teintes_sujet.values():
        ecart = np.abs(teinte - centre)
        sujet |= (np.minimum(ecart, 1 - ecart) < largeur) & retenus

    gris = np.asarray(vignette.convert("L")).astype(float)
    h0, h1 = (int(COTE_VIGNETTE * f) for f in BANDEAU_TITRE)
    bandeau = gris[h0:h1, :]

    # Une couverture finie porte souvent un bandeau uni en bas, pour le nom de
    # l'auteur. Le compter dans la surface fait chuter la présence du sujet sans
    # qu'il ait rétréci : le seuil, calibré sur des illustrations nues, condamnait
    # alors la couverture composée à partir de l'illustration qu'il venait
    # d'approuver. On mesure donc sur la seule zone dessinée.
    lignes_unies = gris[COTE_VIGNETTE // 2:].std(axis=1) < 4
    hauteur_utile = COTE_VIGNETTE
    for i, unie in enumerate(lignes_unies):
        if unie and lignes_unies[i:].all():
            hauteur_utile = COTE_VIGNETTE // 2 + i
            break
    aire_dessinee = max(1, hauteur_utile * COTE_VIGNETTE)

    return {
        "presence": sujet[:hauteur_utile].sum() / aire_dessinee * 1000,
        "bandeau_uni": COTE_VIGNETTE - hauteur_utile,
        # Écart interquartile plutôt qu'écart-type : un dégradé de ciel gonfle
        # le second sans rien dire de la place disponible pour un titre.
        "agitation_bandeau": float(np.percentile(bandeau, 92) - np.percentile(bandeau, 8)),
        "vignette": vignette,
    }


def rapporter(chemin: Path, m: dict, vignette_vers: Path | None) -> bool:
    p = m["presence"]
    etat = "refaire" if p < PRESENCE_REFAIRE else ("passe" if p >= PRESENCE_SURE else "regarder")
    marque = {"refaire": "ÉCHEC ", "regarder": " doute", "passe": "  ok  "}[etat]
    print(f"\n{chemin.name}")
    print(f"  {marque} présence du sujet        {p:7.1f} ‰  "
          f"(refaire sous {PRESENCE_REFAIRE:.0f}, sûr au-dessus de {PRESENCE_SURE:.0f})")
    if m["bandeau_uni"]:
        print(f"         mesurée hors du bandeau uni du bas "
              f"({m['bandeau_uni']} px sur {COTE_VIGNETTE})")
    agite = m["agitation_bandeau"] > BANDEAU_AGITE
    print(f"  {'  note' if agite else '  ok  '} bandeau du titre         "
          f"{m['agitation_bandeau']:7.1f}    "
          f"({'agité, prévoir un voile' if agite else 'calme, le titre y tiendra'})")

    if vignette_vers:
        vignette_vers.parent.mkdir(parents=True, exist_ok=True)
        m["vignette"].save(vignette_vers)
        print(f"  vignette écrite : {vignette_vers}")

    if etat == "passe":
        print("  → PASSE. Regardez quand même la vignette : aucune mesure ne "
              "remplace l\'œil.")
    elif etat == "regarder":
        print("  → À REGARDER. La mesure tombe dans la zone où trois cas de "
              "calibration ne\n     tranchent pas. Ouvrez la vignette : c\'est "
              "votre œil qui décide, pas ce script.")
    else:
        print("  → À REFAIRE. Le sujet occupe moins de place que la pire "
              "couverture connue,\n     et cela ne se rattrape pas en "
              "typographie : rapprocher, agrandir, alléger le décor.")
    return etat != "refaire"


def main(argv: list[str] | None = None) -> int:
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("couvertures", nargs="+", help="images ou PDF d'une page")
    a.add_argument("--vignettes", help="dossier où écrire les vignettes 150 px")
    a.add_argument("--teintes", help="JSON {nom: [centre, largeur]} en fraction de roue")
    args = a.parse_args(argv)

    teintes = TEINTES_DEFAUT
    if args.teintes:
        teintes = {k: tuple(v) for k, v in json.loads(Path(args.teintes).read_text()).items()}

    tout_passe = True
    for chemin in (Path(c) for c in args.couvertures):
        source = chemin
        if chemin.suffix.lower() == ".pdf":
            import fitz
            doc = fitz.open(str(chemin))
            pix = doc[0].get_pixmap(dpi=150)
            source = Path("/tmp") / f"{chemin.stem}_rendu.png"
            pix.save(str(source))
            doc.close()
        vers = Path(args.vignettes) / f"{chemin.stem}_150.png" if args.vignettes else None
        tout_passe &= rapporter(chemin, mesurer(source, teintes), vers)

    if len(args.couvertures) > 1:
        print("\nComparaison : la présence du sujet est le classement le plus sûr. "
              "Un bandeau\nagité se corrige, un sujet trop petit non.")

    print()
    return 0 if tout_passe else 1


if __name__ == "__main__":
    raise SystemExit(main())
