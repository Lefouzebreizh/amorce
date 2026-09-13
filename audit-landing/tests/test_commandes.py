import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from commandes import Commandes

class TestCommandes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.fichier = Path(self.tmp.name) / 'commandes.sqlite'
        self.rapport = Path(self.tmp.name) / 'rapport.html'
        self.rapport.write_text('<html>Rapport relu</html>')
        self.base = Commandes(self.fichier)
        self.base.enregistrer('cs_test', 'https://example.com', 'client@example.com')

    def tearDown(self):
        self.base.fermer()
        self.tmp.cleanup()

    def test_rejeu_et_redemarrage(self):
        self.base.fermer()
        self.base = Commandes(self.fichier)
        self.assertFalse(self.base.enregistrer('cs_test', 'https://example.com', 'client@example.com'))
        with self.assertRaises(ValueError):
            self.base.enregistrer('cs_test', 'https://example.com', 'autre@example.com')

    def test_un_seul_processus_prend_la_commande(self):
        def prendre(_):
            base = Commandes(self.fichier)
            try: return base.prendre('cs_test')
            finally: base.fermer()
        with ThreadPoolExecutor(max_workers=6) as pool:
            self.assertEqual(sum(pool.map(prendre, range(6))), 1)

    def test_parcours_et_interdiction_double_envoi(self):
        self.assertIsNone(self.base.preparer_envoi('cs_test'))
        self.assertTrue(self.base.prendre('cs_test'))
        self.assertTrue(self.base.deposer('cs_test', self.rapport))
        self.assertIsNone(self.base.preparer_envoi('cs_test'))
        self.assertTrue(self.base.approuver('cs_test', 'Relecteur test'))
        envoi = self.base.preparer_envoi('cs_test')
        self.assertEqual(envoi['contenu'], self.rapport.read_bytes())
        self.assertEqual(envoi['destinataire'], 'client@example.com')
        self.assertIsNone(self.base.preparer_envoi('cs_test'))
        self.assertTrue(self.base.confirmer_envoi('cs_test', 'email_test'))
        self.assertEqual(self.base.a_traiter(), [])

    def test_modification_apres_relecture_refusee(self):
        self.base.prendre('cs_test')
        self.base.deposer('cs_test', self.rapport)
        self.base.approuver('cs_test', 'Relecteur test')
        self.rapport.write_text('autre contenu')
        with self.assertRaises(ValueError): self.base.preparer_envoi('cs_test')

    def test_envoi_interrompu_reste_visible_sans_rejeu(self):
        self.base.prendre('cs_test')
        self.base.deposer('cs_test', self.rapport)
        self.base.approuver('cs_test', 'Relecteur test')
        self.base.preparer_envoi('cs_test')
        self.base.fermer()
        self.base = Commandes(self.fichier)
        self.assertIsNone(self.base.preparer_envoi('cs_test'))
        self.assertEqual(self.base.a_traiter()[0]['etat'], 'envoi')


    def test_echec_analyse_explicite_et_reprise_manuelle(self):
        self.base.prendre('cs_test')
        self.assertTrue(self.base.signaler_echec_analyse('cs_test', 'capture impossible'))
        commande = self.base.lire('cs_test')
        self.assertEqual(commande['etat'], 'echec_analyse')
        self.assertEqual(commande['erreur'], 'capture impossible')
        self.assertTrue(self.base.reprendre_analyse('cs_test'))
        self.assertEqual(self.base.lire('cs_test')['etat'], 'attente')

    def test_migration_ajoute_erreur_a_un_registre_existant(self):
        self.base.fermer()
        import sqlite3
        self.fichier.unlink()
        brut = sqlite3.connect(self.fichier)
        brut.execute('CREATE TABLE commandes (session TEXT PRIMARY KEY, url TEXT, email TEXT, etat TEXT, rapport TEXT, empreinte TEXT, relecteur TEXT, message_id TEXT, modifie TEXT)')
        brut.close()
        self.base = Commandes(self.fichier)
        colonnes = {row['name'] for row in self.base.db.execute('PRAGMA table_info(commandes)')}
        self.assertIn('erreur', colonnes)
