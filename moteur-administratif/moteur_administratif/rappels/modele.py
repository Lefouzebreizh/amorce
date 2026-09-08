"""Un rappel : quoi, quand, et le détail qui évite de rouvrir un dossier pour le savoir."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Rappel:
    """Une chose à faire, et le jour où il est trop tard pour la faire.

    `libelle` porte l'action (« Résilier — Assurance habitation »), `detail` la
    consigne complète : un rappel qui oblige à rouvrir un dossier pour savoir
    quoi faire est un rappel qu'on repousse.
    """

    quand: date
    libelle: str
    detail: str = ""
