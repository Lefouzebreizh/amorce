#!/usr/bin/env python3
"""Ce que le banc d'essai doit garantir pour qu'on ait le droit de le croire.

Trois propriétés, et aucune n'est décorative :

1. **Il est reproductible.** Un banc qui rend deux tableaux différents à deux
   exécutions ne peut départager aucun réglage — on lirait la graine, pas la
   note.
2. **Il n'hallucine pas.** Dans un monde où le rendement est décorrélé des
   observables, la note ne doit pas battre le hasard au-delà de la dispersion
   du témoin. C'est le seul verdict du banc qui ne dépende d'aucune hypothèse
   sur la forme du marché, et c'est donc celui qu'il faut garder.
3. **Il dit son angle mort.** La table de couverture existe pour empêcher de
   lire un écart négatif comme « la note ne vaut rien » alors qu'une partie du
   poids porte sur des critères que le marché fabriqué laisse muets. Un banc
   qui perdrait cette réserve rendrait un verdict qui a l'air général et ne
   l'est pas — c'est exactement le défaut que ce banc a lui-même commis à son
   premier jet, et qui est raconté dans son en-tête.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import temoin  # noqa: E402
from core.reglages import charger  # noqa: E402

REGLAGES = charger()
CHAINE = REGLAGES.chaines["base"]


class BancReproductible(unittest.TestCase):
    def test_deux_executions_rendent_les_memes_nombres(self):
        premier = temoin._un_monde(REGLAGES, CHAINE, temoin.PRE_RUPTURE)
        second = temoin._un_monde(REGLAGES, CHAINE, temoin.PRE_RUPTURE)
        self.assertEqual(premier, second)

    def test_les_trois_mondes_partagent_les_memes_observables(self):
        """Seule la ligne du rendement change d'un monde à l'autre.

        Si les populations différaient, comparer les trois n'aurait aucun sens :
        on lirait un effet de tirage. Les filtres voient donc exactement la même
        chose dans « momentum » et dans « pré-rupture ».
        """
        momentum = temoin._un_monde(REGLAGES, CHAINE, temoin.MOMENTUM)
        rupture = temoin._un_monde(REGLAGES, CHAINE, temoin.PRE_RUPTURE)
        self.assertEqual(momentum["survivants"], rupture["survivants"])
        self.assertEqual(momentum["notes"], rupture["notes"])


class BancHonnete(unittest.TestCase):
    def test_la_note_ne_bat_pas_le_hasard_quand_il_n_y_a_rien_a_trouver(self):
        monde = temoin._un_monde(REGLAGES, CHAINE, temoin.BRUIT)
        gain = monde["radar"] - monde["hasard"]
        self.assertLessEqual(
            gain, monde["dispersion"],
            "Dans un monde sans signal, la note bat le hasard au-delà de la "
            "dispersion du témoin : elle lit du bruit.",
        )

    def test_le_temoin_a_une_dispersion_mesuree(self):
        """Un écart sans son bruit de fond ne se lit pas."""
        monde = temoin._un_monde(REGLAGES, CHAINE, temoin.BRUIT)
        self.assertGreater(monde["dispersion"], 0.0)


class BancQuiDitSaLimite(unittest.TestCase):
    def test_la_couverture_nomme_les_criteres_muets(self):
        lignes, aveugle = temoin._couverture(REGLAGES, CHAINE, temoin.PRE_RUPTURE)
        self.assertEqual(len(lignes), len(REGLAGES.convergence.criteres))
        self.assertGreater(
            aveugle, 0.0,
            "Le marché fabriqué prétend donner un sens à tous les critères. "
            "C'est invraisemblable : vérifier que la couverture mesure encore "
            "quelque chose plutôt que de la croire.",
        )
        muets = {nom for nom, _, _, muet in lignes if muet}
        self.assertIn(
            "acceleration", muets,
            "L'accélération est le critère le plus lourd de la note, et ce "
            "marché-ci ne lui donne aucun sens — c'est la réserve principale du "
            "banc. Si elle cesse d'être vraie, l'en-tête du banc est à réécrire.",
        )


if __name__ == "__main__":
    unittest.main()
