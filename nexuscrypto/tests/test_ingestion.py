#!/usr/bin/env python3
"""L'ingestion multi-sources, sans réseau.

Toutes les sources reçoivent leur `Fetcher` par le constructeur : c'est ce qui
permet d'éprouver la chaîne entière avec des réponses enregistrées, sans
`aiohttp` et sans clé. Le test le plus important est
`test_une_source_muette_n_arrete_rien` — c'est la propriété qui décide si le
moteur tourne une semaine d'affilée ou s'arrête à la première panne de
DeFiLlama.
"""

import unittest
from datetime import timedelta, timezone

from aides import FetcherFactice, MAINTENANT

from src.core.modeles import Gravite
from src.core.reseau import ErreurTemporaire
from src.data_engine import macro, sentiment
from src.data_engine.agregateur import Agregateur
from src.data_engine.marche import MarcheHyperliquid
from src.data_engine.onchain import (
    IngestionOnchain, SourceDeFiLlama, SourceDexScreener, candidat_depuis_paire,
)
from src.data_engine.sentiment import IngestionSentiment, SourceFearGreed, SourceReddit


# --------------------------------------------------------------------------
# Sentiment
# --------------------------------------------------------------------------


class TestLexique(unittest.TestCase):
    def test_le_vocabulaire_crypto_inverse_la_polarite_generale(self):
        """« buying the dip » contient « dip » : un modèle généraliste y lit du
        négatif, alors que le message dit qu'on achète. C'est la raison d'être
        du lexique."""

        self.assertGreater(sentiment.analyser_texte("BTC dumping, buying the dip"), 0.0)

    def test_negation(self):
        self.assertLess(sentiment.analyser_texte("not bullish at all"), 0.0)
        self.assertLess(sentiment.analyser_texte("pas haussier du tout"), 0.0)

    def test_intensificateur(self):
        simple = sentiment.analyser_texte("bearish week")
        fort = sentiment.analyser_texte("very bearish week")
        self.assertLess(fort, simple)

    def test_hors_sujet_rend_none_et_non_zero(self):
        """`None` veut dire « ce message ne parle pas de marché », 0.0 veut dire
        « il en parle et il est neutre ». Les confondre noierait le signal."""

        self.assertIsNone(sentiment.analyser_texte("une recette de crêpes bretonnes"))

    def test_score_borne(self):
        for texte in ("scam rug rekt crash", "moon bullish pump rally breakout"):
            self.assertTrue(-1.0 <= sentiment.analyser_texte(texte) <= 1.0)


class TestAgregationSociale(unittest.TestCase):
    def test_le_filtre_par_symbole(self):
        """Le sentiment général d'un forum ne dit rien de SOL en particulier ;
        l'y appliquer noterait cinq actifs avec le même nombre."""

        titres = ["SOL bullish breakout"] * 20 + ["BTC bearish crash"] * 20
        score, mentions = sentiment.agreger(titres, mentions_minimum=5, symbole="SOL/USDT")
        self.assertGreater(score, 0.0)
        self.assertEqual(mentions, 20)

    def test_trop_peu_de_mentions_rend_none(self):
        score, mentions = sentiment.agreger(["BTC bullish"], mentions_minimum=15)
        self.assertIsNone(score)
        self.assertEqual(mentions, 1)


class TestIngestionSentiment(unittest.IsolatedAsyncioTestCase):
    async def test_perdre_reddit_ne_fait_pas_perdre_l_indice(self):
        """L'indice public est stable et presque toujours disponible ; le social
        tombe souvent. Les interroger séparément est ce qui garde le premier."""

        fetcher = FetcherFactice({
            "alternative.me": {"data": [{"value": "18"}]},
            "reddit.com": ErreurTemporaire("reddit muet"),
        })
        ingestion = IngestionSentiment(
            fear_greed=SourceFearGreed(fetcher), reddit=SourceReddit(fetcher)
        )
        signal = await ingestion.signal("BTC/USDT")
        self.assertEqual(signal.fear_greed, 18)
        self.assertIsNone(signal.score_social)
        self.assertIn("alternative.me", signal.sources)

    async def test_indice_vide_leve_dans_la_source(self):
        fetcher = FetcherFactice({"alternative.me": {"data": []}})
        with self.assertRaises(ErreurTemporaire):
            await SourceFearGreed(fetcher).indice()


# --------------------------------------------------------------------------
# Macro
# --------------------------------------------------------------------------


RSS = """<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Fed rate decision expected Thursday</title>
      <pubDate>Tue, 25 Aug 2026 08:00:00 +0000</pubDate><link>http://a</link></item>
<item><title>Major exchange hack drains 200M in user funds</title>
      <pubDate>Tue, 25 Aug 2026 09:00:00 +0000</pubDate></item>
<item><title>Un nouveau café ouvre à Rennes</title>
      <pubDate>Tue, 25 Aug 2026 10:00:00 +0000</pubDate></item>
</channel></rss>"""

ATOM = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>SEC lawsuit against a major exchange</title>
       <updated>2026-08-25T07:00:00Z</updated>
       <link href="http://b"/></entry></feed>"""


class TestMacro(unittest.TestCase):
    def test_classement_par_gravite(self):
        self.assertEqual(macro.classer("Fed rate decision")[0], Gravite.ELEVEE)
        self.assertEqual(macro.classer("exchange hack")[0], Gravite.CRITIQUE)
        self.assertEqual(macro.classer("nonfarm payroll")[0], Gravite.SURVEILLANCE)
        self.assertEqual(macro.classer("un café à Rennes")[0], Gravite.INFO)

    def test_la_gravite_la_plus_haute_gagne(self):
        """Un titre contenant « hack » et « inflation » est critique, pas élevé."""

        gravite, _ = macro.classer("Exchange hack after inflation data")
        self.assertEqual(gravite, Gravite.CRITIQUE)

    def test_parse_rss(self):
        actualites = macro.analyser_flux(RSS, "test")
        self.assertEqual(len(actualites), 3)
        self.assertEqual(actualites[0].lien, "http://a")

    def test_parse_atom(self):
        """Atom met le lien dans un attribut, pas dans le texte."""

        actualites = macro.analyser_flux(ATOM, "test")
        self.assertEqual(len(actualites), 1)
        self.assertEqual(actualites[0].lien, "http://b")
        self.assertEqual(actualites[0].gravite, Gravite.ELEVEE)

    def test_flux_illisible_rend_une_liste_vide(self):
        """Sur quatre flux, il y en a toujours un qui rend du HTML d'erreur."""

        self.assertEqual(macro.analyser_flux("<html>503</html>", "test"), [])
        self.assertEqual(macro.analyser_flux("pas du xml du tout", "test"), [])

    def test_fenetre_et_tri_par_gravite(self):
        """La seule question posée à cette liste est « y a-t-il quelque chose de
        grave » : la réponse doit être en première position."""

        actualites = macro.analyser_flux(RSS, "test")
        dans_fenetre = macro.filtrer_fenetre(actualites, maintenant=MAINTENANT, heures=24)
        self.assertEqual(dans_fenetre[0].gravite, Gravite.CRITIQUE)

    def test_hors_fenetre_ecarte(self):
        actualites = macro.analyser_flux(RSS, "test")
        tard = MAINTENANT + timedelta(days=5)
        self.assertEqual(macro.filtrer_fenetre(actualites, maintenant=tard, heures=24), [])


class TestIngestionMacro(unittest.IsolatedAsyncioTestCase):
    async def test_un_flux_mort_n_arrete_pas_les_autres(self):
        fetcher = FetcherFactice({"vivant": RSS, "mort": ErreurTemporaire("503")})
        ingestion = macro.IngestionMacro(
            fetcher, flux=["https://mort/rss", "https://vivant/rss"]
        )
        actualites = await ingestion.actualites(MAINTENANT)
        self.assertEqual(len(actualites), 3)


# --------------------------------------------------------------------------
# On-chain
# --------------------------------------------------------------------------


class TestOnchain(unittest.IsolatedAsyncioTestCase):
    def _historique(self, valeurs):
        return {"tvl": [{"totalLiquidityUSD": v} for v in valeurs]}

    async def test_variation_sur_sept_jours(self):
        fetcher = FetcherFactice(
            {"protocol/lido": self._historique([100.0] * 7 + [110.0])}
        )
        courante, variation = await SourceDeFiLlama(fetcher).tvl_protocole("lido")
        self.assertAlmostEqual(courante, 110.0)
        self.assertAlmostEqual(variation, 0.10)

    async def test_historique_trop_court_ne_rend_pas_de_variation(self):
        """Plutôt que d'inventer une variation sur une base de trois jours."""

        fetcher = FetcherFactice({"protocol/x": self._historique([100.0, 110.0])})
        courante, variation = await SourceDeFiLlama(fetcher).tvl_protocole("x")
        self.assertAlmostEqual(courante, 110.0)
        self.assertIsNone(variation)

    async def test_le_flux_approche_garde_le_bon_signe(self):
        """TVL en hausse = capital immobilisé = jetons hors des plateformes =
        flux négatif = lecture haussière."""

        fetcher = FetcherFactice({"protocol/lido": self._historique([100.0] * 7 + [120.0])})
        ingestion = IngestionOnchain(
            defillama=SourceDeFiLlama(fetcher),
            dexscreener=SourceDexScreener(fetcher),
            protocoles={"ETH/USDT": ["lido"]},
        )
        metrique = await ingestion.metrique("ETH/USDT")
        self.assertLess(metrique.flux_reserves_exchanges_usd, 0.0)
        self.assertIn("approché", metrique.source)

    async def test_actif_sans_protocole_leve(self):
        ingestion = IngestionOnchain(
            defillama=SourceDeFiLlama(FetcherFactice()),
            dexscreener=SourceDexScreener(FetcherFactice()),
            protocoles={},
        )
        with self.assertRaises(ErreurTemporaire):
            await ingestion.metrique("BTC/USDT")

    def test_meilleure_paire_est_la_plus_liquide(self):
        """DexScreener ne trie pas par liquidité : prendre la première revient
        souvent à mesurer un pool mort de quarante dollars."""

        paires = [
            {"liquidity": {"usd": 40.0}, "id": "mort"},
            {"liquidity": {"usd": 900_000.0}, "id": "vivant"},
        ]
        self.assertEqual(SourceDexScreener.meilleure_paire(paires)["id"], "vivant")
        self.assertIsNone(SourceDexScreener.meilleure_paire([]))

    def test_paire_malformee_ignoree_sans_lever(self):
        """Sur trois cents paires, une seule mal formée ne doit pas faire tomber
        le scan."""

        self.assertIsNone(candidat_depuis_paire({"pas": "ce qu'il faut"}))

    def test_traduction_d_une_paire(self):
        paire = {
            "chainId": "solana",
            "baseToken": {"symbol": "PEP", "address": "So111"},
            "priceUsd": "0.0012",
            "liquidity": {"usd": 800000},
            "volume": {"h24": 1200000, "h6": 300000},
            "marketCap": 12000000,
            "pairCreatedAt": 1755000000000,
        }
        candidat = candidat_depuis_paire(paire)
        self.assertEqual(candidat.symbole, "PEP")
        self.assertAlmostEqual(candidat.volume_moyen_usd, 1_200_000.0)
        self.assertEqual(candidat.creee_le.tzinfo, timezone.utc)


# --------------------------------------------------------------------------
# Marché et agrégateur
# --------------------------------------------------------------------------


class TestHyperliquid(unittest.IsolatedAsyncioTestCase):
    def test_le_symbole_est_reduit_au_jeton(self):
        """Envoyer la paire entière rend une réponse vide sans erreur, et le
        système conclut « pas de données » au lieu de « mauvaise requête »."""

        self.assertEqual(MarcheHyperliquid._jeton("HYPE/USDC"), "HYPE")
        self.assertEqual(MarcheHyperliquid._jeton("BTC/USDC:USDC"), "BTC")

    async def test_lecture_des_bougies(self):
        bougies = [
            {"t": 1755000000000 + i * 14_400_000, "o": 10, "h": 11, "l": 9, "c": 10.5, "v": 100}
            for i in range(5)
        ]
        source = MarcheHyperliquid(FetcherFactice({"hyperliquid": bougies}))
        serie = await source.ohlcv("HYPE/USDC", "4h", 5)
        self.assertEqual(len(serie), 5)
        self.assertEqual(serie.bougies[0].horodatage.tzinfo, timezone.utc)

    async def test_intervalle_non_gere(self):
        from src.core.reseau import ErreurPermanente

        source = MarcheHyperliquid(FetcherFactice({"hyperliquid": []}))
        with self.assertRaises(ErreurPermanente):
            await source.ohlcv("HYPE/USDC", "3h", 5)


class MarcheFactice:
    """Une source de marché rejouée. Peut échouer sur demande, ce qui est le
    seul moyen d'éprouver la tolérance aux pannes de l'agrégateur."""

    def __init__(self, serie=None, carnet=None, echoue=()):
        self.nom = "factice"
        self._serie = serie
        self._carnet = carnet
        self._echoue = set(echoue)

    async def ohlcv(self, symbole, intervalle, profondeur):
        if "ohlcv" in self._echoue:
            raise ErreurTemporaire("plateforme muette")
        return self._serie

    async def carnet(self, symbole, profondeur):
        if "carnet" in self._echoue:
            raise ErreurTemporaire("carnet indisponible")
        return self._carnet


class TestAgregateur(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        from aides import carnet as fabrique_carnet, serie as fabrique_serie

        self.serie = fabrique_serie(nombre=260)
        self.carnet = fabrique_carnet()

    def _agregateur(self, **remplacements):
        arguments = dict(
            marches={"binance": MarcheFactice(self.serie, self.carnet)},
            marche_defaut="binance",
        )
        arguments.update(remplacements)
        return Agregateur(**arguments)

    async def test_contexte_complet(self):
        contexte = await self._agregateur().contexte(
            "BTC/USDT", intervalle="4h", profondeur=260, maintenant=MAINTENANT
        )
        self.assertEqual(contexte.actif, "BTC/USDT")
        self.assertIsNotNone(contexte.carnet)
        self.assertEqual(contexte.sources_en_panne, ())

    async def test_une_source_muette_n_arrete_rien(self):
        """C'est la propriété qui décide si le moteur tourne une semaine
        d'affilée ou s'arrête à la première panne."""

        agregateur = self._agregateur(
            marches={"binance": MarcheFactice(self.serie, self.carnet, echoue=("carnet",))}
        )
        contexte = await agregateur.contexte(
            "BTC/USDT", intervalle="4h", profondeur=260, maintenant=MAINTENANT
        )
        self.assertIsNotNone(contexte)
        self.assertIsNone(contexte.carnet)
        self.assertIn("carnet", contexte.sources_en_panne)

    async def test_sans_prix_l_actif_est_ecarte(self):
        """Le prix n'est pas facultatif : sans bougie, il n'y a pas de contexte."""

        agregateur = self._agregateur(
            marches={"binance": MarcheFactice(self.serie, self.carnet, echoue=("ohlcv",))}
        )
        contexte = await agregateur.contexte(
            "BTC/USDT", intervalle="4h", profondeur=260, maintenant=MAINTENANT
        )
        self.assertIsNone(contexte)

    async def test_chaque_actif_va_sur_sa_plateforme(self):
        """HYPE n'est pas sur Binance."""

        hyper = MarcheFactice(self.serie, self.carnet)
        agregateur = self._agregateur(
            marches={
                "binance": MarcheFactice(self.serie, self.carnet, echoue=("ohlcv",)),
                "hyperliquid": hyper,
            }
        )
        contexte = await agregateur.contexte(
            "HYPE/USDC", intervalle="4h", profondeur=260,
            maintenant=MAINTENANT, plateforme="hyperliquid",
        )
        self.assertIsNotNone(contexte)

    async def test_passe_complete_ecarte_les_actifs_sans_donnees(self):
        agregateur = self._agregateur(
            marches={
                "binance": MarcheFactice(self.serie, self.carnet),
                "vide": MarcheFactice(self.serie, self.carnet, echoue=("ohlcv",)),
            }
        )
        contextes = await agregateur.tous(
            ["BTC/USDT", "SOL/USDT"], intervalle="4h", profondeur=260,
            maintenant=MAINTENANT, plateformes={"SOL/USDT": "vide"},
        )
        self.assertEqual(set(contextes), {"BTC/USDT"})


if __name__ == "__main__":
    unittest.main()
