#!/usr/bin/env python3
"""Écrit une carte SVG par intention, pour la planche de contrôle."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from habillage.carte import en_svg  # noqa: E402
from noyau.intentions import Intention  # noqa: E402
from noyau.verdict import juger  # noqa: E402

# Un jeu de scores par intention, **relevé sur le corpus** du 02/09/2026 pour
# les trois premiers ; les deux derniers passent par la couture, faute de tête
# entraînée.
#
# Le stress portait auparavant un cas fabriqué à la main, `Hiss 0,51`, et la
# planche l'affichait fièrement : « Hiss · 51% ». Or `Hiss` est **muet** —
# 0,000 sur les trois feulements réels. La carte de démonstration annonçait donc
# une mention qu'aucun chat ne produira jamais. Défaut invisible aux tests, qui
# ne regardent pas la planche, et invisible au corpus, qui ne regarde pas les
# cartes : il fallait les deux, puis un œil.
#
# D'où la règle qui s'applique ici : **une planche de démonstration se nourrit
# de mesures, jamais de valeurs choisies pour bien rendre.**
CAS = {
    "contentement": [{"Cat": 0.500, "Purr": 0.586}],           # ronron-1
    "stress": [{"Cat": 0.980, "Meow": 0.801, "Caterwaul": 0.586}],  # feulement-3
    "indecis": [{"Cat": 0.996, "Meow": 0.891, "Caterwaul": 0.031}],  # miaou-3
    "demande": None,     # via la couture : la tête acoustique, pas la porte
}

def principal() -> int:
    dossier = Path(sys.argv[1] if len(sys.argv) > 1 else ".fixtures/cartes")
    dossier.mkdir(parents=True, exist_ok=True)
    for nom, fenetres in CAS.items():
        if fenetres is None:
            intention = Intention.DEMANDE
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
