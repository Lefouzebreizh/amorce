"""Ce qu'un document lu rend : le texte brut, puis les champs qu'on en tire.

Brique 1 du moteur. Deux dataclasses, une par étape :

`Extraction` est la sortie de `traitement.extraire` — le texte d'un fichier, et
comment on l'a obtenu (texte natif d'un PDF, OCR local). `ChampsDocument` est
la sortie de `regles.lire` — ce que ce texte a donné une fois passé au crible
des motifs : nature, émetteur, montant, dates, référence.

Un champ ne porte pas seulement sa valeur, il porte *comment* elle a été
trouvée (`ChampsDocument.trouvailles`) — reprise directe de la leçon de
`paper-manager/core/extraction.py` : un champ lu derrière son étiquette
(« Net à payer ») ne pèse pas la même confiance qu'un champ deviné faute de
mieux. C'est cette distinction, et non une impression, qui doit décider si un
document part se faire relire — mais la formule de pondération elle-même reste
au produit appelant (voir `regles.confiance`), puisque le poids d'un champ
dépend de ce que ce produit en fait.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path


@dataclass(frozen=True)
class Extraction:
    """Le texte d'un fichier, et la façon dont on l'a obtenu.

    `origine` distingue au moins « texte natif » et « OCR » : les deux n'ont pas
    la même fiabilité, et un champ qui en dépend doit pouvoir le dire.
    """

    chemin: Path
    texte: str = ""
    origine: str = ""
    pages_lues: int = 0
    lisible: bool = True
    diagnostic: str = ""

    @property
    def a_du_texte(self) -> bool:
        return bool(self.texte.strip())


@dataclass
class ChampsDocument:
    """Ce qu'un texte a donné, et comment chaque champ a été trouvé.

    Les champs absents valent `None`, jamais une chaîne vide : « pas trouvé » et
    « trouvé vide » n'appellent pas la même suite — le premier se cherche
    ailleurs, le second est une donnée.
    """

    nature: str | None = None
    emetteur: str | None = None
    montant: Decimal | None = None
    date_emission: date | None = None
    date_limite: date | None = None
    reference: str | None = None
    # Une entrée par champ rempli, ex. `{"montant": "etiquete", "date_emission":
    # "devine"}`. Le vocabulaire des valeurs est laissé au produit appelant : le
    # moteur le transporte, il ne le juge pas.
    trouvailles: dict[str, str] = field(default_factory=dict)
