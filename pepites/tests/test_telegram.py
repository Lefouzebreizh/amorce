#!/usr/bin/env python3
"""L'alerte, et surtout le silence.

Un radar qui prévient trois fois par heure du même jeton finit en sourdine, et
c'est ce jour-là qu'il a raison. La logique de silence est donc testée plus
finement que l'envoi lui-même, qui tient en dix lignes.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import MAINTENANT, candidat  # noqa: E402
from core.modeles import Observation, Pepite, Securite, SmartMoney, Verdict  # noqa: E402
from core.reglages import charger  # noqa: E402
from skills.convergence import mesurer, noter  # noqa: E402
from skills.telegram import doit_alerter, formater  # noqa: E402

REGLAGES = charger()
ALERTES = REGLAGES.alertes


def pepite(note_finale=82.0, **remplacements):
    c = candidat(**remplacements)
    metriques = mesurer(c)
    return Pepite(
        observation=Observation(
            candidat=c, metriques=metriques,
            note=noter(c, metriques, REGLAGES.convergence),
            confirme=True, raison_confirmation="confirmé sur 2 relevés",
        ),
        securite=Securite(verdict=Verdict.SUR, facteur=1.0, sources=("GoPlus",)),
        smart_money=SmartMoney(),
        note_finale=note_finale,
    )


class TestSilence(unittest.TestCase):
    def test_une_note_sous_le_seuil_ne_derange_pas(self):
        permis, raison = doit_alerter(None, 62.0, ALERTES, MAINTENANT)
        self.assertFalse(permis)
        self.assertIn("seuil", raison)

    def test_un_jeton_jamais_alerte_passe(self):
        self.assertTrue(doit_alerter(None, 82.0, ALERTES, MAINTENANT)[0])

    def test_un_jeton_alerte_recemment_est_tu(self):
        recente = (MAINTENANT - timedelta(hours=2), 80.0)
        permis, raison = doit_alerter(recente, 81.0, ALERTES, MAINTENANT)
        self.assertFalse(permis)
        self.assertIn("silence", raison)

    def test_une_progression_franche_rouvre_le_silence(self):
        # Ce n'est plus la même nouvelle : le signal s'est nettement renforcé.
        recente = (MAINTENANT - timedelta(hours=2), 71.0)
        self.assertTrue(doit_alerter(recente, 90.0, ALERTES, MAINTENANT)[0])

    def test_le_silence_expire(self):
        vieille = (MAINTENANT - timedelta(hours=20), 80.0)
        self.assertTrue(doit_alerter(vieille, 81.0, ALERTES, MAINTENANT)[0])


class TestMessage(unittest.TestCase):
    def test_le_message_porte_les_metriques_et_les_liens(self):
        texte = formater(pepite())
        self.assertIn("PEP", texte)
        self.assertIn("82/100", texte)
        self.assertIn("dexscreener.com", texte)
        self.assertIn("basescan.org", texte)

    def test_le_message_nomme_les_sources_de_securite(self):
        # Une alerte qui n'affiche que le bon côté finit par ne plus être crue.
        self.assertIn("GoPlus", formater(pepite()))

    def test_un_nom_de_jeton_contenant_du_balisage_est_echappe(self):
        # Le nom vient d'un contrat que n'importe qui a pu déployer : un jeton
        # nommé `<b>` casserait la mise en forme du message.
        from core.modeles import Jeton
        from aides import BASE
        malicieux = Jeton(chaine=BASE, adresse="0xX", symbole="<b>PEP",
                          nom="<script>alert(1)</script>")
        texte = formater(pepite(jeton=malicieux))
        self.assertNotIn("<script>", texte)
        self.assertIn("&lt;script&gt;", texte)


if __name__ == "__main__":
    unittest.main()
