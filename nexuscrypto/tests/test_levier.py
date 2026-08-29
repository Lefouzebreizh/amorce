#!/usr/bin/env python3
"""La mesure du levier.

Trois tests portent des défauts réels, trouvés en regardant le module tourner
et non en le mesurant. Ils sont les plus importants du fichier, parce qu'aucun
n'aurait été écrit à partir de la spécification :

- `test_le_levier_ne_porte_pas_sur_le_cash_dormant` — la première version
  mesurait le recul du *portefeuille* et déclarait 10x survivant sur un marché
  où l'actif s'effondrait de 37 %. Le bot garde l'essentiel du capital en
  liquide : le portefeuille bouge peu quand l'actif plonge.
- `test_un_rejeu_sans_position_ne_conclut_rien` — sans position, aucune n'est
  liquidée, et le tableau annonçait « levier maximal 10x ». Une conclusion
  rassurante tirée du vide.
- `test_un_echantillon_trop_maigre_est_signale` — deux positions sur une
  semaine calme survivent à n'importe quel levier.
"""

import unittest
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from src.core.modeles import Bougie, SerieOHLCV, Sens  # noqa: F401
from src.rejeu import levier as niveau

DEBUT = datetime(2026, 1, 1, tzinfo=timezone.utc)


@dataclass
class OrdreFactice:
    sens: Sens


@dataclass
class ExecutionFactice:
    """Seuls les champs que le module lit. Fabriquer une vraie `Execution`
    obligerait à un `Ordre` complet, dont rien ici n'observe les autres champs."""

    ordre: OrdreFactice
    prix_execute: float
    quantite_executee: float
    horodatage: datetime
    frais_usd: float = 0.0

    @property
    def montant_usd(self) -> float:
        return self.prix_execute * self.quantite_executee


@dataclass
class ResultatFactice:
    capital_initial: float
    executions: list
    courbe: list


def achat(prix, quantite, heures):
    return ExecutionFactice(OrdreFactice(Sens.ACHAT), prix, quantite, DEBUT + timedelta(hours=heures))


def vente(prix, quantite, heures):
    return ExecutionFactice(OrdreFactice(Sens.VENTE), prix, quantite, DEBUT + timedelta(hours=heures))


def serie(prix_bas: list[float]) -> SerieOHLCV:
    """Une bougie par heure ; seul le plus bas compte pour une liquidation."""

    return SerieOHLCV(
        symbole="TEST/USDT", intervalle="1h",
        bougies=tuple(
            Bougie(horodatage=DEBUT + timedelta(hours=i), ouverture=bas, haut=bas * 1.02,
                   bas=bas, cloture=bas, volume=1.0)
            for i, bas in enumerate(prix_bas)
        ),
    )


class TestSeuil(unittest.TestCase):
    def test_sans_levier_il_n_y_a_pas_de_liquidation(self):
        # Perdre et être liquidé ne sont pas la même chose, et les compter
        # pareil ferait apparaître le comptant aussi risqué que le levier.
        self.assertEqual(niveau.seuil_liquidation(1.0), 1.0)

    def test_le_seuil_est_l_inverse_du_levier_moins_la_maintenance(self):
        self.assertAlmostEqual(niveau.seuil_liquidation(10.0, 0.005), 0.095)
        self.assertAlmostEqual(niveau.seuil_liquidation(2.0, 0.005), 0.495)

    def test_un_levier_extreme_ne_rend_jamais_un_seuil_negatif(self):
        self.assertGreaterEqual(niveau.seuil_liquidation(500.0), 0.0)


class TestPositions(unittest.TestCase):
    def test_l_excursion_se_mesure_sur_le_plus_bas_et_non_la_cloture(self):
        # Une mèche liquide aussi sûrement qu'une clôture, et elle ne laisse
        # aucune trace dans une courbe bâtie sur les clôtures.
        resultat = ResultatFactice(1000.0, [achat(100.0, 1.0, 0)], [])
        lots = niveau.positions(resultat, serie([100.0, 80.0, 100.0]))
        self.assertEqual(len(lots), 1)
        self.assertAlmostEqual(lots[0].excursion, 0.20)

    def test_une_vente_borne_la_detention(self):
        # Ce qui se passe après la sortie ne peut plus liquider la position.
        resultat = ResultatFactice(1000.0, [achat(100.0, 1.0, 0), vente(100.0, 1.0, 1)], [])
        lots = niveau.positions(resultat, serie([100.0, 100.0, 10.0]))
        self.assertAlmostEqual(lots[0].excursion, 0.0)

    def test_les_ventes_soldent_les_achats_les_plus_anciens(self):
        # Premier entré, premier sorti : la détention longue va à l'achat
        # ancien, donc à l'excursion la plus large. Compter plus de
        # liquidations plutôt que moins est le bon sens de l'erreur.
        resultat = ResultatFactice(
            1000.0, [achat(100.0, 1.0, 0), achat(100.0, 1.0, 2), vente(100.0, 1.0, 3)], []
        )
        lots = niveau.positions(resultat, serie([100.0, 70.0, 100.0, 100.0]))
        self.assertEqual(len(lots), 2)
        self.assertAlmostEqual(lots[0].excursion, 0.30)   # ancien : a vu le creux
        self.assertAlmostEqual(lots[1].excursion, 0.0)    # récent : entré après

    def test_un_achat_jamais_revendu_est_tenu_jusqu_au_bout(self):
        resultat = ResultatFactice(1000.0, [achat(100.0, 1.0, 0)], [])
        lots = niveau.positions(resultat, serie([100.0, 100.0, 50.0]))
        self.assertIsNone(lots[0].fermee_le)
        self.assertAlmostEqual(lots[0].excursion, 0.50)


class TestDefautsTrouvesEnRegardant(unittest.TestCase):
    def test_le_levier_ne_porte_pas_sur_le_cash_dormant(self):
        """Le défaut qui a failli être livré.

        Capital 10 000 $, une seule position de 100 $ sur un actif qui perd
        40 %. Le portefeuille ne recule que de 0,4 % — un modèle porté sur le
        portefeuille conclurait que 10x passe. La position, elle, est liquidée.
        """

        resultat = ResultatFactice(
            10_000.0, [achat(100.0, 1.0, 0)],
            [(DEBUT, 10_000.0), (DEBUT + timedelta(hours=1), 9_960.0)],
        )
        verdicts = niveau.analyser(resultat, serie([100.0, 60.0]), (10.0,))
        self.assertEqual(verdicts[0].liquidees, 1)
        self.assertIsNone(niveau.levier_maximal(verdicts))

    def test_un_rejeu_sans_position_ne_conclut_rien(self):
        resultat = ResultatFactice(1000.0, [], [(DEBUT, 1000.0)])
        verdicts = niveau.analyser(resultat, serie([100.0, 100.0]), (1.0, 10.0))
        self.assertTrue(niveau.sans_matiere(verdicts))
        self.assertIsNone(niveau.levier_maximal(verdicts))

        texte = niveau.tableau(verdicts, "vide")
        self.assertIn("ne dit rien du levier", texte)
        # Le mot qui rassurerait à tort ne doit apparaître nulle part.
        self.assertNotIn("Levier maximal sans une seule liquidation", texte)

    def test_un_echantillon_trop_maigre_est_signale(self):
        resultat = ResultatFactice(1000.0, [achat(100.0, 1.0, 0)], [])
        verdicts = niveau.analyser(resultat, serie([100.0, 99.0]), (10.0,))
        self.assertIn("trop peu pour conclure", niveau.tableau(verdicts))

    def test_un_echantillon_suffisant_ne_l_est_pas(self):
        achats = [achat(100.0, 1.0, i) for i in range(niveau.POSITIONS_POUR_CONCLURE)]
        resultat = ResultatFactice(100_000.0, achats, [])
        verdicts = niveau.analyser(
            resultat, serie([100.0] * (niveau.POSITIONS_POUR_CONCLURE + 1)), (10.0,)
        )
        self.assertNotIn("trop peu pour conclure", niveau.tableau(verdicts))


class TestFinancement(unittest.TestCase):
    """Le coût qu'aucun prix ne signale.

    Le financement se paie sur le **notionnel**, donc le levier le multiplie une
    seconde fois. C'est ce qui rend son effet plus brutal qu'il n'en a l'air, et
    ce qui manquait pour que ce module rende une estimation plutôt qu'un
    plancher.
    """

    def test_le_cout_est_proportionnel_au_levier_et_a_la_duree(self):
        # 0,01 % par 8 h, trois mois, x10 → 27 % de la marge. Le chiffre est
        # vérifiable à la main, et c'est pour ça qu'il est écrit ici.
        self.assertAlmostEqual(niveau.part_de_marge_financee(10.0, 2160), 0.27, places=3)
        self.assertAlmostEqual(niveau.part_de_marge_financee(5.0, 2160), 0.135, places=3)
        self.assertAlmostEqual(niveau.part_de_marge_financee(10.0, 720), 0.09, places=3)

    def test_sans_levier_il_n_y_a_pas_de_financement(self):
        self.assertEqual(niveau.part_de_marge_financee(1.0, 100_000), 0.0)

    def test_le_financement_resserre_le_seuil(self):
        nu = niveau.seuil_liquidation(10.0)
        charge = niveau.seuil_liquidation(
            10.0, heures=2160, financement=niveau.FINANCEMENT_PAR_DEFAUT
        )
        self.assertLess(charge, nu)

    def test_une_marge_entierement_financee_liquide_sans_mouvement_de_prix(self):
        # Le cas qui n'est pas d'école : à x10 et taux neutre, il arrive vers
        # onze mois — et un DCA garde ses lignes des mois.
        self.assertGreaterEqual(niveau.part_de_marge_financee(10.0, 8760), 1.0)
        self.assertEqual(
            niveau.seuil_liquidation(10.0, heures=8760,
                                     financement=niveau.FINANCEMENT_PAR_DEFAUT),
            0.0,
        )

    def test_une_position_tenue_longtemps_tombe_sans_que_le_prix_recule(self):
        # Prix strictement plat sur toute la détention : sans financement rien
        # ne se passe, avec financement la position est perdue.
        heures = 9000
        bougies = [100.0] * 40
        resultat = ResultatFactice(100_000.0, [achat(100.0, 1.0, 0)], [])
        serie_longue = SerieOHLCV(
            symbole="TEST/USDT", intervalle="1h",
            bougies=tuple(
                Bougie(horodatage=DEBUT + timedelta(hours=i * heures / len(bougies)),
                       ouverture=p, haut=p, bas=p, cloture=p, volume=1.0)
                for i, p in enumerate(bougies)
            ),
        )
        sans = niveau.analyser(resultat, serie_longue, (10.0,), financement=0.0)
        avec = niveau.analyser(resultat, serie_longue, (10.0,))
        self.assertEqual(sans[0].liquidees, 0)
        self.assertEqual(avec[0].liquidees, 1)
        self.assertEqual(avec[0].tuees_par_le_financement, 1)

    def test_le_tableau_nomme_les_positions_tuees_par_les_frais(self):
        resultat = ResultatFactice(100_000.0, [achat(100.0, 1.0, 0)], [])
        longue = SerieOHLCV(
            symbole="T/U", intervalle="1h",
            bougies=tuple(
                Bougie(horodatage=DEBUT + timedelta(hours=i * 500),
                       ouverture=100.0, haut=100.0, bas=100.0, cloture=100.0, volume=1.0)
                for i in range(30)
            ),
        )
        texte = niveau.tableau(niveau.analyser(resultat, longue, (10.0,)))
        self.assertIn("par le seul financement", texte)

    def test_le_financement_se_desactive_pour_isoler_son_effet(self):
        resultat = ResultatFactice(10_000.0, [achat(100.0, 1.0, 0)], [])
        s = serie([100.0, 95.0])
        self.assertEqual(niveau.analyser(resultat, s, (10.0,), financement=0.0)[0].liquidees, 0)


class TestVerdict(unittest.TestCase):
    def test_un_levier_plus_grand_liquide_au_moins_autant(self):
        # Monotonie : c'est la propriété qui rend le tableau lisible de haut en
        # bas. La casser rendrait tout le reste suspect.
        resultat = ResultatFactice(
            10_000.0, [achat(100.0, 1.0, 0), achat(100.0, 1.0, 1), achat(100.0, 1.0, 2)], []
        )
        verdicts = niveau.analyser(resultat, serie([100.0, 92.0, 85.0, 60.0]), (2.0, 3.0, 5.0, 10.0))
        comptes = [v.liquidees for v in verdicts]
        self.assertEqual(comptes, sorted(comptes))

    def test_le_capital_perdu_ne_compte_que_les_positions_liquidees(self):
        resultat = ResultatFactice(
            10_000.0, [achat(100.0, 2.0, 0), achat(100.0, 1.0, 3)], []
        )
        # Le creux tombe avant le second achat : seule la première est touchée.
        verdicts = niveau.analyser(resultat, serie([100.0, 80.0, 100.0, 100.0]), (10.0,))
        self.assertEqual(verdicts[0].liquidees, 1)
        self.assertAlmostEqual(verdicts[0].montant_liquide, 200.0)

    def test_le_tableau_nomme_la_date_de_la_premiere_liquidation(self):
        resultat = ResultatFactice(10_000.0, [achat(100.0, 1.0, 0)], [])
        verdicts = niveau.analyser(resultat, serie([100.0, 50.0]), (10.0,))
        self.assertIn(DEBUT.strftime("%Y-%m-%d"), niveau.tableau(verdicts))


if __name__ == "__main__":
    unittest.main()
