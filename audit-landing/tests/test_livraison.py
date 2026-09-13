import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from commandes import Commandes
from livraison import livrer

class TestLivraison(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Commandes(Path(self.tmp.name) / 'registre.sqlite')
        self.base.enregistrer('cs_test', 'https://example.com', 'client@example.com')
        self.rapport = Path(self.tmp.name) / 'rapport.html'
        self.rapport.write_text('<html>Rapport illustré</html>')
        self.transport = Mock()
        self.transport.return_value.__enter__ = Mock(return_value=Mock(status=200, read=lambda: b'{"id":"email_test"}'))
        self.transport.return_value.__exit__ = Mock(return_value=False)

    def tearDown(self):
        self.base.fermer()
        self.tmp.cleanup()

    def approuver(self):
        self.base.prendre('cs_test')
        self.base.deposer('cs_test', self.rapport)
        self.base.approuver('cs_test', 'Relecteur test')

    def envoyer(self, **options):
        return livrer(self.base, 'cs_test', expediteur='audit@example.com',
                      cle_resend=options.get('cle', 'cle_factice'), transport=self.transport)

    def test_rapport_exact_et_un_seul_envoi(self):
        self.approuver()
        self.assertEqual(self.envoyer(), 'email_test')
        req = self.transport.call_args.args[0]
        corps = json.loads(req.data)
        self.assertEqual(base64.b64decode(corps['attachments'][0]['content']), self.rapport.read_bytes())
        self.assertEqual(corps['to'], ['client@example.com'])
        self.assertEqual(req.full_url, 'https://api.resend.com/emails')
        self.assertTrue(req.get_header('Idempotency-key').startswith('audit-'))
        self.assertIsNone(self.envoyer())
        self.assertEqual(self.transport.call_count, 1)

    def test_pas_de_relecture_pas_de_reseau(self):
        self.assertIsNone(self.envoyer())
        self.transport.assert_not_called()

    def test_configuration_absente_ne_reserve_pas_envoi(self):
        self.approuver()
        with self.assertRaises(ValueError): self.envoyer(cle='')
        self.assertEqual(self.base.lire('cs_test')['etat'], 'approuve')
        self.transport.assert_not_called()

    def test_panne_ne_produit_ni_succes_ni_rejeu(self):
        self.approuver()
        self.transport.side_effect = TimeoutError('détail confidentiel')
        with self.assertRaisesRegex(RuntimeError, 'Envoi non confirmé'): self.envoyer()
        self.assertEqual(self.base.lire('cs_test')['etat'], 'envoi')
        self.assertIsNone(self.envoyer())
        self.assertEqual(self.transport.call_count, 1)

    def test_reponse_sans_identifiant_non_confirmee(self):
        self.approuver()
        self.transport.return_value.__enter__.return_value.read = lambda: b'{}'
        with self.assertRaises(RuntimeError): self.envoyer()
        self.assertEqual(self.base.lire('cs_test')['etat'], 'envoi')
