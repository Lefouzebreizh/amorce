#!/usr/bin/env python3
"""Le tuyau complet, sans réseau : radar → convergence → mémoire → rapport.

Le test central est `test_le_meme_signal_se_confirme_au_second_scan`. C'est la
promesse de tout l'outil — un pic isolé est du bruit, le même signal deux
relevés de suite est un mouvement — et c'est la seule chose qu'aucun test
unitaire ne peut vérifier pièce par pièce : elle naît de l'enchaînement.

Le client factice rejoue la forme réelle des réponses DexScreener. Il compte
aussi ses appels, ce qui permet de vérifier que la mémoire évite de redécouvrir
par hasard un jeton qu'on suit déjà.
"""

import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import MAINTENANT, WETH  # noqa: E402

import pipeline  # noqa: E402
import rapport  # noqa: E402
from core.reglages import charger  # noqa: E402
from core.stockage import Memoire  # noqa: E402
from core.modeles import Verdict  # noqa: E402
from sources import dexscreener, goplus  # noqa: E402


def securite_propre(adresse="0xPepite"):
    """Réponse GoPlus d'un contrat sans reproche, dans sa forme réelle."""
    return {"code": 1, "result": {adresse: {
        "is_honeypot": "0", "buy_tax": "0", "sell_tax": "0", "is_open_source": "1",
        "owner_address": "0x0000000000000000000000000000000000000000",
        "is_mintable": "0", "transfer_pausable": "0",
        "lp_holders": [{"address": "0x000000000000000000000000000000000000dEaD",
                        "percent": "0.97"}],
        "holders": [{"address": "0xalice", "percent": "0.06"}],
    }}}

REGLAGES = charger()


def brut(symbole="PEP", adresse="0xPepite", chaine="base", volume_h1=90_000,
         volume_h24=700_000, liquidite=120_000, market_cap=1_500_000,
         variation_h1=6.0, achats_h1=190, ventes_h1=120, age_heures=240.0,
         pool="0xPool"):
    cree = (MAINTENANT - timedelta(hours=age_heures)).timestamp() * 1000
    return {
        "chainId": chaine, "dexId": "aerodrome", "pairAddress": pool,
        "baseToken": {"address": adresse, "name": symbole, "symbol": symbole},
        "quoteToken": {"address": WETH, "symbol": "WETH"},
        "priceUsd": "0.0012",
        "txns": {"h1": {"buys": achats_h1, "sells": ventes_h1},
                 "h24": {"buys": 2400, "sells": 2100}},
        "volume": {"h1": volume_h1, "h6": volume_h1 * 3.5, "h24": volume_h24},
        "priceChange": {"h1": variation_h1, "h6": 11.0, "h24": 18.0},
        "liquidity": {"usd": liquidite},
        "fdv": market_cap, "marketCap": market_cap,
        "pairCreatedAt": int(cree),
    }


class ClientFactice:
    """Rejoue des réponses DexScreener sans toucher au réseau."""

    def __init__(self, paires: list[dict], invisibles: tuple[str, ...] = (),
                 securite: dict | None = None):
        self.paires = paires
        # url du service de sécurité → réponse. Absent = le service ne répond
        # pas, ce qui doit donner « inconnu » et non « sûr ».
        self.securite = securite or {}
        # Pools présents sur la chaîne mais absents de la recherche : la
        # réponse de `search` est plafonnée, et un jeton peut en sortir sans
        # que rien ne lui soit arrivé.
        self.invisibles = set(invisibles)
        self.appels = 0
        self.urls: list[str] = []

    def json(self, cle, url, params=None, entetes=None):
        self.appels += 1
        self.urls.append(url)
        if url == dexscreener.RECHERCHE:
            # La recherche ne rend que les paires cotées dans le jeton demandé.
            return {"pairs": [p for p in self.paires
                              if p["quoteToken"]["address"] == params["q"]
                              and p["pairAddress"] not in self.invisibles]}
        if url.startswith(goplus.BASE):
            return self.securite.get("goplus")
        if url.startswith(f"{dexscreener.BASE}/token-pairs/"):
            # Comparaison insensible à la casse : les adresses EVM ressortent
            # de la mémoire en minuscules, et DexScreener les accepte ainsi.
            # Sur Solana, la casse est conservée de bout en bout.
            adresse = url.rsplit("/", 1)[-1].lower()
            return [p for p in self.paires
                    if p["baseToken"]["address"].lower() == adresse]
        return []                       # profils et mises en avant : vides ici


class MessagerFactice:
    """Enregistre au lieu d'envoyer. `configure` vrai : c'est le chemin réel
    qu'on veut éprouver, pas la branche « Telegram absent »."""

    configure = True

    def __init__(self):
        self.envoyes: list[str] = []

    def envoyer(self, texte: str) -> bool:
        self.envoyes.append(texte)
        return True


class TestTuyau(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.memoire = Memoire(Path(self.dossier.name) / "essai.sqlite3")

    def tearDown(self):
        self.memoire.fermer()
        self.dossier.cleanup()

    def scan(self, paires, moment, invisibles=(), securite=None):
        client = ClientFactice(paires, invisibles, securite)
        self.messager = MessagerFactice()
        return pipeline.scanner(
            REGLAGES, self.memoire, client, moment, self.messager
        ), client

    def test_un_candidat_sain_est_note_mais_pas_confirme_au_premier_scan(self):
        resultat, _ = self.scan([brut()], MAINTENANT)
        self.assertEqual(len(resultat.observations), 1)
        observation = resultat.observations[0]
        self.assertGreaterEqual(observation.note.total, 55)
        self.assertFalse(observation.confirme)
        self.assertIn("premier relevé", observation.raison_confirmation)

    def test_le_meme_signal_se_confirme_au_second_scan(self):
        self.scan([brut()], MAINTENANT)
        resultat, _ = self.scan([brut()], MAINTENANT + timedelta(minutes=15))
        observation = resultat.observations[0]
        self.assertTrue(observation.confirme, observation.raison_confirmation)
        self.assertIn("confirmé", observation.raison_confirmation)

    def test_un_signal_dont_la_liquidite_fond_ne_se_confirme_pas(self):
        # Volume qui accélère, pool qui se vide : c'est une distribution.
        self.scan([brut()], MAINTENANT)
        resultat, _ = self.scan(
            [brut(liquidite=70_000, volume_h1=140_000)],
            MAINTENANT + timedelta(minutes=15),
        )
        self.assertFalse(resultat.observations[0].confirme)
        self.assertIn("recul", resultat.observations[0].raison_confirmation)

    def test_un_jeton_deja_suivi_est_re_releve_meme_s_il_sort_de_la_recherche(self):
        # La découverte de DexScreener est irrégulière : sans la mémoire, un
        # jeton pourrait quitter un tour sans que rien ne lui soit arrivé, donc
        # ne jamais être confirmé.
        self.scan([brut()], MAINTENANT)
        resultat, client = self.scan(
            [brut()], MAINTENANT + timedelta(minutes=15), invisibles=("0xPool",)
        )
        self.assertTrue(any("token-pairs" in url for url in client.urls))
        self.assertEqual(len(resultat.observations), 1)
        self.assertTrue(resultat.observations[0].confirme)

    def test_un_contrat_propre_traverse_les_cinq_etages(self):
        propre = {"goplus": securite_propre()}
        self.scan([brut()], MAINTENANT, securite=propre)
        resultat, _ = self.scan([brut()], MAINTENANT + timedelta(minutes=15),
                                securite=propre)
        self.assertEqual(len(resultat.retenues), 1)
        pepite = resultat.retenues[0]
        self.assertIs(pepite.securite.verdict, Verdict.SUR)
        self.assertAlmostEqual(pepite.note_finale, pepite.note.total)

    def test_une_pepite_verifiee_declenche_une_alerte_puis_le_silence(self):
        propre = {"goplus": securite_propre()}
        self.scan([brut()], MAINTENANT, securite=propre)
        resultat, _ = self.scan([brut()], MAINTENANT + timedelta(minutes=15),
                                securite=propre)
        self.assertEqual(len(resultat.alertes), 1)
        self.assertIn("PEP", self.messager.envoyes[0])

        # Deuxième passage à quelques minutes : le silence doit tenir.
        resultat, _ = self.scan([brut()], MAINTENANT + timedelta(minutes=30),
                                securite=propre)
        self.assertEqual(resultat.alertes, [])
        self.assertEqual(self.messager.envoyes, [])

    def test_un_service_de_securite_muet_ne_donne_pas_un_quitus(self):
        # Le candidat reste dans le rapport, mais sa note finale chute : on ne
        # sait rien de lui, et ça doit se voir.
        self.scan([brut()], MAINTENANT)
        resultat, _ = self.scan([brut()], MAINTENANT + timedelta(minutes=15))
        pepite = resultat.pepites[0]
        self.assertIs(pepite.securite.verdict, Verdict.INCONNU)
        self.assertLess(pepite.note_finale, pepite.note.total)

    def test_un_piege_detecte_par_le_contrat_est_arrete_apres_notation(self):
        piegeux = securite_propre()
        piegeux["result"]["0xPepite"]["is_honeypot"] = "1"
        self.scan([brut()], MAINTENANT, securite={"goplus": piegeux})
        resultat, _ = self.scan([brut()], MAINTENANT + timedelta(minutes=15),
                                securite={"goplus": piegeux})
        self.assertEqual(resultat.retenues, [])
        self.assertEqual(resultat.pepites[0].note_finale, 0.0)

    def test_le_rapport_s_ecrit_et_nomme_ce_qui_a_ete_ecarte(self):
        piegeux = securite_propre()
        piegeux["result"]["0xPepite"]["is_honeypot"] = "1"
        jeu = [brut(), brut(symbole="VIEUX", adresse="0xVieux", pool="0xP2",
                            market_cap=90_000_000)]
        self.scan(jeu, MAINTENANT, securite={"goplus": piegeux})
        resultat, _ = self.scan(jeu, MAINTENANT + timedelta(minutes=15),
                                securite={"goplus": piegeux})
        texte = rapport.composer(resultat, REGLAGES)
        chemin = rapport.ecrire(texte, Path(self.dossier.name) / "radar.md")
        self.assertTrue(chemin.exists())
        self.assertIn("PEP", texte)
        self.assertIn("capitalisation trop élevée", texte)
        self.assertIn("Arrêtées par le bouclier", texte)
        self.assertIn("la revente échoue en simulation", texte)

    def test_un_piege_evident_ne_sort_pas_du_tuyau_comme_confirme(self):
        piege = brut(achats_h1=400, ventes_h1=1)
        self.scan([piege], MAINTENANT)
        resultat, _ = self.scan([piege], MAINTENANT + timedelta(minutes=15))
        self.assertFalse(resultat.observations[0].confirme)


if __name__ == "__main__":
    unittest.main()
