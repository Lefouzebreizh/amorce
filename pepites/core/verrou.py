#!/usr/bin/env python3
"""Un seul scan à la fois.

Le radar est fait pour tourner en tâche planifiée toutes les quinze minutes —
c'est écrit dans le README, et c'est ce qui donne son sens à la persistance.
Mais rien n'empêchait la minuterie de lancer un tour pendant que le précédent
courait encore, et un scan lent n'a rien d'exceptionnel : trois cents paires,
des services cadencés à trente requêtes par minute, et trois essais avec recul
exponentiel dès que l'un d'eux hoquette.

**Ce que deux scans simultanés abîment**, vérifié plutôt que supposé :

- **La cadence, qui est le point le plus sûr.** `Debit` compte par processus.
  Deux processus, c'est deux fois le débit annoncé contre GoPlus et RugCheck,
  donc des refus 429 — et ils tombent sur les deux tours, pas sur le second
  seulement. Le premier scan est puni par l'arrivée du deuxième.
- **La base.** `sqlite3.connect` s'en tient au délai d'attente par défaut de
  cinq secondes ; sous contention, une écriture lève « database is locked » et
  fait tomber le tour.
- **L'alerte, dans une fenêtre étroite.** Deux scans peuvent lire « rien
  d'envoyé » avant que l'un des deux n'écrive, et prévenir deux fois du même
  jeton.

**Ce qui n'est *pas* abîmé, et qui le paraissait** : la confirmation. On
pourrait croire qu'un relevé écrit à la seconde par un scan servirait de
« relevé précédent » à l'autre, et confirmerait un candidat sur deux mesures
prises à quelques secondes d'intervalle — ce qui viderait le meilleur filtre
anti-faux-signal de sa substance. `confirmer` s'y oppose déjà : un écart
inférieur à `ecart_min_minutes` est refusé, quelle que soit son origine. Le
noter ici évite qu'on aille le re-vérifier dans six mois.

**Le refus est bruyant, et c'est délibéré.** Un tour sauté en silence
laisserait un radar qui se chevauche en permanence — donc qui ne tourne
jamais vraiment — ressembler à un radar en bonne santé. C'est exactement le
travers que la sonde combat par ailleurs. Code de sortie distinct, message qui
dit depuis combien de temps l'autre tourne : si la ligne revient à chaque
passage, l'intervalle est trop court pour la largeur configurée.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

JOURNAL = logging.getLogger("pepites.verrou")

# `fcntl` n'existe pas sous Windows. Le radar y tournerait sans garde plutôt
# que de refuser de démarrer : sur un poste de travail on lance un scan à la
# main, c'est en tâche planifiée que le chevauchement guette.
try:
    import fcntl
except ImportError:                     # pragma: no cover — non-POSIX
    fcntl = None


class ScanDejaEnCours(RuntimeError):
    """Un autre scan tient le verrou."""


def _depuis(age: float | None) -> str:
    """« depuis 0 min » se lit mal, et c'est le cas le plus fréquent : deux
    passages qui se marchent dessus se croisent à quelques secondes près."""
    if age is None:
        return "depuis un moment"
    if age < 60:
        return f"depuis {age:.0f} s"
    return f"depuis {age / 60:.0f} min"


class Verrou:
    """Verrou de fichier tenu le temps d'un tour.

    Un verrou consultatif du noyau, pas un fichier témoin : ce dernier survit à
    un `kill -9` et à une coupure de courant, et il faudrait alors le supprimer
    à la main — c'est-à-dire précisément le matin où personne ne sait pourquoi
    le radar s'est tu. Un `flock` est relâché par le noyau à la mort du
    processus, quelle qu'en soit la cause.
    """

    def __init__(self, chemin: Path | str) -> None:
        self.chemin = Path(chemin)
        self._descripteur = None

    def __enter__(self) -> "Verrou":
        if fcntl is None:
            JOURNAL.warning(
                "verrouillage indisponible sur cette plateforme : "
                "deux scans simultanés ne seront pas empêchés"
            )
            return self

        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        # Ouvert sans troncature : tronquer effacerait l'horodatage du tenant
        # avant même de savoir si on obtient le verrou.
        self._descripteur = os.open(self.chemin, os.O_RDWR | os.O_CREAT, 0o644)
        try:
            fcntl.flock(self._descripteur, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            age = self._age()
            os.close(self._descripteur)
            self._descripteur = None
            depuis = _depuis(age)
            raise ScanDejaEnCours(
                f"un scan tourne déjà {depuis}. Si cette ligne revient à chaque "
                f"passage, l'intervalle est trop court pour la largeur configurée."
            ) from None

        os.truncate(self._descripteur, 0)
        os.write(self._descripteur, f"{os.getpid()} {time.time():.0f}\n".encode())
        os.fsync(self._descripteur)
        return self

    def __exit__(self, *_) -> None:
        if self._descripteur is None:
            return
        if fcntl is not None:
            fcntl.flock(self._descripteur, fcntl.LOCK_UN)
        os.close(self._descripteur)
        self._descripteur = None

    def _age(self) -> float | None:
        """Depuis combien de secondes le tenant du verrou a démarré.

        Lu dans le fichier plutôt que dans sa date de modification : un
        `mtime` se laisse rafraîchir par n'importe quelle sauvegarde qui
        recopie le dossier, et donnerait un âge faux au moment où il compte.
        """
        try:
            morceaux = self.chemin.read_text(encoding="utf-8").split()
            return max(0.0, time.time() - float(morceaux[1]))
        except (OSError, IndexError, ValueError):
            return None
