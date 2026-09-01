#!/usr/bin/env python3
"""La mise en forme du tableau de bord, sans Streamlit.

Séparé de `app.py` pour une raison de vérification : `app.py` importe
Streamlit, que la CI du dépôt n'installe pas — c'est écrit en tête de
`.github/requirements-tests.txt`, et c'est ce qui garde la vérification à
quinze secondes. Tout ce qui se teste sans navigateur vit donc ici, et
`tests/test_interface.py` y passe sans rien installer.

Ce module ne calcule rien du métier non plus. Il reçoit des valeurs déjà
rendues par `core.abonnements.tableau()` et les met en page : une largeur de
barre entre 0 et 1, un nombre de jours entre deux dates déjà choisies, le
libellé lisible d'une catégorie. Les décisions — quelle date porte une alerte,
quel contrat compte au budget — sont dans `core/`, et vérifiées là-bas.

Deux pièges que les tests tiennent :

- **Une barre sans dénominateur.** Une configuration sans contrat, ou sans
  alerte, donnerait une division par zéro au premier affichage — c'est-à-dire
  au premier lancement sur une machine neuve, le seul moment où personne ne
  saurait quoi en faire. La barre reste vide.
- **Une part hors bornes.** Une largeur au-delà de 100 % déborde sa piste et
  passe sous le bord de l'écran ; en deçà de 0 %, le navigateur avale la règle
  et affiche une barre pleine. Les deux se voient en production, jamais en
  relecture.
"""

from __future__ import annotations

from datetime import date

from core.config import Configuration
from core.modele import Alerte


def fraction(part: int, total: int) -> float:
    """La part d'un tout. Sans dénominateur, la barre n'a rien à montrer : elle reste vide."""
    return part / total if total else 0.0


def barre(intitule: str, valeur: str, part: float, chaud: bool = False) -> str:
    """Une barre horizontale : un intitulé, sa mesure, et le trait qui la montre.

    `part` est déjà une fraction de 0 à 1 — la calculer ici reviendrait à
    décider ce que la barre compare, et ce n'est pas à la mise en page de le
    dire. `chaud` la passe en rouge : c'est du retard, pas de l'avancement.
    """
    pour_cent = max(0.0, min(1.0, part)) * 100
    classe = "pm-part pm-chaud" if chaud else "pm-part"
    return (
        f'<div class="pm-barre">'
        f'<div class="pm-mesure"><span>{intitule}</span><span>{valeur}</span></div>'
        f'<div class="pm-piste"><div class="{classe}" style="width:{pour_cent:.1f}%"></div></div>'
        f'</div>'
    )


def delai(alerte: Alerte, le: date) -> str:
    """« en retard de 12 j », « aujourd'hui », « dans 30 j ».

    Deux dates déjà rendues par le calcul, soustraites pour la lecture — la
    même phrase que `paper.py _afficher`, et la même règle : la date portée par
    une alerte est celle du préavis, jamais celle du terme. C'est `core/` qui
    l'a choisie, pas cet écran.
    """
    retard = (le - alerte.echeance).days
    if retard > 0:
        return f"en retard de {retard} j"
    if retard == 0:
        return "aujourd'hui"
    return f"dans {-retard} j"


def libelles(configuration: Configuration) -> dict[str, str]:
    """« energie » s'affiche « Énergie et eau » : le libellé est déjà dans la configuration.

    Une catégorie citée par un contrat sans être déclarée ne peut pas arriver —
    `config.py` la refuse au chargement —, mais l'affichage retombe quand même
    sur la clé brute : un tableau de bord ne devrait jamais être le premier à
    tomber en panne.
    """
    return {cle: categorie.libelle or cle
            for cle, categorie in configuration.classement.categories.items()}
