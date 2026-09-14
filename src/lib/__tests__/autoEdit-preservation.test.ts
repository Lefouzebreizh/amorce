import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAutoEdit, buildAutoEdit } from '../autoEdit.ts';
import { emptyProject, layoutClips, totalDuration } from '../timeline.ts';
import { useStudio } from '../store.ts';
import type { MediaAsset } from '../types.ts';

const rush = (id: string, duration = 15, hasAudio = true): MediaAsset => ({
  id, name: `${id}.mp4`, kind: 'video', url: `blob:${id}`, duration,
  width: 480, height: 854, thumbnail: '', hasAudio,
});

test('plusieurs créatures gardent leur révélation finale et leur ordre', () => {
  const assets = [rush('zebre'), rush('cerf', 15.04), rush('scarabee', 15.07)];
  const result = buildAutoEdit(assets);
  assert.equal(result.clips.length, 3);
  assert.deepEqual(result.clips.map(c => c.assetId), assets.map(a => a.id));
  result.clips.forEach((clip, i) => {
    assert.equal(clip.inPoint, 0);
    assert.equal(clip.outPoint, assets[i].duration, 'la fin du rush ne doit pas disparaître');
    assert.equal(clip.speed, 1);
    assert.equal(clip.motion, 'none', 'aucun second mouvement de caméra');
    assert.equal(clip.volume, 1);
  });
  const placed = layoutClips(result.clips);
  assert.ok(placed.every(p => p.transitionIn === 0), 'les bandes originales ne se chevauchent pas');
  assert.deepEqual(result.captions, []);
  assert.deepEqual(result.cues, []);
  assert.ok(Math.abs(totalDuration(result.clips) - 45.11) < 1e-6);
});

test('un lot de plus de 31 vidéos ne perd aucun rush en conservation', () => {
  const assets = Array.from({ length: 40 }, (_, i) => rush(String(i), 4));
  const { clips } = buildAutoEdit(assets);
  assert.equal(clips.length, 40);
  assert.equal(totalDuration(clips), 160);
});

test('même un rush muet ne reçoit pas de bruitage sans choix explicite', () => {
  assert.deepEqual(buildAutoEdit([rush('muet', 15, false)]).cues, []);
});

test('l’habillage sonore ne couvre pas une piste d’origine ou inconnue', () => {
  for (const hasAudio of [true, undefined]) {
    const asset = { ...rush('son'), hasAudio } as MediaAsset;
    assert.deepEqual(buildAutoEdit([asset], { soundEffects: true }).cues, []);
  }
});

test('le découpage court seul reste sans effets ni textes et tient sa durée', () => {
  const assets = Array.from({ length: 50 }, (_, i) => rush(String(i), 15));
  const result = buildAutoEdit(assets, { shorten: true });
  assert.ok(result.clips.length > 0);
  assert.ok(totalDuration(result.clips) <= 35);
  assert.ok(result.clips.every(c => c.motion === 'none' && c.transition === 'cut'));
  assert.deepEqual(result.captions, []);
  assert.deepEqual(result.cues, []);
});

test('les options de texte, mouvement et son restent indépendantes', () => {
  const assets = [rush('a', 4, false), rush('b', 4, false)];
  const texte = buildAutoEdit(assets, { captionGuide: true });
  assert.ok(texte.captions.length > 0);
  assert.deepEqual(texte.cues, []);
  assert.ok(texte.clips.every(c => c.motion === 'none'));
  const image = buildAutoEdit(assets, { visualEffects: true });
  assert.ok(image.clips.some(c => c.motion !== 'none'));
  assert.deepEqual(image.cues, []);
  assert.deepEqual(image.captions, []);
});

test('le montage conserve l’étalonnage choisi, y compris naturel', () => {
  assert.equal(emptyProject().cinema.look, 'naturel', 'une première importation ne doit pas être réétalonnée');
  for (const look of ['naturel', 'cinema'] as const) {
    const project = emptyProject();
    project.assets = [rush('a')];
    project.cinema.look = look;
    const next = applyAutoEdit(project, { visualEffects: true });
    assert.deepEqual(next.cinema, project.cinema);
  }
});

test('les options traversent le store et le geste peut être annulé', () => {
  const project = emptyProject();
  project.assets = [rush('a'), rush('b')];
  useStudio.setState({ project, past: [], future: [], regroupement: { label: '', instant: 0 } });
  useStudio.getState().montageExpress({ shorten: true });
  assert.ok(useStudio.getState().project.clips[0].outPoint < 3);
  useStudio.getState().undo();
  assert.deepEqual(useStudio.getState().project, project);
  useStudio.getState().montageExpress();
  assert.equal(useStudio.getState().project.clips[0].outPoint, 15);
});
