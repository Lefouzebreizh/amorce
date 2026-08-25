import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromStored, isStored, MUSIC_KEY, requiredFiles, toStored } from '../persist.ts';
import { emptyProject } from '../timeline.ts';
import { DEFAULT_CLIP, type Clip, type MediaAsset, type Project } from '../types.ts';

function asset(id: string): MediaAsset {
  return {
    id,
    name: `${id}.mp4`,
    url: `blob:http://localhost/${id}`,
    duration: 4,
    width: 1080,
    height: 1920,
    thumbnail: 'data:image/jpeg;base64,xxx',
    hasAudio: true,
  };
}

function clip(assetId: string): Clip {
  return { ...DEFAULT_CLIP, id: `clip-${assetId}`, assetId, outPoint: 4 };
}

function project(): Project {
  return {
    ...emptyProject(),
    assets: [asset('a1'), asset('a2')],
    clips: [clip('a1'), clip('a2')],
    captions: [{ id: 'c1', text: 'Salut', start: 0, end: 2, style: 'punch', y: 0.5 }],
    cues: [{ id: 's1', sfx: 'boom', time: 0.5, gain: 0.8 }],
    music: { name: 'fond.mp3', url: 'blob:http://localhost/music', duration: 30, gain: 0.4, offset: 0 },
  };
}

test('aucune URL objet n’est écrite dans le stockage', () => {
  const stored = toStored(project());
  const serialise = JSON.stringify(stored);
  assert.ok(!serialise.includes('blob:'), 'une URL objet a fui dans le stockage');
  assert.ok(stored.project.assets.every((a) => !('url' in a)));
});

test('un média retrouvé reprend une URL neuve', () => {
  const stored = toStored(project());
  const urls = new Map([
    ['a1', 'blob:neuve-1'],
    ['a2', 'blob:neuve-2'],
  ]);
  const restored = fromStored(stored, urls);
  assert.deepEqual(
    restored.assets.map((a) => a.url),
    ['blob:neuve-1', 'blob:neuve-2'],
  );
  assert.equal(restored.assets[0].name, 'a1.mp4');
});

test('un média dont le fichier manque disparaît, et ses clips avec lui', () => {
  const stored = toStored(project());
  const restored = fromStored(stored, new Map([['a1', 'blob:neuve-1']]));
  assert.deepEqual(
    restored.assets.map((a) => a.id),
    ['a1'],
  );
  assert.deepEqual(
    restored.clips.map((c) => c.assetId),
    ['a1'],
  );
});

test('sous-titres et bruitages survivent à la disparition d’un média', () => {
  const restored = fromStored(toStored(project()), new Map());
  assert.equal(restored.assets.length, 0);
  assert.equal(restored.clips.length, 0);
  assert.equal(restored.captions.length, 1);
  assert.equal(restored.cues.length, 1);
});

test('la musique ne revient que si son fichier a été retrouvé', () => {
  const stored = toStored(project());
  assert.equal(fromStored(stored, new Map([['a1', 'blob:1']])).music, null);

  const withMusic = fromStored(
    stored,
    new Map([
      ['a1', 'blob:1'],
      [MUSIC_KEY, 'blob:musique'],
    ]),
  );
  assert.equal(withMusic.music?.url, 'blob:musique');
  assert.equal(withMusic.music?.gain, 0.4);
});

test('les réglages du montage traversent l’aller-retour', () => {
  const source = project();
  const restored = fromStored(toStored(source), new Map([['a1', 'blob:1'], ['a2', 'blob:2']]));
  assert.equal(restored.name, source.name);
  assert.deepEqual(restored.cinema, source.cinema);
  assert.deepEqual(restored.mix, source.mix);
});

test('un enregistrement d’une autre version est rejeté', () => {
  const stored = toStored(project());
  assert.ok(isStored(stored));
  assert.ok(!isStored({ ...stored, version: 999 }));
  assert.ok(!isStored(null));
  assert.ok(!isStored({ version: 1 }));
});

test('requiredFiles annonce la musique en plus des médias', () => {
  assert.deepEqual(requiredFiles(toStored(project())), ['a1', 'a2', MUSIC_KEY]);

  const sansMusique = toStored({ ...project(), music: null });
  assert.deepEqual(requiredFiles(sansMusique), ['a1', 'a2']);
});
