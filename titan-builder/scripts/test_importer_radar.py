import importlib.util
import sqlite3
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('importer_radar', Path(__file__).with_name('importer-radar.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript('CREATE TABLE leads(id INTEGER, url TEXT, domain TEXT, product TEXT, snippet TEXT, status TEXT, contact_email TEXT, discovered_at TEXT); CREATE TABLE suppressions(value TEXT);')
        self.db.execute("INSERT INTO leads VALUES(1,'https://example.com/atelier','example.com','Titre ambigu','Extrait','new','','2026-09-13')")
        self.catalogue = {'signature': 'Test', 'exclusions': [], 'prospects': [{'id': 'atelier', 'name': 'Nom vérifié', 'radar_url': 'https://example.com/atelier', 'email': 'test@example.com'}]}

    def tearDown(self):
        self.db.close()

    def test_pas_de_nom_invente_depuis_un_titre(self):
        out, report = module.importer(self.db, {**self.catalogue, 'prospects': []})
        self.assertEqual(out['prospects'], [])
        self.assertEqual(report['a_documenter'][0]['status'], 'a_documenter')

    def test_profil_etat_non_approuve(self):
        out, _ = module.importer(self.db, self.catalogue)
        self.assertEqual(out['prospects'][0]['name'], 'Nom vérifié')
        self.assertFalse(out['prospects'][0]['approved'])

    def test_opposition_email_enrichi_et_statut_terminal(self):
        self.db.execute("INSERT INTO suppressions VALUES('test@example.com')")
        out, report = module.importer(self.db, self.catalogue)
        self.assertTrue(out['prospects'][0]['opposition'])
        self.assertEqual(len(report['exclus']), 1)
        self.db.execute('DELETE FROM suppressions')
        self.db.execute("UPDATE leads SET status='replied'")
        self.assertTrue(module.importer(self.db, self.catalogue)[0]['prospects'][0]['opposition'])

    def test_rapprochement_ambigu_refuse(self):
        with self.assertRaises(ValueError):
            module.importer(self.db, {**self.catalogue, 'prospects': self.catalogue['prospects'] * 2})

    def test_url_radar_invalide_est_exclue_sans_interrompre_le_rapport(self):
        self.db.execute("INSERT INTO leads VALUES(2,'http://','','Invalide','','new','','2026-09-13')")
        out, report = module.importer(self.db, self.catalogue)
        self.assertEqual(len(out['prospects']), 1)
        self.assertEqual(report['exclus'], [{'radar_id': 2, 'reason': 'URL invalide'}])


if __name__ == '__main__':
    unittest.main()
