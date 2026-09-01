#!/usr/bin/env python3
"""Les lecteurs : un par source, aucune décision, aucune écriture.

C'est la séparation héritée du radar (`sources/` ↔ `skills/`), et c'est la seule
qui compte ici : un lecteur connaît la **forme** d'une source — un YAML, une
base SQLite, un journal texte — et rend des objets de `core.modeles`. Il ne
juge rien. Le jour où NexusCrypto change la structure de son fichier de
configuration, on remplace quatre-vingts lignes sans relire une seule ligne de
raisonnement patrimonial.

Deux règles s'appliquent à tout fichier de ce dossier, et elles ne sont pas
négociables :

1. **Aucun import des modules lus.** On lit leurs fichiers, on ne charge pas
   leur code. Importer NexusCrypto ferait entrer son chemin d'ordre dans ce
   processus-ci ; ce qui garantit aujourd'hui qu'aucun ordre ne peut partir
   d'ici, c'est que le code qui sait en passer n'y est jamais chargé.
2. **Aucune écriture, nulle part.** Les bases s'ouvrent par
   `core.lecture_seule.ouvrir_sqlite`, qui passe par une URI `mode=ro`.

`tests/test_lecture_seule.py` relit le source de ce dossier et échoue si l'une
des deux est enfreinte — y compris dans un fichier qui n'existe pas encore.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from core.modeles import EtatSource, Ligne


@dataclass(frozen=True)
class Lecture:
    """Ce que rend un lecteur : un état, éventuellement des lignes, et des notes.

    Les trois sont séparés à dessein. Une source peut répondre sans rien
    apporter au patrimoine — NexusCrypto en est le cas type : il dit une
    intention d'allocation, pas un montant détenu. Fondre ses notes dans des
    lignes valorisées à zéro l'aurait fait entrer dans le total, et un total
    faux est pire qu'une information absente.
    """

    etat: EtatSource
    lignes: tuple[Ligne, ...] = ()
    notes: tuple[str, ...] = field(default=())
