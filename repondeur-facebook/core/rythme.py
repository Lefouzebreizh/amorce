#!/usr/bin/env python3
"""Le rythme : ce qui distingue une aide d'un robot.

Le vrai risque de ce projet n'est pas le bannissement — l'accès passe par l'API
officielle, avec une application déclarée. C'est la mise en pause par Facebook,
et surtout le signalement pour spam par les membres eux-mêmes. Le second fait
bien plus de dégâts que le premier.

Quatre décisions tiennent ce fichier :

1. **Les délais sont tirés au hasard, jamais fixes.** Un `sleep(3.0)` produit
   des horodatages espacés de trois secondes à la milliseconde près : c'est une
   signature aussi nette qu'une empreinte, et elle se lit dans les données bien
   avant de se voir à l'œil nu.
2. **Deux plafonds, pas un.** Par exécution *et* par jour. Sans le second,
   trois lancements dans la même heure font sauter le premier — et c'est
   exactement ce qu'on fait quand on essaie quelque chose.
3. **Des heures humaines.** Un compte qui répond à quatre heures du matin, tous
   les jours, ne dort jamais. La nuit, on lit et on prépare ; on ne publie pas.
4. **Le compteur de Facebook est lu, pas deviné.** L'API renvoie le quota
   consommé dans un en-tête, à chaque réponse. S'arrêter avant le mur vaut
   mieux que le découvrir en s'y cognant.
"""

from __future__ import annotations

import json
import random
from datetime import datetime

PAUSE_MIN_S = 40.0     # jamais deux actions à moins d'une demi-minute d'écart
PAUSE_MAX_S = 150.0    # ni au-delà de deux minutes trente : l'exécution finirait par lasser
PLAFOND_JOUR = 25      # au-delà, on ne ressemble plus à quelqu'un qui passe voir son groupe
HEURE_REVEIL = 7
HEURE_COUCHER = 23
QUOTA_MAX = 75         # en pourcentage du quota Facebook : la marge avant le mur


def pause() -> float:
    """Combien de temps attendre avant l'action suivante."""
    return random.uniform(PAUSE_MIN_S, PAUSE_MAX_S)


def heure_ouvrable(maintenant: datetime) -> bool:
    """Est-on dans les heures où un humain publie ?

    Heure locale, et c'est voulu : ce qui doit paraître naturel, c'est l'heure
    qu'il est là où vivent les membres du groupe, pas à Greenwich.
    """
    return HEURE_REVEIL <= maintenant.hour < HEURE_COUCHER


def reste_a_faire(plafond_execution: int, deja_fait_aujourdhui: int) -> int:
    """Combien d'actions cette exécution peut encore se permettre."""
    return max(0, min(plafond_execution, PLAFOND_JOUR - deja_fait_aujourdhui))


def quota_consomme(entetes) -> float:
    """Le pire des compteurs renvoyés par Facebook, en pourcentage.

    `X-App-Usage` porte trois compteurs (appels, temps, processeur) ; c'est le
    plus haut qui décide, puisque c'est lui qui touchera le plafond en premier.
    Un en-tête absent ou illisible rend 0 : ne pas savoir n'est pas une raison
    de s'arrêter, seulement de ne pas se croire renseigné.
    """
    brut = entetes.get('X-App-Usage') or entetes.get('x-app-usage')
    if not brut:
        return 0.0
    try:
        compteurs = json.loads(brut)
    except ValueError:
        return 0.0
    valeurs = [v for v in compteurs.values() if isinstance(v, (int, float))]
    return float(max(valeurs)) if valeurs else 0.0
