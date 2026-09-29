import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, STEPS, phaseForStep } from '../steps.ts';

test('les trois phases conservent chacune des sept étapes une fois', () => {
  const grouped = PHASES.flatMap((phase) => phase.steps);
  assert.deepEqual(grouped, STEPS.map((step) => step.id));
});

test('chaque étape ouvre la bonne phase du parcours', () => {
  assert.equal(phaseForStep('import').id, 'creer');
  assert.equal(phaseForStep('montage').id, 'composer');
  assert.equal(phaseForStep('texte').id, 'composer');
  assert.equal(phaseForStep('son').id, 'composer');
  assert.equal(phaseForStep('cinema').id, 'composer');
  assert.equal(phaseForStep('analyse').id, 'finaliser');
  assert.equal(phaseForStep('export').id, 'finaliser');
});
