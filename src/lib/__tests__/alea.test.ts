import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seeded } from '../alea.ts';

test('même graine, même suite — c’est tout ce qu’on lui demande', () => {
  const a = seeded(12345);
  const b = seeded(12345);
  const suiteA = Array.from({ length: 50 }, () => a());
  const suiteB = Array.from({ length: 50 }, () => b());
  assert.deepEqual(suiteA, suiteB);
});

test('deux graines différentes ne rendent pas la même suite', () => {
  // Sans quoi le générateur serait une constante déguisée, et le bruit blanc
  // du studio, un bourdonnement.
  const a = Array.from({ length: 20 }, seeded(1));
  const b = Array.from({ length: 20 }, seeded(2));
  assert.notDeepEqual(a, b);
});

test('les tirages restent dans [0, 1[', () => {
  const tirage = seeded(0xdeadbeef);
  for (let i = 0; i < 5000; i++) {
    const v = tirage();
    assert.ok(v >= 0 && v < 1, `tirage hors bornes : ${v}`);
  }
});

test('la suite ne se répète pas au bout de quelques tirages', () => {
  // Un xorshift mal recopié tombe vite dans un cycle court, et le bruit blanc
  // deviendrait périodique — donc audible comme une note.
  const tirage = seeded(7);
  const vus = new Set(Array.from({ length: 2000 }, tirage));
  assert.ok(vus.size > 1900, `${vus.size} valeurs distinctes sur 2000`);
});
