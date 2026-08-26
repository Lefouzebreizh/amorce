#!/usr/bin/env python3
"""Relire le dernier relevé d'usage déposé par la ligne d'état.

Deux décisions tiennent ce fichier :

1. **L'âge du relevé s'affiche avec le relevé.** Ces chiffres viennent du
   dernier passage de la ligne d'état, pas d'une mesure faite à l'instant.
   Annoncer « 63 % » sans dire qu'il date d'une heure laisserait décider sur
   une donnée périmée — et c'est précisément quand on approche du plafond
   qu'on décide.
2. **Rien d'inventé quand il n'y a rien.** Le dépôt manque tant que la ligne
   d'état n'a pas tourné, et il ne contient jamais rien pour un compte sans
   abonnement. On le dit, et on renvoie à `/usage`.
"""

from __future__ import annotations

import json
import os
import sys
import time

DEPOT = os.path.join(os.environ.get('TMPDIR', '/tmp'), f'claude-jauge-{os.getuid()}.json')
FENETRES = (('five_hour', 'Cinq heures'), ('seven_day', 'Sept jours'))


def barre(pourcent: float, largeur: int = 10) -> str:
    pleins = min(largeur, round(pourcent / 100 * largeur))
    return '▓' * pleins + '░' * (largeur - pleins)


def duree(secondes: float) -> str:
    """Une durée telle qu'on la dit à voix haute, pas en secondes."""
    minutes = max(0, int(secondes // 60))
    if minutes < 60:
        return f'{minutes} min'
    heures, reste = divmod(minutes, 60)
    if heures < 24:
        return f'{heures} h {reste:02d}' if reste else f'{heures} h'
    jours, reste_h = divmod(heures, 24)
    return f'{jours} j {reste_h} h' if reste_h else f'{jours} j'


def main() -> int:
    try:
        with open(DEPOT, encoding='utf-8') as f:
            releve = json.load(f)
    except (OSError, ValueError):
        print("Aucun relevé disponible.\n"
              "La ligne d'état n'a pas encore tourné dans cette session, ou le "
              "compte n'a pas d'abonnement Claude.\n"
              "Recours : taper /usage.")
        return 0

    limites = releve.get('rate_limits') or {}
    if not limites:
        print("Le relevé existe mais ne contient aucune jauge : Claude Code ne "
              "transmet ces chiffres qu'aux abonnements Pro et Max.\n"
              "Recours : taper /usage.")
        return 0

    maintenant = time.time()
    age = maintenant - float(releve.get('releve') or maintenant)
    print(f"Relevé il y a {duree(age)} — modèle {releve.get('model') or 'inconnu'}.")

    for cle, nom in FENETRES:
        fenetre = limites.get(cle) or {}
        pourcent = fenetre.get('used_percentage')
        if pourcent is None:
            print(f'{nom} : pas encore connue.')
            continue
        ligne = f'{nom} : {barre(float(pourcent))} {float(pourcent):.0f} %'
        reprise = fenetre.get('resets_at')
        if reprise:
            ligne += f' — se vide dans {duree(float(reprise) - maintenant)}'
        print(ligne)
    return 0


if __name__ == '__main__':
    sys.exit(main())
