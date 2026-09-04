"""Engendre les témoins de conformité depuis le noyau Python, qui fait foi.

Un portage ne se relit pas, il se compare. Ce script fait tourner le cœur
Python sur une liste de cas choisis pour couvrir chaque branche de décision,
et écrit ce qu'il rend dans `temoins/cas.json`. La suite TypeScript rejoue les
mêmes entrées et exige les mêmes sorties, **au caractère près sur le SVG**.

C'est le seul garde-fou qui vaille : deux implémentations d'une même règle
divergent toujours, et jamais là où on regarde. Ici la divergence casse un
test au lieu de sortir une carte fausse six mois plus tard.

À relancer après toute modification du noyau Python :

    python3 chat-traducteur/web/outils/engendrer-temoins.py
"""

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE.parent))

from habillage.carte import en_svg                      # noqa: E402
from noyau.intentions import Intention                  # noqa: E402
from noyau.tete import TypeMiaulement, classer, lire    # noqa: E402
from noyau.traits import Traits, hauteur_bloc           # noqa: E402
from noyau.verdict import juger                         # noqa: E402

# Chaque cas nomme la branche qu'il couvre. Un cas sans branche nommée est un
# cas qu'on ne saura pas remplacer le jour où la règle bouge.
CAS_VERDICT = [
    ("porte : aucune fenetre", [], None),
    ("porte : sous le seuil", [{"Speech": 0.99}], None),
    ("porte : juste sous le seuil", [{"Cat": 0.19}], None),
    ("lecture directe Purr", [{"Cat": 0.500, "Purr": 0.586}], None),
    ("lecture directe Hiss", [{"Cat": 0.60, "Hiss": 0.51}], None),
    ("lecture directe Caterwaul",
     [{"Cat": 0.980, "Meow": 0.801, "Caterwaul": 0.586}], None),
    ("Meow domine, porteuse sous le plancher",
     [{"Cat": 0.996, "Meow": 0.891, "Caterwaul": 0.031}], None),
    ("le lion : felin fort, aucune classe precise",
     [{"Roaring cats (lions, tigers)": 0.97}], None),
    ("meilleure fenetre, jamais la moyenne",
     [{"Speech": 0.9}, {"Cat": 0.5, "Purr": 0.586}, {"Speech": 0.9}], None),
    ("couture : la tete rend une demande",
     [{"Cat": 0.9, "Meow": 0.8}], ["demande", 0.71]),
    ("couture : la tete plafonnee",
     [{"Cat": 0.9, "Meow": 0.8}], ["demande", 0.5]),
]

# Les traits : hauteur médiane, durée, et le refus de conclure.
CAS_TETE = [
    ("aigu et long -> requete", 500.0, 1.0, 5),
    ("aigu et court -> salutation", 500.0, 0.3, 5),
    ("grave -> alerte", 200.0, 1.0, 5),
    ("hauteur absente -> indetermine", None, 2.0, 0),
    ("trop peu de mesures -> indetermine", 500.0, 1.0, 1),
]

# L'autocorrélation, sur des signaux fabriqués dont on connaît la réponse.
CAS_HAUTEUR = [
    ("sinus a 440 Hz", 440.0, 4096),
    ("sinus a 200 Hz", 200.0, 4096),
    ("bloc trop court", 300.0, 128),
]


def _sinus(hertz: float, n: int, frequence: int = 16_000) -> list[float]:
    import math
    return [math.sin(2 * math.pi * hertz * i / frequence) for i in range(n)]


def principal() -> int:
    verdicts = []
    for nom, fenetres, tete in CAS_VERDICT:
        rappel = None
        if tete is not None:
            valeur = (Intention(tete[0]), tete[1])
            rappel = lambda v=valeur: v
        v = juger(fenetres, tete_intention=rappel)
        verdicts.append({
            "nom": nom,
            "fenetres": fenetres,
            "tete": tete,
            "attendu": {
                "intention": v.intention.value,
                "source": v.source.value,
                "confiance": v.confiance,
                "raison": v.raison,
                "classeDominante": v.classe_dominante,
                "affichable": v.affichable,
            },
            # Le SVG entier : c'est la comparaison la plus sévère possible, et
            # celle qui attrape une divergence d'arrondi ou de découpe de ligne.
            "svg": en_svg(v) if v.affichable else None,
        })

    tetes = []
    for nom, hauteur, duree, mesures in CAS_TETE:
        t = Traits(hauteur, duree, mesures)
        lecture = lire(t)
        tetes.append({
            "nom": nom,
            "traits": {"hauteur": hauteur, "duree": duree, "mesuresFiables": mesures},
            "attendu": {
                "type": classer(t).value,
                "intention": lecture.intention.value,
                "confiance": lecture.confiance,
                "raison": lecture.raison,
            },
        })

    hauteurs = []
    for nom, hertz, n in CAS_HAUTEUR:
        bloc = _sinus(hertz, n)
        f0, confiance = hauteur_bloc(bloc)
        hauteurs.append({
            "nom": nom, "hertz": hertz, "echantillons": n,
            "attendu": {"f0": f0, "confiance": confiance},
        })

    sortie = RACINE / "temoins" / "cas.json"
    sortie.write_text(
        json.dumps({"verdicts": verdicts, "tetes": tetes, "hauteurs": hauteurs},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    print(f"{len(verdicts)} verdicts, {len(tetes)} lectures, "
          f"{len(hauteurs)} hauteurs -> {sortie.relative_to(RACINE.parent.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
