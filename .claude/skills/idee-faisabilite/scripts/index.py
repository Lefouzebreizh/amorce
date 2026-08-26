#!/usr/bin/env python3
"""Ajoute ou met à jour une ligne du tableau « Idées » d'INDEX.md.

Réécrire un tableau Markdown à la main casse l'alignement des colonnes et
laisse traîner la ligne d'exemple ; pire, une idée dont le statut change se
retrouve en double, ce qui vide l'index de son intérêt. Ce script fait les
deux opérations que la main rate : il remplace la ligne portant le même nom
d'idée plutôt que d'en ajouter une seconde, et il retire la ligne « vide »
dès qu'une vraie ligne existe.

Il ne touche qu'au tableau situé sous « ## Idées » : le reste du fichier,
notamment la table des chantiers existants, est recopié tel quel.
"""

import argparse
import sys
from pathlib import Path

STATUTS = ("En cours", "Faisable", "En pause", "À trier")
TITRE = "## Idées"


def cellules(ligne):
    """Découpe une ligne de tableau Markdown en cellules nettoyées."""
    return [c.strip() for c in ligne.strip().strip("|").split("|")]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--idee", required=True, help="Nom de l'idée (clé d'unicité)")
    p.add_argument("--statut", required=True, choices=STATUTS)
    p.add_argument("--score", default="—", help="Note sur 10, ou — si pas notée")
    p.add_argument("--fiche", default="—", help="Chemin de la fiche")
    p.add_argument("--prochain-pas", dest="pas", default="—")
    p.add_argument("--index", default="INDEX.md", help="Chemin d'INDEX.md")
    a = p.parse_args()

    chemin = Path(a.index)
    if not chemin.exists():
        sys.exit(f"INDEX.md introuvable : {chemin.resolve()}")

    lignes = chemin.read_text(encoding="utf-8").splitlines()

    try:
        debut = next(i for i, l in enumerate(lignes) if l.strip() == TITRE)
    except StopIteration:
        sys.exit(f"Section « {TITRE} » absente de {chemin}")

    # Le tableau court du titre jusqu'au prochain titre de niveau 2.
    fin = next(
        (i for i in range(debut + 1, len(lignes)) if lignes[i].startswith("## ")),
        len(lignes),
    )

    fiche = a.fiche if a.fiche == "—" else f"[fiche]({a.fiche})"
    score = a.score if a.score == "—" else f"{a.score}/10"
    nouvelle = f"| {a.idee} | **{a.statut}** | {score} | {fiche} | {a.pas} |"

    corps, remplacee = [], False
    for ligne in lignes[debut:fin]:
        est_ligne = ligne.startswith("|") and "---" not in ligne
        if not est_ligne or ligne.startswith("| Idée "):
            corps.append(ligne)
            continue
        cols = cellules(ligne)
        if cols and cols[0].startswith("_("):  # ligne d'exemple
            continue
        if cols and cols[0] == a.idee:
            corps.append(nouvelle)
            remplacee = True
            continue
        corps.append(ligne)

    if not remplacee:
        # Insérer après la dernière ligne du tableau, pas en fin de section :
        # la section peut se terminer par des lignes vides.
        dernier = max(
            i for i, l in enumerate(corps) if l.startswith("|")
        )
        corps.insert(dernier + 1, nouvelle)

    chemin.write_text(
        "\n".join(lignes[:debut] + corps + lignes[fin:]) + "\n", encoding="utf-8"
    )
    print(f"{'Mise à jour' if remplacee else 'Ajoutée'} : {a.idee} → {a.statut}")


if __name__ == "__main__":
    main()
