#!/usr/bin/env python3
"""Ce que le radar a repéré — et qui n'est toujours pas du patrimoine.

Le radar, lui, écrit vraiment : `donnees/pepites.sqlite3` porte ses relevés et
ses alertes, et `pepites_radar.md` porte son dernier entonnoir. C'est la seule
des deux sources crypto qui ait une mémoire.

**Mais une pépite repérée n'est pas une pépite détenue**, et c'est le piège que
ce fichier existe pour éviter. Le radar signale une anomalie de volume sur un
jeton ; il ne dit pas qu'on en a acheté. Faire entrer ses trouvailles dans le
total du patrimoine gonflerait celui-ci de positions imaginaires. Elles sortent
donc en **notes**, jamais en lignes valorisées.

Trois précautions de lecture, chacune payée par une erreur connue du dépôt :

- **La base s'ouvre en `mode=ro`** par `core.lecture_seule.ouvrir_sqlite`. Le
  radar tient un verrou de fichier pendant un scan ; une lecture concurrente
  peut alors rendre « base occupée ». C'est traité comme « source occupée »,
  jamais comme « aucune pépite » — les deux donneraient le même tableau vide.
- **Une base absente lève** au lieu d'être créée. Sans cela, un chemin mal
  orthographié fabriquerait un fichier vide à côté de la vraie base et le
  conseiller annoncerait paisiblement un radar sans la moindre trouvaille.
- **Le symbole peut manquer** sur les lignes anciennes : il n'est rangé dans
  `releves` que depuis une migration tardive. Une ligne sans nom porte son
  adresse, qui est de toute façon le meilleur identifiant — un symbole se copie
  à l'identique par n'importe qui, une adresse non.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from core.lecture_seule import BaseIntrouvable, ouvrir_sqlite
from core.modeles import Disponibilite, EtatSource
from lecteurs import Lecture

# La fenêtre sur laquelle on résume les alertes. Sept jours : en deçà, un
# week-end calme fait croire à un radar éteint ; au-delà, on résume un mois
# d'humeurs de marché en une phrase qui ne veut plus rien dire.
FENETRE_JOURS = 7

# Au-delà, ce n'est plus un aperçu mais une liste qu'on ne lit pas. Le radar a
# déjà son propre rapport pour le détail.
ALERTES_CITEES = 5


def _horodatage_limite(aujourdhui: datetime) -> str:
    """La borne basse, écrite comme la base l'écrit : ISO 8601 en UTC.

    Les dates sont des chaînes dans SQLite, donc la comparaison est lexicale —
    ce qui marche exactement tant que les deux côtés sont en ISO et en UTC, et
    faux dès qu'un fuseau local s'y glisse.
    """
    return (aujourdhui - timedelta(days=FENETRE_JOURS)).isoformat()


def _resumer(connexion: sqlite3.Connection, aujourdhui: datetime) -> tuple[str, ...]:
    limite = _horodatage_limite(aujourdhui)
    notes: list[str] = []

    dernier = connexion.execute("SELECT MAX(vu_le) FROM releves").fetchone()[0]
    notes.append(
        f"dernier scan du radar : {dernier} (UTC)" if dernier
        else "aucun relevé : le radar n'a jamais tourné sur cette machine"
    )

    recentes = connexion.execute(
        "SELECT symbole, adresse, note, envoyee_le FROM alertes "
        "WHERE envoyee_le >= ? ORDER BY note DESC",
        (limite,),
    ).fetchall()

    if not recentes:
        notes.append(f"aucune alerte sur les {FENETRE_JOURS} derniers jours")
        return tuple(notes)

    notes.append(f"{len(recentes)} alerte(s) sur les {FENETRE_JOURS} derniers jours")
    for symbole, adresse, note, _ in recentes[:ALERTES_CITEES]:
        nom = symbole or adresse
        notes.append(f"  · {nom} — note {note:.0f}/100")
    if len(recentes) > ALERTES_CITEES:
        notes.append(f"  · … et {len(recentes) - ALERTES_CITEES} autre(s)")

    notes.append(
        "ces jetons sont des signalements du radar, pas des positions : rien "
        "de ce bloc n'entre dans le total du patrimoine."
    )
    return tuple(notes)


def lire(racine: Path | None, aujourdhui: datetime | None = None) -> Lecture:
    """Résume l'activité récente du radar. Ne rend jamais de ligne de patrimoine."""
    if racine is None:
        return Lecture(etat=EtatSource(
            nom="pepites",
            disponibilite=Disponibilite.NON_BRANCHEE,
            motif="aucun chemin « sources.pepites » dans la configuration",
        ))

    aujourdhui = aujourdhui or datetime.now(timezone.utc)
    base = racine / "donnees" / "pepites.sqlite3"

    try:
        connexion = ouvrir_sqlite(base)
    except BaseIntrouvable:
        return Lecture(etat=EtatSource(
            nom="pepites",
            disponibilite=Disponibilite.ABSENTE,
            chemin=str(base),
            motif=(
                f"{base} est introuvable — le radar n'a pas encore tourné. "
                "Un premier « python3 main.py scan » depuis pepites/ la crée."
            ),
        ))

    try:
        with connexion:
            notes = _resumer(connexion, aujourdhui)
    except sqlite3.Error as erreur:
        # Base verrouillée par un scan en cours, table absente sur une base d'un
        # autre âge, fichier tronqué : trois causes, un seul geste — ne rien
        # conclure. Le motif porte l'erreur brute, qui les distingue.
        return Lecture(etat=EtatSource(
            nom="pepites",
            disponibilite=Disponibilite.ILLISIBLE,
            chemin=str(base),
            motif=f"base illisible ({erreur}) — scan en cours, ou schéma inattendu",
        ))
    finally:
        connexion.close()

    return Lecture(
        etat=EtatSource(
            nom="pepites",
            disponibilite=Disponibilite.LUE,
            chemin=str(base),
        ),
        notes=notes,
    )
