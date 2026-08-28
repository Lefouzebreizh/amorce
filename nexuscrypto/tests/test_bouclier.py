#!/usr/bin/env python3
"""Le bouclier anti-rugpull.

Un garde-fou dont on ne peut pas fabriquer les conditions de déclenchement en
production ne s'éprouve que sur des réponses rejouées. C'est tout ce fichier.

Deux tests portent des défauts réels, trouvés en regardant plutôt qu'en
mesurant, et aucun n'aurait été écrit depuis la spécification :

- `test_sans_adresse_le_bouclier_ne_s_applique_pas` — la première version
  rendait `INCONNU` faute d'adresse, donc refusait l'achat. Or les lignes du
  socle n'ont pas de contrat : LINK/USDT se serait vu interdire à chaque passe.
- `test_une_source_muette_ne_vaut_pas_un_quitus` — le piège inverse, et le plus
  courant : un service qui ne répond pas doit rendre `None`, jamais un constat
  vide qui se lirait comme « rien à signaler ».
"""

import asyncio
import sys
import unittest
from pathlib import Path

# **L'ordre alphabétique décide si la suite passe depuis la racine du dépôt**,
# et ce fichier est le premier. Sans cette ligne, `import src` résout vers le
# `src/` d'Amorce à la racine — un paquet-espace-de-noms implicite, donc aucune
# erreur — puis se fige dans `sys.modules` ; `aides.py` corrige ensuite le
# chemin pour rien, et les seize modules suivants échouent sur « No module
# named 'src.core' ». Vert dans `nexuscrypto/`, rouge depuis la racine.
RACINE = Path(__file__).resolve().parents[1]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

from src.core.config import ConfigBouclier  # noqa: E402
from src.data_engine import securite as sources  # noqa: E402
from src.strategy.bouclier import (  # noqa: E402
    Constat, Securite, Verdict, achat_autorise, juger,
)

CONFIG = ConfigBouclier()


class FetcherFactice:
    """Rend une réponse par fragment d'URL. Absent = le service ne répond pas,
    ce qui doit donner « inconnu » et non « sûr »."""

    def __init__(self, reponses=None, lever=False, lent=False):
        self.reponses = reponses or {}
        self.lever = lever
        self.lent = lent
        self.appels = []

    async def json(self, url, *, params=None, entetes=None, corps=None):
        self.appels.append(url)
        if self.lever:
            raise RuntimeError("service injoignable")
        if self.lent:
            await asyncio.sleep(5)
        for motif, reponse in self.reponses.items():
            if motif in url:
                return reponse
        return None

    async def texte(self, url, **_):
        return ""


class TestJugement(unittest.TestCase):
    def test_sans_constat_le_verdict_est_inconnu(self):
        self.assertIs(juger([], CONFIG, est_evm=True).verdict, Verdict.INCONNU)

    def test_une_revente_qui_echoue_rejette(self):
        verdict = juger([Constat("honeypot.is", honeypot=True)], CONFIG, est_evm=True)
        self.assertIs(verdict.verdict, Verdict.REJETE)
        self.assertIn("revente", verdict.rejets[0])

    def test_une_source_alarmee_l_emporte_sur_une_source_rassurante(self):
        # Sur un contrat, un seul avis négatif suffit : une lecture statique
        # propre ne rachète pas une simulation de revente qui échoue.
        verdict = juger(
            [Constat("GoPlus", honeypot=False), Constat("honeypot.is", honeypot=True)],
            CONFIG, est_evm=True,
        )
        self.assertIs(verdict.verdict, Verdict.REJETE)

    def test_une_taxe_de_vente_excessive_rejette(self):
        verdict = juger([Constat("GoPlus", taxe_vente_pct=45.0)], CONFIG, est_evm=True)
        self.assertIs(verdict.verdict, Verdict.REJETE)

    def test_une_liquidite_peu_verrouillee_rejette(self):
        verdict = juger([Constat("GoPlus", lp_verrouillee_pct=12.0)], CONFIG, est_evm=True)
        self.assertIs(verdict.verdict, Verdict.REJETE)

    def test_l_emission_ouverte_ne_rejette_que_hors_evm(self):
        # `is_mintable` est trop répandu sur EVM pour éliminer ; sur Solana
        # l'autorité est tenue par une clé unique, sans gouvernance ni délai.
        constats = [Constat("GoPlus", emission_possible=True)]
        self.assertIs(juger(constats, CONFIG, est_evm=True).verdict, Verdict.SUR)
        self.assertIs(juger(constats, CONFIG, est_evm=False).verdict, Verdict.REJETE)

    def test_un_contrat_propre_passe(self):
        verdict = juger(
            [Constat("GoPlus", honeypot=False, taxe_achat_pct=1.0, taxe_vente_pct=1.0,
                     lp_verrouillee_pct=95.0, top10_detenteurs_pct=22.0)],
            CONFIG, est_evm=True,
        )
        self.assertIs(verdict.verdict, Verdict.SUR)
        self.assertEqual(verdict.rejets, ())

    def test_un_champ_absent_ne_vaut_pas_faux(self):
        # `None` veut dire « je ne sais pas ». Le confondre avec `False`
        # transformerait une ignorance en quitus.
        self.assertIs(juger([Constat("GoPlus")], CONFIG, est_evm=True).verdict, Verdict.SUR)


class TestPolitique(unittest.TestCase):
    def test_un_rejet_interdit_l_achat(self):
        autorise, motif = achat_autorise(
            Securite(Verdict.REJETE, ("taxe à la vente de 45 %",)), CONFIG
        )
        self.assertFalse(autorise)
        self.assertIn("45", motif)

    def test_inconnu_interdit_l_achat_par_defaut(self):
        autorise, motif = achat_autorise(Securite(Verdict.INCONNU), CONFIG)
        self.assertFalse(autorise)
        self.assertIn("prudence", motif)

    def test_inconnu_peut_etre_autorise_en_le_sachant(self):
        permissif = ConfigBouclier(acheter_si_inconnu=True)
        autorise, motif = achat_autorise(Securite(Verdict.INCONNU), permissif)
        self.assertTrue(autorise)
        self.assertIn("configuration", motif)

    def test_sur_autorise(self):
        autorise, _ = achat_autorise(Securite(Verdict.SUR, sources=("GoPlus",)), CONFIG)
        self.assertTrue(autorise)


class TestSources(unittest.TestCase):
    def test_une_source_muette_ne_vaut_pas_un_quitus(self):
        constats = asyncio.run(sources.constats(FetcherFactice(), "ethereum", "0xABC"))
        self.assertEqual(constats, [])
        self.assertIs(juger(constats, CONFIG, est_evm=True).verdict, Verdict.INCONNU)

    def test_une_source_qui_leve_ne_fait_pas_tomber_les_autres(self):
        constats = asyncio.run(sources.constats(FetcherFactice(lever=True), "bsc", "0xABC"))
        self.assertEqual(constats, [])

    def test_goplus_evm_se_traduit(self):
        fetcher = FetcherFactice({"token_security": {"result": {"0xabc": {
            "is_honeypot": "1", "buy_tax": "0.03", "sell_tax": "0.99",
            "is_mintable": "0", "transfer_pausable": "0",
        }}}})
        constat = asyncio.run(sources.goplus(fetcher, "ethereum", "0xABC"))
        self.assertTrue(constat.honeypot)
        self.assertAlmostEqual(constat.taxe_achat_pct, 3.0)
        self.assertAlmostEqual(constat.taxe_vente_pct, 99.0)

    def test_honeypot_is_ne_couvre_que_trois_chaines(self):
        fetcher = FetcherFactice({"honeypot": {"honeypotResult": {"isHoneypot": True}}})
        self.assertIsNone(asyncio.run(sources.honeypot_is(fetcher, "polygon", "0xABC")))
        self.assertIsNotNone(asyncio.run(sources.honeypot_is(fetcher, "base", "0xABC")))

    def test_une_simulation_impossible_est_dite_et_non_tue(self):
        fetcher = FetcherFactice({"honeypot": {
            "simulationSuccess": False, "honeypotResult": {},
        }})
        constat = asyncio.run(sources.honeypot_is(fetcher, "ethereum", "0xABC"))
        self.assertIsNone(constat.honeypot)
        self.assertIn("simulation d'achat/revente impossible", constat.remarques)

    def test_rugcheck_ne_repond_que_sur_solana(self):
        fetcher = FetcherFactice({"rugcheck": {"risks": [{"name": "Mint authority enabled"}]}})
        self.assertIsNone(asyncio.run(sources.rugcheck(fetcher, "ethereum", "So111")))
        constat = asyncio.run(sources.rugcheck(fetcher, "solana", "So111"))
        self.assertTrue(constat.emission_possible)

    def test_un_service_lent_ne_bloque_pas_le_chemin_d_achat(self):
        # Une pépite se décide en secondes : le délai est un plafond, et le
        # bouclier tranche sur ce qu'il a plutôt que d'attendre.
        constats = asyncio.run(
            sources.constats(FetcherFactice(lent=True), "ethereum", "0xABC", delai_s=0.05)
        )
        self.assertEqual(constats, [])

    def test_une_chaine_inconnue_part_vers_le_point_solana(self):
        # Le `else` de `est_evm` est traité comme « Solana » partout dans ce
        # projet ; le bouclier ne fait pas exception, et une chaîne absente de
        # la table rend `INCONNU`, donc refuse l'achat.
        self.assertFalse(sources.est_evm("sui"))


class TestDefautTrouveEnRegardant(unittest.TestCase):
    def test_sans_adresse_le_bouclier_ne_s_applique_pas(self):
        """Le défaut qui aurait bloqué tous les achats.

        `LigneAllocation` ne porte ni chaîne ni adresse pour un actif établi
        acheté sur une plateforme centralisée. La première version en tirait un
        `INCONNU`, donc un refus : LINK/USDT se serait vu interdire à chaque
        passe, et le journal aurait accusé les sources de sécurité.
        """

        from src.core.config import LigneAllocation

        ligne = LigneAllocation(symbole="LINK/USDT", poids=5, role="pepite")
        self.assertIsNone(ligne.adresse)
        self.assertIsNone(ligne.chaine)

    def test_une_ligne_peut_desormais_designer_un_contrat(self):
        from src.core.config import LigneAllocation

        ligne = LigneAllocation(symbole="PEP/SOL", poids=2, role="pepite",
                                chaine="solana", adresse="So111")
        self.assertEqual(ligne.chaine, "solana")


if __name__ == "__main__":
    unittest.main()
