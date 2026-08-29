import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chopped, layoutClips, sliceAt, totalDuration, effectiveTransition, withoutSilences } from '../timeline.ts';
import { DEFAULT_CLIP, type Clip, type TransitionKind } from '../types.ts';

function makeClip(seconds: number, transition: TransitionKind = 'cut', td = 0): Clip {
  return {
    ...DEFAULT_CLIP,
    id: `c${seconds}-${transition}-${td}-${Math.round(Math.random() * 1e6)}`,
    assetId: 'a',
    outPoint: seconds,
    transition,
    transitionDuration: td,
  };
}

test('des coupes franches mettent les clips bout à bout', () => {
  const clips = [makeClip(3), makeClip(2), makeClip(5)];
  const placed = layoutClips(clips);
  assert.deepEqual(placed.map((p) => p.start), [0, 3, 5]);
  assert.equal(totalDuration(clips), 10);
});

test('une transition raccourcit la durée totale du chevauchement', () => {
  const clips = [makeClip(4), makeClip(4, 'fade', 1)];
  assert.equal(totalDuration(clips), 7);
  assert.equal(layoutClips(clips)[1].start, 3);
});

test('une transition trop longue est ramenée à 45% du plus court clip', () => {
  // 10 s demandées entre un clip de 2 s et un clip de 4 s -> 45% de 2 s = 0,9 s.
  assert.equal(effectiveTransition(makeClip(2), makeClip(4, 'fade', 10)), 0.9);
});

test('la vitesse comprime la durée du clip', () => {
  const fast = { ...makeClip(6), speed: 2 };
  assert.equal(totalDuration([fast]), 3);
});

test('jamais plus de deux clips visibles simultanément', () => {
  // Des transitions volontairement démesurées sur des clips très courts.
  const clips = [
    makeClip(1, 'fade', 9),
    makeClip(0.6, 'zoomPunch', 9),
    makeClip(0.6, 'glitch', 9),
    makeClip(1, 'whipPan', 9),
  ];
  const placed = layoutClips(clips);
  const total = totalDuration(clips);

  for (let t = 0; t < total; t += 0.005) {
    const visible = placed.filter((p) => t >= p.start && t < p.end);
    assert.ok(visible.length <= 2, `${visible.length} clips visibles à t=${t.toFixed(3)}`);
  }
});

test('les clips restent dans l’ordre malgré des transitions extrêmes', () => {
  const placed = layoutClips([makeClip(1, 'fade', 99), makeClip(1, 'fade', 99), makeClip(1, 'fade', 99)]);
  for (let i = 1; i < placed.length; i++) {
    assert.ok(placed[i].start > placed[i - 1].start, 'un clip démarre avant son prédécesseur');
  }
});

test('sliceAt compose deux couches pendant la transition, une seule ensuite', () => {
  const clips = [makeClip(4), makeClip(4, 'fade', 1)];
  const placed = layoutClips(clips);

  const during = sliceAt(placed, 3.5)!;
  assert.ok(during.from, 'le clip sortant devrait être présent');
  assert.equal(during.from!.placed.index, 0);
  assert.equal(during.to.placed.index, 1);
  assert.ok(Math.abs(during.progress - 0.5) < 1e-9);

  const after = sliceAt(placed, 5)!;
  assert.equal(after.from, null);
  assert.equal(after.to.placed.index, 1);
});

test('sourceTime suit le point d’entrée et la vitesse', () => {
  const clip = { ...makeClip(10), inPoint: 2, outPoint: 10, speed: 2 };
  const placed = layoutClips([clip]);
  // 1 s de timeline à vitesse 2 -> 2 s consommées dans la source, depuis 2 s.
  assert.equal(sliceAt(placed, 1)!.to.sourceTime, 4);
});

test('au-delà de la fin, on fige sur la dernière image', () => {
  const placed = layoutClips([makeClip(3)]);
  const slice = sliceAt(placed, 99)!;
  assert.equal(slice.to.placed.index, 0);
  assert.ok(slice.to.sourceTime <= 3 && slice.to.sourceTime > 2.99);
});

// ------------------------------------------------ Découpe des blancs

function clipEntre(entree: number, sortie: number): Clip {
  return { ...DEFAULT_CLIP, id: 'source', assetId: 'a', inPoint: entree, outPoint: sortie };
}

let compteur = 0;
const donneUnId = () => `neuf-${++compteur}`;

test('les blancs du début et de la fin partent sans créer de raccord', () => {
  // Un rush de 10 s dont on ne parle qu'entre 2 et 8 : un seul morceau reste,
  // donc un seul plan — surtout pas une liste d'un élément avec un raccord.
  const pieces = withoutSilences(clipEntre(0, 10), [{ start: 2, end: 8 }], donneUnId);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].inPoint, 2);
  assert.equal(pieces[0].outPoint, 8);
  assert.equal(pieces[0].id, 'source', 'le plan garde son identité');
});

test('un blanc au milieu coupe le plan en deux', () => {
  const pieces = withoutSilences(
    clipEntre(0, 10),
    [{ start: 0, end: 3 }, { start: 6, end: 10 }],
    donneUnId,
  );
  assert.equal(pieces.length, 2);
  assert.deepEqual(pieces.map((p) => [p.inPoint, p.outPoint]), [[0, 3], [6, 10]]);
});

test('seul le premier morceau garde la transition entrante', () => {
  const source = { ...clipEntre(0, 10), transition: 'fade' as TransitionKind, transitionDuration: 0.5 };
  const pieces = withoutSilences(source, [{ start: 0, end: 3 }, { start: 6, end: 10 }], donneUnId);
  assert.equal(pieces[0].transition, 'fade');
  assert.equal(pieces[0].transitionDuration, 0.5);
  assert.equal(pieces[1].transition, 'cut', 'un fondu à chaque blanc rendrait la mollesse qu’on retire');
  assert.equal(pieces[1].transitionDuration, 0);
});

test('les passages hors des bornes du plan sont ignorés', () => {
  // Les segments portent sur le fichier entier ; le plan n'en montre que 4→8.
  const pieces = withoutSilences(
    clipEntre(4, 8),
    [{ start: 0, end: 2 }, { start: 5, end: 6.5 }, { start: 20, end: 25 }],
    donneUnId,
  );
  assert.equal(pieces.length, 1);
  assert.deepEqual([pieces[0].inPoint, pieces[0].outPoint], [5, 6.5]);
});

test('un plan sans le moindre blanc n’est pas touché', () => {
  const source = clipEntre(0, 5);
  assert.equal(withoutSilences(source, [{ start: 0, end: 5 }], donneUnId)[0], source);
});

test('un plan entièrement muet n’est pas vidé', () => {
  // Rendre une liste vide effacerait le plan : mieux vaut ne rien faire et le
  // dire, l'utilisateur décidera lui-même de le supprimer.
  const source = clipEntre(0, 5);
  assert.deepEqual(withoutSilences(source, [], donneUnId), [source]);
});

test('les miettes plus courtes que le minimum ne font pas de plan', () => {
  const pieces = withoutSilences(
    clipEntre(0, 10),
    [{ start: 0, end: 3 }, { start: 4, end: 4.05 }, { start: 6, end: 10 }],
    donneUnId,
  );
  assert.equal(pieces.length, 2, 'le morceau de 50 ms est écarté');
});

test('les morceaux d’une découpe changent de cadrage', () => {
  /*
   * Découper une prise continue en morceaux contigus ne crée aucune coupe
   * visible : l'image se poursuit exactement là où elle s'était arrêtée. Sans
   * changement de cadrage, on obtient des raccords invisibles — et autant de
   * bruitages qui claquent sur rien.
   */
  const pieces = chopped({ ...DEFAULT_CLIP, id: 'x', assetId: 'a', outPoint: 12 }, 2, donneUnId);
  assert.ok(pieces.length >= 5, `${pieces.length} morceaux`);
  const mouvements = pieces.map((p) => p.motion);
  assert.equal(new Set(mouvements).size >= 3, true, `mouvements : ${mouvements.join(', ')}`);
  for (let i = 1; i < mouvements.length; i += 1) {
    assert.notEqual(mouvements[i], mouvements[i - 1], `deux morceaux de suite en « ${mouvements[i]} »`);
  }
});

test('aucun morceau ne reste immobile', () => {
  const pieces = chopped({ ...DEFAULT_CLIP, id: 'y', assetId: 'a', outPoint: 10 }, 2, donneUnId);
  assert.ok(pieces.every((p) => p.motion !== 'none'), 'un plan fixe ne montre aucune coupe');
});

test('une découpe ne produit jamais des dizaines de morceaux', () => {
  /*
   * Une prise de cinquante-six secondes donnait vingt-huit plans de deux
   * secondes : la même image coupée vingt-huit fois, avec autant de bruitages
   * posés sur des raccords qui ne se voient pas. Rapporté depuis le téléphone :
   * « il a ajouté des plans partout, il a tout découpé ».
   */
  const pieces = chopped({ ...DEFAULT_CLIP, id: 'long', assetId: 'a', outPoint: 56 }, 2, donneUnId);
  assert.ok(pieces.length <= 12, `${pieces.length} morceaux`);
  // Ils s'allongent au lieu de se multiplier, et couvrent toujours la prise.
  const couvert = pieces.reduce((s, p) => s + (p.outPoint - p.inPoint), 0);
  assert.ok(Math.abs(couvert - 56) < 0.01, `${couvert.toFixed(2)} s couvertes`);
});

test('une prise courte se découpe toujours normalement', () => {
  // La borne ne doit pas changer le cas courant : 10 s visées à 2 s font 5.
  const pieces = chopped({ ...DEFAULT_CLIP, id: 'court', assetId: 'a', outPoint: 10 }, 2, donneUnId);
  assert.equal(pieces.length, 5);
});
