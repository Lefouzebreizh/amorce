"""Un titre avec une apostrophe doit rester gravable.

Le défaut a coûté un rendu entier : « IL S'EST RÉVEILLÉ » faisait échouer
ffmpeg sur « No such filter: '0.25' » — un message qui ne parle pas du texte
mais d'un morceau de l'expression `alpha` écrite cent caractères plus loin.
On ne pouvait pas le deviner, seulement le reproduire.

Le test porte sur la **chaîne produite**, jamais sur un appel à ffmpeg : le
runner d'intégration continue n'a pas le binaire, et un test qui l'exige est
vert en session et rouge chez tout le monde.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from monter_episode import texte_ffmpeg  # noqa: E402


class TitreAvecApostrophe(unittest.TestCase):
    def couches(self, texte: str) -> str:
        return " ".join(texte_ffmpeg(
            {"texte": texte, "debut": 0.25, "fin": 1.9, "taille": 74}, 1040))

    def test_l_apostrophe_ferme_et_rouvre_le_champ(self):
        """`'\\''` est la seule forme que ffmpeg relit comme une apostrophe."""
        rendu = self.couches("IL S'EST RÉVEILLÉ")
        self.assertIn(r"'\''", rendu)

    def test_l_ancienne_forme_a_disparu(self):
        """`\\'` laissait le champ ouvert : tout le reste devenait des options."""
        rendu = self.couches("IL S'EST RÉVEILLÉ")
        self.assertNotIn(r"S\'EST", rendu)

    def test_un_titre_sans_apostrophe_est_intact(self):
        """Le correctif ne doit rien changer au cas courant."""
        rendu = self.couches("AZNAROTH")
        self.assertIn("text='AZNAROTH'", rendu)

    def test_les_deux_points_restent_echappes(self):
        """Ils séparent les options d'un filtre : les laisser casse tout aussi."""
        self.assertIn(r"\:", self.couches("ÉPISODE 01 : LE RÉVEIL"))


if __name__ == "__main__":
    unittest.main()
