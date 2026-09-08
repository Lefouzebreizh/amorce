"""(type de document, table de règles, date repère) → échéance. Pur.

Aucune règle n'est écrite ici : la table est une donnée, fournie par le
produit appelant (voir `traitement.charger_table_de_regles`). Ce fichier ne
sait que l'appliquer — chercher la règle d'un type de document, et compter les
jours depuis le repère qu'elle désigne.
"""

from __future__ import annotations

from datetime import date, timedelta

from .modele import Echeance, Regle


def regle_pour(type_document: str, table: list[Regle]) -> Regle | None:
    """La règle déclarée pour ce type de document, ou `None` si aucune ne l'est.

    La première trouvée l'emporte, dans l'ordre de la table : même parti pris
    que le classement par thèmes de `life-organizer/modules/classement/
    regles.py` — un ordre que l'utilisateur maîtrise plutôt qu'un score qu'il
    devrait deviner. Deux règles pour le même type dans une table donnée sont
    donc une erreur de configuration, pas un cas à départager ici.
    """
    for regle in table:
        if regle.type_document == type_document:
            return regle
    return None


def calculer_echeance(type_document: str, date_repere: date,
                      table: list[Regle]) -> Echeance | None:
    """L'échéance pour ce document, ou `None` si aucune règle ne le concerne.

    `date_repere` doit déjà être la bonne date — celle que la règle désigne par
    `point_de_depart` — c'est au produit appelant de l'y faire correspondre
    avant d'appeler cette fonction : la règle nomme un repère, elle ne sait pas
    lequel des champs d'un document lui correspond.
    """
    regle = regle_pour(type_document, table)
    if regle is None:
        return None
    return Echeance(
        type_document=type_document,
        date_repere=date_repere,
        date_limite=date_repere + timedelta(days=regle.delai_jours),
        demarche=regle.demarche,
        texte_de_reference=regle.texte_de_reference,
    )
