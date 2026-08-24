import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAutoEdit } from '../autoEdit.ts';
import { totalDuration } from '../timeline.ts';
import type { MediaAsset } from '../types.ts';

function asset(id: string, duration: number): MediaAsset {
  return { id, name: `${id}.mp4`, url: `blob:${id}`, duration, width: 1080, height: 1920, thumbnail: '', hasAudio: true };
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
