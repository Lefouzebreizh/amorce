import json
import hashlib
import shutil
import sqlite3
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from tempfile import TemporaryDirectory
from threading import Barrier
from pathlib import Path

from checkout_pilote import creer_session, livrer_edition, verifier_acces, stripe_test


class AchatPilote(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.session = {"id": "cs_test_commande", "livemode": False, "mode": "payment",
                        "client_reference_id": "compte-a", "status": "complete",
                        "metadata": {"phare_commande": str(uuid4())},
                        "payment_status": "paid", "amount_total": 1000, "currency": "eur",
                        "line_items": {"has_more": False, "data": [
                            {"price": {"product": "prod_phare"}, "quantity": 1, "amount_total": 1000}]}}
        self.debit = {"livemode": False, "paid": True, "currency": "eur",
                      "amount_captured": 1000, "amount_refunded": 0}
        self.session["payment_intent"] = {"latest_charge": self.debit}
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

    def test_deux_sessions_payees_pour_une_commande_concurrente(self):
        depart = Barrier(2)
        with TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "recette.sqlite"

            def verifier_session(session_id):
                session = dict(self.session, id=session_id)
                db = sqlite3.connect(chemin)
                try:
                    depart.wait(timeout=5)
                    return verifier_acces(Mock(return_value=session), db, "prod_phare", "compte-a", session_id)
                except ValueError as erreur:
                    return str(erreur)
                finally:
                    db.close()

            with ThreadPoolExecutor(max_workers=2) as pool:
                resultats = list(pool.map(verifier_session, ["cs_test_a", "cs_test_b"]))
            self.assertCountEqual(resultats, ["acces_de_test_attribue",
                                  "Conflit commande/session : vérifier les règlements de test."])
            db = sqlite3.connect(chemin)
            try:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM achats_test").fetchone(), (1,))
            finally:
                db.close()

    def test_session_sans_commande_ou_reaffectee(self):
        metadata = self.session.pop("metadata")
        with self.assertRaises(ValueError):
            self.verifier()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM sqlite_master").fetchone(), (0,))
        self.session["metadata"] = metadata
        self.verifier()
        self.session["metadata"] = {"phare_commande": str(uuid4())}
        with self.assertRaisesRegex(ValueError, "Conflit"):
            self.verifier()

    def test_reprise_achat_inscrit_avant_liaison_des_commandes(self):
        self.db.execute("""CREATE TABLE achats_test (session TEXT PRIMARY KEY, compte TEXT NOT NULL,
                         produit TEXT NOT NULL, centimes INTEGER NOT NULL)""")
        self.db.execute("INSERT INTO achats_test VALUES (?, ?, ?, ?)",
                        (self.session["id"], "compte-a", "prod_phare", 1000))
        self.db.commit()
        self.verifier()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM achats_test").fetchone(), (1,))
        liaison = self.db.execute("SELECT commande, session FROM commandes_test").fetchone()
        self.assertEqual(liaison, (self.session["metadata"]["phare_commande"], self.session["id"]))


    def test_livraison_depuis_la_commande_operateur(self):
        ici = Path(__file__).resolve().parent
        with TemporaryDirectory() as dossier:
            racine = Path(dossier)
            fichiers = racine / "edition"
            shutil.copytree(ici / "fixtures/edition-test", fichiers)
            manifeste = fichiers / "edition-test.json"
            edition = json.loads(manifeste.read_text())
            produit = edition["produit"]
            source = fichiers / edition["fichier"]
            destination = racine / "recu.txt"
            base = racine / "achats.sqlite"
            self.session["line_items"]["data"][0]["price"]["product"] = produit

            def livrer(compte="compte-a", article=produit):
                return subprocess.run([
                    sys.executable, str(ici / "checkout_pilote.py"), "--produit", article,
                    "--compte", compte, "livrer", "--session", self.session["id"],
                    "--base-test", str(base), "--manifeste", str(manifeste),
                    "--destination", str(destination)], capture_output=True, text=True)

            db = sqlite3.connect(base)
            try:
                verifier_acces(self.api, db, produit, "compte-a", self.session["id"])
            finally:
                db.close()

            for refus in (livrer(compte="compte-b"), livrer(article="prod_album")):
                self.assertNotEqual(refus.returncode, 0)
                self.assertIn("Aucun droit", refus.stderr)
                self.assertFalse(destination.exists())

            contenu = source.read_bytes()
            source.write_bytes(contenu + b"?")
            corrompu = livrer()
            self.assertNotEqual(corrompu.returncode, 0)
            self.assertIn("empreinte", corrompu.stderr)
            self.assertFalse(destination.exists())
            source.write_bytes(contenu)

            accord = livrer()
            self.assertEqual(accord.returncode, 0, accord.stderr)
            self.assertEqual(destination.read_bytes(), contenu)
            self.assertEqual(json.loads(accord.stdout)["sha256"], hashlib.sha256(contenu).hexdigest())
            destination.write_bytes(b"copie personnelle")
            self.assertNotEqual(livrer().returncode, 0)
            self.assertEqual(destination.read_bytes(), b"copie personnelle")
            self.debit["amount_refunded"] = 1000
            with sqlite3.connect(base) as db:
                self.assertEqual(verifier_acces(self.api, db, produit, "compte-a", self.session["id"]),
                                 "acces_de_test_rembourse")
            destination.unlink()
            self.assertIn("Aucun droit", livrer().stderr)
            self.assertFalse(destination.exists())

    def test_remboursement_total_avant_attribution_et_rejeu(self):
        self.debit["amount_refunded"] = 1000
        self.assertEqual(self.verifier(), "acces_de_test_rembourse")
        self.debit["amount_refunded"] = 0
        self.assertEqual(self.verifier(), "acces_de_test_rembourse")

    def test_remboursement_partiel_et_isolation_des_comptes(self):
        self.debit["amount_refunded"] = 300
        self.assertEqual(self.verifier(), "acces_de_test_attribue")
        self.debit["amount_refunded"] = 1000
        with self.assertRaises(ValueError):
            self.verifier("compte-b")
        self.assertEqual(self.db.execute("SELECT centimes FROM remboursements_test").fetchone(), (300,))
        self.assertEqual(self.verifier(), "acces_de_test_rembourse")

    def test_remboursement_inconnu_ne_valide_pas(self):
        self.session["payment_intent"] = "pi_incomplet"
        with self.assertRaisesRegex(ValueError, "Débit"):
            self.verifier()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM sqlite_master").fetchone(), (0,))

    def test_remboursement_entre_copie_et_publication(self):
        manifeste = Path(__file__).resolve().parent / "fixtures/edition-test/edition-test.json"
        produit = json.loads(manifeste.read_text())["produit"]
        identifiant = self.session["id"]
        self.session["line_items"]["data"][0]["price"]["product"] = produit
        with TemporaryDirectory() as dossier:
            base = Path(dossier) / "recette.sqlite"
            destination = Path(dossier) / "livre.txt"
            rembourseur = sqlite3.connect(base)
            livreur = sqlite3.connect(base)
            try:
                verifier_acces(self.api, rembourseur, produit, "compte-a", identifiant)

                def anticiper_verrou(instruction):
                    if instruction == "BEGIN IMMEDIATE":
                        self.debit["amount_refunded"] = 1000
                        verifier_acces(self.api, rembourseur, produit, "compte-a", identifiant)

                livreur.set_trace_callback(anticiper_verrou)
                with self.assertRaisesRegex(ValueError, "Aucun droit"):
                    livrer_edition(livreur, produit, "compte-a", identifiant, manifeste, destination)
                self.assertFalse(destination.exists())
            finally:
                livreur.close()
                rembourseur.close()
