#!/usr/bin/env python3
"""La tête acoustique, et surtout ce qu'elle refuse de dire.

Le référentiel de hauteur et de durée vient d'une source de vulgarisation, pas
d'une publication. Ces tests ne vérifient donc pas qu'il a raison — personne
ici ne peut le savoir. Ils vérifient qu'il est appliqué **là où il s'applique**,
et que le premier vrai enregistrement, sur lequel il se trompait, ne peut plus
produire son verdict faux.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from noyau.intentions import Intention, Source  # noqa: E402
from noyau.tete import (  # noqa: E402
    CORRESPONDANCE, MESURES_MINIMUM, TypeMiaulement, classer, lire, tete_pour,
)
from noyau.traits import (  # noqa: E402
    FRONTIERE_AIGU, FRONTIERE_LONG, Traits, hauteur_bloc, traits_vocalisation,
)
from noyau.verdict import juger  # noqa: E402


class TestHauteur(unittest.TestCase):
    def test_un_sinus_connu_se_retrouve(self):
        import math
        sr, n = 16_000, 3_200
        for cible in (220.0, 440.0, 880.0):
            with self.subTest(cible=cible):
                bloc = [math.sin(2 * math.pi * cible * i / sr) for i in range(n)]
                f0, confiance = hauteur_bloc(bloc)
                self.assertIsNotNone(f0)
                self.assertLess(abs(f0 - cible) / cible, 0.05)
                self.assertGreater(confiance, 0.9)

    def test_le_silence_ne_rend_pas_de_hauteur(self):
        self.assertEqual(hauteur_bloc([0.0] * 3_200), (None, 0.0))

    def test_un_echec_rend_None_et_non_la_borne(self):
        """Le piège mesuré le 03/09 : une autocorrélation qui échoue se colle
        à `fmax` et rend un nombre parfaitement plausible.

        On lui donne du bruit blanc, qui n'a aucune périodicité : le module
        doit dire qu'il ne sait pas, jamais rendre 1400 Hz.
        """
        import random
        random.seed(1)
        bruit = [random.gauss(0, 1) for _ in range(3_200)]
        f0, _ = hauteur_bloc(bruit)
        if f0 is not None:
            self.assertLess(f0, 1_399.0, "une valeur à la borne est un échec déguisé")


class TestFenetrage(unittest.TestCase):
    """La règle qui tient tout le module : on ne mesure que le félin."""

    def test_les_fenetres_non_felines_sont_ignorees(self):
        """Sinon on mesure la bande-son.

        Mesuré : sur une vidéo portant un accordéon, l'autocorrélation rendait
        300 à 500 Hz avec 0,8 de confiance pendant cinq secondes.
        """
        import math
        sr = 16_000
        # 3 fenêtres : un 800 Hz félin, puis deux 200 Hz non félins.
        ech = ([math.sin(2 * math.pi * 800 * i / sr) for i in range(15_600)]
               + [math.sin(2 * math.pi * 200 * i / sr) for i in range(15_600)])
        t = traits_vocalisation(ech, [True, False, False], 15_600, 7_800)
        self.assertIsNotNone(t.hauteur)
        self.assertGreater(t.hauteur, 600, "la hauteur non féline a contaminé la mesure")

    def test_la_duree_est_la_plus_longue_suite_continue(self):
        """Deux miaulements séparés ne font pas une vocalisation longue."""
        t = traits_vocalisation([0.0] * 100_000,
                                [True, False, False, False, True], 15_600, 7_800)
        court = traits_vocalisation([0.0] * 100_000, [True], 15_600, 7_800)
        self.assertAlmostEqual(t.duree, court.duree, places=3)


class TestClassement(unittest.TestCase):
    def test_les_trois_types_du_referentiel(self):
        aigu, grave = FRONTIERE_AIGU + 100, FRONTIERE_AIGU - 100
        long_, court = FRONTIERE_LONG + 0.3, FRONTIERE_LONG - 0.3
        self.assertIs(classer(Traits(aigu, long_, 5)), TypeMiaulement.REQUETE)
        self.assertIs(classer(Traits(aigu, court, 5)), TypeMiaulement.SALUTATION)
        self.assertIs(classer(Traits(grave, long_, 5)), TypeMiaulement.ALERTE)
        self.assertIs(classer(Traits(grave, court, 5)), TypeMiaulement.ALERTE)

    def test_une_hauteur_absente_ne_devient_jamais_un_grave(self):
        """`None` n'est pas zéro.

        Un appelant qui traiterait l'absence de mesure comme une hauteur nulle
        fabriquerait une alerte à partir d'un ronronnement, dont la
        fondamentale est simplement hors de portée.
        """
        self.assertIs(classer(Traits(None, 2.0, 0)), TypeMiaulement.INDETERMINE)
        self.assertIs(lire(Traits(None, 2.0, 0)).intention, Intention.INDECIS)

    def test_trop_peu_de_fenetres_ne_conclut_pas(self):
        self.assertIs(classer(Traits(500.0, 1.0, MESURES_MINIMUM - 1)),
                      TypeMiaulement.INDETERMINE)


class TestCeQuOnRefuseDeDire(unittest.TestCase):
    """Les deux refus, et ils valent plus que les trois classements."""

    def test_requete_ne_choisit_pas_entre_faim_et_sortir(self):
        """Le référentiel range faim, soif, litière et « veut sortir » sous le
        **même** type. Les séparer serait inventer.
        """
        self.assertIs(CORRESPONDANCE[TypeMiaulement.REQUETE], Intention.INDECIS)
        for interdite in (Intention.FAIM, Intention.SORTIR):
            self.assertNotIn(interdite, CORRESPONDANCE.values())

    def test_le_grave_se_lit_en_stress_jamais_en_douleur(self):
        """Le référentiel dit « douleur, consulter un vétérinaire ».

        Le dépôt a déjà tranché contre ce genre de verdict — voir
        `archives-backlog/ou-a-mal-mon-animal.md`. Le grave se lit en `STRESS`,
        ce que l'application sait dire, et rien de plus. Ce test existe pour
        qu'une session ne « complète » pas la correspondance un jour.
        """
        self.assertIs(CORRESPONDANCE[TypeMiaulement.ALERTE], Intention.STRESS)
        self.assertEqual(set(CORRESPONDANCE.values()),
                         {Intention.INDECIS, Intention.CONTENTEMENT, Intention.STRESS})

    def test_la_confiance_reste_plafonnee(self):
        """0,5 au plus : les deux frontières sont des hypothèses déclarées."""
        for t in (Traits(500.0, 1.0, 5), Traits(200.0, 1.0, 5), Traits(500.0, 0.3, 5)):
            self.assertLessEqual(lire(t).confiance, 0.5)


class TestBranchementSurLaCouture(unittest.TestCase):
    def test_la_tete_ne_voit_que_les_miaulements(self):
        """`Purr`, `Hiss` et `Caterwaul` sont lus en direct et ne l'atteignent
        jamais — c'est ce qui a évité le « détresse » sur un chat qui ronronne.
        """
        tete = tete_pour(Traits(150.0, 7.8, 7))      # grave et long : alerte
        v = juger([{"Cat": 0.996, "Purr": 0.996}], tete_intention=tete)
        self.assertIs(v.intention, Intention.CONTENTEMENT,
                      "la lecture directe doit primer sur la tête")
        self.assertIs(v.source, Source.MESUREE)

    def test_sur_un_miaulement_la_tete_prend_la_main(self):
        tete = tete_pour(Traits(520.0, 0.4, 5))      # aigu et court : salutation
        v = juger([{"Cat": 0.9, "Meow": 0.8}], tete_intention=tete)
        self.assertIs(v.intention, Intention.CONTENTEMENT)
        self.assertIs(v.source, Source.PROVISOIRE)


if __name__ == "__main__":
    unittest.main(verbosity=2)
