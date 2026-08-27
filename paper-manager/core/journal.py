"""L'index de ce que la machine a lu — `coffre/documents.json`.

Séparé d'`admin_config.json`, et c'est la décision principale du projet :

- `admin_config.json` porte ce qui vient d'une **décision humaine** — les
  contrats, les préférences, le statut d'une alerte. Il est irremplaçable.
- `documents.json` porte ce que la **machine a lu**. Il se jette et se
  refabrique en relisant le coffre.

Confondre les deux, c'est risquer six mois de saisie de contrats à chaque bogue
d'extraction.

Le journal sert aussi de garde anti-doublon : chaque document y entre avec
l'empreinte SHA-256 de son contenu. Le même relevé déposé deux fois — ce qui
arrive dès qu'on synchronise deux dossiers — n'est classé qu'une fois.

Une différence avec `config.py`, et elle est volontaire : **aucune copie de
sauvegarde**. Ce fichier se refabrique en relisant le coffre ; en garder une
copie donnerait deux vérités là où il n'en faut qu'une, et la mauvaise serait
celle qu'on relirait un jour de panique.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterator

from core.modele import Document, Nature

VERSION = 1


class ErreurJournal(Exception):
    """Journal illisible. Il se refabrique : ce n'est jamais une perte definitive."""


@dataclass
class Journal:
    """L'index des documents lus, rangé par empreinte."""

    chemin: Path
    documents: dict[str, Document] = field(default_factory=dict)

    def __iter__(self) -> Iterator[Document]:
        return iter(self.documents.values())

    def __len__(self) -> int:
        return len(self.documents)

    def connu(self, empreinte: str) -> Document | None:
        """Le même fichier a-t-il déjà été classé ?

        Par empreinte et non par nom : le même relevé déposé deux fois sous deux
        noms — ce qui arrive dès qu'on synchronise deux dossiers — ne doit être
        classé qu'une seule fois.
        """
        return self.documents.get(empreinte)

    def inscrire(self, document: Document) -> bool:
        """Ajoute le document. Rend False s'il était déjà là, sans rien écraser."""
        if not document.empreinte:
            raise ErreurJournal(
                f"{document.chemin} : sans empreinte, le doublon ne se voit pas"
            )
        if document.empreinte in self.documents:
            return False
        self.documents[document.empreinte] = document
        return True

    def derniers_de(self, emetteur: str) -> list[Document]:
        """Les documents d'un émetteur, du plus récent au plus ancien.

        Sert à voir qu'une facture mensuelle a cessé d'arriver — l'alerte
        `document_manquant` que `abonnements.py` ne sait pas encore calculer,
        faute précisément de ce journal.
        """
        connus = [d for d in self if d.emetteur == emetteur and d.date_emission]
        return sorted(connus, key=lambda d: d.date_emission or date.min, reverse=True)


def charger(chemin: str | Path) -> Journal:
    """Relit le journal. Un fichier absent n'est pas une erreur : c'est un début."""
    chemin = Path(chemin)
    if not chemin.exists():
        return Journal(chemin=chemin)
    try:
        brut = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ErreurJournal(
            f"{chemin} ligne {erreur.lineno} : {erreur.msg}. Le journal se refabrique "
            "en relisant le coffre : le supprimer est sans risque."
        ) from None
    journal = Journal(chemin=chemin)
    for objet in brut.get("documents", []):
        document = _relire(objet)
        journal.documents[document.empreinte] = document
    return journal


def enregistrer(journal: Journal) -> None:
    """Écrit le journal, par remplacement atomique.

    Rangé par date : le fichier se relit à l'œil, et deux exécutions qui n'ont
    rien changé produisent le même octet — donc un diff vide.
    """
    journal.chemin.parent.mkdir(parents=True, exist_ok=True)
    contenu = {
        "version": VERSION,
        "documents": [
            _en_json(d)
            for d in sorted(journal, key=lambda d: (d.date_emission or date.min, d.id))
        ],
    }
    temporaire = journal.chemin.with_name(journal.chemin.name + ".tmp")
    temporaire.write_text(
        json.dumps(contenu, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    os.replace(temporaire, journal.chemin)


def _en_json(document: Document) -> dict[str, Any]:
    return {
        "id": document.id,
        "chemin": document.chemin,
        "nature": document.nature.value,
        "emetteur": document.emetteur,
        "categorie": document.categorie,
        "montant": None if document.montant is None else float(document.montant),
        "date_emission": (
            document.date_emission.isoformat() if document.date_emission else None
        ),
        "date_limite": document.date_limite.isoformat() if document.date_limite else None,
        "reference": document.reference,
        "empreinte": document.empreinte,
        "confiance": document.confiance,
        "abonnement": document.abonnement,
    }


def _relire(objet: dict[str, Any]) -> Document:
    def jour(cle: str) -> date | None:
        valeur = objet.get(cle)
        return date.fromisoformat(valeur) if valeur else None

    montant = objet.get("montant")
    return Document(
        id=objet.get("id", ""),
        chemin=objet.get("chemin", ""),
        nature=Nature(objet.get("nature", "inconnue")),
        emetteur=objet.get("emetteur", ""),
        categorie=objet.get("categorie", "divers"),
        montant=None if montant is None else Decimal(str(montant)),
        date_emission=jour("date_emission"),
        date_limite=jour("date_limite"),
        reference=objet.get("reference", ""),
        empreinte=objet.get("empreinte", ""),
        confiance=float(objet.get("confiance", 1.0)),
        abonnement=objet.get("abonnement"),
    )
