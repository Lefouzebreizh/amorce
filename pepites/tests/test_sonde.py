#!/usr/bin/env python3
"""La sonde, éprouvée sur des réponses rejouées.

Le cas qui justifie tout le module est `test_des_paires_recues_et_illisibles_
sont_une_derive` : c'est la panne qu'aucun autre filet n'attrape, parce qu'elle
ne produit ni exception, ni échec HTTP, ni compteur d'erreur — seulement un
rapport vide qui se lit comme un marché calme.

Les autres tests gardent surtout la frontière inverse, qui est le vrai risque
d'une sonde : crier sans raison. Une sonde qui alarme un matin sur deux ne sera
plus lue au bout d'une semaine, et le jour où elle aura raison personne ne le
saura.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import sonde  # noqa: E402
from aides import BASE, MAINTENANT, WETH  # noqa: E402
from core.modeles import Chaine  # noqa: E402
from core.reseau import ReseauIndisponible  # noqa: E402
from sources import dexscreener  # noqa: E402

WSOL = "So11111111111111111111111111111111111111112"

SOLANA = Chaine(
    cle="solana", nom="Solana", goplus="solana", honeypot_is=None,
    explorateur="https://solscan.io/token/", liquidite_min_usd=30000,
    quotes=frozenset({WSOL}), sensible_a_la_casse=True,
)


def paire_brute(chaine: str = "base", **remplacements) -> dict:
    """Forme réelle d'une paire DexScreener, réduite aux champs lus."""
    brut = {
        "chainId": chaine,
        "dexId": "aerodrome",
        "pairAddress": "0xPool",
        "baseToken": {"address": "0xPepite", "name": "Pepite", "symbol": "PEP"},
        "quoteToken": {"address": WETH, "name": "Wrapped Ether", "symbol": "WETH"},
        "priceUsd": "0.0012345",
        "txns": {"h1": {"buys": 190, "sells": 120}, "h24": {"buys": 2400, "sells": 2100}},
        "volume": {"h1": 90000.0, "h6": 280000.0, "h24": 700000.0},
        "priceChange": {"h1": 6.0, "h6": 11.0, "h24": 18.0},
        "liquidity": {"usd": 120000.0, "base": 1.0, "quote": 2.0},
        "fdv": 2000000.0,
        "marketCap": 1500000.0,
        "pairCreatedAt": int((MAINTENANT - timedelta(hours=240)).timestamp() * 1000),
    }
    brut.update(remplacements)
    return brut


class ReglagesFactices:
    """Seul `chaines` est lu par la sonde ; le reste des réglages ne l'intéresse
    pas, et lui en fabriquer un jeu complet ferait dépendre ces tests de champs
    qu'ils n'observent pas."""

    def __init__(self, chaines=None):
        self.chaines = chaines if chaines is not None else {"base": BASE, "solana": SOLANA}


class ClientFactice:
    """Rejoue une réponse par point d'entrée, sans toucher au réseau.

    `None` signifie « ce service n'a rien rendu », qui est ce que `ClientHttp`
    produit après ses trois essais — c'est donc bien la forme réelle du silence,
    pas une commodité de test.
    """

    def __init__(self, reponses=None, muet=False, coupure=False):
        self.reponses = reponses or {}
        self.muet = muet
        self.coupure = coupure
        self.appels = 0
        self.urls = []

    def _rendre(self, url):
        self.appels += 1
        self.urls.append(url)
        if self.coupure:
            raise ReseauIndisponible("5 points d'entrée d'affilée sans réponse")
        if self.muet:
            return None
        for motif, reponse in self.reponses.items():
            if motif in url:
                return reponse
        return None

    def json(self, cle, url, params=None, entetes=None):
        return self._rendre(url)

    def poster(self, cle, url, charge):
        return self._rendre(url)


def constat(constats, prefixe):
    return next(c for c in constats if c.point.startswith(prefixe))


class TestDerive(unittest.TestCase):
    """Le cas pour lequel la sonde existe."""

    def test_des_paires_recues_et_illisibles_sont_une_derive(self):
        # DexScreener répond, avec des paires de nos chaînes — mais plus une
        # seule ne porte les champs dont nos modèles ont besoin. C'est
        # exactement ce qu'un renommage de champ produirait, et le scan rendrait
        # « 0 paires » sans qu'aucune erreur ne soit levée nulle part.
        client = ClientFactice({
            "dex/search": {"pairs": [{"chainId": "base"}, {"chainId": "base"}]},
        })
        resultat = sonde._sonder_recherche(client, ReglagesFactices(), MAINTENANT)
        self.assertIs(resultat.etat, sonde.Etat.DERIVE)
        self.assertEqual(resultat.recus, 2)
        self.assertEqual(resultat.lus, 0)
        self.assertTrue(resultat.grave)

    def test_la_liste_pairs_disparue_est_une_derive_et_non_un_silence(self):
        # La distinction n'est pas cosmétique : « muet » envoie chercher du côté
        # du réseau, « dérive » du côté de l'analyseur. Se tromper de piste
        # coûte la session.
        client = ClientFactice({"dex/search": {"resultats": []}})
        resultat = sonde._sonder_recherche(client, ReglagesFactices(), MAINTENANT)
        self.assertIs(resultat.etat, sonde.Etat.DERIVE)

    def test_le_resume_nomme_la_source_derivee(self):
        constats = [sonde.Constat("dexscreener · recherche", sonde.Etat.DERIVE, 30, 0)]
        texte = sonde.resumer(constats)
        self.assertIn("DÉRIVE DE FORMAT", texte)
        self.assertIn("dexscreener · recherche", texte)


class TestPasDeFausseAlerte(unittest.TestCase):
    """Le risque symétrique, et le plus probable des deux au quotidien."""

    def test_des_paires_hors_perimetre_ne_font_pas_crier_la_sonde(self):
        # Une recherche par adresse de WETH rend des paires de toutes les
        # chaînes. Celles qu'on ne suit pas ne se traduisent pas, et c'est
        # normal : les compter comme illisibles ferait hurler la sonde à chaque
        # exécution, ce qui reviendrait à ne plus la lire.
        client = ClientFactice({
            "dex/search": {"pairs": [paire_brute(),
                                     paire_brute("linea"),
                                     paire_brute("scroll")]},
        })
        resultat = sonde._sonder_recherche(client, ReglagesFactices(), MAINTENANT)
        self.assertIs(resultat.etat, sonde.Etat.OK)
        self.assertEqual(resultat.recus, 1)      # seule celle sur Base compte
        self.assertEqual(resultat.lus, 1)
        self.assertIn("3 paires rendues", resultat.detail)

    def test_une_vitrine_vide_n_est_pas_une_panne(self):
        # Aucune fiche publiée depuis le dernier tour est un fait du marché.
        client = ClientFactice({"token-profiles": []})
        resultat = sonde._sonder_vitrine(client, ReglagesFactices())
        self.assertIs(resultat.etat, sonde.Etat.VIDE)
        self.assertFalse(resultat.grave)

    def test_une_vitrine_entierement_hors_perimetre_reste_saine(self):
        # Les entrées sont bien formées, simplement sur des chaînes qu'on ne
        # suit pas. La forme n'a pas bougé : rien à signaler.
        client = ClientFactice({
            "token-profiles": [{"chainId": "linea", "tokenAddress": "0xAilleurs"}],
        })
        resultat = sonde._sonder_vitrine(client, ReglagesFactices())
        self.assertIs(resultat.etat, sonde.Etat.OK)
        self.assertIn("0 dans le périmètre", resultat.detail)

    def test_une_cle_absente_n_est_pas_grave(self):
        # Le radar est conçu pour tourner sans Etherscan ni Telegram, en moins
        # bien. Le dire, oui ; s'en alarmer, non.
        constats = sonde._sonder_cles()
        for c in constats:
            self.assertIn(c.etat, (sonde.Etat.OK, sonde.Etat.SANS_CLE))
            self.assertFalse(c.grave)

    def test_le_resume_sans_defaut_le_dit_en_une_phrase(self):
        constats = [sonde.Constat("dexscreener · recherche", sonde.Etat.OK, 30, 30),
                    sonde.Constat("telegram", sonde.Etat.SANS_CLE)]
        self.assertIn("Toutes les sources répondent", sonde.resumer(constats))


class TestSilence(unittest.TestCase):
    def test_une_source_muette_est_signalee_comme_telle(self):
        client = ClientFactice(muet=True)
        resultat = sonde._sonder_recherche(client, ReglagesFactices(), MAINTENANT)
        self.assertIs(resultat.etat, sonde.Etat.MUET)
        self.assertTrue(resultat.grave)

    def test_le_resume_distingue_muet_de_derive(self):
        constats = [sonde.Constat("goplus · EVM", sonde.Etat.MUET)]
        texte = sonde.resumer(constats)
        self.assertIn("SOURCES MUETTES", texte)
        self.assertNotIn("DÉRIVE", texte)


class TestParcoursComplet(unittest.TestCase):
    def test_la_sonde_couvre_tous_les_points_d_entree(self):
        constats = sonde.sonder(ReglagesFactices(), ClientFactice(muet=True))
        points = {c.point for c in constats}
        for attendu in ("dexscreener · recherche", "dexscreener · vitrine",
                        "dexscreener · pools d'un jeton", "goplus · EVM",
                        "goplus · Solana", "honeypot.is", "rugcheck",
                        "solana · RPC", "etherscan · clé", "telegram"):
            self.assertIn(attendu, points)

    def test_une_source_en_panne_n_empeche_pas_de_sonder_les_suivantes(self):
        # C'est le service même qu'on demande à la sonde : savoir que trois
        # sources sur sept sont tombées vaut mieux que de s'arrêter à la
        # première et de découvrir les autres au tour suivant.
        client = ClientFactice({
            "dex/search": {"pairs": [paire_brute()]},
            "token-profiles": [{"chainId": "base", "tokenAddress": "0xPepite"}],
        })
        constats = sonde.sonder(ReglagesFactices(), client)
        self.assertIs(constat(constats, "dexscreener · recherche").etat, sonde.Etat.OK)
        self.assertIs(constat(constats, "goplus · EVM").etat, sonde.Etat.MUET)
        self.assertTrue(len(constats) >= 10)

    def test_une_coupure_franche_garde_ce_qui_a_ete_constate(self):
        # `ClientHttp` lève après cinq points d'entrée muets d'affilée. La sonde
        # ne doit pas perdre le diagnostic déjà établi en remontant l'exception.
        constats = sonde.sonder(ReglagesFactices(), ClientFactice(coupure=True))
        self.assertIs(constat(constats, "réseau").etat, sonde.Etat.MUET)
        self.assertIn("telegram", {c.point for c in constats})

    def test_une_coupure_nomme_les_points_jamais_atteints(self):
        # Défaut vu en regardant la sonde tourner, pas en la mesurant : la
        # coupure arrivait au cinquième point d'entrée et les quatre suivants
        # disparaissaient du tableau. Un point absent se lit comme un point
        # sain — c'est le mensonge exact que ce module combat, et il l'avait
        # commis sur lui-même.
        constats = sonde.sonder(ReglagesFactices(), ClientFactice(coupure=True))
        points = {c.point for c in constats}
        for jamais_atteint in ("goplus · EVM", "goplus · Solana", "honeypot.is",
                               "rugcheck", "solana · RPC"):
            self.assertIn(jamais_atteint, points)
            self.assertIs(constat(constats, jamais_atteint).etat, sonde.Etat.NON_SONDE)

    def test_le_resume_avoue_ce_qu_il_n_a_pas_sonde(self):
        constats = sonde.sonder(ReglagesFactices(), ClientFactice(coupure=True))
        self.assertIn("non sondé(s)", sonde.resumer(constats))

    def test_un_point_non_sonde_n_est_pas_compte_comme_une_panne(self):
        # La panne, c'est la ligne « réseau ». Compter aussi les points qu'elle
        # a empêché d'atteindre gonflerait le diagnostic d'un facteur cinq et
        # ferait chercher cinq causes là où il n'y en a qu'une.
        self.assertFalse(sonde.Constat("rugcheck", sonde.Etat.NON_SONDE).grave)

    def test_la_sonde_n_ecrit_ni_n_alerte(self):
        # Aucun POST ne doit partir vers Telegram : une sonde qui prévient le
        # salon à chaque exécution le rendrait inutilisable.
        client = ClientFactice(muet=True)
        sonde.sonder(ReglagesFactices(), client)
        self.assertFalse([u for u in client.urls if "telegram" in u])


class TestSujetsDeSondage(unittest.TestCase):
    def test_le_sujet_est_un_jeton_de_cotation_de_la_configuration(self):
        # Pas une adresse écrite en dur dans la sonde : elle vieillirait sans
        # que personne ne la relise, et ferait de la sonde elle-même une source
        # de fausses alertes.
        client = ClientFactice({"dex/search": {"pairs": []}})
        sonde._sonder_recherche(client, ReglagesFactices(), MAINTENANT)
        self.assertEqual(len(client.urls), 1)
        self.assertTrue(client.urls[0].startswith(dexscreener.RECHERCHE))

    def test_sans_chaine_evm_la_sonde_le_dit_au_lieu_de_tomber(self):
        resultat = sonde._sonder_recherche(
            ClientFactice(), ReglagesFactices({"solana": SOLANA}), MAINTENANT
        )
        self.assertIs(resultat.etat, sonde.Etat.VIDE)
        self.assertIn("aucune chaîne EVM", resultat.detail)


if __name__ == "__main__":
    unittest.main()
