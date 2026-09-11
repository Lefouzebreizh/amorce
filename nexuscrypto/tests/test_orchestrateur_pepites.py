#!/usr/bin/env python3
"""Le scanner de pépites, en direct — option 1 du README § 16 bis.

Le test qui compte le plus dans ce fichier est
`test_bouclier_actif_bloque_lachat_sur_verdict_rejete` : il prouve, en faisant
vraiment appeler le service de sécurité, que la mine trouvée par
`garde-du-bot` en relisant la PR #886 est refermée — la chaîne/adresse d'une
pépite découverte par le scanner arment bien le bouclier, jamais un
« pas d'adresse, pas de bouclier » silencieux. Un garde-fou d'argent ne compte
comme vérifié que si un test l'a vu se déclencher pour de vrai (CLAUDE.md).

Tout le reste tourne sans réseau : un client factice rejoue des réponses
DexScreener/GoPlus/RugCheck enregistrées.
"""

import unittest
from dataclasses import replace
from datetime import timedelta

from aides import MAINTENANT, config, portefeuille, position

from src.core.modeles import Mode
from src.data_engine.agregateur import Agregateur
from src.execution.courtier import CourtierPapier
from src.notifications.canaux import CanalConsole, Notificateur
from src.orchestrateur import Orchestrateur


class ClientDexFactice:
    """Rend une réponse par fragment d'URL — même principe que `FetcherFactice`
    de `test_bouclier.py`, étendu aux deux points d'entrée DexScreener."""

    def __init__(self, *, recherche=None, jeton=None, securite=None):
        self.recherche = recherche or []
        self.jeton = jeton or []
        self.securite = securite or {}
        self.appels: list[str] = []

    async def json(self, url, *, params=None, entetes=None, corps=None):
        self.appels.append(url)
        # `dexscreener.com` d'abord et seul : l'URL de RugCheck contient elle
        # aussi « /tokens/ » (`rugcheck.xyz/v1/tokens/{mint}/report/summary`),
        # et la confondre avec le point d'entrée DexScreener du même nom a
        # fait passer un premier jet de ce test sans jamais interroger le
        # bouclier pour de vrai.
        if "api.dexscreener.com" in url:
            return {"pairs": self.recherche if "/search" in url else self.jeton}
        for motif, reponse in self.securite.items():
            if motif in url:
                return reponse
        return None

    async def texte(self, url, **_):
        return ""


def paire_dexscreener(
    *, symbole="PEP", chaine="solana", adresse="So1111111111111111111111111111111111111112",
    prix=0.01, liquidite=300_000.0, volume24=3_000_000.0, volume6=200_000.0,
    mcap=5_000_000.0, age_heures=200, variation_liquidite_pct=30.0,
):
    cree = int((MAINTENANT - timedelta(hours=age_heures)).timestamp() * 1000)
    return {
        "chainId": chaine,
        "baseToken": {"symbol": symbole, "address": adresse},
        "quoteToken": {"symbol": "SOL", "address": "So11111111111111111111111111111111111111112"},
        "priceUsd": str(prix),
        "liquidity": {"usd": liquidite},
        "volume": {"h24": volume24, "h6": volume6},
        "marketCap": mcap,
        "pairCreatedAt": cree,
        "liquidityChange": {"h24": variation_liquidite_pct},
    }


def config_pepites_permissive(**pepites_kwargs):
    """Une configuration qui laisse passer n'importe quel candidat fabriqué
    ci-dessus — le but de ces tests est l'orchestration (décision, bouclier,
    exécution, mémoire des positions), pas la notation du scanner elle-même,
    déjà couverte par `test_pepites.py`."""

    base = config()
    reglages = {
        "liquidite_min_usd": 1_000.0,
        "croissance_volume_min": 0.5,
        "age_minimum_heures": 1.0,
        "variation_liquidite_24h_min": 0.0,
        "capitalisation_max_usd": 1e12,
        "score_minimum": 1.0,
        "candidats_max": 3,
        "plafond_par_jeton_usd": 1_000.0,
        "stop_pct": 0.10,
        "termes_recherche": ("WETH",),
    }
    reglages.update(pepites_kwargs)
    pepites = replace(base.strategie.pepites, **reglages)
    return replace(base, strategie=replace(base.strategie, pepites=pepites))


def construire_orchestrateur(config_test, client):
    orchestrateur = Orchestrateur(
        config_test,
        agregateur=Agregateur(marches={}, marche_defaut="binance"),
        courtier=CourtierPapier(config_test.execution, horloge=lambda: MAINTENANT),
        notificateur=Notificateur(canaux=[CanalConsole()]),
        client=client,
    )
    return orchestrateur


class TestDecouverteEtAchat(unittest.IsolatedAsyncioTestCase):
    async def test_aucun_terme_configure_ne_fait_aucun_appel_reseau(self):
        """`termes_recherche` vide à dessein : sans terme, aucun appel, même
        avec un client réseau présent — voir `ConfigPepites.termes_recherche`."""

        cfg = config_pepites_permissive(termes_recherche=())
        client = ClientDexFactice(recherche=[paire_dexscreener()])
        orchestrateur = construire_orchestrateur(cfg, client)
        await orchestrateur._passe_pepites(MAINTENANT, {})
        self.assertEqual(client.appels, [])
        self.assertEqual(orchestrateur.etat.portefeuille.positions, {})

    async def test_bouclier_desactive_lachat_va_au_bout(self):
        """Le chemin d'orchestration complet — décision, dimensionnement,
        courtier, portefeuille, mémoire — avec le bouclier explicitement
        coupé pour isoler la plomberie de la question de sécurité, testée à
        part ci-dessous."""

        cfg = config_pepites_permissive()
        cfg = replace(
            cfg, strategie=replace(cfg.strategie, bouclier=replace(cfg.strategie.bouclier, actif=False))
        )
        client = ClientDexFactice(recherche=[paire_dexscreener()])
        orchestrateur = construire_orchestrateur(cfg, client)
        await orchestrateur._passe_pepites(MAINTENANT, {})

        self.assertIn("PEP/solana", orchestrateur.etat.portefeuille.positions)
        self.assertIn("PEP/solana", orchestrateur.etat.pepites_suivies)
        self.assertEqual(orchestrateur.etat.pepites_suivies["PEP/solana"],
                          ("solana", "So1111111111111111111111111111111111111112"))
        self.assertLess(
            orchestrateur.etat.portefeuille.liquidites_usd,
            cfg.portefeuille.capital_initial_usd,
        )

    async def test_bouclier_actif_bloque_lachat_sur_verdict_rejete(self):
        """Le test qui compte : une pépite avec une vraie adresse doit
        déclencher un vrai appel de sécurité, et un verdict REJETE doit
        bloquer l'achat — la preuve que la chaîne/adresse de la `Decision`
        arment le bouclier pour un jeton hors watchlist."""

        cfg = config_pepites_permissive()  # bouclier actif par défaut
        client = ClientDexFactice(
            recherche=[paire_dexscreener()],
            # Solana : seuls GoPlus-Solana et RugCheck s'appliquent. Une
            # autorité d'émission ouverte y rejette, sans équivoque possible.
            securite={"rugcheck": {"risks": [{"name": "Mint authority enabled"}]}},
        )
        orchestrateur = construire_orchestrateur(cfg, client)
        await orchestrateur._passe_pepites(MAINTENANT, {})

        self.assertTrue(any("rugcheck" in appel for appel in client.appels),
                         "le bouclier n'a jamais interrogé RugCheck : la chaîne/adresse "
                         "n'ont pas atteint _bouclier_autorise")
        self.assertEqual(orchestrateur.etat.portefeuille.positions, {})
        self.assertEqual(orchestrateur.etat.pepites_suivies, {})
        self.assertEqual(
            orchestrateur.etat.portefeuille.liquidites_usd,
            cfg.portefeuille.capital_initial_usd,
        )

    async def test_une_pepite_deja_detenue_nest_pas_rachetee(self):
        cfg = config_pepites_permissive()
        cfg = replace(
            cfg, strategie=replace(cfg.strategie, bouclier=replace(cfg.strategie.bouclier, actif=False))
        )
        client = ClientDexFactice(recherche=[paire_dexscreener()])
        orchestrateur = construire_orchestrateur(cfg, client)
        orchestrateur.etat.portefeuille = portefeuille(
            positions={"PEP/solana": position(actif="PEP/solana", quantite=10.0, prix_moyen=0.01)}
        )
        orchestrateur.etat.pepites_suivies["PEP/solana"] = (
            "solana", "So1111111111111111111111111111111111111112",
        )
        liquidites_avant = orchestrateur.etat.portefeuille.liquidites_usd
        await orchestrateur._passe_pepites(MAINTENANT, {})
        self.assertEqual(orchestrateur.etat.portefeuille.liquidites_usd, liquidites_avant)

    async def test_le_montant_achete_est_borne_par_le_plafond_du_jeton(self):
        """Trouvé par `banc-du-bot` en mesurant à l'exécution : avec les
        réglages livrés, `plafond_par_jeton_usd` mord systématiquement avant
        le plafond de risque — c'est lui qui décide de la taille réelle d'un
        achat de pépite, pas `risque_par_position`. Ce test le garde : un
        futur oubli du plafond spécifique romprait ce comportement en
        silence."""

        cfg = config_pepites_permissive(plafond_par_jeton_usd=50.0)
        cfg = replace(
            cfg, strategie=replace(cfg.strategie, bouclier=replace(cfg.strategie.bouclier, actif=False))
        )
        client = ClientDexFactice(recherche=[paire_dexscreener()])
        orchestrateur = construire_orchestrateur(cfg, client)
        await orchestrateur._passe_pepites(MAINTENANT, {})

        position = orchestrateur.etat.portefeuille.positions["PEP/solana"]
        montant = position.quantite * position.prix_moyen
        # Le plafond borne le montant *avant* frais/glissement — une petite
        # marge au-delà de 50 $ vient d'eux, jamais une multiplication.
        self.assertLess(montant, 55.0)
        self.assertGreater(montant, 45.0)

    async def test_candidats_max_atteint_arrete_la_decouverte(self):
        """Trouvé par `banc-du-bot` : aucun test ne vérifiait que la
        découverte s'arrête vraiment une fois le plafond de positions pépites
        atteint."""

        cfg = config_pepites_permissive(candidats_max=1)
        client = ClientDexFactice(
            recherche=[paire_dexscreener()],
            jeton=[paire_dexscreener(prix=0.01)],  # pour le rafraîchissement de la ligne déjà tenue
        )
        orchestrateur = construire_orchestrateur(cfg, client)
        orchestrateur.etat.portefeuille = portefeuille(
            positions={"AUTRE/solana": position(actif="AUTRE/solana", quantite=1.0, prix_moyen=0.01)}
        )
        orchestrateur.etat.pepites_suivies["AUTRE/solana"] = ("solana", "So000")

        await orchestrateur._passe_pepites(MAINTENANT, {})

        self.assertFalse(any("/search" in appel for appel in client.appels),
                          "la découverte a cherché de nouveaux candidats alors que "
                          "candidats_max était déjà atteint")
        self.assertNotIn("PEP/solana", orchestrateur.etat.portefeuille.positions)


class TestSortieSurPriseDeBenefice(unittest.IsolatedAsyncioTestCase):
    async def test_la_prise_de_benefice_suiveuse_sort_sans_attendre_le_stop(self):
        """Trouvé par `banc-du-bot` : les tests de sortie ne couvraient que le
        stop-loss. Rien ne prouvait que la stratégie sait aussi *garder* un
        gain sur une pépite, seulement qu'elle sait couper une perte —
        `stops.evaluer` arme le trailing indépendamment de l'ATR, donc rien ne
        l'empêchait déjà de fonctionner ici, mais ce n'était pas gardé."""

        import io
        from contextlib import redirect_stdout

        cfg = config_pepites_permissive(termes_recherche=())
        chaine, adresse = "solana", "So1111111111111111111111111111111111111112"
        # +100 % de plus-haut atteint arme le trailing (seuil 20 %) ; le prix
        # rafraîchi retombe sous le niveau suiveur (88 % du plus-haut) mais
        # reste largement au-dessus du stop à 10 % sous l'entrée — c'est la
        # prise de bénéfice qui doit décider, jamais le stop.
        client = ClientDexFactice(jeton=[paire_dexscreener(chaine=chaine, adresse=adresse, prix=0.017)])
        orchestrateur = construire_orchestrateur(cfg, client)
        orchestrateur.etat.portefeuille = portefeuille(
            positions={
                "PEP/solana": position(
                    actif="PEP/solana", quantite=100.0, prix_moyen=0.01, plus_haut=0.02,
                )
            },
            liquidites=500.0,
        )
        orchestrateur.etat.pepites_suivies["PEP/solana"] = (chaine, adresse)

        with redirect_stdout(io.StringIO()) as sortie:
            await orchestrateur._passe_pepites(MAINTENANT, {})
        journal = sortie.getvalue()

        self.assertNotIn("PEP/solana", orchestrateur.etat.portefeuille.positions)
        self.assertIn("suiveuse", journal)
        self.assertNotIn("stop touché", journal)


class TestSortieSurStopFixe(unittest.IsolatedAsyncioTestCase):
    async def test_le_prix_rafraichi_sous_le_stop_declenche_la_vente(self):
        cfg = config_pepites_permissive(termes_recherche=())  # pas de découverte ici
        chaine, adresse = "solana", "So1111111111111111111111111111111111111112"
        client = ClientDexFactice(
            jeton=[paire_dexscreener(chaine=chaine, adresse=adresse, prix=0.0084)],  # -16 %, sous stop_pct=10 %
        )
        orchestrateur = construire_orchestrateur(cfg, client)
        orchestrateur.etat.portefeuille = portefeuille(
            positions={"PEP/solana": position(actif="PEP/solana", quantite=100.0, prix_moyen=0.01)},
            liquidites=500.0,
        )
        orchestrateur.etat.pepites_suivies["PEP/solana"] = (chaine, adresse)

        await orchestrateur._passe_pepites(MAINTENANT, {})

        self.assertNotIn("PEP/solana", orchestrateur.etat.portefeuille.positions)
        self.assertNotIn("PEP/solana", orchestrateur.etat.pepites_suivies)
        self.assertGreater(orchestrateur.etat.portefeuille.liquidites_usd, 500.0)

    async def test_le_prix_rafraichi_au_dessus_du_stop_ne_vend_pas(self):
        cfg = config_pepites_permissive(termes_recherche=())
        chaine, adresse = "solana", "So1111111111111111111111111111111111111112"
        client = ClientDexFactice(
            jeton=[paire_dexscreener(chaine=chaine, adresse=adresse, prix=0.0095)],  # -5 %, au-dessus du stop
        )
        orchestrateur = construire_orchestrateur(cfg, client)
        orchestrateur.etat.portefeuille = portefeuille(
            positions={"PEP/solana": position(actif="PEP/solana", quantite=100.0, prix_moyen=0.01)},
            liquidites=500.0,
        )
        orchestrateur.etat.pepites_suivies["PEP/solana"] = (chaine, adresse)

        await orchestrateur._passe_pepites(MAINTENANT, {})

        self.assertIn("PEP/solana", orchestrateur.etat.portefeuille.positions)
        self.assertEqual(orchestrateur.etat.portefeuille.liquidites_usd, 500.0)

    async def test_une_position_disparue_du_portefeuille_est_oubliee(self):
        """Vendue par ailleurs (ou jamais réellement ouverte) : la mémoire ne
        doit pas garder une chaîne/adresse orpheline indéfiniment."""

        cfg = config_pepites_permissive(termes_recherche=())
        client = ClientDexFactice()
        orchestrateur = construire_orchestrateur(cfg, client)
        orchestrateur.etat.pepites_suivies["FANTOME/solana"] = ("solana", "So999")
        await orchestrateur._passe_pepites(MAINTENANT, {})
        self.assertNotIn("FANTOME/solana", orchestrateur.etat.pepites_suivies)
        self.assertEqual(client.appels, [])


class TestCoupeCircuitVoitLesPepites(unittest.IsolatedAsyncioTestCase):
    async def test_le_coupe_circuit_voit_la_perte_latente_dune_pepite(self):
        """Trouvé par `garde-du-bot` en relisant ce lot : avant la correction,
        `_verifier_coupe_circuit` ne recevait jamais le prix rafraîchi d'une
        pépite, seulement son prix d'achat (`Portefeuille.valeur_totale`
        retombe sur `prix_moyen` quand l'actif est absent du dict `prix`) — le
        garde-fou de portefeuille restait aveugle à sa perte latente tant
        qu'elle n'était pas vendue. `une_passe()` appelle désormais
        `_evaluer_sorties_pepites` avant `_verifier_coupe_circuit`, ce qui
        rafraîchit `prix` en place. Preuve que le coupe-circuit se déclenche
        pour de vrai sur une chute qui ne touche que le prix d'une pépite : le
        stop individuel (50 %) n'est pas atteint par les -20 % de ce test, donc
        seul le garde-fou de portefeuille agrégé peut expliquer le
        déclenchement observé."""

        from src.risk_management import coupe_circuit as cc

        chaine, adresse = "solana", "So1111111111111111111111111111111111111112"
        cfg = config_pepites_permissive(termes_recherche=(), stop_pct=0.50)
        client = ClientDexFactice(
            jeton=[paire_dexscreener(chaine=chaine, adresse=adresse, prix=0.04)],
        )
        orchestrateur = construire_orchestrateur(cfg, client)
        # 5000 $ de liquidités + une pépite achetée à 0,05 $, valant 5000 $ à
        # l'achat : 10 000 $ au total, la référence journalière du drawdown.
        orchestrateur.etat.portefeuille = portefeuille(
            positions={
                "PEP/solana": position(actif="PEP/solana", quantite=100_000.0, prix_moyen=0.05)
            },
            liquidites=5000.0,
        )
        orchestrateur.etat.pepites_suivies["PEP/solana"] = (chaine, adresse)
        # Le coupe-circuit de l'orchestrateur est construit à l'instant réel
        # de son `__init__`, pas à `MAINTENANT` (fixture figée) : sans ce
        # recalage, `observer` verrait un changement de jour et
        # réinitialiserait la référence journalière sur la valeur déjà
        # chutée, ce qui masquerait exactement le défaut que ce test prouve
        # corrigé.
        orchestrateur.coupe_circuit.jour_courant = MAINTENANT.toordinal()
        orchestrateur.coupe_circuit.reference_journaliere = 10_000.0
        orchestrateur.coupe_circuit.plus_haut_portefeuille = 10_000.0

        prix: dict[str, float] = {}
        await orchestrateur._evaluer_sorties_pepites(MAINTENANT, prix)
        self.assertIn("PEP/solana", orchestrateur.etat.portefeuille.positions,
                       "le stop individuel (50 %) n'aurait pas dû se déclencher sur -20 %")
        self.assertAlmostEqual(prix["PEP/solana"], 0.04)

        await orchestrateur._verifier_coupe_circuit(MAINTENANT, prix, {})

        self.assertIs(orchestrateur.coupe_circuit.etat, cc.Etat.DECLENCHE)
        self.assertEqual(
            orchestrateur.coupe_circuit.declenchement.motif, cc.Motif.DRAWDOWN_JOURNALIER
        )


if __name__ == "__main__":
    unittest.main()
