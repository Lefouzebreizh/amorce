import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeOnCuts, placeWithoutOverlap, shotStarts } from '../timeline.ts';
import { DEFAULT_CLIP, type Clip } from '../types.ts';

/** Quatre plans de 3 s en coupe franche : des coupes à 0, 3, 6 et 9 s. */
function montage(): Clip[] {
  return [0, 1, 2, 3].map((i) => ({
    ...DEFAULT_CLIP,
    id: `c${i}`,
    assetId: 'a',
    outPoint: 3,
    transition: 'cut' as const,
    transitionDuration: 0,
  }));
}

test('les coupes sont les débuts de plan', () => {
  assert.deepEqual(shotStarts(montage()), [0, 3, 6, 9]);
});

test('les coupes antérieures à la tête de lecture sont écartées', () => {
  assert.deepEqual(shotStarts(montage(), 4), [6, 9]);
});

test('une réplique par plan, dans l’ordre', () => {
  const times = placeWithoutOverlap(shotStarts(montage()), [1.5, 1.5, 1.5]);
  assert.deepEqual(times, [0, 3, 6]);
});

test('une réplique qui déborde saute la coupe qu’elle recouvre', () => {
  // 4 s de parole depuis 0 s : la coupe à 3 s est déjà occupée, on passe à 6 s.
  const times = placeWithoutOverlap(shotStarts(montage()), [4, 1]);
  assert.deepEqual(times, [0, 6]);
});

test('à court de coupes, les répliques s’enchaînent bout à bout', () => {
  const times = placeWithoutOverlap(shotStarts(montage()), [1, 1, 1, 1, 2, 2]);
  assert.deepEqual(times.slice(0, 4), [0, 3, 6, 9]);
  // Les deux dernières n'ont plus de coupe : elles suivent la précédente.
  assert.equal(times[4], 10);
  assert.equal(times[5], 12);
});

test('aucune réplique n’en recouvre une autre', () => {
  const durations = [2.5, 4, 1, 3];
  const times = placeWithoutOverlap(shotStarts(montage()), durations);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] >= times[i - 1] + durations[i - 1] - 1e-6, `la réplique ${i} recouvre la précédente`);
  }
});

test('le placement part de la tête de lecture', () => {
  assert.deepEqual(placeWithoutOverlap(shotStarts(montage(), 4), [1, 1], 4), [6, 9]);
});

test('les bruitages prennent une coupe chacun', () => {
  assert.deepEqual(placeOnCuts(shotStarts(montage()), 3), [0, 3, 6]);
});

test('à court de coupes, les bruitages s’espacent au lieu de s’empiler', () => {
  const times = placeOnCuts(shotStarts(montage()), 6);
  assert.deepEqual(times.slice(0, 4), [0, 3, 6, 9]);
  assert.deepEqual(times.slice(4), [10, 11]);
});

test('un montage vide ne fait pas échouer le placement', () => {
  assert.deepEqual(shotStarts([]), []);
  assert.deepEqual(placeWithoutOverlap([], [2, 2], 5), [5, 7]);
  assert.deepEqual(placeOnCuts([], 2, 5), [5, 6]);
});
