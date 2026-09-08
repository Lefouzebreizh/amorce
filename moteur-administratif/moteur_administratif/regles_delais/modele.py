"""Une règle de délai, et l'échéance qu'elle donne une fois appliquée à un document.

Brique 2 du moteur — celle qui n'existait encore nulle part sous forme
générique. `paper-manager` calcule un délai de préavis d'abonnement en dur
dans `core/resiliation.py` ; `life-organizer` calcule une date de résiliation
en dur dans `modules/calendrier/regles.py`. Les deux mécaniques de dates sont
solides et servent de modèle, mais aucune des deux ne sépare la règle (une
donnée : « pour une mise en demeure, 30 jours à compter de la réception ») de
son application (une fonction pure). C'est cette séparation que `Regle` porte.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Regle:
    """Ce qu'un type de document impose comme délai et comme démarche.

    `point_de_depart` nomme le repère à partir duquel `delai_jours` se compte
    (« date_emission », « date_reception », « date_notification »…) — un nom et
    non une date : c'est au produit appelant de dire quelle date de son propre
    document correspond à ce repère, la règle ne le sait pas d'avance.
    """

    type_document: str
    delai_jours: int
    point_de_depart: str
    demarche: str
    texte_de_reference: str = ""


@dataclass(frozen=True)
class Echeance:
    """Une règle appliquée à une date repère précise : ce qu'il reste, et jusqu'à quand."""

    type_document: str
    date_repere: date
    date_limite: date
    demarche: str
    texte_de_reference: str

    def jours_restants(self, aujourdhui: date) -> int:
        return (self.date_limite - aujourdhui).days

    def depassee(self, aujourdhui: date) -> bool:
        return aujourdhui > self.date_limite
