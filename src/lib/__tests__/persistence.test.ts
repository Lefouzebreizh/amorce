import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fichierExploitable, fileKey, fileRefs, restoreProject, serializeProject, worthSaving } from '../persistence.ts';
import { emptyProject } from '../timeline.ts';
import { DEFAULT_CLIP, type Project } from '../types.ts';

function project(): Project {
  return {
    ...emptyProject(),
    assets: [
      { id: 'a1', name: 'r1.mp4', url: 'blob:un', duration: 4, width: 1080, height: 1920, thumbnail: '', hasAudio: true },
      { id: 'a2', name: 'r2.mp4', url: 'blob:deux', duration: 4, width: 1080, height: 1920, thumbnail: '', hasAudio: true },
    ],
    clips: [
      { ...DEFAULT_CLIP, id: 'c1', assetId: 'a1', outPoint: 4 },
      { ...DEFAULT_CLIP, id: 'c2', assetId: 'a2', outPoint: 4 },
    ],
    captions: [
      { id: 'cap1', text: 'libre', start: 0, end: 1, style: 'punch', y: 0.3 },
      { id: 'cap2', text: 'issu de la voix', start: 1, end: 2, style: 'karaoke', y: 0.7, voiceId: 'v1' },
    ],
    voices: [{ id: 'v1', name: 'v.mp3', url: 'blob:voix', duration: 2, start: 0, gain: 1, script: 'salut', segments: [] }],
    samples: [{ id: 's1', name: 'boum.wav', url: 'blob:bruit', duration: 1, start: 2, gain: 0.9 }],
    music: { name: 'm.mp3', url: 'blob:musique', duration: 30, gain: 0.4, offset: 0 },
  };
}

/** Les liens qu'on retrouverait après relecture, pour tout ce qui est demandé. */
function allUrls(p: Project): Map<string, string> {
  return new Map(fileRefs(p).map((ref, i) => [ref.key, `blob:repris-${i}`]));
}

test('les clés de rangement séparent les familles', () => {
  assert.notEqual(fileKey('asset', 'x'), fileKey('voix', 'x'));
  assert.equal(fileKey('musique', 'peu importe'), 'musique');
});

test('un projet vierge n’a rien à conserver', () => {
  assert.equal(worthSaving(emptyProject()), false);
  assert.equal(worthSaving(project()), true);
});

test('le rangement vide les liens, qui ne valent que pour leur page', () => {
  const saved = serializeProject(project());
  assert.deepEqual(saved.project.assets.map((a) => a.url), ['', '']);
  assert.equal(saved.project.voices[0].url, '');
  assert.equal(saved.project.samples[0].url, '');
  assert.equal(saved.project.music?.url, '');
  // Tout le reste est conservé tel quel.
  assert.equal(saved.project.clips.length, 2);
  assert.equal(saved.project.voices[0].script, 'salut');
});

test('une reprise complète rend un montage identique', () => {
  const original = project();
  const restored = restoreProject(serializeProject(original), allUrls(original));

  assert.ok(restored);
  assert.equal(restored.assets.length, 2);
  assert.equal(restored.clips.length, 2);
  assert.equal(restored.captions.length, 2);
  assert.equal(restored.voices.length, 1);
  assert.equal(restored.samples.length, 1);
  assert.ok(restored.music);
  for (const ref of fileRefs(restored)) assert.ok(ref.url.startsWith('blob:repris-'));
});

test('un rush effacé emporte les plans qui en dépendaient', () => {
  const original = project();
  const urls = allUrls(original);
  urls.delete(fileKey('asset', 'a1'));

  const restored = restoreProject(serializeProject(original), urls);
  assert.ok(restored);
  assert.deepEqual(restored.assets.map((a) => a.id), ['a2']);
  // Le plan orphelin doit disparaître : le laisser donnerait un montage qui
  // s'ouvre normalement et se révèle vide à la lecture.
  assert.deepEqual(restored.clips.map((c) => c.id), ['c2']);
});

test('une réplique effacée emporte ses sous-titres, pas les autres', () => {
  const original = project();
  const urls = allUrls(original);
  urls.delete(fileKey('voix', 'v1'));

  const restored = restoreProject(serializeProject(original), urls);
  assert.ok(restored);
  assert.equal(restored.voices.length, 0);
  assert.deepEqual(restored.captions.map((c) => c.id), ['cap1']);
});

test('une musique effacée ne laisse pas de piste morte', () => {
  const original = project();
  const urls = allUrls(original);
  urls.delete('musique');

  const restored = restoreProject(serializeProject(original), urls);
  assert.equal(restored?.music, null);
});

test('un format inconnu est refusé plutôt que deviné', () => {
  const saved = serializeProject(project());
  assert.equal(restoreProject({ ...saved, format: 99 }, allUrls(project())), null);
});

test('un fichier rangé vide est traité comme perdu, pas comme valide', () => {
  // Un Blob de zéro octet est `truthy` : sans garde, il produisait un lien qui
  // ne décode rien, et le montage se rouvrait normalement pour sortir noir.
  assert.equal(fichierExploitable(new Blob([])), false);
  assert.equal(fichierExploitable(undefined), false);
  assert.equal(fichierExploitable(new Blob(['x'])), true);
});

test('un rush dont le fichier était vide emporte ses plans', () => {
  const original = project();
  const urls = allUrls(original);
  // Ce que fait la relecture d'un fichier de zéro octet, une fois écarté.
  urls.delete(fileKey('asset', 'a1'));

  const restored = restoreProject(serializeProject(original), urls);
  assert.equal(restored?.assets.length, 1);
  assert.equal(restored?.clips.every((c) => c.assetId !== 'a1'), true);
});
