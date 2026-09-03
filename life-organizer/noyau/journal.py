"""Trace des opérations, et mise en œuvre du mode simulation.

Le mode simulation (README, décision 3) n'est pas un `if` posé dans chaque
module : c'est le journal qui l'incarne. Un module déclare ce qu'il fait, le
journal l'écrit — et ne laisse agir que si l'on a demandé d'appliquer.
Éparpiller la condition dans les six modules garantirait qu'un jour l'un d'eux
l'oublie, et qu'il déplacerait deux mille fichiers pendant qu'on croyait
regarder.

D'où la forme de `prevoir` : elle rend un booléen, et le geste vit dans le `if`.
Un module ne peut donc pas agir sans être passé par le journal, et ce qui
apparaît à l'écran est exactement ce qui a été fait — ou aurait été fait.

Le fichier de trace n'est écrit qu'en mode réel. Une simulation qui laisse un
fichier derrière elle n'est plus une simulation.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from .fichiers import creer_dossier_prive, ouvrir_prive


class Journal:
    """Ce qu'une commande a fait, ou aurait fait."""

    def __init__(self, dossier: Path | None, simulation: bool) -> None:
        self.dossier = Path(dossier).expanduser() if dossier else None
        self.simulation = simulation
        self.actions: list[str] = []
        self.incidents: list[str] = []

    def prevoir(self, action: str) -> bool:
        """Consigne une action et dit s'il faut l'exécuter."""
        self.actions.append(action)
        if not self.simulation:
            self._ecrire(action)
        return not self.simulation

    def incident(self, chemin: Path, raison: str) -> None:
        """Un fichier enjambé. Consigné, jamais fatal (voir `fichiers.parcourir`)."""
        message = f"{chemin} : {raison}"
        self.incidents.append(message)
        if not self.simulation:
            self._ecrire(f"ignoré — {message}")

    def resume(self) -> str:
        verbe = "seraient effectuées" if self.simulation else "effectuées"
        texte = f"{len(self.actions)} action(s) {verbe}"
        if self.incidents:
            texte += f", {len(self.incidents)} fichier(s) ignoré(s)"
        return texte

    def _ecrire(self, ligne: str) -> None:
        if not self.dossier:
            return
        try:
            # Même raison que la quarantaine : le journal nomme les fichiers
            # traités, donc il cartographie l'arborescence personnelle même pour
            # qui ne lirait aucun document.
            creer_dossier_prive(self.dossier)
            fichier = self.dossier / f"{date.today().isoformat()}.log"
            with ouvrir_prive(fichier, encoding="utf-8") as trace:
                trace.write(f"{datetime.now().isoformat(timespec='seconds')} {ligne}\n")
        except OSError as erreur:
            # Ne pas pouvoir écrire la trace n'est pas une raison d'abandonner le
            # travail en cours : on le dit une fois et on continue.
            if self.dossier is not None:
                print(f"Journal indisponible ({erreur.strerror}) : {self.dossier}")
                self.dossier = None
