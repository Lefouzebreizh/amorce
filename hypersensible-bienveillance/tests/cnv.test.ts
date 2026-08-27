/**
 * Ce que ces tests protègent : trois régressions déjà rencontrées pendant
 * l'écriture du moteur, et qui ne se voient pas à la lecture du code.
 * Le reste — la beauté des tournures — se juge à l'œil, pas ici.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { reformuler, reperer, extraireFait, valider, LONGUEUR_MAX } from '../src/lib/cnv.ts';

test('la négation est conservée : « jamais » ne disparaît pas du fait cité', () => {
  const { observation } = reformuler("Tu réponds jamais à mes messages.");
  assert.match(observation, /ne réponds pas|réponds pas/);
  assert.doesNotMatch(observation, /Quand tu réponds à/);
});

test('un mot qui contient une insulte n’est pas une insulte', () => {
  const etiquettes = reperer('Tu vas encore annuler nos rendez-vous.').map((s) => s.etiquette);
  assert.ok(!etiquettes.includes('Jugement sur la personne'), etiquettes.join(', '));
});

test('un ordre n’est jamais cité comme un fait', () => {
  assert.equal(extraireFait('Calme-toi un peu.'), null);
  assert.equal(extraireFait("Arrête de faire ta chochotte."), null);
});

test('un message hurlé est rendu en minuscules', () => {
  const { message } = reformuler('TU AS OUBLIÉ MON ANNIVERSAIRE ENCORE UNE FOIS');
  assert.doesNotMatch(message, /TU AS OUBLIÉ/);
});

test('le procédé dominant décide du besoin exprimé', () => {
  const minimise = reformuler("C'est pas grave, tu exagères.");
  assert.match(minimise.besoin, /au lieu de le balayer/);
  const menace = reformuler('Si tu continues, ne compte plus sur moi.');
  assert.match(menace.besoin, /sans avoir à menacer/);
});

test('deux analyses du même message rendent exactement le même texte', () => {
  const phrase = "T'es vraiment pénible avec tes reproches.";
  assert.deepEqual(reformuler(phrase), reformuler(phrase));
});

test('un message sans procédé repéré reçoit quand même les quatre blocs', () => {
  const r = reformuler('On se voit demain ?');
  for (const bloc of [r.observation, r.sentiment, r.besoin, r.demande, r.humour]) {
    assert.ok(bloc.length > 0, 'aucun bloc ne doit être vide');
  }
  assert.equal(r.intensite, 0);
});

test('l’intensité additionne les procédés sans dépasser cent', () => {
  const charge = reformuler(
    "Franchement t'es nulle, tu fais jamais rien, c'est pas grave, sinon je m'en vais !!!",
  );
  assert.ok(charge.intensite > 60, `intensité mesurée : ${charge.intensite}`);
  assert.ok(charge.intensite <= 100);
});

test('la saisie est refusée avec une phrase lisible, jamais avec un code', () => {
  assert.equal(valider(42).ok, false);
  assert.equal(valider('  ').ok, false);
  const trop = valider('a'.repeat(LONGUEUR_MAX + 1));
  assert.equal(trop.ok, false);
  assert.match(trop.ok === false ? trop.raison : '', /pas toute la conversation/);
  assert.equal(valider('  tu exagères  ').ok, true);
});
