#!/usr/bin/env python3
"""Journalisation : console lisible et fichier tournant sous `logs/`.

Un bot qui décide seul et n'écrit rien est indéfendable. La question qu'on se
pose trois semaines plus tard n'est jamais « qu'a-t-il acheté » — ça, le relevé
le dit — mais « pourquoi ». D'où la règle : chaque décision est journalisée
avec ses raisons, pas seulement son résultat.

Les secrets ne passent jamais par ici. `Secrets.__repr__` est masqué pour la
même raison, mais un jeton peut aussi arriver dans une URL : d'où le filtre
`_MasquerSecrets`, qui coupe tout ce qui ressemble à un jeton de bot ou à une
clé dans une chaîne de requête.
"""

from __future__ import annotations

import logging
import re
from logging.handlers import RotatingFileHandler
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER_LOGS = RACINE / "logs"

_MOTIFS_SECRETS = (
    re.compile(r"(bot)\d{6,}:[A-Za-z0-9_\-]{20,}"),
    re.compile(r"(?i)(api[-_]?key|secret|token|signature)=[^&\s]+"),
    re.compile(r"(?i)(https://discord\.com/api/webhooks/)\S+"),
)


class _MasquerSecrets(logging.Filter):
    def filter(self, enregistrement: logging.LogRecord) -> bool:
        message = enregistrement.getMessage()
        masque = message
        for motif in _MOTIFS_SECRETS:
            masque = motif.sub(lambda m: f"{m.group(1)}…masqué…", masque)
        if masque != message:
            enregistrement.msg = masque
            enregistrement.args = ()
        return True


def installer(niveau: str = "INFO", *, dossier: Path | None = None, console: bool = True) -> logging.Logger:
    """Installe le journal racine du projet. Idempotent : rappeler cette
    fonction ne double pas les lignes, ce qui arrivait quand chaque module
    l'appelait de son côté."""

    dossier = dossier or DOSSIER_LOGS
    dossier.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("nexus")
    logger.setLevel(getattr(logging, niveau.upper(), logging.INFO))
    logger.propagate = False
    if logger.handlers:
        return logger

    format_fichier = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)-28s | %(message)s"
    )
    fichier = RotatingFileHandler(
        dossier / "nexus.log", maxBytes=2_000_000, backupCount=5, encoding="utf-8"
    )
    fichier.setFormatter(format_fichier)
    fichier.addFilter(_MasquerSecrets())
    logger.addHandler(fichier)

    if console:
        terminal = logging.StreamHandler()
        terminal.setFormatter(logging.Formatter("%(levelname)-8s %(message)s"))
        terminal.addFilter(_MasquerSecrets())
        logger.addHandler(terminal)

    return logger


def obtenir(nom: str) -> logging.Logger:
    """Journal d'un module. Toujours sous « nexus. » pour qu'un seul réglage
    de niveau agisse sur l'ensemble."""

    return logging.getLogger(f"nexus.{nom}")
