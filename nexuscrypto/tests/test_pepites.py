#!/usr/bin/env python3
"""Le scanner de pépites.

Deux choses sont gardées ici. Que les filtres **gratuits** s'appliquent avant
tout appel réseau — c'est ce qui permet de ramener trois cents paires à cinq
sans épuiser le quota d'une API. Et que le journal des rejets existe : un
scanner qui rend une liste vide sans dire pourquoi se règle à l'aveugle, et on
finit par ouvrir les vannes en grand.
"""

import unittest
from datetime import timedelta

from aides import MAINTENANT, config

from src.strategy.pepites import Candidat, noter, scanner


def candidat(**remplacements) -> Candidat:
    defauts = dict(
        symbole="PEP", chaine="solana", adresse="So1111",
        prix_usd=0.0012, liquidite_usd=800_000.0,
        volume_24h_usd=1_200_000.0, volume_moyen_usd=200_000.0,
        capitalisation_usd=12_000_000.0, variation_liquidite_24h=0.35,
        creee_le=MAINTENANT - timedelta(days=30),
    )
    defauts.update(remplacements)
    return Candidat(**defauts)


class TestCandidat(unittest.TestCase):
    def test_croissance_de_volume(self):
        self.assertAlmostEqual(candidat().croissance_volume, 6.0)

    def test_sans_historique_la_croissance_est_nulle(self):
        """Un jeton sans historique n'est pas une pépite, c'est un inconnu —
        et surtout pas une croissance infinie."""

        self.assertEqual(candidat(volume_moyen_usd=0.0).croissance_volume, 0.0)

    def test_age(self):
        self.assertAlmostEqual(candidat().age_heures(MAINTENANT), 720.0)
        self.assertIsNone(candidat(creee_le=None).age_heures(MAINTENANT))


class TestScanner(unittest.TestCase):
    def setUp(self):
        self.config = config().strategie.pepites

    def _scanner(self, *candidats):
        return scanner(list(candidats), self.config, MAINTENANT)

    def test_une_pepite_nominale_passe(self):
        retenues, rejets = self._scanner(candidat())
        self.assertEqual(len(retenues), 1)
        self.assertEqual(rejets, {})
        self.assertGreaterEqual(retenues[0].score, self.config.score_minimum)

    def test_liquidite_insuffisante_rejetee_avec_motif(self):
        _, rejets = self._scanner(candidat(liquidite_usd=1_000.0))
        self.assertIn("liquidité", rejets["PEP"])

    def test_volume_plat_rejete(self):
        _, rejets = self._scanner(candidat(volume_24h_usd=210_000.0))
        self.assertIn("volume", rejets["PEP"])

    def test_paire_trop_jeune_rejetee(self):
        _, rejets = self._scanner(candidat(creee_le=MAINTENANT - timedelta(hours=6)))
        self.assertIn("âgée", rejets["PEP"])

    def test_capitalisation_trop_grosse_rejetee(self):
        _, rejets = self._scanner(candidat(capitalisation_usd=5e9))
        self.assertIn("plus une pépite", rejets["PEP"])

    def test_volume_sans_afflux_de_liquidite_rejete(self):
        """Le croisement des deux sources est ce qui fait le signal : un volume
        qui explose sans liquidité qui monte est un carrousel."""

        _, rejets = self._scanner(candidat(variation_liquidite_24h=-0.10))
        self.assertIn("sans afflux", rejets["PEP"])

    def test_classement_par_note_decroissante(self):
        faible = candidat(symbole="FAIBLE", volume_24h_usd=650_000.0,
                          variation_liquidite_24h=0.16)
        forte = candidat(symbole="FORTE", volume_24h_usd=1_200_000.0,
                         variation_liquidite_24h=0.60)
        retenues, _ = self._scanner(faible, forte)
        self.assertEqual([p.candidat.symbole for p in retenues][0], "FORTE")

    def test_le_nombre_de_candidats_est_plafonne(self):
        candidats = [candidat(symbole=f"P{i}") for i in range(20)]
        retenues, _ = self._scanner(*candidats)
        self.assertLessEqual(len(retenues), self.config.candidats_max)

    def test_le_journal_des_rejets_est_toujours_rempli(self):
        _, rejets = self._scanner(
            candidat(symbole="A", liquidite_usd=10.0),
            candidat(symbole="B", volume_24h_usd=1.0),
        )
        self.assertEqual(set(rejets), {"A", "B"})


class TestNotation(unittest.TestCase):
    def setUp(self):
        self.config = config().strategie.pepites

    def test_la_rotation_disproportionnee_est_penalisee(self):
        """Un million de volume sur cinquante mille de liquidité est un
        carrousel, pas un afflux."""

        saine = noter(candidat(volume_24h_usd=1_200_000.0, liquidite_usd=800_000.0), self.config)
        carrousel = noter(candidat(volume_24h_usd=1_200_000.0, liquidite_usd=60_000.0), self.config)
        self.assertGreater(saine[0], carrousel[0])

    def test_note_bornee(self):
        for volume in (0.0, 1e5, 1e9):
            note, _ = noter(candidat(volume_24h_usd=volume), self.config)
            self.assertTrue(0.0 <= note <= 100.0, volume)

    def test_liquidite_inconnue_reste_neutre(self):
        note, _ = noter(candidat(variation_liquidite_24h=None), self.config)
        self.assertTrue(0.0 <= note <= 100.0)


if __name__ == "__main__":
    unittest.main()
