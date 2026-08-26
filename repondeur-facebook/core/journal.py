#!/usr/bin/env python3
"""Ce qui a déjà été traité, et ce qu'il reste à faire.

Trois décisions tiennent ce fichier :

1. **On inscrit avant d'envoyer, pas après.** Une coupure entre la publication
   et l'inscription est le seul scénario qui produise deux réponses identiques
   sous le même commentaire, publiquement, sans moyen de les rattraper. En
   inscrivant d'abord, le pire devient un commentaire resté sans réponse — qui
   se rattrape en retirant sa ligne du journal.
2. **Un fichier qui s'allonge, pas un fichier qu'on réécrit.** Une ligne JSON
   ajoutée à la fin ne peut pas corrompre les précédentes ; une réécriture
   complète interrompue, si.
3. **Le tri vit ici.** Décider ce qu'il reste à traiter, c'est presque
   uniquement décider ce qu'on n'a pas déjà fait. Un module de plus pour ça
   n'apporterait qu'un import.
4. **Le journal sert aussi de compteur du jour.** Le plafond quotidien a besoin
   de savoir ce qui a déjà été fait aujourd'hui, y compris lors d'une exécution
   précédente : cette mémoire-là est déjà sur le disque, inutile d'en tenir une
   seconde.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import date, datetime, timezone
from pathlib import Path

from .facebook import Commentaire


class Journal:
    """Les identifiants des commentaires déjà pris en charge."""

    def __init__(self, chemin: Path):
        self.chemin = chemin
        self.connus: set[str] = set()
        self.dates: list[str] = []
        if chemin.exists():
            for ligne in chemin.read_text(encoding='utf-8').splitlines():
                if not ligne.strip():
                    continue
                try:
                    entree = json.loads(ligne)
                    self.connus.add(entree['id'])
                    self.dates.append(entree.get('quand', ''))
                except (ValueError, KeyError):
                    continue  # une ligne tronquée par une coupure ne condamne pas le reste

    def __contains__(self, id_commentaire: str) -> bool:
        return id_commentaire in self.connus

    def reserver(self, id_commentaire: str, note: str = '') -> None:
        """Marque un commentaire comme pris en charge, avant tout envoi."""
        quand = datetime.now(timezone.utc).isoformat(timespec='seconds')
        self.connus.add(id_commentaire)
        self.dates.append(quand)
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        with self.chemin.open('a', encoding='utf-8') as fichier:
            fichier.write(json.dumps({
                'id': id_commentaire,
                'quand': quand,
                'note': note,
            }, ensure_ascii=False) + '\n')

    def compte_du_jour(self, aujourdhui: date | None = None) -> int:
        """Combien de commentaires ont déjà été pris en charge aujourd'hui.

        En temps universel, comme les dates inscrites : comparer une date locale
        à un horodatage UTC ferait sauter le plafond entre minuit et deux heures
        du matin, précisément la tranche où il compte le plus.
        """
        jour = (aujourdhui or datetime.now(timezone.utc).date()).isoformat()
        return sum(1 for quand in self.dates if quand.startswith(jour))


def retenir(commentaires: Iterable[Commentaire], journal: Journal) -> list[Commentaire]:
    """Les commentaires auxquels il reste quelque chose à faire, du plus ancien au plus récent.

    Du plus ancien au plus récent parce qu'une exécution bornée doit rattraper
    le retard, pas écrémer les nouveautés en laissant le reste vieillir.
    """
    # Aucun filtre sur la longueur : un « 👍 » mérite lui aussi sa réaction.
    # C'est `redaction.rediger` qui décide ensuite s'il y a des mots à écrire.
    a_faire = [
        c for c in commentaires
        if c.id not in journal
        and not c.de_nous
        and not c.deja_repondu
    ]
    return sorted(a_faire, key=lambda c: c.publie_le)
