"""Private, single-host SQLite ledger. Never expose this API directly to a browser.

Account IDs and grants must come from a trusted authenticated server. Units are
operator-defined integers, NOT a price or a promise of provider cost coverage.
The database must live on persistent local disk, not a shared/network filesystem.
"""
import sqlite3
from contextlib import contextmanager


class CreditError(ValueError):
    pass


def positive(value):
    if type(value) is not int or value <= 0:
        raise CreditError('Le nombre de crédits doit être un entier positif.')


def identifier(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 200:
        raise CreditError('Identifiant invalide.')


class Ledger:
    def __init__(self, path):
        self.path = str(path)
        with self.transaction() as db:
            db.execute('CREATE TABLE IF NOT EXISTS grants (id TEXT PRIMARY KEY, account TEXT NOT NULL, units INTEGER NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, account TEXT NOT NULL, units INTEGER NOT NULL, fingerprint TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ("reserved", "consumed", "released")))')

    @contextmanager
    def transaction(self):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        try:
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def available(db, account):
        granted = db.execute('SELECT COALESCE(SUM(units),0) FROM grants WHERE account=?', (account,)).fetchone()[0]
        spent = db.execute('SELECT COALESCE(SUM(units),0) FROM jobs WHERE account=? AND status != "released"', (account,)).fetchone()[0]
        return granted - spent

    def balance(self, account):
        identifier(account)
        with self.transaction() as db:
            return self.available(db, account)

    def grant(self, event, account, units):
        """Trusted operator/webhook only. Replaying one event cannot mint credits."""
        identifier(event); identifier(account); positive(units)
        with self.transaction() as db:
            old = db.execute('SELECT account,units FROM grants WHERE id=?', (event,)).fetchone()
            if old:
                if old != (account, units):
                    raise CreditError('Événement déjà utilisé avec des valeurs différentes.')
                return
            db.execute('INSERT INTO grants VALUES (?,?,?)', (event, account, units))

    def reserve(self, job, account, units, fingerprint):
        identifier(job); identifier(account); identifier(fingerprint); positive(units)
        with self.transaction() as db:
            old = db.execute('SELECT account,units,fingerprint,status FROM jobs WHERE id=?', (job,)).fetchone()
            if old:
                if old[:3] != (account, units, fingerprint):
                    raise CreditError('Identifiant de production déjà utilisé pour une autre demande.')
                if old[3] == 'released':
                    raise CreditError('Production libérée : une nouvelle demande est nécessaire.')
                return old[3]
            if self.available(db, account) < units:
                raise CreditError('Crédits insuffisants. Tes projets et fichiers restent accessibles.')
            db.execute('INSERT INTO jobs VALUES (?,?,?,?,"reserved")', (job, account, units, fingerprint))
            return 'reserved'

    def finish(self, job, account, status):
        """Release only after operator confirms no billable call; never on timeout."""
        identifier(job); identifier(account)
        if status not in ('consumed', 'released'):
            raise CreditError('État final invalide.')
        with self.transaction() as db:
            old = db.execute('SELECT status FROM jobs WHERE id=? AND account=?', (job, account)).fetchone()
            if not old:
                raise CreditError('Production introuvable pour ce compte.')
            if old[0] == status:
                return
            if old[0] != 'reserved':
                raise CreditError('Production déjà finalisée.')
            db.execute('UPDATE jobs SET status=? WHERE id=? AND account=?', (status, job, account))
