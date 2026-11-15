"""Synthetic-only bridge. Execution is delegated to the existing pinned Ordonnanceur.
No shell, generated code, model, public endpoint or background service is provided.
"""
from __future__ import annotations
import argparse
import asyncio
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import sys
import types

SCHEDULER_SHA256 = '70ee094adaa5a32701741ee71842cb9c391609da3b4b3b485076457db418aaa6'
HANDLER = 'phare_synthetic_reference_audit_v1'
MARKER = 'PHARE_HANDOFF_FIXTURES.json'
PROTOCOL = 'phare-task-handoff-v1'


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def strict_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result: raise ValueError('Duplicate JSON key')
            result[key] = value
        return result
    def nonfinite(_): raise ValueError('Nonfinite JSON value')
    try:
        return json.loads(data, object_pairs_hook=unique, parse_constant=nonfinite)
    except RecursionError as exc:
        raise ValueError('JSON nesting too deep') from exc


def shape(value, fields):
    if not isinstance(value, dict) or set(value) != set(fields.split()):
        raise ValueError('Unknown or missing field')
    return value


def token(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,99}', value):
        raise ValueError('Invalid identifier')
    return value


def validate_submission(value, owner_id, project_id):
    token(owner_id); token(project_id)
    shape(value, 'format version schedulerSourceSha256 projet nom payload lourd delai_secondes')
    if value['format'] != 'phare-task-handoff' or type(value['version']) is not int or value['version'] != 1 or value['schedulerSourceSha256'] != SCHEDULER_SHA256 or value['projet'] != project_id or value['nom'] != HANDLER or value['lourd'] is not False or type(value['delai_secondes']) is not int or value['delai_secondes'] != 5:
        raise ValueError('Unsupported submission')
    p = shape(value['payload'], 'format version task recipe stepId capability permissions sourceRefs engine')
    t = shape(p['task'], 'id ownerId projectId idempotencyKey')
    for field in t.values(): token(field)
    if t['ownerId'] != owner_id or t['projectId'] != project_id:
        raise ValueError('Foreign owner or project')
    r = shape(p['recipe'], 'id version'); token(r['id'])
    if not isinstance(r['version'], str) or not re.fullmatch(r'\d{1,5}\.\d{1,5}\.\d{1,5}', r['version']):
        raise ValueError('Unsupported recipe version')
    e = shape(p['engine'], 'id version execution'); token(e['id'])
    if not isinstance(e['version'], str) or not e['version'] or len(e['version']) > 100 or e['execution'] != 'deterministic_local':
        raise ValueError('Only deterministic local execution is supported')
    token(p['stepId'])
    if p['format'] != 'phare-synthetic-reference-audit' or type(p['version']) is not int or p['version'] != 1 or p['capability'] != 'fixtures.verify' or p['permissions'] != ['read_task']:
        raise ValueError('Unsupported capability or permission')
    refs = p['sourceRefs']
    if not isinstance(refs, list) or not 1 <= len(refs) <= 32:
        raise ValueError('Invalid source references')
    for ref in refs: token(ref)
    if len(set(refs)) != len(refs) or len(canonical(value).encode()) > 16000:
        raise ValueError('Duplicate references or oversized submission')
    return value


def checked_path(value):
    raw = os.fspath(value)
    if raw.startswith(('\\\\', '//')):
        raise ValueError('Network or UNC paths refused')
    path = Path(os.path.abspath(value))
    for part in [*reversed(path.parents), path]:
        if part.exists() or part.is_symlink():
            info = part.lstat()
            if part.is_symlink() or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Link or reparse point refused')
    return path


def bounded_read(path, maximum):
    path = checked_path(path)
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError('Nonregular file refused before open')
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0))
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
            raise ValueError('Nonregular or oversized file')
        with os.fdopen(fd, 'rb', closefd=False) as stream:
            data = stream.read(maximum + 1)
        after = os.fstat(fd)
        if len(data) > maximum or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise ValueError('File changed during read')
        return data
    finally:
        os.close(fd)


def inspect_scope(root, submission):
    root = checked_path(root)
    manifest = strict_json(bounded_read(root / MARKER, 16000))
    shape(manifest, 'format version synthetic ownerId projectId sources')
    task = submission['payload']['task']
    if manifest['format'] != 'phare-handoff-fixtures' or type(manifest['version']) is not int or manifest['version'] != 1 or manifest['synthetic'] is not True or manifest['ownerId'] != task['ownerId'] or manifest['projectId'] != task['projectId']:
        raise ValueError('Explicit synthetic owner-scoped manifest required')
    if not isinstance(manifest['sources'], list) or not 1 <= len(manifest['sources']) <= 32:
        raise ValueError('Invalid source manifest')
    by_ref, names, total = {}, set(), 0
    for source in manifest['sources']:
        shape(source, 'ref name size sha256'); token(source['ref'])
        name = source['name']
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,99}', name) or name in {'.', '..', MARKER} or name in names or source['ref'] in by_ref:
            raise ValueError('Invalid, duplicate or escaping source name')
        if type(source['size']) is not int or not 0 <= source['size'] <= 1048576 or not isinstance(source['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', source['sha256']):
            raise ValueError('Invalid source size or hash')
        names.add(name); total += source['size']; by_ref[source['ref']] = source
    if total > 2 * 1048576 or {p.name for p in root.iterdir()} != names | {MARKER}:
        raise ValueError('Undeclared entry or source limit exceeded')
    refs = submission['payload']['sourceRefs']
    if any(ref not in by_ref for ref in refs):
        raise ValueError('Source outside selected scope')
    result = []
    # No undeclared file or unselected source contents are read.
    for ref in refs:
        metadata = by_ref[ref]
        data = bounded_read(root / metadata['name'], 1048576)
        sha = hashlib.sha256(data).hexdigest()
        if len(data) != metadata['size'] or sha != metadata['sha256']:
            raise ValueError('Source modified or corrupted')
        result.append({'ref': ref, 'size': len(data), 'sha256': sha})
    return result


def load_scheduler(path):
    path = checked_path(path)
    source = bounded_read(path, 64000)
    if hashlib.sha256(source).hexdigest() != SCHEDULER_SHA256:
        raise ValueError('Pinned scheduler source mismatch')
    # Execute only the bytes whose hash was checked, never a cached .pyc or
    # re-read path, and never any text originating in a recipe or its payload.
    module = types.ModuleType('phare_pinned_ordonnanceur')
    exec(compile(source, str(path), 'exec'), module.__dict__)
    return module.Ordonnanceur


class RegistryLock:
    def __init__(self, path): self.path = Path(str(path) + '.handoff.lock')
    def __enter__(self):
        fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(fd)
        return self
    def __exit__(self, *_): self.path.unlink()


def registry_identity(db, owner_id, project_id):
    expected = (PROTOCOL, owner_id, project_id, SCHEDULER_SHA256)
    rows = db.execute('SELECT protocol,owner_id,project_id,scheduler_sha FROM handoff_identity').fetchall()
    if rows != [expected]: raise ValueError('Foreign or incompatible registry')


async def run(submission, source_root, registry, owner_id, project_id, scheduler_source, synthetic_only=False):
    if synthetic_only is not True: raise ValueError('Synthetic-only mode required')
    validate_submission(submission, owner_id, project_id)
    initial = inspect_scope(source_root, submission)
    Scheduler = load_scheduler(scheduler_source)
    registry = checked_path(registry)
    root = checked_path(source_root)
    if root == registry or root in registry.parents: raise ValueError('Registry must be outside sources')
    registry.parent.mkdir(parents=True, exist_ok=True)
    signature, key = digest(submission), submission['payload']['task']['idempotencyKey']
    with RegistryLock(registry):
        if registry.exists():
            if not stat.S_ISREG(registry.lstat().st_mode): raise ValueError('Nonregular registry refused')
            with closing(sqlite3.connect(registry.as_uri() + '?mode=ro', uri=True)) as db:
                registry_identity(db, owner_id, project_id)
        scheduler = Scheduler(registry, concurrence=1, limite=1)
        try:
            with scheduler.db:
                scheduler.db.execute('CREATE TABLE IF NOT EXISTS handoff_identity(protocol TEXT,owner_id TEXT,project_id TEXT,scheduler_sha TEXT)')
                if not scheduler.db.execute('SELECT 1 FROM handoff_identity').fetchone():
                    scheduler.db.execute('INSERT INTO handoff_identity VALUES (?,?,?,?)', (PROTOCOL, owner_id, project_id, SCHEDULER_SHA256))
                scheduler.db.execute('CREATE TABLE IF NOT EXISTS handoff_claims(key TEXT PRIMARY KEY,signature TEXT NOT NULL,state TEXT NOT NULL,scheduler_id TEXT)')
            registry_identity(scheduler.db, owner_id, project_id)
            previous = scheduler.db.execute('SELECT signature,state,scheduler_id FROM handoff_claims WHERE key=?', (key,)).fetchone()
            if previous:
                if previous[0] != signature: raise ValueError('Idempotency key reused for different contents')
                if previous[1] != 'succeeded': raise RuntimeError('Unresolved attempt: no automatic retry or recovery')
                row = next((row for row in scheduler.liste() if row['id'] == previous[2]), None)
                verify_row(row, submission, initial)
                return {'state': 'deduplicated', 'verified': True, 'signature': signature, 'newTasks': 0, 'row': row}
            with scheduler.db:
                scheduler.db.execute('INSERT INTO handoff_claims VALUES (?,?,?,?)', (key, signature, 'claimed', None))
            async def audit(payload, checkpoint):
                if canonical(payload) != canonical(submission['payload']): raise ValueError('Unexpected handler payload')
                checkpoint({'phase': 'references_selected', 'count': len(initial)})
                await asyncio.sleep(0)
                current = inspect_scope(source_root, submission)
                if current != initial: raise ValueError('Sources changed before execution')
                t = payload['task']
                return {'format': 'phare-synthetic-reference-audit-result', 'version': 1, 'synthetic': True, 'taskId': t['id'], 'ownerId': t['ownerId'], 'projectId': t['projectId'], 'stepId': payload['stepId'], 'sources': current, 'networkUsed': False, 'originalsChanged': False}
            scheduler.enregistrer(HANDLER, audit)
            ident = scheduler.soumettre(submission['projet'], submission['nom'], submission['payload'], lourd=submission['lourd'], delai_secondes=submission['delai_secondes'])
            with scheduler.db:
                scheduler.db.execute('UPDATE handoff_claims SET scheduler_id=? WHERE key=?', (ident, key))
            await scheduler.attendre()
            final = inspect_scope(source_root, submission)
            if final != initial: raise ValueError('Sources changed after execution')
            row = next((row for row in scheduler.liste() if row['id'] == ident), None)
            verify_row(row, submission, initial)
            with scheduler.db:
                scheduler.db.execute('UPDATE handoff_claims SET state=? WHERE key=?', ('succeeded', key))
            return {'state': 'succeeded', 'verified': True, 'signature': signature, 'newTasks': 1, 'row': row}
        finally:
            await scheduler.fermer()


def verify_row(row, submission, sources):
    if not row or row['projet'] != submission['projet'] or row['type'] != HANDLER or canonical(row['payload']) != canonical(submission['payload']) or row['etat'] != 'terminee':
        raise ValueError('Scheduler did not finish the expected task')
    t = submission['payload']['task']
    expected = {'format': 'phare-synthetic-reference-audit-result', 'version': 1, 'synthetic': True, 'taskId': t['id'], 'ownerId': t['ownerId'], 'projectId': t['projectId'], 'stepId': submission['payload']['stepId'], 'sources': sources, 'networkUsed': False, 'originalsChanged': False}
    if row['resultat'] != expected: raise ValueError('Unverified or corrupted scheduler result')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['submission', 'sources', 'registry', 'scheduler-source', 'owner', 'project']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--synthetic-only', action='store_true')
    args = parser.parse_args()
    submission = strict_json(bounded_read(Path(args.submission), 16000))
    result = asyncio.run(run(submission, args.sources, args.registry, args.owner, args.project, args.scheduler_source, args.synthetic_only))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try: main()
    except (ValueError, RuntimeError, OSError, sqlite3.DatabaseError, json.JSONDecodeError) as exc:
        # No source content or full exception text in the public protocol.
        print(json.dumps({'state': 'refused_or_failed', 'error': type(exc).__name__}), file=sys.stderr)
        sys.exit(1)
