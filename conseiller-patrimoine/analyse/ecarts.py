#!/usr/bin/env python3
"""La dérive de chaque poche contre sa cible.

Un seul calcul, mais deux façons de le lire, et il faut les deux :

- **en points** (`ecart_pts`), qui dit s'il faut agir. C'est la grandeur que la
  bande de tolérance compare, parce qu'une cible est un pourcentage ;
- **en euros** (`ecart_eur`), qui dit combien. C'est la grandeur qu'on porte à
  son courtier.

Afficher l'un sans l'autre donne soit un chiffre qu'on ne sait pas interpréter,
soit un montant dont on ignore s'il est grave.

**La bande de tolérance est une décision, pas un réglage cosmétique.** Sous
cinq points d'écart, arbitrer coûte plus en frais et en impôt que la discipline
ne rapporte. C'est pourquoi « aucun écart hors bande » se dit franchement — un
écran sans action doit se lire comme un feu vert, jamais comme une panne.

**Et cette bande est absolue, donc elle ment sur les petites cibles.** Mesuré
le 05/09/2026 sur le profil validé — bourse 1 %, crypto 3,5 %, immobilier 95 %,
liquidités 0,5 % —, cinq points en valeur absolue tolèrent :

| poche | cible | part encore tolérée | soit |
| --- | --- | --- | --- |
| liquidités | 0,5 % | 5,5 % | **onze fois la cible** |
| bourse | 1 % | 6 % | six fois |
| crypto | 3,5 % | 8,5 % | 2,4 fois |
| immobilier | 95 % | 100 % | 1,05 fois |

Vérifié sur ce moteur, avec un patrimoine fabriqué de 220 000 € : une poche de liquidités à
10 780 € au lieu des 1 100 € visés sort « dans la bande », rien à faire. Ce
n'est pas un défaut de calcul — `ecart_pts` est juste — c'est le seuil qui
n'a de sens que pour les poches larges. Une bande **relative** (jamais plus de
la moitié de la cible, avec un plancher de 0,5 pt) le corrigerait ; elle n'est
pas posée ici parce qu'elle change ce que l'outil recommande, et cette
décision-là appartient au propriétaire.
"""

from __future__ import annotations

from core.modeles import Classe, Ecart
from core.reglages import Profil


def analyser(totaux: dict[Classe, float], profil: Profil) -> tuple[Ecart, ...]:
    """Compare chaque poche à sa cible.

    Un patrimoine vide rend des parts à zéro plutôt qu'une division par zéro :
    le cas arrive à la toute première utilisation, quand le fichier ne porte
    encore aucun actif, et planter là serait le pire moment.
    """
    total = sum(totaux.values())
    ecarts: list[Ecart] = []
    for classe in Classe:
        valeur = totaux.get(classe, 0.0)
        cible_pct = profil.cibles_pct[classe]
        part_pct = 0.0 if total <= 0 else valeur / total * 100
        ecarts.append(Ecart(
            classe=classe,
            valeur_eur=valeur,
            part_pct=part_pct,
            cible_pct=cible_pct,
            ecart_pts=part_pct - cible_pct,
            ecart_eur=valeur - total * cible_pct / 100,
            # Comparaison large : un écart pile égal à la bande déclenche. La
            # bande dit « en dessous, on ne bouge pas » — à la valeur exacte on
            # est donc déjà sorti.
            hors_bande=abs(part_pct - cible_pct) >= profil.bande_pct,
        ))
    return tuple(ecarts)
