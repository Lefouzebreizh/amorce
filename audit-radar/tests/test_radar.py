import importlib.util
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "radar.py"
SPEC = importlib.util.spec_from_file_location("radar", MODULE_PATH)
radar = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules["radar"] = radar
SPEC.loader.exec_module(radar)


class RadarTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = radar.connect(Path(self.temp.name) / "radar.sqlite3")

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_normalize_url(self):
        self.assertEqual(radar.normalize_url("Example.com/pricing/"), "https://example.com/pricing")
        with self.assertRaises(ValueError):
            radar.normalize_url("file:///etc/passwd")

    def test_high_intent_assessment_reaches_review_threshold(self):
        markup = """<html><title>Mon SaaS</title><body>Tarifs abonnement mensuel. Déjà 200 clients.<script src='https://x.supabase.co/a.js'></script></body></html>"""
        result = radar.assess("https://produit.fr", markup, "Fondateur bloqué par une erreur Stripe en production", True)
        self.assertGreaterEqual(result.score, 7)
        self.assertIn("Supabase", result.tech)
        self.assertNotIn("faille", result.fact.casefold())

    def test_weak_lead_is_not_over_scored(self):
        result = radar.assess("https://portfolio.example", "<html><body>Mon projet étudiant</body></html>", "", False)
        self.assertLess(result.score, 7)

    def test_upsert_deduplicates_exact_url(self):
        first = radar.upsert_lead(self.db, "https://example.com", "source A", snippet="court")
        second = radar.upsert_lead(self.db, "https://example.com/", "source B", snippet="description plus longue")
        self.assertEqual(first, second)
        row = self.db.execute("SELECT * FROM leads").fetchone()
        self.assertEqual(row["snippet"], "description plus longue")

    def test_imports_prequalified_private_batch(self):
        source = Path(self.temp.name) / "batch.csv"
        source.write_text(
            'url,source,snippet,product,status,score,public_fact,score_reasons\n'
            'https://example.fr,Plateforme publique,Bug Stripe en production,Produit,review,8,'
            'Le budget et le problème sont indiqués publiquement.,"[""Douleur précise (+2)""]"\n',
            encoding="utf-8",
        )
        count = radar.import_leads(self.db, source, {"limits": {"minimum_score": 7}, "identity": {}})
        self.assertEqual(count, 1)
        row = self.db.execute("SELECT * FROM leads").fetchone()
        self.assertEqual(row["status"], "review")
        self.assertEqual(row["score"], 8)
        self.assertIn("Répondez simplement", row["draft_body"])

    def test_import_rejects_unqualified_review(self):
        source = Path(self.temp.name) / "batch.csv"
        source.write_text(
            'url,source,snippet,product,status,score,public_fact,score_reasons\n'
            'https://example.fr,Plateforme publique,Besoin flou,Produit,review,4,Fait public,[]\n',
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "score minimal"):
            radar.import_leads(self.db, source, {"limits": {"minimum_score": 7}})

    def test_draft_contains_boundary_and_opt_out(self):
        lead_id = radar.upsert_lead(self.db, "https://example.fr", "annuaire public", product="Produit")
        self.db.execute("UPDATE leads SET public_fact=? WHERE id=?", ("Une page tarifaire est visible.", lead_id))
        row = self.db.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
        subject, body = radar.make_draft(row, {"identity": {"name": "Erwann", "brand": "Lefouzèbreizh"}})
        self.assertIn("Produit", subject)
        self.assertIn("sans rien forcer", body)
        self.assertIn("Répondez simplement « non »", body)

    def test_status_allowlist(self):
        lead_id = radar.upsert_lead(self.db, "https://example.fr", "manuel")
        radar.set_status(self.db, lead_id, "approved")
        self.assertEqual(self.db.execute("SELECT status FROM leads WHERE id=?", (lead_id,)).fetchone()[0], "approved")
        with self.assertRaises(ValueError):
            radar.set_status(self.db, lead_id, "sent-without-review")

    def test_suppression_blocks_export(self):
        lead_id = radar.upsert_lead(self.db, "https://example.fr", "manuel")
        radar.set_status(self.db, lead_id, "approved")
        self.db.execute("INSERT INTO suppressions(value,reason,created_at) VALUES(?,?,?)", ("example.fr", "opposition", radar.utcnow()))
        output = Path(self.temp.name) / "export.csv"
        self.assertEqual(radar.export_approved(self.db, output), 0)

    def test_private_hosts_are_rejected(self):
        with self.assertRaises(ValueError):
            radar.assert_public_host("http://127.0.0.1/admin")
        with self.assertRaises(ValueError):
            radar.assert_public_host("http://169.254.169.254/latest/meta-data")

    def test_redirect_to_private_host_is_rejected_before_request(self):
        handler = radar.PublicOnlyRedirectHandler()
        request = radar.Request("https://example.com")
        with self.assertRaises(ValueError):
            handler.redirect_request(request, None, 302, "Found", {}, "http://127.0.0.1/admin")


if __name__ == "__main__":
    unittest.main()
