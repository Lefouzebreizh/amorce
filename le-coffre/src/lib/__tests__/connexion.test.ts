import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FunctionsFetchError,
  FunctionsHttpError,
} from '@supabase/supabase-js';
import {
  MESSAGE_CODE_INCORRECT,
  MESSAGE_CONNEXION_INDISPONIBLE,
  messageErreurConnexion,
} from '../connexion';

describe('messageErreurConnexion', () => {
  it('explique une 401 sans la confondre avec une panne technique', async () => {
    const erreur = new FunctionsHttpError(new Response(
      JSON.stringify({ error: 'Identifiant ou mot de passe incorrect.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    assert.equal(await messageErreurConnexion(erreur, null), MESSAGE_CODE_INCORRECT);
  });

  it('conserve le message de limitation des tentatives', async () => {
    const erreur = new FunctionsHttpError(new Response(
      JSON.stringify({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    ));

    assert.equal(
      await messageErreurConnexion(erreur, null),
      'Trop de tentatives. Réessaie dans quelques minutes.',
    );
  });

  it('présente une panne réseau comme une indisponibilité', async () => {
    const erreur = new FunctionsFetchError(new Error('Failed to fetch'));
    assert.equal(
      await messageErreurConnexion(erreur, null),
      MESSAGE_CONNEXION_INDISPONIBLE,
    );
  });

  it('refuse de continuer silencieusement sans jeton ni erreur', async () => {
    assert.equal(await messageErreurConnexion(null, null), '');
  });
});
