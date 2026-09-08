"""Chargement d'une table de règles depuis un fichier JSON. Impur : lecture disque.

Le fichier appartient au produit appelant, pas au moteur — c'est lui qui sait
quels délais s'appliquent à quels documents. Un exemple de forme attendue :

```json
[
  {
    "type_document": "mise_en_demeure",
    "delai_jours": 30,
    "point_de_depart": "date_reception",
    "demarche": "Répondre ou régulariser avant l'échéance.",
    "texte_de_reference": "article 1231-1 du code civil"
  }
]
```
"""

from __future__ import annotations

import json
from pathlib import Path

from .modele import Regle


class ErreurTableDeRegles(Exception):
    """Table de règles introuvable, illisible, ou d'une forme inattendue."""


def charger_table_de_regles(chemin: str | Path) -> list[Regle]:
    """Relit et valide la table de règles d'un produit."""
    chemin = Path(chemin)
    if not chemin.exists():
        raise ErreurTableDeRegles(f"{chemin} est introuvable")
    try:
        brut = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ErreurTableDeRegles(f"{chemin} ligne {erreur.lineno} : {erreur.msg}") from None
    if not isinstance(brut, list):
        raise ErreurTableDeRegles(f"{chemin} : une liste de règles est attendue")

    regles: list[Regle] = []
    for index, entree in enumerate(brut):
        if not isinstance(entree, dict):
            raise ErreurTableDeRegles(f"{chemin}[{index}] : un objet est attendu")
        try:
            regles.append(Regle(
                type_document=str(entree["type_document"]),
                delai_jours=int(entree["delai_jours"]),
                point_de_depart=str(entree["point_de_depart"]),
                demarche=str(entree["demarche"]),
                texte_de_reference=str(entree.get("texte_de_reference", "")),
            ))
        except KeyError as erreur:
            raise ErreurTableDeRegles(f"{chemin}[{index}] : champ manquant {erreur}") from None
        except (TypeError, ValueError) as erreur:
            raise ErreurTableDeRegles(f"{chemin}[{index}] : {erreur}") from None
    return regles
