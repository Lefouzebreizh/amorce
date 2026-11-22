import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import tempfile
import unittest

from credits import CreditError, Ledger
from credit_service import AuthenticationRequired, CreditReadService, ProductionRate


class CreditReadServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.ledger = Ledger(Path(self.temp.name) / 'credits.sqlite')
        self.ledger.grant('trial-alice', 'alice', 20)
        self.ledger.grant('trial-bob', 'bob', 70)
        self.context = object()
        self.catalogue = {'fixture-30s-720p-1take': ProductionRate(5, True),
                          'future': ProductionRate(9)}
        self.service = CreditReadService(self.ledger,
            lambda context: 'alice' if context is self.context else None,
            self.catalogue, 'fixture-v1')

    def test_unverified_account_field_is_not_identity(self):
        for context in (None, 'alice', {'account': 'alice'}, {'compteId': 'bob'}):
            with self.assertRaises(AuthenticationRequired):
                self.service.balance(context)
            with self.assertRaises(AuthenticationRequired):
                self.service.quote(context, 'fixture-30s-720p-1take')

    def test_snapshot_separates_pending_consumed_and_released_and_isolates_account(self):
        self.ledger.reserve('pending', 'alice', 5, 'a')
        self.ledger.reserve('done', 'alice', 7, 'b')
        self.ledger.finish('done', 'alice', 'consumed')
        self.ledger.reserve('cancelled', 'alice', 3, 'c')
        self.ledger.finish('cancelled', 'alice', 'released')
        self.ledger.reserve('bob-job', 'bob', 40, 'd')
        result = self.service.balance(self.context)
        self.assertEqual(result['credits'], dict(granted=20, reserved=5, consumed=7, available=8))
        self.assertNotIn('alice', str(result))
        self.assertNotIn('bob', str(result))

    def test_quote_is_non_reserving_and_rechecks_current_balance(self):
        first = self.service.quote(self.context, 'fixture-30s-720p-1take')
        self.assertEqual(first['status'], 'ready')
        self.assertEqual(first['requiredCredits'], 5)
        self.assertFalse(first['reservationMade'])
        self.assertEqual(self.ledger.balance('alice'), 20)
        self.ledger.reserve('other-tab', 'alice', 18, 'other')
        second = self.service.quote(self.context, 'fixture-30s-720p-1take')
        self.assertEqual(second['status'], 'insufficient_credits')
        self.assertFalse(second['canRequestProduction'])
        self.assertTrue(second['existingFilesAccessible'])

    def test_unavailable_profiles_and_catalogue_mutation_cannot_enable_production(self):
        self.catalogue['fixture-30s-720p-1take'] = ProductionRate(1, True)
        self.assertEqual(self.service.quote(self.context, 'fixture-30s-720p-1take')['requiredCredits'], 5)
        for profile in ('future', 'unknown'):
            quote = self.service.quote(self.context, profile)
            self.assertEqual(quote['status'], 'unavailable')
            self.assertIsNone(quote['requiredCredits'])
            self.assertFalse(quote['canRequestProduction'])

    def test_invalid_configuration_and_profile_rejected(self):
        for units in (True, 0, -1, 1.2):
            with self.assertRaises(CreditError):
                ProductionRate(units, True)
        with self.assertRaises(CreditError):
            ProductionRate(1, 'true')
        with self.assertRaises(CreditError):
            self.service.quote(self.context, {'units': 1})


if __name__ == '__main__':
    unittest.main()
