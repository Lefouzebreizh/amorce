#!/usr/bin/env python3
"""Les indicateurs, vérifiés contre des valeurs connues.

Le piège de cette famille n'est pas la formule, c'est **l'alignement**. Un
décalage d'un cran entre l'EMA et le RSI ne lève jamais : il déplace simplement
tous les signaux d'une bougie, et on s'en aperçoit trois mois plus tard sur une
courbe de performance qu'on n'arrive pas à reproduire. D'où les tests
d'alignement, qui sont les plus importants du fichier.
"""

import unittest

from aides import serie

from src.core.modeles import Bougie
from src.strategy import indicateurs as ind
from aides import MAINTENANT
from datetime import timedelta


class TestMoyennes(unittest.TestCase):
    def test_sma_valeurs_connues(self):
        self.assertEqual(ind.sma([1, 2, 3, 4, 5], 3), [None, None, 2.0, 3.0, 4.0])

    def test_series_alignees_a_droite(self):
        """Toutes les séries rendent autant d'éléments que d'entrées, et le
        dernier correspond à la dernière bougie."""

        valeurs = list(range(50))
        for sortie in (ind.sma(valeurs, 10), ind.ema(valeurs, 10), ind.rsi(valeurs, 14)):
            self.assertEqual(len(sortie), len(valeurs))
            self.assertIsNotNone(sortie[-1])

    def test_ema_amorcee_par_une_sma(self):
        """L'amorçage décide de la moitié du signal sur une série de 300
        bougies : une EMA 200 amorcée sur la première valeur mettrait deux
        cents bougies à converger."""

        valeurs = [10.0] * 30
        sortie = ind.ema(valeurs, 10)
        self.assertIsNone(sortie[8])
        self.assertAlmostEqual(sortie[9], 10.0)

    def test_ema_trop_courte_rend_des_none(self):
        self.assertEqual(ind.ema([1, 2, 3], 10), [None, None, None])

    def test_periode_nulle_leve(self):
        with self.assertRaises(ValueError):
            ind.ema([1, 2, 3], 0)


class TestRSI(unittest.TestCase):
    def test_hausse_continue_donne_cent(self):
        self.assertAlmostEqual(ind.rsi(list(range(1, 40)), 14)[-1], 100.0)

    def test_baisse_continue_donne_zero(self):
        self.assertAlmostEqual(ind.rsi(list(range(40, 1, -1)), 14)[-1], 0.0)

    def test_serie_plate_donne_cinquante(self):
        """Ni gain ni perte : le rapport est indéterminé, et 50 est la seule
        réponse honnête. Rendre 100 ferait passer un marché mort pour une
        surchauffe."""

        self.assertAlmostEqual(ind.rsi([10.0] * 40, 14)[-1], 50.0)

    def test_serie_trop_courte(self):
        self.assertTrue(all(v is None for v in ind.rsi([1, 2, 3], 14)))


class TestATR(unittest.TestCase):
    def test_amplitude_constante(self):
        """Sur des bougies d'amplitude constante et sans écart de clôture,
        l'ATR vaut cette amplitude."""

        bougies = tuple(
            Bougie(MAINTENANT - timedelta(hours=4 * (39 - i)), 100, 102, 98, 100, 10)
            for i in range(40)
        )
        self.assertAlmostEqual(ind.atr(bougies, 14)[-1], 4.0, places=6)


class TestProfilVolume(unittest.TestCase):
    def test_poc_sur_la_tranche_la_plus_chargee(self):
        bougies = []
        for i in range(40):
            # Vingt bougies serrées autour de 100, vingt autour de 130 avec
            # dix fois moins de volume : le POC doit tomber près de 100.
            prix, volume = (100.0, 1000.0) if i < 20 else (130.0, 100.0)
            bougies.append(
                Bougie(MAINTENANT - timedelta(hours=4 * (39 - i)),
                       prix, prix + 0.5, prix - 0.5, prix, volume)
            )
        profil = ind.profil_volume(tuple(bougies), tranches=24)
        self.assertLess(abs(profil.poc - 100.0), 3.0)
        self.assertLess(profil.zone_valeur_basse, 100.0)

    def test_position_hors_zone(self):
        bougies = tuple(
            Bougie(MAINTENANT - timedelta(hours=4 * (29 - i)), 100, 101, 99, 100, 10)
            for i in range(30)
        )
        profil = ind.profil_volume(bougies)
        self.assertLess(profil.position(90.0), 0.0)
        self.assertGreater(profil.position(110.0), 1.0)

    def test_serie_plate_sans_amplitude(self):
        """Haut égal au bas partout : aucun profil calculable, `None` plutôt
        qu'une division par zéro."""

        bougies = tuple(
            Bougie(MAINTENANT - timedelta(hours=4 * (9 - i)), 100, 100, 100, 100, 10)
            for i in range(10)
        )
        self.assertIsNone(ind.profil_volume(bougies))


class TestCoteZVolume(unittest.TestCase):
    def test_pic_de_volume_detecte(self):
        volumes = [100.0] * 20 + [100.0]
        self.assertIsNone(ind.cote_z_volume(volumes, 20))  # écart-type nul
        volumes = [100.0 + (i % 3) for i in range(20)] + [1000.0]
        self.assertGreater(ind.cote_z_volume(volumes, 20), 10.0)

    def test_la_moyenne_exclut_la_derniere_bougie(self):
        """Sinon un pic de volume abaisse sa propre cote et se cache lui-même."""

        volumes = [10.0, 12.0, 11.0, 9.0, 10.0, 11.0, 10.0, 9.0, 12.0, 10.0, 1000.0]
        cote = ind.cote_z_volume(volumes, 10)
        self.assertGreater(cote, 100.0)


class TestCoteZEcartEMA(unittest.TestCase):
    """L'écart à l'EMA rapporté à sa propre distribution.

    C'est la réponse au défaut mesuré sur seize ans de BTC réel : en tendance,
    le prix vit durablement au-delà de +30 % de son EMA 200, et une note à
    seuils absolus reste collée à zéro toute la période.
    """

    def test_une_tendance_reguliere_n_est_pas_une_surchauffe(self):
        """L'écart brut d'une hausse régulière dépasse largement le seuil
        absolu, alors qu'il est parfaitement ordinaire pour ce régime."""

        lecture = ind.lire(serie(nombre=400, pente=0.5))
        ecart_brut = (lecture.prix - lecture.ema_longue) / lecture.ema_longue
        self.assertGreater(ecart_brut, 0.15)
        # En absolu ce serait une note très basse ; en relatif, le prix est en
        # dessous de son habituel pour ce marché-là.
        self.assertLess(lecture.cote_z_ecart_ema, 0.0)

    def test_serie_plate_sans_dispersion(self):
        """Écart-type nul : `None` plutôt qu'une division par zéro, et le
        scoring redistribue au lieu d'inventer une note."""

        self.assertIsNone(ind.lire(serie(nombre=400)).cote_z_ecart_ema)

    def test_fenetre_trop_courte(self):
        """En deçà du minimum, la distribution décrit le bruit et la note
        sauterait d'une bougie à l'autre."""

        self.assertIsNone(
            ind.cote_z_ecart_ema([100.0] * 10, [99.0] * 10)
        )

    def test_un_prix_inhabituellement_haut_pour_son_regime(self):
        clotures = [100.0 + (i % 5) for i in range(200)] + [400.0]
        ema_serie = [100.0] * 201
        self.assertGreater(ind.cote_z_ecart_ema(clotures, ema_serie), 3.0)


class TestLecture(unittest.TestCase):
    def test_lecture_complete(self):
        lecture = ind.lire(serie(nombre=260, pente=0.1, amplitude=5.0))
        for champ in ("rsi", "ema_courte", "ema_moyenne", "ema_longue", "atr", "profil"):
            self.assertIsNotNone(getattr(lecture, champ), champ)

    def test_serie_courte_laisse_des_none_sans_lever(self):
        """Une série de 30 bougies ne permet pas d'EMA 200. Le scoring lit ces
        `None` et redistribue — il ne les remplace pas par une valeur neutre,
        qui serait un signal inventé."""

        lecture = ind.lire(serie(nombre=30))
        self.assertIsNone(lecture.ema_longue)
        self.assertIsNone(lecture.sous_ema_longue)
        self.assertIsNone(lecture.tendance_haussiere)

    def test_tendance_haussiere(self):
        lecture = ind.lire(serie(nombre=260, pente=0.5))
        self.assertTrue(lecture.tendance_haussiere)
        self.assertFalse(lecture.sous_ema_longue)

    def test_tendance_baissiere(self):
        lecture = ind.lire(serie(nombre=260, depart=300.0, pente=-0.5))
        self.assertFalse(lecture.tendance_haussiere)
        self.assertTrue(lecture.sous_ema_longue)


if __name__ == "__main__":
    unittest.main()
