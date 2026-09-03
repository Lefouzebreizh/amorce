#!/usr/bin/env python3
"""Le prototype : un fichier son entre, une intention sort.

Volontairement en texte, et volontairement avant tout habillage visuel. Un
écran joli posé sur un verdict faux se regarde sans qu'on voie le défaut —
c'est le piège que `CLAUDE.md` nomme « une mesure disait vert et le fichier
était faux ». Ici tout est nu : la classe retenue, le score, et la raison.

    python3 chat-traducteur/cli.py enregistrement.m4a
    python3 chat-traducteur/cli.py enregistrement.wav --detail
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from adaptateurs.audio import PAS, TAILLE_FENETRE  # noqa: E402
from adaptateurs.audio import AudioIllisible, charger, fenetrer  # noqa: E402
from adaptateurs.yamnet import ModeleAbsent, Yamnet  # noqa: E402
from noyau.intentions import Source, habiller  # noqa: E402
from noyau.tete import lire, tete_pour  # noqa: E402
from noyau.traits import traits_vocalisation  # noqa: E402
from noyau.verdict import (  # noqa: E402
    CLASSES_FELINES, CLASSES_SPECIFIQUES, SEUIL_PORTE, juger,
)


def _fenetres_de_miaulement(scores):
    """Les fenêtres où `Meow` domine — et elles seules nourrissent la tête.

    Pas les fenêtres félines : sur le premier vrai enregistrement, les quinze
    l'étaient, dont neuf de bâillement classées `Roaring cats`. La hauteur
    médiane tombait alors à 152 Hz et le référentiel rendait « détresse » sur
    un chat qui ronronne. Le référentiel classe des **miaulements** ; on ne lui
    donne que ça.
    """
    sortie = []
    for f in scores:
        felin = sum(f.get(c, 0.0) for c in CLASSES_FELINES) >= SEUIL_PORTE
        precise = max(CLASSES_SPECIFIQUES, key=lambda c: f.get(c, 0.0))
        sortie.append(felin and precise == "Meow" and f.get("Meow", 0.0) > 0.0)
    return sortie


def principal(argv=None) -> int:
    analyseur = argparse.ArgumentParser(
        description="Traduit un enregistrement de chat en intention probable."
    )
    analyseur.add_argument("fichier", help="enregistrement (.wav, .m4a, .mp3…)")
    analyseur.add_argument("--detail", action="store_true",
                           help="affiche les scores félins fenêtre par fenêtre")
    analyseur.add_argument("--seuil", type=float, default=None,
                           help="seuil de la porte (défaut : 0,20)")
    arguments = analyseur.parse_args(argv)

    try:
        echantillons = charger(arguments.fichier)
        fenetres = fenetrer(echantillons)
        modele = Yamnet()
    except (AudioIllisible, ModeleAbsent) as erreur:
        print(f"✗ {erreur}", file=sys.stderr)
        return 1

    scores = modele.scorer_toutes(fenetres)
    options = {} if arguments.seuil is None else {"seuil_porte": arguments.seuil}
    miaulements = _fenetres_de_miaulement(scores)
    traits = traits_vocalisation(echantillons, miaulements, TAILLE_FENETRE, PAS)
    verdict = juger(scores, tete_intention=tete_pour(traits), **options)

    duree = len(echantillons) / 16_000
    print(f"Fichier   : {arguments.fichier}  ({duree:.2f} s, {len(fenetres)} fenêtres)")

    if arguments.detail:
        print("\nScores félins par fenêtre :")
        for i, fenetre in enumerate(scores):
            felins = {c: fenetre.get(c, 0.0) for c in CLASSES_FELINES}
            cumul = sum(felins.values())
            haut = max(fenetre, key=fenetre.get)
            detail = "  ".join(f"{c} {v:.3f}" for c, v in felins.items() if v >= 0.01)
            print(f"  [{i}] cumul {cumul:.3f}  | {detail or '—'}"
                  f"  | tête de liste : {haut} {fenetre[haut]:.3f}")

    if arguments.detail and any(miaulements):
        lecture = lire(traits)
        print(f"\nTête acoustique : {lecture.raison}")
        print(f"  fenêtres de miaulement : {sum(miaulements)}/{len(miaulements)}")

    print(f"\nIntention : {verdict.intention.value}")
    print(f"Source    : {verdict.source.value}")
    if verdict.source is not Source.AUCUNE:
        print(f"Confiance : {verdict.confiance:.2f}")
    print(f"Raison    : {verdict.raison}")

    if verdict.affichable:
        parure = habiller(verdict.intention)
        print(f"\nÀ l'écran : {parure.titre}")
        print(f"Scène     : {parure.scene}")
        print(f"Sous-titre: {parure.sous_titre}")

    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
