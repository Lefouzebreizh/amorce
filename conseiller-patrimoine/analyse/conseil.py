#!/usr/bin/env python3
"""Que faire du prochain versement, et ce qu'il ne rattrapera pas.

**L'apport passe avant l'arbitrage, et c'est la décision qui vaut le plus
d'argent de tout le module.** Renforcer ce qui est sous-pondéré ne déclenche
aucune imposition ; vendre ce qui est sur-pondéré en déclenche, hors PEA et
assurance-vie. Le plan d'apport se calcule donc en premier, et une vente n'est
proposée que pour ce que douze mois de versements ne rattraperaient pas.

C'est aussi ce qui évite le travers du conseiller automatique : proposer chaque
mois de vendre ce que la discipline corrigerait toute seule, sans impôt et sans
frais.
"""

from __future__ import annotations

from core.modeles import Classe, Ecart

# Au-delà, un écart n'est plus un accident de marché qu'un versement régulier
# absorbe : c'est une dérive structurelle, et elle se corrige autrement.
MOIS_DE_PATIENCE = 12

# Alléger n'a pas le même sens selon la poche. Ces phrases sont la différence
# entre un conseil applicable et un conseil qui coûte de l'argent : un
# appartement ne se vend pas par tranches, et une cession crypto vers l'euro
# est imposée là où un arbitrage interne au PEA ne l'est pas.
COMMENT_ALLEGER: dict[Classe, str] = {
    Classe.BOURSE: (
        "à vendre d'abord dans le PEA ou l'assurance-vie, où l'arbitrage n'est "
        "pas imposé ; sur un compte-titres il l'est"
    ),
    Classe.CRYPTO: (
        "toute cession vers l'euro est imposable : n'alléger que ce qui dépasse "
        "vraiment, et garder la trace des prix de revient"
    ),
    Classe.IMMOBILIER: (
        "un bien ne se vend pas par tranches ; cette sur-pondération se corrige "
        "en renforçant les autres poches plutôt qu'en touchant à celle-ci"
    ),
    Classe.LIQUIDITES: (
        "rien à vendre, seulement à placer : ce surplus dort et perd de la "
        "valeur chaque année où l'inflation dépasse son taux"
    ),
}


def affecter_apport(apport_eur: float, ecarts: tuple[Ecart, ...]) -> dict[Classe, float]:
    """Répartit le prochain versement sur ce qui manque le plus.

    **Le manque se mesure sur le patrimoine d'après le versement, pas
    d'avant.** Les cibles étant des pourcentages, verser mille euros relève
    aussi la cible en euros de chaque poche : rattraper l'écart d'avant laissait
    un résidu, et un apport de cent mille euros sur un portefeuille déséquilibré
    retombait à 49,98 % au lieu de 50.

    **Proportionnel au manque, pas à parts égales.** Une poche à dix mille euros
    de sa cible et une autre à cinq cents doivent être rattrapées dans ce
    rapport-là. Une poche déjà sur-pondérée ne reçoit rien : c'est la dilution
    par l'apport, qui corrige sans vendre, donc sans impôt.
    """
    if apport_eur <= 0:
        return {ecart.classe: 0.0 for ecart in ecarts}

    total_apres = sum(ecart.valeur_eur for ecart in ecarts) + apport_eur
    besoins = {
        ecart.classe: max(0.0, total_apres * ecart.cible_pct / 100 - ecart.valeur_eur)
        for ecart in ecarts
    }
    total_besoins = sum(besoins.values())
    if total_besoins <= 0:
        # Aucune poche sous sa cible : cela n'arrive que si toutes sont pile
        # dessus. On répartit alors selon les cibles, faute de manque à combler.
        return {
            ecart.classe: apport_eur * ecart.cible_pct / 100 for ecart in ecarts
        }
    # La somme des besoins est ≥ à l'apport, avec égalité quand aucune poche
    # n'est sur-pondérée : la répartition tombe alors pile sur les cibles.
    return {classe: apport_eur * besoin / total_besoins for classe, besoin in besoins.items()}


def ventes_restantes(
    ecarts: tuple[Ecart, ...], affectation: dict[Classe, float], bande_pct: float
) -> dict[Classe, float]:
    """Ce qu'il resterait à alléger après douze mois d'apports.

    Un versement mensuel ne rattrape presque jamais un gros écart d'un coup,
    mais douze y suffisent souvent. Ne proposer une vente qu'après les avoir
    simulés, c'est refuser de conseiller un arbitrage imposable pour un écart
    que la discipline efface toute seule.
    """
    verse = {classe: montant * MOIS_DE_PATIENCE for classe, montant in affectation.items()}
    total_apres = sum(ecart.valeur_eur for ecart in ecarts) + sum(verse.values())
    if total_apres <= 0:
        return {}

    ventes: dict[Classe, float] = {}
    for ecart in ecarts:
        valeur_apres = ecart.valeur_eur + verse.get(ecart.classe, 0.0)
        part_apres = valeur_apres / total_apres * 100
        if part_apres - ecart.cible_pct >= bande_pct:
            ventes[ecart.classe] = valeur_apres - total_apres * ecart.cible_pct / 100
    return ventes
