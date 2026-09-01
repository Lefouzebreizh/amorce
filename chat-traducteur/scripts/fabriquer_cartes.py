#!/usr/bin/env python3
"""Écrit une carte SVG par intention, pour la planche de contrôle."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from habillage.carte import en_svg  # noqa: E402
from noyau.intentions import Intention  # noqa: E402
from noyau.verdict import juger  # noqa: E402

# Un jeu de scores par intention. Ceux des trois premiers sont **relevés** sur
# de vrais sons ; les deux derniers sont fabriqués faute d'enregistrement.
CAS = {
    "contentement": [{"Cat": 0.109, "Purr": 0.148}],
    "stress": [{"Cat": 0.60, "Hiss": 0.51}],
    "indecis": [{"Cat": 0.988, "Meow": 0.891}],
    "faim": None,        # via la couture, tant que la tête n'existe pas
    "sortir": None,
}

def principal() -> int:
    dossier = Path(sys.argv[1] if len(sys.argv) > 1 else ".fixtures/cartes")
    dossier.mkdir(parents=True, exist_ok=True)
    for nom, fenetres in CAS.items():
        if fenetres is None:
            intention = Intention.FAIM if nom == "faim" else Intention.SORTIR
            verdict = juger([{"Cat": 0.9, "Meow": 0.8}],
                            tete_intention=lambda i=intention: (i, 0.71))
        else:
            verdict = juger(fenetres)
        (dossier / f"{nom}.svg").write_text(en_svg(verdict), encoding="utf-8")
        print(f"  {nom:14} {verdict.intention.value:13} {verdict.source.value}")
    print(f"Cartes écrites dans {dossier}")
    return 0

if __name__ == "__main__":
    raise SystemExit(principal())
