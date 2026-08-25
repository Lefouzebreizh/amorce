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
3. **Le tri vit ici.** Décider à quoi répondre, c'est presque uniquement
   décider ce qu'on n'a pas déjà fait — et le reste des critères tient en trois
   lignes. Un module de plus pour ça n'apporterait qu'un import.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path

from .facebook import Commentaire

LONGUEUR_MIN = 3   # « ok », « 👍 » : rien à quoi répondre, et y répondre fait robot


class Journal:
    """Les identifiants des commentaires déjà pris en charge."""

    def __init__(self, chemin: Path):
        self.chemin = chemin
        self.connus: set[str] = set()
        if chemin.exists():
            for ligne in chemin.read_text(encoding='utf-8').splitlines():
                if not ligne.strip():
                    continue
                try:
                    self.connus.add(json.loads(ligne)['id'])
                except (ValueError, KeyError):
                    continue  # une ligne tronquée par une coupure ne condamne pas le reste

    def __contains__(self, id_commentaire: str) -> bool:
        return id_commentaire in self.connus

    def reserver(self, id_commentaire: str, note: str = '') -> None:
        """Marque un commentaire comme pris en charge, avant tout envoi."""
        self.connus.add(id_commentaire)
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        with self.chemin.open('a', encoding='utf-8') as fichier:
            fichier.write(json.dumps({
                'id': id_commentaire,
                'quand': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                'note': note,
            }, ensure_ascii=False) + '\n')


def retenir(commentaires: Iterable[Commentaire], journal: Journal,
            longueur_min: int = LONGUEUR_MIN) -> list[Commentaire]:
    """Les commentaires auxquels il reste quelque chose à faire, du plus ancien au plus récent.

    Du plus ancien au plus récent parce qu'une exécution bornée doit rattraper
    le retard, pas écrémer les nouveautés en laissant le reste vieillir.
    """
    a_faire = [
        c for c in commentaires
        if c.id not in journal
        and not c.de_nous
        and not c.deja_repondu
        and len(c.texte.strip()) >= longueur_min
    ]
    return sorted(a_faire, key=lambda c: c.publie_le)
