import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerTests(unittest.TestCase):
    def plan(self):
        return dict(version=1, title='Test', lyrics='Mes mots', musicDirection='Acoustique', visualDirection='Mer', duration=30, takes=2, aspect='16:9', resolution='1080p', scenes=[])

    def test_quote_needs_no_provider_and_counts_all_variants(self):
        with patch.object(worker, 'api_request', side_effect=AssertionError('No network')):
            quote = worker.quote(self.plan())
        self.assertEqual(quote['seconds'], 30)
        self.assertAlmostEqual(quote['video'], 6.25536)
        self.assertAlmostEqual(quote['music'], .16)

    def test_invalid_and_undercovered_plans_are_rejected(self):
        for change in [dict(duration=True), dict(takes=0), dict(scenes=[dict(prompt='Mer', duration=3)])]:
            with self.assertRaises(ValueError):
                worker.quote({**self.plan(), **change})

    def test_completed_source_is_reused_without_second_billable_call(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            state = {'generations': {}}
            result = {'id': 'v1_test', 'status': 'completed', 'steps': [{'type': 'model_output', 'content': [{'type': 'audio', 'data': base64.b64encode(b'fixture-not-real-audio').decode()}]}]}
            with patch.object(worker, 'api_request', return_value=result) as api:
                first = worker.generate_media('not-a-key', {'model': 'fixture'}, 'audio', 'test.mp3', output, state)
                second = worker.generate_media('not-a-key', {'model': 'fixture'}, 'audio', 'test.mp3', output, state)
                self.assertEqual(first, second)
                self.assertEqual(api.call_count, 1)
            self.assertNotIn('not-a-key', (output / 'state.json').read_text())
            first.write_bytes(b'altered')
            with self.assertRaises(ValueError):
                worker.generate_media('not-a-key', {'model': 'fixture'}, 'audio', 'test.mp3', output, state)

    def test_uncertain_billable_request_is_never_automatically_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            state = {'generations': {}}
            with patch.object(worker, 'api_request', side_effect=TimeoutError('uncertain')) as api:
                with self.assertRaises(TimeoutError):
                    worker.generate_media('not-a-key', {'model': 'fixture'}, 'audio', 'test.mp3', output, state)
                with self.assertRaisesRegex(RuntimeError, 'incertaine'):
                    worker.generate_media('not-a-key', {'model': 'fixture'}, 'audio', 'test.mp3', output, state)
                self.assertEqual(api.call_count, 1)
            self.assertEqual(json.loads((output / 'state.json').read_text())['generations']['test.mp3']['state'], 'submitting')


if __name__ == '__main__':
    unittest.main()
