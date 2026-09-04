#!/usr/bin/env python3
"""Ce que la porte doit refuser, et ce qu'elle doit laisser passer.

Ces tests portent surtout sur des **refus**, et c'est délibéré : le défaut
qu'on redoute ici n'est pas un modèle qui se trompe de chat, c'est une chaîne
qui trouve une intention à une porte qui claque. Un utilisateur qui voit
« ton chat a faim » sur l'enregistrement d'un aspirateur ne revient pas.

Aucun de ces tests ne charge YAMNet. Ils écrivent les scores à la main — y
compris des combinaisons qu'aucun micro ne produira — parce que c'est le seul
moyen d'éprouver la frontière elle-même plutôt que le modèle qui la nourrit.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from noyau.intentions import Intention, Source, habiller  # noqa: E402
from noyau.verdict import SEUIL_PORTE, juger  # noqa: E402

# Scores relevés sur deux miaulements réels passés dans YAMNet le
# 01/09/2026, et recopiés tels quels. Ce sont eux, et non un raisonnement,
# qui ont fait apparaître le défaut de la classe parente `Cat`.
MIAULEMENT_REEL = {
    "Animal": 0.992, "Cat": 0.988, "Meow": 0.891,
    "Domestic animals, pets": 0.930, "Caterwaul": 0.016,
}


class TestLaPorte(unittest.TestCase):
    """L'étage 1 : un veto, jamais une note qu'un étage suivant rattrape."""

    def test_aucune_fenetre_ne_conclut_pas(self):
        v = juger([])
        self.assertIs(v.intention, Intention.INDECIS)
        self.assertIs(v.source, Source.AUCUNE)
        self.assertFalse(v.affichable)

    def test_un_son_humain_ne_passe_pas(self):
        v = juger([{"Speech": 0.94, "Music": 0.30}])
        self.assertIs(v.source, Source.AUCUNE)
        self.assertEqual(v.classe_dominante, "")
        # Le message dit « aucun son de chat entendu », jamais « ce n'est pas
        # un chat » : sur une vidéo où le chat quémande en silence, la seconde
        # formule est fausse pour la personne qui filme son propre chat.
        self.assertIn("Aucun son de chat", v.raison)
        self.assertNotIn("pas un chat", v.raison)

    def test_un_rugissement_franchit_la_porte_mais_ne_dit_rien(self):
        """`Roaring cats` ouvre la porte depuis le 03/09/2026, et ne choisit pas.

        Ce test disait l'inverse — « un rugissement ne passe pas » — et
        l'exclusion se défendait : elle tenait les documentaires animaliers
        dehors. Le premier vrai chat l'a démentie. Un chat domestique qui
        bâille bruyamment est classé `Roaring cats` à 1,00 pendant quatre
        secondes et demie, avec un cumul félin de **zéro**.

        Le compromis est assumé : perdre un vrai chat coûte plus cher
        qu'admettre un lion. Mais un lion ne reçoit **aucune intention** — la
        classe ouvre la porte et ne porte pas de lecture, comme `Cat`.
        """
        v = juger([{"Roaring cats (lions, tigers)": 0.88, "Animal": 0.6}])
        self.assertTrue(v.affichable, "le son est félin, la porte s'ouvre")
        self.assertIs(v.intention, Intention.INDECIS)
        self.assertIs(v.source, Source.AUCUNE)

    def test_aucune_classe_precise_ne_donne_jamais_contentement(self):
        """Le défaut du zéro, épinglé pour qu'il ne revienne pas.

        Le repli était un `max()` sur les classes spécifiques. Sur des scores
        tous nuls, `max()` rend le **premier** élément du tuple — `Purr` — et
        le verdict sortait « contentement, mesuré, 0 % » sur un son qui ne
        contient aucun ronronnement.

        Il est resté invisible tant que rien ne pouvait franchir la porte sans
        qu'une classe précise réponde. `Roaring cats` a créé ce cas, et le test
        du lion l'a attrapé dans la seconde.
        """
        v = juger([{"Roaring cats (lions, tigers)": 0.90}])
        self.assertNotEqual(v.classe_dominante, "Purr")
        self.assertIsNot(v.intention, Intention.CONTENTEMENT)
        self.assertIs(v.source, Source.AUCUNE)

    def test_juste_sous_le_seuil_refuse(self):
        v = juger([{"Meow": SEUIL_PORTE - 0.01}])
        self.assertIs(v.source, Source.AUCUNE)

    def test_juste_au_seuil_passe(self):
        """La borne est inclusive — et ce test existe pour qu'elle le reste.

        Une comparaison retournée un jour en `<=` ferait basculer toute une
        classe d'enregistrements limites sans qu'aucun autre test ne bouge.
        """
        v = juger([{"Meow": SEUIL_PORTE}])
        self.assertEqual(v.classe_dominante, "Meow")

    def test_le_cumul_des_cinq_classes_ouvre_la_porte(self):
        """Un miaulement se répartit souvent entre `Cat` et `Meow`.

        Aucune des deux ne franchit seule le seuil ; leur somme le doit,
        sinon on refuse exactement les enregistrements les plus ordinaires.
        """
        v = juger([{"Cat": 0.12, "Meow": 0.11}])
        self.assertTrue(v.affichable)

    def test_la_meilleure_fenetre_decide_pas_la_moyenne(self):
        """Trois secondes de silence autour d'un miaulement d'une demi-seconde.

        C'est le cas d'usage normal — quelqu'un appuie sur enregistrer, puis
        attend. Une moyenne sur les fenêtres noierait le seul instant utile.
        """
        v = juger([{"Silence": 0.9}, {"Silence": 0.9}, {"Purr": 0.71}, {"Silence": 0.9}])
        self.assertIs(v.intention, Intention.CONTENTEMENT)


class TestLectureDirecte(unittest.TestCase):
    """L'étage 2 : ce que YAMNet nomme lui-même n'est pas une supposition."""

    def test_ronronnement_donne_contentement_mesure(self):
        v = juger([{"Purr": 0.66}])
        self.assertIs(v.intention, Intention.CONTENTEMENT)
        self.assertIs(v.source, Source.MESUREE)
        self.assertAlmostEqual(v.confiance, 0.66)

    def test_aucune_classe_de_yamnet_ne_porte_le_stress(self):
        """Le 04/09/2026, quarante vrais chats ont retiré le stress mesuré.

        `Hiss` vaut 0,000 sur les quarante. `Caterwaul` s'allume sur
        n'importe quel miaulement — médiane 0,199, soit deux fois le
        plancher — et l'ancienne règle rendait **30 chats sur 40 en
        « stress »**.

        Le stress reste atteignable par la tête acoustique, en `PROVISOIRE`
        et plafonné à 0,5 : annoncé comme une hypothèse, jamais comme une
        mesure. Ce test refuse le retour de la seconde forme.
        """
        for etiquette in ("Hiss", "Caterwaul"):
            with self.subTest(etiquette=etiquette):
                v = juger([{etiquette: 0.51}])
                self.assertIsNot(v.intention, Intention.STRESS)
                self.assertIsNot(v.source, Source.MESUREE)

    def test_cat_ouvre_la_porte_mais_ne_choisit_jamais(self):
        """Le défaut trouvé en regardant, que six tests verts n'avaient pas vu.

        `Cat` est la classe parente et gagne toujours contre la classe
        précise — 0,988 contre 0,891 sur un miaulement réel. S'il concourt,
        un ronronnement franc repart en `INDECIS` : la lecture directe, qui
        est la seule chose que ce projet mesure vraiment, ne se déclenche
        jamais. Et rien ne le signale, parce que le verdict rendu reste
        plausible.
        """
        v = juger([{"Cat": 0.90, "Purr": 0.60, "Animal": 0.95}])
        self.assertEqual(v.classe_dominante, "Purr")
        self.assertIs(v.intention, Intention.CONTENTEMENT)
        self.assertIs(v.source, Source.MESUREE)

    def test_sur_les_scores_reels_le_verdict_est_un_miaulement(self):
        """Le garde-fou de non-régression, sur des chiffres non inventés."""
        v = juger([MIAULEMENT_REEL])
        self.assertEqual(v.classe_dominante, "Meow")
        self.assertTrue(v.affichable)

    def test_la_dominante_se_choisit_parmi_les_felines_seulement(self):
        """`Animal` est vrai et n'apprend rien — il ne doit pas gagner.

        Ce test tient la frontière : YAMNet place souvent `Animal` ou
        `Domestic animals` au-dessus de la classe précise, et retenir le
        maximum global viderait l'étage 2 de son sens.
        """
        v = juger([{"Animal": 0.80, "Domestic animals, pets": 0.75, "Purr": 0.22}])
        self.assertEqual(v.classe_dominante, "Purr")
        self.assertIs(v.intention, Intention.CONTENTEMENT)


class TestMiaulementSansTete(unittest.TestCase):
    """L'étage 2 bis : le refus de conclure est le comportement normal.

    Faim et envie de sortir sont deux façons de miauler qu'aucun modèle public
    ne sépare. Tant que la tête entraînée n'existe pas, `INDECIS` est le seul
    verdict qui ne ment pas — et ces tests sont là pour qu'une session pressée
    ne le remplace pas un jour par un tirage au sort déguisé en score.
    """

    def test_un_miaulement_seul_reste_indecis(self):
        v = juger([{"Meow": 0.62}])
        self.assertIs(v.intention, Intention.INDECIS)
        self.assertIs(v.source, Source.AUCUNE)
        self.assertEqual(v.confiance, 0.0)

    def test_mais_il_reste_affichable(self):
        """Le doute a son écran : on a bien entendu un chat, et on le dit."""
        v = juger([{"Meow": 0.62}])
        self.assertTrue(v.affichable)
        self.assertEqual(v.classe_dominante, "Meow")

    def test_la_couture_de_la_tete_entrainee_est_branchee(self):
        """Le jour où la tête existe, elle doit prendre la main ici.

        On l'éprouve avec une fausse tête plutôt qu'en attendant la vraie :
        une couture jamais traversée est une couture qui ne marche pas.
        """
        v = juger([{"Meow": 0.62}],
                  tete_intention=lambda: (Intention.DEMANDE, 0.73))
        self.assertIs(v.intention, Intention.DEMANDE)
        self.assertIs(v.source, Source.PROVISOIRE)
        self.assertAlmostEqual(v.confiance, 0.73)

    def test_la_tete_ne_court_circuite_jamais_la_porte(self):
        """Même branchée, elle ne voit pas ce que la porte a refusé."""
        v = juger([{"Speech": 0.99}],
                  tete_intention=lambda: (Intention.DEMANDE, 0.99))
        self.assertIs(v.intention, Intention.INDECIS)
        self.assertIs(v.source, Source.AUCUNE)


class TestHabillage(unittest.TestCase):
    def test_chaque_intention_a_son_ecran_indecis_compris(self):
        for intention in Intention:
            with self.subTest(intention=intention):
                p = habiller(intention)
                self.assertTrue(p.titre and p.scene and p.sous_titre)

    def test_le_sous_titre_tient_dans_la_bande_utile(self):
        """Le §2 borne le texte entre 12 et 45 % de la hauteur.

        Sur 1080 de large, cela laisse deux lignes lisibles à 18 px minimum.
        Quarante-cinq caractères par ligne est la limite éprouvée du dépôt ;
        au-delà, le sous-titre passe à trois lignes et sort de la bande.
        """
        for intention in Intention:
            with self.subTest(intention=intention):
                self.assertLessEqual(len(habiller(intention).sous_titre), 90)


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestComportementEpingle(unittest.TestCase):
    """Ce qui n'est pas encore tranché, épinglé pour qu'un changement soit voulu.

    Ces tests ne disent pas « c'est juste ». Ils disent « c'est ce que le code
    fait aujourd'hui ». Le jour où de vrais enregistrements trancheront la
    question ouverte de `verdict.py`, ils échoueront — et c'est exactement leur
    rôle : rendre visible une décision qui, sans eux, se prendrait en silence.
    """

    def test_caterwaul_ne_porte_plus_le_stress(self):
        """Ce test a basculé deux fois, et c'est son histoire qui vaut.

        Écrit le 02/09/2026 pour épingler que `Caterwaul` **devait** l'emporter
        sur `Meow` — décision prise sur quinze sons **fabriqués**, où la classe
        valait 0,000 à 0,031 sur les miaulements ordinaires et 0,199 à 0,738
        sur les sons de détresse. Un écart de six, franc.

        Cet écart n'existe pas dans la réalité. Sur quarante enregistrements de
        chats d'ESC-50, `Caterwaul` a une médiane de **0,199** — la valeur que
        le corpus fabriqué rangeait du côté de la détresse — et dépasse 0,10
        sur **31 chats sur 40**. La classe ne distingue rien : elle suit le
        volume du miaulement.

        Le score ci-dessous est celui d'un vrai feulement, et il ressort
        désormais `indécis`. C'est le prix assumé : aucune classe de YAMNet ne
        porte le stress, et le dire vaut mieux que l'inventer.
        """
        v = juger([{"Cat": 0.980, "Meow": 0.801, "Caterwaul": 0.586}])
        self.assertEqual(v.classe_dominante, "Meow")
        self.assertIs(v.intention, Intention.INDECIS)

    def test_un_miaulement_ordinaire_ne_bascule_pas_en_stress(self):
        """Le symétrique, et c'est lui qui borne le plancher.

        Les trois miaulements ordinaires du corpus portent `Caterwaul` à
        0,000, 0,016 et 0,031 — tous sous `SEUIL_LECTURE`. Un plancher plus
        bas ferait passer un chat qui réclame sa gamelle pour un chat en
        détresse, ce qui est le pire des deux sens : l'application inquiéterait
        quelqu'un sans raison.
        """
        v = juger([{"Cat": 0.996, "Meow": 0.891, "Caterwaul": 0.031}])
        self.assertEqual(v.classe_dominante, "Meow")
        self.assertIs(v.intention, Intention.INDECIS)

    def test_hiss_est_une_classe_muette(self):
        """Mesuré deux fois, et la seconde a été décisive.

        0,000 sur les trois feulements du corpus fabriqué, puis **0,000 sur
        les quarante chats d'ESC-50**. Une classe qui n'a jamais répondu sur
        aucun chat, réel ou fabriqué, n'est pas une classe en attente : c'est
        une classe morte.

        Elle a donc été retirée des porteuses. Ce test grave le fait pour
        qu'une session qui cherche pourquoi le stress n'arrive pas ne parte
        pas fouiller la porte — la porte va bien, c'est le modèle qui ne sait
        pas.
        """
        v = juger([{"Cat": 0.60, "Hiss": 0.51}])
        self.assertIs(v.intention, Intention.INDECIS)
        self.assertEqual(v.classe_dominante, "Meow")

    def test_un_ronronnement_faible_franchit_quand_meme_la_porte(self):
        """Mesuré : cumul 0,262 sur un vrai ronronnement, seuil à 0,20.

        La marge est de six centièmes. C'est ce qui justifie un seuil aussi
        bas, et c'est aussi ce qui interdit de le relever sans mesurer : un
        ronronnement est le son félin le plus discret que YAMNet connaisse.
        """
        v = juger([{"Cat": 0.109, "Purr": 0.148}])
        self.assertIs(v.intention, Intention.CONTENTEMENT)
        self.assertIs(v.source, Source.MESUREE)
