import test from 'node:test';
import assert from 'node:assert/strict';
import { messageErreurMiseAJourMotDePasse } from '../recuperation';

test('la récupération distingue un lien expiré d’un refus du nouveau code', () => {
  assert.match(messageErreurMiseAJourMotDePasse({ status: 401 }), /lien de récupération a expiré/);
  assert.match(messageErreurMiseAJourMotDePasse({ code: 'weak_password' }), /12 caractères/);
});

test('la récupération n’accuse pas le lien d’une panne réseau', () => {
  assert.match(messageErreurMiseAJourMotDePasse({ message: 'Failed to fetch' }), /connexion et réessaie/);
});
