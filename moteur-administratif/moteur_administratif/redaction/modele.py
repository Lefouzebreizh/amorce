"""Un gabarit, et l'écrit qu'il produit une fois résolu.

Brique 3 du moteur. La mécanique — remplir un gabarit avec des champs,
contrôler les mentions obligatoires, mettre en page un PDF, remplir un
formulaire à champs (AcroForm) ou plat (par coordonnées) — est déjà écrite et
éprouvée dans `paper-manager/core/formulaires.py` et `core/resiliation.py`.
Ce qui est spécifique à un produit, et n'a rien à faire ici, c'est le contenu
des gabarits eux-mêmes : les quatre gabarits de résiliation de `paper-manager`
restent à `paper-manager`, ou migrent vers le produit qui en a besoin.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Ecrit:
    """Un texte composé à partir d'un gabarit, et ce qui lui manque encore.

    `mentions_manquantes` est vide quand l'écrit porte tout ce que le produit
    appelant a jugé obligatoire — voir `regles.controler_mentions`. Un écrit
    à qui il manque une mention n'est pas invalide en soi : c'est au produit
    de décider s'il le produit quand même, marqué comme incomplet, ou s'il
    refuse — le moteur ne tranche pas à sa place, il rend l'information.
    """

    gabarit: str
    contenu: str
    mentions_manquantes: tuple[str, ...] = ()

    @property
    def pret_a_signer(self) -> bool:
        return not self.mentions_manquantes


@dataclass(frozen=True)
class Champ:
    """Un champ tel qu'un PDF à formulaire (AcroForm) le déclare."""

    nom: str
    page: int
    type: str  # "texte", "case", "radio", "liste"
    rect: tuple[float, float, float, float]
    valeurs: list[str] = field(default_factory=list)
    valeur_actuelle: str = ""


@dataclass(frozen=True)
class Plan:
    """Le lien, fait une fois, entre un formulaire PDF et les données à y verser.

    Repéré à la main une fois par formulaire (dix minutes pour un Cerfa), puis
    versionné et rejoué toujours — c'est ce qui évite de refaire ce travail
    chaque année. `champs` associe un nom de champ du PDF à un gabarit de
    valeur (résolu par `regles.resoudre_champs`) ; `positions` ne sert que pour
    un PDF plat, sans AcroForm, où la valeur se pose par coordonnées plutôt que
    par nom de champ.
    """

    nom: str
    titre: str
    source: Path
    champs: dict[str, Any]
    positions: dict[str, dict[str, Any]] = field(default_factory=dict)
