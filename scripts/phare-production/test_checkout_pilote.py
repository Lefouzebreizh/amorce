import sqlite3
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from checkout_pilote import creer_session, verifier_acces, stripe_test


class AchatPilote(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.session = {"id": "cs_test_commande", "livemode": False, "mode": "payment",
                        "client_reference_id": "compte-a", "status": "complete",
                        "payment_status": "paid", "amount_total": 1000, "currency": "eur",
                        "line_items": {"has_more": False, "data": [
                            {"price": {"product": "prod_phare"}, "quantity": 1, "amount_total": 1000}]}}
        self.api = Mock(return_value=self.session)

    def verifier(self, compte="compte-a"):
        return verifier_acces(self.api, self.db, "prod_phare", compte, self.session["id"])

    def test_prix_libre_et_reprise(self):
        commande = str(uuid4())
        for montant in (1000, 2000, 2700):
            creer_session(self.api, "prod_phare", "compte-a", commande, montant, "https://example.org/merci")
            args = self.api.call_args.args
            self.assertEqual(args[2]["line_items[0][price_data][unit_amount]"], montant)
            self.assertTrue(args[3].endswith(commande))
        self.api.reset_mock()
        with self.assertRaises(ValueError):
            creer_session(self.api, "prod_phare", "compte-a", commande, 999, "https://example.org/merci")
        self.api.assert_not_called()

    def test_attribution_unique_et_isolee(self):
        self.assertEqual(self.verifier(), "acces_de_test_attribue")
        self.assertEqual(self.verifier(), "acces_de_test_attribue")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM achats_test").fetchone(), (1,))
        with self.assertRaises(ValueError):
            self.verifier("compte-b")

    def test_paiement_en_attente(self):
        self.session["payment_status"] = "unpaid"
        self.assertEqual(self.verifier(), "en_attente")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM sqlite_master").fetchone(), (0,))

    def test_produit_montant_et_mode(self):
        for champ, valeur in (("livemode", True), ("amount_total", 500), ("currency", "usd")):
            with self.subTest(champ=champ), patch.dict(self.session, {champ: valeur}), self.assertRaises(ValueError):
                self.verifier()
        self.session["line_items"]["data"][0]["price"]["product"] = "prod_album"
        with self.assertRaises(ValueError):
            self.verifier()

    def test_cle_de_production_refusee(self):
        with patch.dict("os.environ", {"STRIPE_TEST_SECRET_KEY": "sk_live_fictive"}), self.assertRaises(ValueError):
            stripe_test("GET", "/checkout/sessions/x", {}, None)
