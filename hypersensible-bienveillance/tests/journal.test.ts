import test from 'node:test';
import assert from 'node:assert/strict';

import { lire } from '../src/lib/journal.ts';

test('un mot n’est pas repéré à l’intérieur d’un autre mot', () => {
  const lecture = lire('Seulement voilà, la journée était seulement remplie.');
  assert.ok(!lecture.emotions.some((e) => e.nom === 'Tristesse'), JSON.stringify(lecture.emotions));
});

test('l’émotion dominante donne la météo et l’accueil', () => {
  const lecture = lire("J'ai peur, je suis anxieux, l'angoisse ne me lâche pas.");
  assert.equal(lecture.emotions[0]?.nom, 'Peur');
  assert.match(lecture.meteo, /Brouillard/);
});

test('l’autocritique passe devant l’émotion dominante', () => {
  const lecture = lire("Je suis heureux. C'est ma faute. Je m'en veux. J'aurais dû faire mieux.");
  assert.ok(lecture.autocritique >= 25, `mesuré : ${lecture.autocritique}`);
  assert.match(lecture.accueil, /rigueur/);
});

test('les intensités sont des parts qui restent bornées à cent', () => {
  const lecture = lire('Triste, seul, vide, en colère, énervé, marre.');
  for (const emotion of lecture.emotions) {
    assert.ok(emotion.intensite > 0 && emotion.intensite <= 100);
  }
});

test('un texte sans marqueur ne force aucune émotion', () => {
  const lecture = lire('Rendez-vous mardi à quatorze heures avec le garagiste.');
  assert.deepEqual(lecture.emotions, []);
  assert.match(lecture.meteo, /variable/);
});
