import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluerLimitesSession } from './sessionLimits';

const MAINTENANT = Date.parse('2026-09-11T12:00:00Z');

test('ni le temps ni les échanges ne franchissent le seuil 1 : rien ne se déclenche', () => {
  const resultat = evaluerLimitesSession(
    { demarreeLe: MAINTENANT - 5 * 60 * 1000, nombreEchanges: 3, detressePersistanteInterSessions: false },
    MAINTENANT,
  );
  assert.equal(resultat.rappelDiscret, false);
  assert.equal(resultat.redirectionFerme, false);
});

test('30 minutes de conversation continue déclenchent le rappel discret', () => {
  const resultat = evaluerLimitesSession(
    { demarreeLe: MAINTENANT - 31 * 60 * 1000, nombreEchanges: 2, detressePersistanteInterSessions: false },
    MAINTENANT,
  );
  assert.equal(resultat.rappelDiscret, true);
  assert.equal(resultat.redirectionFerme, false);
});

test('15 échanges déclenchent le rappel discret même en peu de temps', () => {
  const resultat = evaluerLimitesSession(
    { demarreeLe: MAINTENANT - 2 * 60 * 1000, nombreEchanges: 16, detressePersistanteInterSessions: false },
    MAINTENANT,
  );
  assert.equal(resultat.rappelDiscret, true);
});

test('le rappel discret reste un rappel, jamais un mur — le seuil 2 lui est indépendant', () => {
  const resultat = evaluerLimitesSession(
    { demarreeLe: MAINTENANT - 45 * 60 * 1000, nombreEchanges: 20, detressePersistanteInterSessions: false },
    MAINTENANT,
  );
  assert.equal(resultat.rappelDiscret, true);
  assert.equal(resultat.redirectionFerme, false);
});

test('une détresse persistante inter-sessions déclenche la redirection ferme, indépendamment du seuil 1', () => {
  const resultat = evaluerLimitesSession(
    { demarreeLe: MAINTENANT, nombreEchanges: 1, detressePersistanteInterSessions: true },
    MAINTENANT,
  );
  assert.equal(resultat.rappelDiscret, false);
  assert.equal(resultat.redirectionFerme, true);
});
