import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAutoEdit } from '../autoEdit.ts';
import { totalDuration } from '../timeline.ts';
import { IMAGE_DURATION, type MediaAsset } from '../types.ts';

function asset(id: string, duration: number): MediaAsset {
  return { id, name: `${id}.mp4`, kind: 'video', url: `blob:${id}`, duration, width: 1080, height: 1920, thumbnail: '', hasAudio: true };
}

function image(id: string): MediaAsset {
  return { ...asset(id, IMAGE_DURATION), name: `${id}.png`, kind: 'image', hasAudio: false };
}

test('un rush unique est conservé entier', () => {
  /*
   * Le cas de la voix off : tout le propos tient dans un seul fichier. Le
   * ramener à deux secondes couperait la phrase en plein milieu, et rien à
   * l'écran ne dirait qu'il manque six secondes de parole.
   */
  const { clips } = buildAutoEdit([asset('a', 8.4)]);

  assert.equal(clips.length, 1);
  assert.equal(clips[0].inPoint, 0, 'même l’amorce est gardée : elle porte les premiers mots');
  assert.equal(clips[0].outPoint, 8.4);
  assert.equal(clips[0].speed, 1, 'la vitesse d’origine préserve la voix');
  assert.ok(Math.abs(totalDuration(clips) - 8.4) < 1e-9);
});

test('plusieurs rushes sont ramenés à des plans courts', () => {
  const { clips } = buildAutoEdit([asset('a', 20), asset('b', 20), asset('c', 20)]);

  assert.equal(clips.length, 3);
  for (const clip of clips) {
    const shown = (clip.outPoint - clip.inPoint) / clip.speed;
    assert.ok(shown <= 2.2, `plan de ${shown.toFixed(1)} s, trop long pour un enchaînement`);
  }
});

test('un rush unique très court reste utilisable', () => {
  const { clips } = buildAutoEdit([asset('a', 1.2)]);
  assert.equal(clips.length, 1);
  assert.ok(Math.abs(totalDuration(clips) - 1.2) < 1e-9);
});

test('un rush trop bref pour être vu est écarté', () => {
  assert.equal(buildAutoEdit([asset('a', 0.1)]).clips.length, 0);
});

test('le premier plan démarre toujours sans transition', () => {
  const { clips } = buildAutoEdit([asset('a', 20), asset('b', 20)]);
  assert.equal(clips[0].transition, 'cut');
  assert.notEqual(clips[1].transition, 'cut');
});

test('le montage express pose une accroche et de quoi ponctuer', () => {
  const { captions, cues } = buildAutoEdit([asset('a', 20), asset('b', 20), asset('c', 20)]);

  assert.equal(captions.length, 1);
  assert.equal(captions[0].start, 0, 'l’accroche doit tomber sur la première image');
  assert.ok(cues.length >= 3, `${cues.length} bruitage(s) seulement`);
  assert.ok(cues.some((c) => c.time < 0.1), 'rien ne marque la première image');
});

test('les bruitages posés restent dans les bornes du montage', () => {
  const { clips, cues } = buildAutoEdit([asset('a', 20), asset('b', 20), asset('c', 20)]);
  const duration = totalDuration(clips);

  for (const cue of cues) {
    assert.ok(cue.time >= 0 && cue.time <= duration, `bruitage hors montage à ${cue.time}`);
  }
});

test('aucun rush, aucun montage', () => {
  const result = buildAutoEdit([]);
  assert.deepEqual([result.clips.length, result.captions.length, result.cues.length], [0, 0, 0]);
});

test('une image fixe unique n’est pas conservée entière', () => {
  /*
   * L'exception au cas précédent. Une image ne porte aucune parole qu'on
   * couperait : la garder entière ne protège rien et pose six secondes
   * d'immobilité, exactement ce que l'analyse pénalise.
   */
  const { clips } = buildAutoEdit([image('i')]);

  assert.equal(clips.length, 1);
  const longueur = clips[0].outPoint - clips[0].inPoint;
  assert.ok(longueur < IMAGE_DURATION, `un plan de ${longueur}s, soit l’image entière`);
  assert.ok(longueur <= 2.5, 'au-delà de 2,5 s, l’analyse compte une retombée d’attention');
});

test('une image fixe reçoit un mouvement de caméra', () => {
  /*
   * C'est tout ce qui sépare un diaporama d'un montage : sans mouvement, une
   * image fixe est un arrêt sur image, et le spectateur passe.
   */
  const { clips } = buildAutoEdit([image('i1'), image('i2'), image('i3')]);

  assert.equal(clips[0].motion, 'zoomIn', 'l’ouverture avance');
  assert.ok(
    clips.some((clip) => clip.motion !== 'none'),
    'au moins un plan bouge',
  );
});

test('le montage express ne pose jamais de plan fixe', () => {
  /*
   * Un plan sur trois était immobile. Sur des rushes qui se ressemblent — même
   * personnage, même palette — un plan fixe entre deux autres ne se lit pas
   * comme une coupe mais comme un arrêt : mesuré sur un film livré, des plans
   * de 2,1 s donnaient des suites de 4,6 et 7,5 secondes sans qu'aucun raccord
   * ne se voie.
   */
  const assets = Array.from({ length: 8 }, (_, i) => asset(`a${i}`, 4));
  const { clips } = buildAutoEdit(assets);
  assert.ok(clips.length >= 6, `${clips.length} plans`);
  assert.ok(clips.every((c) => c.motion !== 'none'), clips.map((c) => c.motion).join(', '));
});

test('deux plans qui se suivent ne portent pas le même mouvement', () => {
  const assets = Array.from({ length: 8 }, (_, i) => asset(`b${i}`, 4));
  const { clips } = buildAutoEdit(assets);
  for (let i = 1; i < clips.length; i += 1) {
    assert.notEqual(clips[i].motion, clips[i - 1].motion, `plans ${i - 1} et ${i}`);
  }
});

test('le montage vise sa durée au lieu de la subir', () => {
  /*
   * La longueur d'un plan était fixe : plus on importait de rushes, plus le
   * film s'allongeait. Mesuré avant : douze rushes donnaient 21,9 s, vingt
   * 36,3 et trente 54,3 — au-delà des quarante-cinq secondes où le guide
   * réclame ensuite de raccourcir, une fois par plan.
   */
  for (const n of [12, 20, 30, 50]) {
    const { clips } = buildAutoEdit(Array.from({ length: n }, (_, i) => asset(`d${i}`, 4)));
    const duree = totalDuration(clips);
    assert.ok(duree <= 35, `${n} rushes donnent ${duree.toFixed(1)} s`);
    assert.equal(clips.length, n, 'aucun rush n’est écarté en silence');
  }
});

test('peu de rushes gardent des plans de deux secondes', () => {
  // La borne ne doit pas raccourcir ce qui n'a pas besoin de l'être.
  const { clips } = buildAutoEdit(Array.from({ length: 4 }, (_, i) => asset(`e${i}`, 4)));
  const plan = clips[1];
  assert.ok(plan.outPoint - plan.inPoint > 2, `${(plan.outPoint - plan.inPoint).toFixed(2)} s`);
});

test('un plan ne descend jamais sous le seuil de lisibilité', () => {
  // Cent rushes ne doivent pas produire des plans de deux dixièmes.
  const { clips } = buildAutoEdit(Array.from({ length: 100 }, (_, i) => asset(`f${i}`, 4)));
  // Un millième de tolérance : les bornes se calculent en flottant, et
  // 0,32 + 0,9 − 0,32 ne rend pas exactement 0,9.
  for (const c of clips) {
    assert.ok(c.outPoint - c.inPoint >= 0.899, `plan de ${(c.outPoint - c.inPoint).toFixed(4)} s`);
  }
});
