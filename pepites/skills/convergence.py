#!/usr/bin/env python3
"""Skill 3 — la note de convergence. Aucun appel réseau, et c'est le sujet.

Cet étage doit traiter mille candidats en une seconde, pour que les deux étages
coûteux — sécurité, portefeuilles — ne s'exécutent que sur les vingt-cinq
meilleurs. GoPlus répond trente fois par minute : on ne peut pas lui soumettre
neuf cents jetons, et on n'a pas à le faire. Tout ce qui se calcule gratuitement
se calcule donc ici, en premier.

Trois idées portent le fichier.

1. **Des trapèzes, pas des seuils.** Un seuil est binaire, et tout manipulateur
   se place juste au-dessus. Une note linéaire récompense l'extrême — or sur un
   jeton de 500 000 $, l'extrême est presque toujours fabriqué. Un volume
   horaire à 400 % de la capitalisation n'est pas huit fois meilleur qu'à 50 % :
   c'est un sommet en train de se faire. Chaque critère a donc une zone saine,
   et **les deux** côtés de cette zone font baisser la note.

2. **Les drapeaux portent sur la forme, pas sur le niveau.** Aucun trapèze ne
   peut voir qu'un marché est *trop symétrique* pour être vrai, ou que les
   ventes n'échouent pas par hasard. Ce sont des éliminations, pas des points
   en moins.

3. **Un pic isolé est du bruit ; le même signal deux relevés de suite est un
   mouvement.** La confirmation ne coûte pas un appel réseau — elle coûte une
   base SQLite et dix minutes de patience. C'est le meilleur rapport
   efficacité/coût de tout l'outil : un scan sans mémoire alerte sur chaque
   hoquet d'indexation de DexScreener.
"""

from __future__ import annotations

from core.modeles import (
    CHAMPS_METRIQUES, Candidat, Metriques, Note, Observation, Releve,
)
from core.reglages import Convergence, Persistance

MINUTE = 60.0


def mesurer(candidat: Candidat) -> Metriques:
    """Les huit nombres que note la convergence.

    Chaque division est gardée : un dénominateur nul rend 0, jamais une
    exception. Un candidat sans volume sur 24 h existe — c'est un jeton qui
    vient de se réveiller — et il doit obtenir une mauvaise note, pas faire
    tomber le scan.
    """
    transactions = candidat.transactions_h1
    return Metriques(
        # L'heure écoulée, rapportée au rythme moyen de la journée. Vaut 1 quand
        # elle ressemble à toutes les autres.
        acceleration=(candidat.volume_h1 * 24.0 / candidat.volume_h24) if candidat.volume_h24 > 0 else 0.0,
        pression=(candidat.volume_h1 / candidat.market_cap) if candidat.market_cap > 0 else 0.0,
        discretion=candidat.variation_h1,
        rotation=(candidat.volume_h24 / candidat.liquidite_usd) if candidat.liquidite_usd > 0 else 0.0,
        desequilibre=(candidat.achats_h1 / transactions) if transactions > 0 else 0.0,
        profondeur=(candidat.liquidite_usd / candidat.market_cap) if candidat.market_cap > 0 else 0.0,
        taille_moyenne=(candidat.volume_h1 / transactions) if transactions > 0 else 0.0,
        age_heures=candidat.age_heures,
    )


def _drapeaux(candidat: Candidat, metriques: Metriques, convergence: Convergence) -> tuple[str, ...]:
    regles = convergence.drapeaux
    leves: list[str] = []
    transactions = candidat.transactions_h1

    # Presque que des achats, et presque aucune vente en valeur absolue : la
    # signature d'un jeton qu'on ne peut pas revendre. Le bouclier le
    # confirmerait, mais autant ne pas dépenser l'appel.
    if (transactions > 0
            and metriques.desequilibre > regles.honeypot_ratio_achats
            and candidat.ventes_h1 < regles.honeypot_ventes_max):
        leves.append(
            f"les ventes semblent bloquées : {candidat.achats_h1} achats pour "
            f"{candidat.ventes_h1} vente{'s' if candidat.ventes_h1 > 1 else ''} en 1 h"
        )

    # Un marché réel n'est jamais symétrique à 3 % près. Croisé avec une
    # rotation anormale, c'est un aller-retour sur soi-même.
    if transactions > 0:
        symetrie = abs(candidat.achats_h1 - candidat.ventes_h1) / transactions
        if symetrie < regles.lavage_symetrie_max and metriques.rotation > regles.lavage_rotation_min:
            leves.append(
                # Virgule décimale : ces phrases finissent telles quelles dans
                # le rapport et dans l'alerte Telegram.
                f"volume probablement lavé : achats et ventes à {symetrie * 100:.1f} % "
                f"l'un de l'autre pour une rotation de {metriques.rotation:.1f}"
                .replace(".", ",")
            )

    # Le critère « ticket moyen » ne pèse que 7 points : mesuré seul, un robot
    # de volume note encore 88/100. Il faut une élimination.
    if (metriques.taille_moyenne < regles.robot_ticket_max_usd
            and transactions > regles.robot_transactions_min):
        leves.append(
            f"volume de robot : {transactions} transactions en 1 h pour un ticket "
            f"moyen de {metriques.taille_moyenne:.0f} $"
        )

    return tuple(leves)


def noter(candidat: Candidat, metriques: Metriques, convergence: Convergence) -> Note:
    """La note sur 100, son détail, et les drapeaux éventuels.

    Le détail n'est pas décoratif : une note de 74 ne dit rien, « 74, dont 22
    d'accélération et 0 de profondeur » dit qu'il faut regarder le pool avant
    d'acheter. Le rapport et l'alerte l'affichent, c'est la moitié de l'intérêt
    de l'outil.
    """
    detail: dict[str, float] = {}
    valeurs: dict[str, float] = {}
    for critere in convergence.criteres:
        mesure = float(getattr(metriques, CHAMPS_METRIQUES[critere.nom]))
        valeurs[critere.nom] = mesure
        detail[critere.nom] = critere.poids * critere.trapeze.appartenance(mesure)

    return Note(
        total=sum(detail.values()),
        detail=detail,
        valeurs=valeurs,
        drapeaux=_drapeaux(candidat, metriques, convergence),
    )


def confirmer(candidat: Candidat, note: float, precedent: Releve | None,
              persistance: Persistance, seuil_signal: float) -> tuple[bool, str]:
    """Le signal tenait-il déjà au relevé précédent ?

    Rend aussi la raison, parce qu'un « non » sans motif se lit comme une panne.
    """
    if persistance.releves_requis <= 1:
        return True, "confirmation désactivée"

    if precedent is None:
        return False, "premier relevé — à confirmer au prochain scan"

    ecart_minutes = (candidat.paire_principale.releve_le - precedent.vu_le).total_seconds() / MINUTE
    if ecart_minutes < persistance.ecart_min_minutes:
        return False, (
            f"relevé précédent trop récent ({ecart_minutes:.0f} min, "
            f"il en faut {persistance.ecart_min_minutes})"
        )

    if precedent.liquidite_usd > 0:
        evolution = (candidat.liquidite_usd - precedent.liquidite_usd) / precedent.liquidite_usd * 100.0
        if evolution < persistance.chute_liquidite_max_pct:
            # Ce n'est pas une accumulation : c'est quelqu'un qui vide le pool
            # dans l'enthousiasme.
            return False, f"liquidité en recul de {abs(evolution):.0f} % pendant la hausse du volume"

    if precedent.note < seuil_signal:
        return False, (
            f"signal isolé — le jeton n'était qu'à {precedent.note:.0f}/100 "
            f"il y a {ecart_minutes:.0f} min"
        )

    return True, (
        f"confirmé sur 2 relevés ({precedent.note:.0f} → {note:.0f}/100 "
        f"en {ecart_minutes:.0f} min)"
    )


def observer(candidat: Candidat, convergence: Convergence, precedent: Releve | None,
             seuil_signal: float) -> Observation:
    """Mesure, note et confronte au passé. La sortie de tout le calcul sans réseau."""
    metriques = mesurer(candidat)
    note = noter(candidat, metriques, convergence)
    if note.drapeaux:
        # Inutile d'interroger la mémoire pour un candidat déjà éliminé sur la
        # forme de ses données.
        confirme, raison = False, note.drapeaux[0]
    else:
        confirme, raison = confirmer(
            candidat, note.total, precedent, convergence.persistance, seuil_signal
        )
    return Observation(
        candidat=candidat, metriques=metriques, note=note,
        confirme=confirme, raison_confirmation=raison,
    )
