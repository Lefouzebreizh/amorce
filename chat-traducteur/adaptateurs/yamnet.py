"""YAMNet en TFLite — le seul endroit du projet qui charge un modèle.

Ce que le fichier de poids contient vraiment, relevé le 01/09/2026 et non
supposé : 4 126 810 octets, entrée `[15600] float32`, sortie `[1, 521]
float32`, et **les 521 étiquettes embarquées dans le fichier lui-même**. Un
`.tflite` porteur de métadonnées est aussi une archive ZIP : `yamnet.tflite`
s'ouvre avec `zipfile` et rend `yamnet_label_list.txt`.

Cela évite d'aller chercher ailleurs un CSV d'étiquettes — et surtout d'en
télécharger un qui ne serait pas dans le même ordre que les sorties du modèle,
défaut qui décale tout sans rien casser.
"""

import zipfile
from pathlib import Path

CHEMIN_DEFAUT = Path(__file__).resolve().parents[1] / "modeles" / "yamnet.tflite"


class ModeleAbsent(Exception):
    """Les poids ne sont pas là — message avec la commande qui les amène."""


class Yamnet:
    """Un classifieur de sons généraux, chargé une fois et réutilisé.

    Instancier l'interpréteur coûte bien plus cher qu'une inférence : mesuré
    ici, **1,9 ms par fenêtre de 0,975 s** une fois chargé, soit environ 500
    fois le temps réel sur un cœur de serveur. Le recréer à chaque appel
    ferait passer un enregistrement de trois secondes de dix millisecondes à
    plusieurs centaines.
    """

    def __init__(self, chemin: str | Path = CHEMIN_DEFAUT):
        chemin = Path(chemin)
        if not chemin.exists():
            raise ModeleAbsent(
                f"Poids absents ({chemin}). Les récupérer par :\n"
                "    python3 chat-traducteur/scripts/telecharger_modeles.py"
            )
        # Importés ici et non en tête de fichier : le `noyau/` doit rester
        # importable sur une machine où ni numpy ni le moteur TFLite ne sont
        # installés, et un test qui n'y touche pas ne doit pas les exiger.
        import numpy as np
        from ai_edge_litert.interpreter import Interpreter

        self._np = np
        self.etiquettes = (
            zipfile.ZipFile(chemin).read("yamnet_label_list.txt").decode().splitlines()
        )
        self._interprete = Interpreter(model_path=str(chemin))
        self._interprete.allocate_tensors()
        self._entree = self._interprete.get_input_details()[0]
        self._sortie = self._interprete.get_output_details()[0]

    def scorer(self, fenetre: list[float]) -> dict[str, float]:
        """Rend `étiquette -> score` pour une fenêtre de 15 600 échantillons."""
        if len(fenetre) != 15_600:
            raise ValueError(
                f"YAMNet attend exactement 15 600 échantillons, reçu {len(fenetre)}. "
                "Passer par `adaptateurs.audio.fenetrer`."
            )
        x = self._np.array(fenetre, dtype=self._np.float32)
        self._interprete.set_tensor(self._entree["index"], x)
        self._interprete.invoke()
        scores = self._interprete.get_tensor(self._sortie["index"])[0]
        return dict(zip(self.etiquettes, (float(v) for v in scores)))

    def scorer_toutes(self, fenetres: list[list[float]]) -> list[dict[str, float]]:
        """Le format qu'attend `noyau.verdict.juger` : une entrée par fenêtre."""
        return [self.scorer(f) for f in fenetres]
