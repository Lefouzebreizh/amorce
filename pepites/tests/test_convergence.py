#!/usr/bin/env python3
"""Ce que la note doit dire, et surtout ce qu'elle doit refuser de dire.

Le test qui porte tout le fichier est `test_un_volume_demesure_note_moins_bien`.
C'est la raison d'être des trapèzes : si la note montait avec l'extrême, l'outil
alerterait sur les manipulations plutôt que sur les accumulations.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import MAINTENANT, candidat  # noqa: E402
from core.modeles import Releve  # noqa: E402
from core.reglages import charger  # noqa: E402
from skills.convergence import confirmer, mesurer, noter, observer  # noqa: E402

REGLAGES = charger()
CONVERGENCE = REGLAGES.convergence
SEUIL = REGLAGES.bouclier.note_minimale_pour_analyser


def releve(note=70.0, **remplacements) -> Releve:
    defauts = dict(
        chaine="base", adresse="0xpepite", vu_le=MAINTENANT - timedelta(minutes=15),
        liquidite_usd=120_000, market_cap=1_500_000, volume_h1=60_000,
        volume_h24=650_000, prix_usd=0.0011, note=note, acceleration=2.2,
    )
    defauts.update(remplacements)
    return Releve(**defauts)


class TestMesures(unittest.TestCase):
    def test_l_acceleration_compare_l_heure_au_rythme_moyen(self):
        # 90 000 $ en 1 h contre 700 000 $ sur 24 h : l'heure fait environ trois
        # fois le rythme moyen de la journée.
        m = mesurer(candidat())
        self.assertAlmostEqual(m.acceleration, 90_000 * 24 / 700_000, places=6)

    def test_un_volume_nul_sur_24h_ne_fait_pas_tomber_le_scan(self):
        # Un jeton qui vient de se réveiller doit être mal noté, pas lever une
        # division par zéro au milieu de neuf cents candidats.
        m = mesurer(candidat(volume_h24=0, volume_h1=0, achats_h1=0, ventes_h1=0))
        self.assertEqual(m.acceleration, 0.0)
        self.assertEqual(m.taille_moyenne, 0.0)
        self.assertEqual(m.desequilibre, 0.0)


class TestNote(unittest.TestCase):
    def test_un_candidat_sain_passe_le_seuil_d_analyse(self):
        note = noter(candidat(), mesurer(candidat()), CONVERGENCE)
        self.assertGreaterEqual(note.total, SEUIL)
        self.assertEqual(note.drapeaux, ())

    def test_un_volume_demesure_note_moins_bien_qu_un_volume_normal(self):
        # Le cœur du choix des trapèzes. Un volume horaire à quatre fois la
        # capitalisation est un sommet en train de se faire, pas une
        # accumulation : il doit noter *moins* qu'une hausse mesurée.
        sain = candidat()
        demesure = candidat(volume_h1=6_000_000, volume_h24=7_000_000, variation_h1=90.0)
        note_saine = noter(sain, mesurer(sain), CONVERGENCE).total
        note_demesuree = noter(demesure, mesurer(demesure), CONVERGENCE).total
        self.assertGreater(note_saine, note_demesuree)

    def test_le_detail_de_la_note_est_rendu_critere_par_critere(self):
        # « 74/100 » ne dit rien ; « 74, dont 22 d'accélération et 0 de
        # profondeur » dit qu'il faut regarder le pool avant d'acheter.
        note = noter(candidat(), mesurer(candidat()), CONVERGENCE)
        self.assertEqual(set(note.detail), {c.nom for c in CONVERGENCE.criteres})
        self.assertAlmostEqual(sum(note.detail.values()), note.total)

    def test_des_ventes_quasi_absentes_levent_le_drapeau_du_piege(self):
        piege = candidat(achats_h1=300, ventes_h1=2)
        note = noter(piege, mesurer(piege), CONVERGENCE)
        self.assertTrue(note.drapeaux)
        self.assertFalse(note.retenu)

    def test_un_ticket_minuscule_repete_leve_le_drapeau_du_robot(self):
        # Sans ce drapeau, ce profil note 88/100 : le critère « ticket moyen »
        # ne pèse que 7 points et ne peut pas écarter un robot de volume.
        robot = candidat(volume_h1=90_000, achats_h1=6000, ventes_h1=5900)
        note = noter(robot, mesurer(robot), CONVERGENCE)
        self.assertTrue(any("robot" in d for d in note.drapeaux), note.drapeaux)
        self.assertFalse(note.retenu)

    def test_un_marche_trop_symetrique_leve_le_drapeau_du_lavage(self):
        # Achats et ventes à moins de 3 % l'un de l'autre, avec une rotation de
        # 15 : un marché réel n'est jamais aussi régulier.
        lave = candidat(achats_h1=500, ventes_h1=501, liquidite_usd=60_000,
                        volume_h24=900_000)
        note = noter(lave, mesurer(lave), CONVERGENCE)
        self.assertTrue(any("lavé" in d for d in note.drapeaux))


class TestConfirmation(unittest.TestCase):
    def test_un_premier_releve_n_est_jamais_confirme(self):
        confirme, raison = confirmer(candidat(), 80.0, None, CONVERGENCE.persistance, SEUIL)
        self.assertFalse(confirme)
        self.assertIn("premier relevé", raison)

    def test_un_releve_precedent_trop_recent_ne_confirme_pas(self):
        # Deux relevés à trois minutes d'écart, c'est le même instant vu deux
        # fois : ça ne prouve aucune persistance.
        recent = releve(vu_le=MAINTENANT - timedelta(minutes=3))
        confirme, raison = confirmer(candidat(), 80.0, recent, CONVERGENCE.persistance, SEUIL)
        self.assertFalse(confirme)
        self.assertIn("trop récent", raison)

    def test_une_liquidite_en_recul_disqualifie_malgre_le_volume(self):
        # Ce n'est pas une accumulation : c'est quelqu'un qui vide le pool.
        avant = releve(liquidite_usd=200_000)
        confirme, raison = confirmer(candidat(), 85.0, avant, CONVERGENCE.persistance, SEUIL)
        self.assertFalse(confirme)
        self.assertIn("recul", raison)

    def test_un_pic_isole_ne_confirme_pas(self):
        efface = releve(note=12.0)
        confirme, raison = confirmer(candidat(), 85.0, efface, CONVERGENCE.persistance, SEUIL)
        self.assertFalse(confirme)
        self.assertIn("isolé", raison)

    def test_deux_releves_soutenus_confirment(self):
        confirme, raison = confirmer(candidat(), 85.0, releve(), CONVERGENCE.persistance, SEUIL)
        self.assertTrue(confirme)
        self.assertIn("confirmé", raison)

    def test_un_candidat_drapeaute_n_interroge_pas_la_memoire(self):
        # Inutile de vérifier la persistance d'un signal déjà éliminé sur la
        # forme de ses données.
        piege = candidat(achats_h1=300, ventes_h1=1)
        observation = observer(piege, CONVERGENCE, releve(), SEUIL)
        self.assertFalse(observation.confirme)
        self.assertIn("ventes", observation.raison_confirmation)


if __name__ == "__main__":
    unittest.main()
