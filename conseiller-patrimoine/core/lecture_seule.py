#!/usr/bin/env python3
"""Le garde-fou. Ce module est la raison d'être du conseiller.

Ce conseiller lit l'argent de quelqu'un. Il ne doit **jamais** pouvoir le
déplacer — ni aujourd'hui, ni le jour où quelqu'un branchera une banque en
quatrième vitesse un dimanche soir. Une promesse écrite dans un README ne
protège de rien : elle se lit une fois et s'oublie. Ce fichier la remplace par
trois mécanismes qui *cassent* quand on les franchit.

**1. Une seule porte vers l'environnement.** `variable()` est le seul endroit du
paquet qui lit `os.environ`, et il refuse tout nom qui ne finit pas par
`_LECTURE_SEULE`. Le suffixe n'est pas décoratif : il oblige celui qui crée la
variable à écrire lui-même, dans son fichier de service, qu'il fournit un accès
en lecture. On ne peut pas le taper distraitement.

Pourquoi une porte plutôt qu'un balayage de tout l'environnement : un balayage
qui refuse `*SECRET*` tomberait sur le premier `NEXTAUTH_SECRET` venu et
empêcherait l'outil de démarrer pour une raison sans rapport. Un garde-fou qui
crie à tort finit désactivé, et c'est alors qu'il ne protège plus rien.

**2. Un second filet derrière le premier.** Même suffixée correctement, une
variable dont le nom parle de négoce, de retrait ou de clé privée est refusée.
Le suffixe dit l'intention ; ces motifs-ci disent ce que la chose *est*. Le jour
où quelqu'un exporte `BINANCE_API_SECRET_LECTURE_SEULE` en croyant bien faire,
c'est ici que ça s'arrête.

**3. SQLite ouvert en lecture seule par le moteur.** `ouvrir_sqlite()` passe par
une URI `mode=ro`. Ce n'est pas une convention d'appel qu'on peut contourner par
distraction : le moteur lui-même refuse l'écriture, et une base absente lève
plutôt que d'être créée vide — ce qui, sur la mémoire du radar, ferait passer
« le fichier n'est pas là » pour « le radar n'a rien trouvé ».

Un quatrième verrou vit ailleurs, dans `tests/test_lecture_seule.py` : il relit
le source du paquet et échoue s'il y trouve un client HTTP, un SDK de plateforme
d'échange, ou un accès à `os.environ` hors de ce fichier. C'est le seul qui
couvre le code qui n'est pas encore écrit.
"""

from __future__ import annotations

import os
import re
import sqlite3
from pathlib import Path

# Le suffixe qu'une variable d'environnement doit porter pour que ce paquet
# accepte seulement de la lire. Écrit en toutes lettres et en français : c'est
# une déclaration d'intention de la part de celui qui crée la variable.
SUFFIXE_REQUIS = "_LECTURE_SEULE"

# Ce qu'aucun nom ne peut contenir, suffixe ou pas. Chaque motif désigne un
# pouvoir d'écriture sur de l'argent, jamais un pouvoir de lecture.
MOTIFS_INTERDITS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)\bsecret\b|_SECRET|SECRET_"),
    re.compile(r"(?i)private_?key"),
    re.compile(r"(?i)trad(e|ing)"),
    re.compile(r"(?i)withdraw|retrait"),
    re.compile(r"(?i)\border\b|passer_?ordre"),
    re.compile(r"(?i)binance|bybit|kraken|coinbase|kucoin|okx|hyperliquid"),
    re.compile(r"(?i)mnemonic|seed_?phrase|passphrase"),
)

# Les modules qu'aucun fichier de ce paquet ne doit importer. `sqlite3` est
# évidemment autorisé — il est lu en `mode=ro` ; ce sont les sorties vers le
# réseau et les SDK de plateformes d'échange qui sont bannis.
MODULES_INTERDITS: tuple[str, ...] = (
    "requests",
    "aiohttp",
    "httpx",
    "urllib.request",
    "urllib3",
    "http.client",
    "socket",
    "ccxt",
    "yfinance",
    "websocket",
    "websockets",
)


class AccesRefuse(Exception):
    """Un accès qui sortirait de la lecture seule. Levée avant tout usage,
    jamais après : le but est que la chose n'ait pas lieu, pas qu'on l'apprenne
    dans un journal."""


class BaseIntrouvable(Exception):
    """La base existe dans la configuration et pas sur le disque.

    Distincte d'`AccesRefuse` parce que le geste n'est pas le même : ici il n'y
    a rien de fautif, seulement une source qui n'a jamais tourné.
    """


def variable(nom: str, *, defaut: str | None = None) -> str | None:
    """La seule lecture d'`os.environ` autorisée dans ce paquet.

    Refuse tout nom sans le suffixe, et tout nom qui désigne un pouvoir
    d'écriture. Le message d'erreur nomme la règle enfreinte : un garde-fou dont
    on ne comprend pas le refus se contourne au lieu de se respecter.
    """
    if not nom.endswith(SUFFIXE_REQUIS):
        raise AccesRefuse(
            f"« {nom} » n'est pas lisible ici : ce module ne lit que des variables "
            f"suffixées « {SUFFIXE_REQUIS} ». Renommez-la si, et seulement si, "
            "l'accès qu'elle porte est bien en lecture seule."
        )
    for motif in MOTIFS_INTERDITS:
        if motif.search(nom):
            raise AccesRefuse(
                f"« {nom} » est refusée malgré son suffixe : son nom désigne un "
                "droit d'écriture ou de négoce. Le conseiller ne prend aucun "
                "accès qui puisse déplacer de l'argent, même déclaré en lecture."
            )
    return os.environ.get(nom, defaut)


def ouvrir_sqlite(chemin: Path) -> sqlite3.Connection:
    """Ouvre une base **du disque de quelqu'un d'autre** en lecture seule.

    Deux garanties, et elles comptent autant l'une que l'autre :

    - `mode=ro` fait refuser l'écriture par le moteur, pas par nous ;
    - une base absente lève `BaseIntrouvable` au lieu d'être créée vide. Sans
      cela, une faute de frappe dans un chemin fabriquerait un fichier de zéro
      octet à côté de la vraie base, et le conseiller annoncerait sereinement
      un radar sans la moindre pépite.
    """
    if not chemin.exists():
        raise BaseIntrouvable(f"{chemin} est introuvable.")
    return sqlite3.connect(f"file:{chemin}?mode=ro", uri=True)
