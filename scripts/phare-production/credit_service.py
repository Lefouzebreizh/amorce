"""Private read service for a future trusted account adapter; no HTTP listener.

The adapter must validate the existing comptes-serveur session AND account before
returning its stable compteId. This module does not mint or verify another token,
and must never be exposed with a resolver that trusts a browser's account field.
The Amorce/D1 balance is not merged with this Phare/SQLite ledger.
"""
from dataclasses import dataclass
from types import MappingProxyType
from typing import Callable, Mapping

from credits import CreditError, Ledger, identifier, positive


class AuthenticationRequired(CreditError):
    pass


@dataclass(frozen=True)
class ProductionRate:
    """An exact server-selected production profile, not an editable client price."""
    units: int
    available: bool = False

    def __post_init__(self):
        positive(self.units)
        if type(self.available) is not bool:
            raise CreditError('Disponibilité invalide.')


class CreditReadService:
    def __init__(self, ledger: Ledger, resolve_account: Callable[[object], str | None],
                 catalogue: Mapping[str, ProductionRate], catalogue_version: str):
        """All constructor inputs are server configuration, never request JSON.

        No production tariff is provided by default. The adapter is responsible
        for selecting a profile matching ALL job parameters (duration, variants,
        quality...). A quote neither reserves credits nor authorizes execution.
        """
        identifier(catalogue_version)
        if not callable(resolve_account):
            raise TypeError('Un adaptateur de compte vérifié est requis.')
        rates = dict(catalogue)
        for profile, rate in rates.items():
            identifier(profile)
            if not isinstance(rate, ProductionRate):
                raise CreditError('Tarif serveur invalide.')
        self._ledger = ledger
        self._resolve_account = resolve_account
        self._catalogue = MappingProxyType(rates)
        self._catalogue_version = catalogue_version

    def _account(self, authentication_context):
        account = self._resolve_account(authentication_context)
        try:
            identifier(account)
        except CreditError:
            raise AuthenticationRequired('Connexion vérifiée requise.') from None
        return account

    def _balance(self, account):
        # One transaction gives a coherent snapshot while jobs change state.
        with self._ledger.transaction() as db:
            granted = db.execute('SELECT COALESCE(SUM(units),0) FROM grants WHERE account=?', (account,)).fetchone()[0]
            totals = dict(db.execute('SELECT status,SUM(units) FROM jobs WHERE account=? GROUP BY status', (account,)))
        reserved = totals.get('reserved', 0)
        consumed = totals.get('consumed', 0)
        return {'granted': granted, 'reserved': reserved, 'consumed': consumed,
                'available': granted - reserved - consumed}

    def balance(self, authentication_context):
        return {'version': 1, 'credits': self._balance(self._account(authentication_context)),
                'existingFilesAccessible': True}

    def quote(self, authentication_context, profile):
        account = self._account(authentication_context)
        identifier(profile)
        rate = self._catalogue.get(profile)
        balance = self._balance(account)
        reason = ('unavailable' if rate is None or not rate.available else
                  'insufficient_credits' if balance['available'] < rate.units else 'ready')
        return {'version': 1, 'catalogueVersion': self._catalogue_version,
                'profile': profile, 'requiredCredits': rate.units if rate and rate.available else None,
                'credits': balance, 'status': reason, 'canRequestProduction': reason == 'ready',
                'reservationMade': False, 'existingFilesAccessible': True}
