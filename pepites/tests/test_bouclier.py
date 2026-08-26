#!/usr/bin/env python3
"""Le croisement des sources de sécurité, et le jugement qui en découle.

Le test qui porte le fichier est `test_une_absence_de_source_ne_vaut_pas_quitus`.
Sans lui, une panne de GoPlus délivrerait un blanc-seing à tout le marché — et
c'est exactement le jour où l'on se ferait avoir.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.modeles import Constat, Verdict  # noqa: E402
from core.reglages import charger  # noqa: E402
from skills.bouclier import juger  # noqa: E402
from sources.goplus import constat_evm, constat_solana  # noqa: E402
from sources.honeypot_is import constat as constat_honeypot  # noqa: E402
from sources.rugcheck import constat as constat_rugcheck  # noqa: E402

REGLAGES = charger().bouclier

PROPRE = Constat(
    source="GoPlus", honeypot=False, taxe_achat_pct=0.0, taxe_vente_pct=0.0,
    contrat_verifie=True, proprietaire_renonce=True, emission_possible=False,
    echange_pausable=False, lp_verrouillee_pct=98.0, top10_detenteurs_pct=18.0,
)


class TestJugement(unittest.TestCase):
    def test_un_contrat_propre_passe_sans_penalite(self):
        securite = juger([PROPRE], REGLAGES, est_evm=True)
        self.assertIs(securite.verdict, Verdict.SUR)
        self.assertEqual(securite.facteur, 1.0)

    def test_une_absence_de_source_ne_vaut_pas_quitus(self):
        # Ni un rejet — le service peut être en panne — ni un blanc-seing.
        securite = juger([], REGLAGES, est_evm=True)
        self.assertIs(securite.verdict, Verdict.INCONNU)
        self.assertEqual(securite.facteur, REGLAGES.facteur_si_inconnu)
        self.assertLess(securite.facteur, 1.0)

    def test_une_source_qui_ne_sait_rien_dire_vaut_une_absence(self):
        muette = Constat(source="GoPlus")
        self.assertIs(juger([muette], REGLAGES, est_evm=True).verdict, Verdict.INCONNU)

    def test_la_source_la_plus_pessimiste_l_emporte(self):
        # GoPlus lit un contrat propre, honeypot.is n'arrive pas à revendre :
        # c'est qu'on ne peut pas revendre. L'exécution ne ment pas.
        simulation = Constat(source="honeypot.is", honeypot=True)
        securite = juger([PROPRE, simulation], REGLAGES, est_evm=True)
        self.assertIs(securite.verdict, Verdict.REJETE)
        self.assertEqual(securite.facteur, 0.0)

    def test_une_taxe_excessive_est_un_rejet(self):
        taxe = Constat(source="honeypot.is", taxe_vente_pct=35.0)
        self.assertIs(juger([PROPRE, taxe], REGLAGES, est_evm=True).verdict, Verdict.REJETE)

    def test_une_liquidite_non_verrouillee_est_un_rejet(self):
        fragile = Constat(source="GoPlus", honeypot=False, lp_verrouillee_pct=5.0)
        securite = juger([fragile], REGLAGES, est_evm=True)
        self.assertIs(securite.verdict, Verdict.REJETE)
        self.assertIn("verrouillée", securite.rejets[0])

    def test_une_source_genereuse_ne_couvre_pas_une_liquidite_non_verrouillee(self):
        # La part verrouillée est la seule grandeur du bouclier dont une valeur
        # *basse* est le danger : la croiser au maximum laisserait un « 95 % »
        # annuler un « 10 % » et rouvrirait la porte au retrait de liquidité.
        prudente = Constat(source="GoPlus", honeypot=False, lp_verrouillee_pct=10.0)
        genereuse = Constat(source="Autre", honeypot=False, lp_verrouillee_pct=95.0)
        securite = juger([genereuse, prudente], REGLAGES, est_evm=True)
        self.assertIs(securite.verdict, Verdict.REJETE)
        self.assertEqual(securite.lp_verrouillee_pct, 10.0)

    def test_la_concentration_se_croise_bien_dans_l_autre_sens(self):
        # Là, c'est le haut qui inquiète : on retient la source la plus alarmante.
        basse = Constat(source="GoPlus", honeypot=False, top10_detenteurs_pct=12.0)
        haute = Constat(source="Autre", honeypot=False, top10_detenteurs_pct=71.0)
        self.assertIs(juger([basse, haute], REGLAGES, est_evm=True).verdict, Verdict.REJETE)

    def test_dix_porteurs_qui_tiennent_la_moitie_sont_un_rejet(self):
        concentre = Constat(source="GoPlus", honeypot=False, top10_detenteurs_pct=71.0)
        self.assertIs(juger([concentre], REGLAGES, est_evm=True).verdict, Verdict.REJETE)

    def test_une_emission_ouverte_est_un_rejet_sur_solana_et_une_penalite_sur_evm(self):
        # Sur Solana, l'autorité tient à une clé unique, sans gouvernance ni
        # délai. Sur EVM, `is_mintable` est bien trop courant pour éliminer.
        ouvert = Constat(source="GoPlus", honeypot=False, emission_possible=True,
                         lp_verrouillee_pct=90.0)
        self.assertIs(juger([ouvert], REGLAGES, est_evm=False).verdict, Verdict.REJETE)
        sur_evm = juger([ouvert], REGLAGES, est_evm=True)
        self.assertIs(sur_evm.verdict, Verdict.SUSPECT)
        self.assertAlmostEqual(sur_evm.facteur, REGLAGES.penalites["emission_possible"])

    def test_les_penalites_se_multiplient(self):
        bancal = Constat(source="GoPlus", honeypot=False, contrat_verifie=False,
                         proprietaire_renonce=False, lp_verrouillee_pct=90.0)
        attendu = (REGLAGES.penalites["contrat_non_verifie"]
                   * REGLAGES.penalites["proprietaire_non_renonce"])
        securite = juger([bancal], REGLAGES, est_evm=True)
        self.assertAlmostEqual(securite.facteur, attendu)
        self.assertIs(securite.verdict, Verdict.SUSPECT)

    def test_les_sources_consultees_sont_nommees(self):
        # Une ligne « sûr » sans nom de source laisserait croire à une
        # vérification qui n'a peut-être pas eu lieu.
        securite = juger([PROPRE, Constat(source="honeypot.is", honeypot=False)],
                         REGLAGES, est_evm=True)
        self.assertEqual(securite.sources, ("GoPlus", "honeypot.is"))


class TestTraductionGoPlus(unittest.TestCase):
    def test_un_champ_absent_reste_une_absence(self):
        # « Ne sait pas » n'est pas « rien à signaler ».
        constat = constat_evm({})
        self.assertIsNone(constat.honeypot)
        self.assertIsNone(constat.proprietaire_renonce)
        self.assertIsNone(constat.taxe_achat_pct)

    def test_les_taxes_arrivent_en_fraction_de_un(self):
        self.assertAlmostEqual(constat_evm({"buy_tax": "0.05"}).taxe_achat_pct, 5.0)

    def test_une_propriete_reprenable_annule_la_renonciation(self):
        constat = constat_evm({
            "owner_address": "0x0000000000000000000000000000000000000000",
            "can_take_back_ownership": "1",
        })
        self.assertFalse(constat.proprietaire_renonce)

    def test_une_liquidite_brulee_compte_comme_verrouillee(self):
        # Envoyer la liquidité à l'adresse morte est plus solide qu'un contrat
        # de blocage, qui a une date d'expiration.
        constat = constat_evm({"lp_holders": [
            {"address": "0x000000000000000000000000000000000000dEaD", "percent": "0.97"},
        ]})
        self.assertAlmostEqual(constat.lp_verrouillee_pct, 97.0)

    def test_les_pools_et_les_verrous_sortent_du_calcul_de_concentration(self):
        # Sans cette exclusion, tout jeton honnête serait rejeté : le pool
        # détient mécaniquement une grosse part de l'offre.
        constat = constat_evm({"holders": [
            {"address": "0xpool", "percent": "0.60", "tag": "Uniswap V3"},
            {"address": "0xverrou", "percent": "0.20", "is_locked": 1},
            {"address": "0xalice", "percent": "0.07"},
        ]})
        self.assertAlmostEqual(constat.top10_detenteurs_pct, 7.0)

    def test_solana_lit_des_autorites_et_non_des_fonctions(self):
        constat = constat_solana({
            "mintable": {"status": "1"}, "freezable": {"status": "0"},
            "metadata_mutable": {"status": "1"},
        })
        self.assertTrue(constat.emission_possible)
        self.assertFalse(constat.gel_possible)
        self.assertTrue(constat.metadonnees_modifiables)


class TestAutresSources(unittest.TestCase):
    def test_une_simulation_qui_echoue_ne_denonce_personne(self):
        # Le plus souvent, le pool est trop mince pour absorber l'achat
        # d'essai. Le dire serait une fausse accusation.
        self.assertIsNone(constat_honeypot({"simulationSuccess": False}))

    def test_honeypot_is_rend_ses_taxes_deja_en_pourcentage(self):
        constat = constat_honeypot({
            "simulationSuccess": True, "honeypotResult": {"isHoneypot": False},
            "simulationResult": {"buyTax": 3.0, "sellTax": 4.5},
        })
        self.assertEqual(constat.taxe_vente_pct, 4.5)

    def test_rugcheck_traduit_les_intitules_qu_il_reconnait(self):
        constat = constat_rugcheck({"risks": [
            {"name": "Mint Authority still enabled", "level": "danger"},
            {"name": "Un intitulé inédit", "level": "danger"},
        ]})
        self.assertTrue(constat.emission_possible)
        # L'intitulé non reconnu devient une remarque, jamais un verdict.
        self.assertIn("Un intitulé inédit", constat.remarques)


if __name__ == "__main__":
    unittest.main()
