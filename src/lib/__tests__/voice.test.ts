import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENVELOPE_HOP,
  alignWords,
  captionsFromVoice,
  duckTarget,
  groupIntoBlocks,
  rmsEnvelope,
  speechSegments,
  syllableCount,
} from '../voice.ts';

/**
 * Fabrique une enveloppe où les intervalles donnés sont parlés et le reste
 * silencieux. On travaille sur l'enveloppe plutôt que sur un vrai fichier :
 * c'est elle que l'algorithme découpe, et une voix de synthèse n'apporterait
 * qu'un décodeur de plus à embarquer dans les tests.
 */
function envelopeWith(total: number, spoken: [number, number][]): Float32Array {
  const count = Math.round(total / ENVELOPE_HOP);
  const envelope = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const time = i * ENVELOPE_HOP;
    envelope[i] = spoken.some(([from, to]) => time >= from && time < to) ? 0.4 : 0.002;
  }
  return envelope;
}

/** Identifiants prévisibles, pour pouvoir comparer les sous-titres produits. */
function counter() {
  let n = 0;
  return () => `cap${n++}`;
}

test('l’enveloppe suit l’énergie du signal', () => {
  const sampleRate = 8000;
  const samples = new Float32Array(sampleRate);
  // Une demi-seconde de silence, puis une demi-seconde de signal.
  for (let i = sampleRate / 2; i < sampleRate; i++) samples[i] = Math.sin(i * 0.3);

  const envelope = rmsEnvelope(samples, sampleRate);
  assert.ok(envelope[10] < 0.01, 'le silence doit rester au plancher');
  assert.ok(envelope[80] > 0.3, 'la partie sonore doit monter');
});

test('deux phrases séparées par un silence donnent deux segments', () => {
  const segments = speechSegments(envelopeWith(4, [[0.5, 1.5], [2.5, 3.5]]));
  assert.equal(segments.length, 2);
  // La marge élargit chaque segment de 40 ms de part et d'autre.
  assert.ok(Math.abs(segments[0].start - 0.46) < 0.02);
  assert.ok(Math.abs(segments[1].end - 3.54) < 0.02);
});

test('un silence trop court ne coupe pas la phrase en deux', () => {
  // 80 ms entre deux mots : c'est une occlusive, pas une respiration.
  const segments = speechSegments(envelopeWith(3, [[0.5, 1.0], [1.08, 1.6]]));
  assert.equal(segments.length, 1);
});

test('un claquement isolé n’est pas pris pour de la parole', () => {
  const segments = speechSegments(envelopeWith(3, [[0.5, 0.53], [1.5, 2.2]]));
  assert.equal(segments.length, 1);
  assert.ok(segments[0].start > 1);
});

test('un fichier sans dynamique ne se découpe pas en mille morceaux', () => {
  assert.deepEqual(speechSegments(new Float32Array(300)), [{ start: 0, end: 3 }]);
});

test('les syllabes se comptent par groupes de voyelles', () => {
  assert.equal(syllableCount('le'), 1);
  assert.equal(syllableCount('titan'), 2);
  assert.equal(syllableCount('secteur'), 2);
  assert.equal(syllableCount('effondre'), 2);
  assert.equal(syllableCount('éveille'), 2);
  // Le « e » final muet ne compte pas, mais un mot d'une seule voyelle si.
  assert.equal(syllableCount('ombre'), 1);
});

test('les mots se répartissent dans l’ordre et sans chevauchement', () => {
  const segments = speechSegments(envelopeWith(4, [[0.5, 1.5], [2.5, 3.5]]));
  const words = alignWords('le secteur zero neuf s effondre maintenant', segments);

  assert.equal(words.length, 7);
  assert.equal(words[0].text, 'le');
  for (let i = 1; i < words.length; i++) {
    assert.ok(words[i].start >= words[i - 1].end - 1e-6, `le mot ${i} recule`);
  }
  assert.ok(words[0].start >= segments[0].start - 1e-6);
  assert.ok(Math.abs(words[words.length - 1].end - segments[1].end) < 1e-6);
});

test('aucun mot ne s’étire pendant un silence', () => {
  const segments = speechSegments(envelopeWith(6, [[0, 1], [4, 5]]));
  const words = alignWords('un deux trois quatre', segments);

  for (const word of words) {
    const inside = segments.some((s) => word.start >= s.start - 1e-6 && word.end <= s.end + 1e-6);
    assert.ok(inside, `« ${word.text} » déborde du passage parlé`);
  }
});

test('un mot long occupe plus de temps qu’un mot bref', () => {
  const segments = speechSegments(envelopeWith(4, [[0, 4]]));
  const [court, long] = alignWords('un anticonstitutionnellement', segments);
  assert.ok(long.end - long.start > (court.end - court.start) * 3);
});

test('un silence force une coupure de sous-titre', () => {
  const segments = speechSegments(envelopeWith(4, [[0.5, 1.5], [2.5, 3.5]]));
  const words = alignWords('alerte le secteur zero neuf s effondre', segments);
  const blocks = groupIntoBlocks(words, { maxWords: 99, maxChars: 999 });

  assert.ok(blocks.length >= 2, 'les deux phrases doivent être séparées');
});

test('un sous-titre ne dépasse ni le nombre de mots ni la largeur autorisés', () => {
  const segments = speechSegments(envelopeWith(6, [[0, 6]]));
  const words = alignWords('alpha bravo charlie delta echo foxtrot golf hotel india juliett', segments);
  const blocks = groupIntoBlocks(words, { maxWords: 4, maxChars: 24 });

  for (const block of blocks) {
    assert.ok(block.length <= 4);
    assert.ok(block.map((w) => w.text).join(' ').length <= 24);
  }
});

test('les sous-titres produits sont décalés de la position de la voix', () => {
  const segments = speechSegments(envelopeWith(3, [[0.5, 2.5]]));
  const captions = captionsFromVoice('le titan s eveille', segments, counter(), { offset: 8 });

  assert.ok(captions.length >= 1);
  assert.ok(captions[0].start >= 8);
  assert.equal(captions[0].style, 'karaoke');
  assert.ok(captions[captions.length - 1].end <= 8 + 3);
});

test('un texte vide ne produit aucun sous-titre', () => {
  const segments = speechSegments(envelopeWith(3, [[0.5, 2.5]]));
  assert.deepEqual(captionsFromVoice('   ', segments, counter()), []);
});

test('le fond se baisse avant le premier mot et remonte après le dernier', () => {
  const segments = [{ start: 2, end: 4 }];

  assert.equal(duckTarget(segments, 0.5, 0.7), 1);
  // Anticipation : 120 ms avant, le fond est déjà descendu.
  assert.ok(Math.abs(duckTarget(segments, 1.95, 0.7) - 0.3) < 1e-6);
  assert.ok(Math.abs(duckTarget(segments, 3, 0.7) - 0.3) < 1e-6);
  // Maintien après la fin, puis retour au plein niveau.
  assert.ok(Math.abs(duckTarget(segments, 4.1, 0.7) - 0.3) < 1e-6);
  assert.equal(duckTarget(segments, 5, 0.7), 1);
});

test('un reste trop court est rendu au sous-titre voisin', () => {
  const segments = speechSegments(envelopeWith(4, [[0.4, 1.6], [2.4, 3.6]]));
  const words = alignWords('alerte le secteur zero neuf s effondre le titan d ombre s eveille', segments);
  const blocks = groupIntoBlocks(words);

  for (const block of blocks) {
    const span = block[block.length - 1].end - block[0].start;
    assert.ok(span >= 0.35, `« ${block.map((w) => w.text).join(' ')} » ne dure que ${span.toFixed(2)} s`);
  }
});

test('le recollage ne franchit jamais un silence', () => {
  const segments = speechSegments(envelopeWith(6, [[0.4, 2.4], [4.5, 4.75]]));
  const blocks = groupIntoBlocks(alignWords('un deux trois quatre cinq six', segments));

  // Un bloc reste court s'il est seul dans son passage : le recoller au
  // précédent le ferait s'afficher pendant le blanc qui les sépare.
  for (const block of blocks) {
    assert.equal(new Set(block.map((w) => w.segment)).size, 1);
  }
});
