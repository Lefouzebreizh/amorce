#!/usr/bin/env python3
"""Les alertes : contenu d'abord, canaux ensuite.

Le contenu se teste sans réseau, et c'est le contenu qui compte : une alerte qui
dit « achat BTC » sans dire pourquoi oblige à ouvrir les journaux depuis un
téléphone, ce qui n'arrive jamais.
"""

import io
import unittest
from contextlib import redirect_stdout

from aides import FetcherFactice, MAINTENANT, config, portefeuille, position

from src.core.modeles import (
    Action, Decision, Execution, Ordre, Score, Sens, TypeOrdre,
)
from src.core.reseau import ErreurTemporaire
from src.notifications import messages
from src.notifications.canaux import (
    CanalConsole, CanalDiscord, CanalTelegram, Notificateur, construire,
)
from src.risk_management.coupe_circuit import Declenchement, Motif


def decision():
    return Decision(
        actif="BTC/USDT", action=Action.ACHETER, montant_usd=340.0,
        score=Score(total=78.0, technique=82.0, sentiment=90.0, onchain=60.0),
        prix_reference=64_000.0,
        raisons=("zone peur extrême → ×2", "RSI en survente (24)"),
    )


def execution():
    return Execution(
        ordre=Ordre("id", "BTC/USDT", Sens.ACHAT, TypeOrdre.MARCHE, 0.005, motif="DCA renforcé"),
        prix_execute=64_100.0, quantite_executee=0.005, frais_usd=0.32,
        horodatage=MAINTENANT, glissement=0.0015,
    )


class TestMessages(unittest.TestCase):
    def test_le_signal_porte_le_detail_du_score(self):
        """« 63 » ne dit pas s'il faut regarder le RSI ou le flux des
        plateformes : chaque composante part dans la notification."""

        texte = messages.signal(decision())
        for morceau in ("78/100", "technique 82", "sentiment 90", "on-chain 60"):
            self.assertIn(morceau, texte)

    def test_le_signal_porte_le_motif(self):
        self.assertIn("RSI en survente", messages.signal(decision()))

    def test_une_simulation_est_marquee_comme_telle(self):
        """Confondre un ordre simulé et un ordre réel dans une alerte est la
        confusion la plus chère du système."""

        self.assertIn("SIMULÉ", messages.ordre_execute(execution(), simule=True))
        self.assertIn("RÉEL", messages.ordre_execute(execution(), simule=False))

    def test_le_coupe_circuit_dit_que_les_sorties_restent_actives(self):
        texte = messages.coupe_circuit(
            Declenchement(Motif.DRAWDOWN_JOURNALIER, "perte de 8 %", MAINTENANT)
        )
        self.assertIn("COUPE-CIRCUIT", texte)
        self.assertIn("sorties de protection", texte)

    def test_le_recapitulatif_tient_sur_un_ecran(self):
        pfl = portefeuille(
            liquidites=5_000.0,
            positions={"BTC/USDT": position(quantite=0.05, prix_moyen=60_000.0)},
        )
        texte = messages.recapitulatif(
            pfl, {"BTC/USDT": 64_000.0}, capital_initial=10_000.0,
            executions_du_jour=[execution()], date=MAINTENANT, simule=True,
        )
        self.assertLessEqual(len(texte.splitlines()), 8)
        self.assertIn("simulation", texte)
        self.assertIn("PnL", texte)

    def test_une_pepite_est_annoncee_comme_candidate(self):
        """Un candidat à examiner, jamais un achat : le contrat n'a pas été
        vérifié, et c'est le module lui-même qui le dit."""

        from src.strategy.pepites import Candidat, Pepite

        pepite = Pepite(
            candidat=Candidat(
                symbole="PEP", chaine="solana", adresse="So1", prix_usd=0.001,
                liquidite_usd=800_000.0, volume_24h_usd=1_200_000.0,
                volume_moyen_usd=200_000.0, capitalisation_usd=1e7,
                variation_liquidite_24h=0.3, creee_le=MAINTENANT,
            ),
            score=82.0, raisons=("volume ×6.0",),
        )
        texte = messages.pepite_detectee(pepite)
        self.assertIn("pas un achat", texte)


class TestCanaux(unittest.IsolatedAsyncioTestCase):
    async def test_telegram_envoie_du_texte_brut(self):
        """Un `_` dans un nom de jeton suffit à faire rejeter un envoi en
        Markdown, avec un 400 qui ne dit pas lequel des vingt caractères est en
        cause."""

        fetcher = FetcherFactice({"api.telegram.org": {"ok": True}})
        canal = CanalTelegram(jeton="123:abc", salon="42", fetcher=fetcher)
        self.assertTrue(await canal.envoyer("BTC/USDT -12 % _test_"))

    async def test_un_canal_qui_tombe_ne_leve_pas(self):
        """Une alerte perdue est regrettable ; un moteur qui s'interrompt parce
        que Telegram a hoqueté est bien pire."""

        fetcher = FetcherFactice({"api.telegram.org": ErreurTemporaire("503")})
        canal = CanalTelegram(jeton="123:abc", salon="42", fetcher=fetcher)
        self.assertFalse(await canal.envoyer("message"))

    async def test_discord_tronque_a_sa_limite(self):
        fetcher = FetcherFactice({"discord.com": {}})
        canal = CanalDiscord(url_crochet="https://discord.com/api/webhooks/x", fetcher=fetcher)
        self.assertTrue(await canal.envoyer("x" * 5000))

    async def test_le_filtre_par_categorie(self):
        """Sans lui, quarante messages par jour : ils cessent d'être lus au
        troisième, et le jour du coupe-circuit personne ne le voit."""

        notificateur = Notificateur(
            canaux=[CanalConsole()], categories=frozenset({"coupe_circuit"})
        )
        with redirect_stdout(io.StringIO()):
            self.assertEqual(await notificateur.diffuser("bruit", categorie="signal"), 0)
            self.assertEqual(await notificateur.diffuser("urgent", categorie="coupe_circuit"), 1)

    async def test_un_canal_en_exception_ne_fait_pas_tomber_les_autres(self):
        class CanalCasse:
            nom = "casse"

            async def envoyer(self, message):
                raise RuntimeError("boum")

        notificateur = Notificateur(canaux=[CanalCasse(), CanalConsole()])
        with redirect_stdout(io.StringIO()):
            self.assertEqual(await notificateur.diffuser("message"), 1)


class TestConstruction(unittest.TestCase):
    def test_console_par_defaut(self):
        notificateur = construire(config(), None)
        self.assertEqual([c.nom for c in notificateur.canaux], ["console"])

    def test_un_canal_sans_secret_est_ecarte_et_la_console_reste(self):
        charge = config()
        object.__setattr__(charge.notifications, "canaux", ("telegram",))
        notificateur = construire(charge, None)
        self.assertEqual([c.nom for c in notificateur.canaux], ["console"])


if __name__ == "__main__":
    unittest.main()
