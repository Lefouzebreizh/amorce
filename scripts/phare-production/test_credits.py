import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from credits import Ledger, CreditError
import unittest
import tempfile
from concurrent.futures import ThreadPoolExecutor


class CreditsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Ledger(Path(self.temp.name) / 'credits.sqlite')
        self.db.grant('trial-1', 'alice', 10)

    def test_grant_replay_and_mutation(self):
        self.db.grant('trial-1', 'alice', 10)
        self.assertEqual(self.db.balance('alice'), 10)
        with self.assertRaises(CreditError):
            self.db.grant('trial-1', 'bob', 10)

    def test_two_concurrent_jobs_cannot_spend_same_balance(self):
        def reserve(n):
            try:
                self.db.reserve(str(n), 'alice', 7, 'plan')
                return True
            except CreditError:
                return False
        with ThreadPoolExecutor(2) as pool:
            self.assertEqual(sum(pool.map(reserve, [1, 2])), 1)
        self.assertEqual(self.db.balance('alice'), 3)

    def test_replay_survives_restart_without_double_charge(self):
        self.db.reserve('job', 'alice', 7, 'plan')
        restarted = Ledger(self.db.path)
        restarted.reserve('job', 'alice', 7, 'plan')
        restarted.finish('job', 'alice', 'consumed')
        restarted.finish('job', 'alice', 'consumed')
        self.assertEqual(restarted.balance('alice'), 3)
        with self.assertRaises(CreditError):
            restarted.reserve('job', 'alice', 7, 'changed-plan')

    def test_account_isolation_and_insufficient_balance(self):
        self.assertEqual(self.db.balance('bob'), 0)
        with self.assertRaises(CreditError):
            self.db.reserve('job', 'bob', 1, 'plan')
        self.db.reserve('job', 'alice', 7, 'plan')
        with self.assertRaises(CreditError):
            self.db.finish('job', 'bob', 'released')
        with self.assertRaises(CreditError):
            self.db.reserve('job', 'bob', 7, 'plan')

    def test_uncertain_job_stays_reserved_and_release_is_final(self):
        self.db.reserve('uncertain', 'alice', 10, 'plan')
        self.assertEqual(self.db.balance('alice'), 0)
        self.db.finish('uncertain', 'alice', 'released')
        self.assertEqual(self.db.balance('alice'), 10)
        with self.assertRaises(CreditError):
            self.db.reserve('uncertain', 'alice', 10, 'plan')

    def test_invalid_units_cannot_create_balance(self):
        for value in (True, 0, -1, 1.2, float('nan')):
            with self.assertRaises(CreditError):
                self.db.grant('bad', 'alice', value)
            with self.assertRaises(CreditError):
                self.db.reserve('bad', 'alice', value, 'plan')


if __name__ == '__main__':
    unittest.main()

class WorkerQuotaTests(unittest.TestCase):
    def test_exhausted_balance_prevents_provider_call(self):
        import worker
        import json
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plan = root / 'plan.json'
            plan.write_text(json.dumps(dict(version=1, title='Test', lyrics='Mes mots', musicDirection='Acoustique', visualDirection='Mer', duration=30, takes=1, aspect='16:9', resolution='1080p', scenes=[])))
            dbpath = root / 'credits.sqlite'
            Ledger(dbpath)
            env = dict(PHARE_PAID_GENERATION_ENABLED='true', GEMINI_API_KEY='fake-key', PHARE_CREATION_QUOTAS_ENABLED='true', PHARE_CREDITS_DB=str(dbpath), PHARE_JOB_CREDIT_UNITS='5')
            argv = ['worker', str(plan), '--allow-paid', '--budget-usd', '100', '--output', str(root / 'output'), '--credit-account', 'alice', '--credit-job', 'job']
            with patch.dict('os.environ', env), patch('sys.argv', argv), patch.object(worker, 'generate_media') as generate:
                with self.assertRaises(CreditError):
                    worker.main()
                generate.assert_not_called()
