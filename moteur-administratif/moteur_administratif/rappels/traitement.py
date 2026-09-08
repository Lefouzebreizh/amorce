"""Écrit le fichier `.ics` sur disque. Impur : seul point d'entrée-sortie de la brique."""

from __future__ import annotations

from datetime import date, time
from pathlib import Path

from . import regles
from .modele import Rappel


def ecrire_ics(rappels: list[Rappel], destination: str | Path, le: date | None = None,
                heure: time = time(8, 0), rappels_jours_avant: tuple[int, ...] = (30, 7, 1),
                produit: str = regles.PRODUIT_PAR_DEFAUT) -> Path:
    """Compose et écrit le fichier de rappels. Rend le chemin écrit.

    `newline=""` : les fins de ligne CRLF sont déjà dans le contenu composé par
    `regles.composer_ics` ; les laisser retraduire par Python donnerait des
    CRCRLF sous Windows, que certains agendas refusent en bloc.
    """
    le = le or date.today()
    contenu = regles.composer_ics(rappels, le, heure, rappels_jours_avant, produit)
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8", newline="") as fichier:
        fichier.write(contenu)
    return destination
