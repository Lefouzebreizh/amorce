#!/usr/bin/env python3
"""Ce que le propriétaire a saisi lui-même : bourse, crypto, immobilier, liquidités.

C'est le seul lecteur qui apporte des **montants** au patrimoine, et il faut
savoir pourquoi plutôt que de le découvrir en cherchant le module de cours qui
n'existe pas.

**Les cours sont saisis à la main, et c'est un choix.** Le conseiller n'a aucune
dépendance réseau : ni `requests`, ni `yfinance`, ni client d'API. Trois raisons,
dans l'ordre où elles comptent :

1. Un module qui lit l'argent de quelqu'un doit être aussi petit et aussi
   inerte que possible. Zéro sortie réseau est une propriété vérifiable — un
   test relit le source du paquet — là où « il ne fait que des GET » est une
   promesse qu'il faudrait recontrôler à chaque modification.
2. Les hôtes de cours ne répondent pas depuis une session distante de ce dépôt
   (mesuré : les neuf hôtes de marché rendent `000`). Un module de cours écrit
   ici serait donc du code **jamais éprouvé**, présenté comme fonctionnel.
3. Une saisie mensuelle est le rythme réel d'un rééquilibrage. On ne réarbitre
   pas un patrimoine au cours de la minute.

La contrepartie est réelle et elle est traitée, pas ignorée : un cours saisi
vieillit. Chaque prix porte sa date, `lignes_perimees` relève ceux qui ont
dépassé la fraîcheur admise, et le bilan bascule alors en partiel — le conseil
se tait plutôt que de raisonner sur le marché de l'été dernier.
"""

from __future__ import annotations

from datetime import date

from analyse import valorisation
from core.modeles import Disponibilite, EtatSource
from core.reglages import Reglages
from lecteurs import Lecture


def lire(reglages: Reglages, aujourdhui: date) -> Lecture:
    """Valorise la saisie et signale ce qui manque ou ce qui a vieilli."""
    lignes = valorisation.valoriser(reglages)

    if not lignes:
        return Lecture(etat=EtatSource(
            nom="saisie",
            disponibilite=Disponibilite.VIDE,
            motif=(
                "aucun actif saisi. Le patrimoine est vide tant que le bloc "
                "« actifs » du fichier de configuration n'est pas rempli."
            ),
        ))

    notes: list[str] = []

    sans_prix = valorisation.lignes_sans_prix(lignes)
    if sans_prix:
        notes.append(
            "cours absent pour " + ", ".join(ligne.nom for ligne in sans_prix)
            + " — ces lignes ne comptent pas dans le total, elles ne valent pas zéro"
        )

    perimees = valorisation.lignes_perimees(
        lignes, aujourdhui, reglages.profil.fraicheur_max_jours
    )
    for ligne, age in perimees:
        notes.append(
            f"cours de {ligne.nom} saisi il y a {age} jours "
            f"(fraîcheur admise : {reglages.profil.fraicheur_max_jours})"
        )

    return Lecture(
        etat=EtatSource(
            nom="saisie",
            disponibilite=Disponibilite.LUE,
            lignes=len(lignes),
        ),
        lignes=lignes,
        notes=tuple(notes),
    )
