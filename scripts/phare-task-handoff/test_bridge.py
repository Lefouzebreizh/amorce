import asyncio
from contextlib import closing
import copy
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from bridge import HANDLER, MARKER, SCHEDULER_SHA256, bounded_read, checked_path, inspect_scope, run, strict_json, validate_submission


def submission():
    return {'format': 'phare-task-handoff', 'version': 1, 'schedulerSourceSha256': SCHEDULER_SHA256, 'projet': 'fixture-project', 'nom': HANDLER, 'lourd': False, 'delai_secondes': 5,
            'payload': {'format': 'phare-synthetic-reference-audit', 'version': 1, 'task': {'id': 'fixture-task', 'ownerId': 'fixture-owner', 'projectId': 'fixture-project', 'idempotencyKey': 'once-fixture'}, 'recipe': {'id': 'fixture-method', 'version': '1.0.0'}, 'stepId': 'verify', 'capability': 'fixtures.verify', 'permissions': ['read_task'], 'sourceRefs': ['fixture:brief'], 'engine': {'id': 'fixture-engine', 'version': '1.0.0', 'execution': 'deterministic_local'}}}


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.sources = self.root / 'sources'; self.sources.mkdir()
        content = b'Synthetic fixture only.\n'
        (self.sources / 'brief.txt').write_bytes(content)
        self.manifest = {'format': 'phare-handoff-fixtures', 'version': 1, 'synthetic': True, 'ownerId': 'fixture-owner', 'projectId': 'fixture-project', 'sources': [{'ref': 'fixture:brief', 'name': 'brief.txt', 'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}]}
        self.write_manifest()
        self.registry = self.root / 'state' / 'tasks.sqlite'
        self.scheduler = os.environ.get('PHARE_SCHEDULER_REFERENCE', '')
    def tearDown(self): self.temp.cleanup()
    def write_manifest(self): (self.sources / MARKER).write_text(json.dumps(self.manifest), encoding='utf-8')
    def do_run(self, request=None, **kwargs):
        return asyncio.run(run(request or submission(), self.sources, self.registry, 'fixture-owner', 'fixture-project', self.scheduler, synthetic_only=True, **kwargs))

    def test_strict_json_refuses_duplicate_keys_and_nonfinite_values(self):
        for value in ['{"ownerId":"one","ownerId":"two"}', '{"x":NaN}', '{"x":Infinity}']:
            with self.assertRaises(ValueError): strict_json(value)

    def test_unsupported_permissions_handlers_models_or_fields_are_refused(self):
        for field, value in [('permissions', ['send_external']), ('capability', 'text.draft'), ('engine', {'id': 'fixture-engine', 'version': '1.0.0', 'execution': 'local_model'})]:
            request = submission(); request['payload'][field] = value
            with self.assertRaises(ValueError): validate_submission(request, 'fixture-owner', 'fixture-project')
        request = submission(); request['payload']['command'] = 'not executable'
        with self.assertRaises(ValueError): validate_submission(request, 'fixture-owner', 'fixture-project')
        self.assertFalse(self.registry.exists())

    def test_reference_scope_and_relative_paths_are_enforced_before_registry_write(self):
        for value in ['../outside.txt', 'sub/file.txt', 'C:outside.txt', '..']:
            self.manifest['sources'][0]['name'] = value; self.write_manifest()
            with self.assertRaises(ValueError): inspect_scope(self.sources, submission())
        self.assertFalse(self.registry.exists())

    def test_nonregular_file_is_refused_before_open(self):
        if not hasattr(os, 'mkfifo'): self.skipTest('FIFO unavailable on this platform')
        fifo = self.root / 'pipe'; os.mkfifo(fifo)
        with patch('bridge.os.open', side_effect=AssertionError('must not open FIFO')):
            with self.assertRaises(ValueError): bounded_read(fifo, 100)

    def test_unc_paths_are_refused_before_filesystem_access(self):
        with patch('bridge.os.path.abspath', side_effect=AssertionError('must not access UNC path')):
            for value in ['//server/share/fixture', '\\\\server\\share\\fixture']:
                with self.assertRaisesRegex(ValueError, 'UNC'): checked_path(value)

    def test_unselected_manifested_source_content_is_not_read(self):
        (self.sources / 'unselected.txt').write_text('Unselected synthetic fixture.')
        self.manifest['sources'].append({'ref': 'fixture:unselected', 'name': 'unselected.txt', 'size': 1, 'sha256': '0' * 64})
        self.write_manifest()
        real_read = bounded_read
        def selected_only(path, maximum):
            if path.name == 'unselected.txt': raise AssertionError('Unselected source was read')
            return real_read(path, maximum)
        with patch('bridge.bounded_read', side_effect=selected_only):
            self.assertEqual(inspect_scope(self.sources, submission())[0]['ref'], 'fixture:brief')

    @unittest.skipUnless(os.environ.get('PHARE_SCHEDULER_REFERENCE'), 'Pinned existing scheduler source must be explicitly supplied')
    def test_real_scheduler_result_and_idempotence_preserve_sources(self):
        before = {p.name: p.read_bytes() for p in self.sources.iterdir()}
        first = self.do_run(); second = self.do_run()
        self.assertEqual(first['state'], 'succeeded'); self.assertTrue(first['verified']); self.assertEqual(first['newTasks'], 1)
        self.assertEqual(first['row']['etat'], 'terminee'); self.assertEqual(second['state'], 'deduplicated'); self.assertEqual(second['newTasks'], 0)
        self.assertEqual(first['row']['id'], second['row']['id'])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.sources.iterdir()})
        with closing(sqlite3.connect(self.registry)) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM taches').fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT owner_id,project_id FROM handoff_identity').fetchone(), ('fixture-owner', 'fixture-project'))

    @unittest.skipUnless(os.environ.get('PHARE_SCHEDULER_REFERENCE'), 'Pinned existing scheduler source must be explicitly supplied')
    def test_conflicting_key_corrupt_result_and_unresolved_claim_are_not_retried(self):
        self.do_run()
        changed = submission(); changed['payload']['task']['id'] = 'other-task'
        with self.assertRaisesRegex(ValueError, 'Idempotency'): self.do_run(changed)
        with closing(sqlite3.connect(self.registry)) as db, db:
            original = db.execute('SELECT resultat FROM taches').fetchone()[0]
            db.execute('UPDATE taches SET resultat=?', ('{}',))
        with self.assertRaisesRegex(ValueError, 'corrupted'): self.do_run()
        with closing(sqlite3.connect(self.registry)) as db, db:
            db.execute('UPDATE taches SET resultat=?', (original,))
            db.execute("UPDATE handoff_claims SET state='claimed'")
        with self.assertRaisesRegex(RuntimeError, 'Unresolved'): self.do_run()
        with closing(sqlite3.connect(self.registry)) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM taches').fetchone()[0], 1)

    @unittest.skipUnless(os.environ.get('PHARE_SCHEDULER_REFERENCE'), 'Pinned existing scheduler source must be explicitly supplied')
    def test_foreign_registry_and_changed_scheduler_are_refused_without_mutation(self):
        self.registry.parent.mkdir()
        with closing(sqlite3.connect(self.registry)) as db, db: db.execute('CREATE TABLE foreign_data(x TEXT)')
        before = self.registry.read_bytes()
        with self.assertRaises((ValueError, sqlite3.DatabaseError)): self.do_run()
        self.assertEqual(self.registry.read_bytes(), before)
        fake = self.root / 'wrong_scheduler.py'; fake.write_text('raise RuntimeError("must never execute")')
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            asyncio.run(run(submission(), self.sources, self.root / 'other.sqlite', 'fixture-owner', 'fixture-project', fake, synthetic_only=True))
        self.assertFalse((self.root / 'other.sqlite').exists())


if __name__ == '__main__': unittest.main()
