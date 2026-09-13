import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from reception import application
from commandes import Commandes

class TestReception(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'base.sqlite'
        self.app = application(self.path, 's' * 32)
    def tearDown(self): self.tmp.cleanup()
    def appeler(self, secret='s'*32, email='client@example.com'):
        data = json.dumps({'sessionId':'cs_test', 'url':'https://example.com', 'email':email}).encode()
        status = []
        list(self.app({'PATH_INFO':'/commandes', 'REQUEST_METHOD':'POST',
                       'HTTP_AUTHORIZATION':'Bearer '+secret, 'CONTENT_LENGTH':str(len(data)),
                       'wsgi.input':io.BytesIO(data)}, lambda code, headers: status.append(code)))
        return status[0]
    def test_persistance_et_rejeu(self):
        self.assertEqual(self.appeler(), '201 Created')
        self.assertEqual(self.appeler(), '200 OK')
        base = Commandes(self.path)
        self.assertEqual(len(base.a_traiter()), 1)
        base.fermer()
    def test_destinataire_change_refuse(self):
        self.appeler()
        self.assertEqual(self.appeler(email='autre@example.com'), '409 Conflict')
    def test_secret_invalide_aucune_base(self):
        self.assertEqual(self.appeler(secret='incorrect'), '401 Unauthorized')
        self.assertFalse(self.path.exists())
    def test_disque_indisponible_non_acquitte(self):
        self.app = application(Path(self.tmp.name)/'absent'/'base.sqlite', 's'*32)
        self.assertEqual(self.appeler(), '503 Service Unavailable')
