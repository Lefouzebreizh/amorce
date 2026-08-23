import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeProject, band, captionCoverage, findSlumps, tensionCurve } from '../analysis.ts';
import { DEFAULT_CINEMA, DEFAULT_CLIP, type Caption, type Clip, type MediaAsset, type Project } from '../types.ts';

let counter = 0;
const nextId = () => `id${counter++}`;

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'a1',
    name: 'rush.mp4',
    url: 'blob:x',
    duration: 60,
    width: 1080,
    height: 1920,
    thumbnail: '',
    hasAudio: true,
    ...overrides,
  };
}

function clip(seconds: number, overrides: Partial<Clip> = {}): Clip {
  return { ...DEFAULT_CLIP, id: nextId(), assetId: 'a1', outPoint: seconds, transition: 'cut', ...overrides };
}

function caption(start: number, end: number): Caption {
  return { id: nextId(), text: 'hop', start, end, style: 'punch', y: 0.5 };
}

function project(overrides: Partial<Project> = {}): Project {
  return { name: 't', assets: [asset()], clips: [], captions: [], cues: [], music: null, cinema: { ...DEFAULT_CINEMA }, ...overrides };
}

test('band vaut 1 dans la plage idéale et 0 aux bornes dures', () => {
  assert.equal(band(2, 1, 3, 0, 4), 1);
  assert.equal(band(0, 1, 3, 0, 4), 0);
  assert.equal(band(4, 1, 3, 0, 4), 0);
  assert.equal(band(0.5, 1, 3, 0, 4), 0.5);
  assert.equal(band(3.5, 1, 3, 0, 4), 0.5);
});

test('la couverture texte fusionne les sous-titres qui se chevauchent', () => {
  // 0-4 et 2-6 se recouvrent : 6 s couvertes sur 10, pas 8.
  assert.equal(captionCoverage([caption(0, 4), caption(2, 6)], 10), 0.6);
});

test('la couverture texte ignore ce qui dépasse de la timeline', () => {
  assert.equal(captionCoverage([caption(0, 50)], 10), 1);
});

test('la couverture texte est nulle sans sous-titre', () => {
  assert.equal(captionCoverage([], 10), 0);
});

test('un plan long et nu produit une descente de tension', () => {
  const slumps = findSlumps(tensionCurve(project({ clips: [clip(12)] })));
  assert.ok(slumps.length >= 1, 'un plan fixe de 12 s devrait déclencher une alerte');
  assert.ok(slumps[0].duration > 5);
});

test('un montage rythmé ne déclenche aucune alerte de tension', () => {
  const clips = Array.from({ length: 8 }, () => clip(1.6));
  const captions = Array.from({ length: 6 }, (_, i) => caption(i * 2, i * 2 + 1.8));
  const cues = Array.from({ length: 6 }, (_, i) => ({ id: nextId(), sfx: 'whoosh' as const, time: i * 2, gain: 0.8 }));
  assert.deepEqual(findSlumps(tensionCurve(project({ clips, captions, cues }))), []);
});

test('un montage sans accroche est noté sous un montage travaillé', () => {
  const mou = analyzeProject(project({ clips: [clip(14)] }));

  const clips = Array.from({ length: 9 }, (_, i) => clip(1.8, { motion: i === 0 ? 'zoomIn' : 'none' }));
  const captions = Array.from({ length: 7 }, (_, i) => caption(i * 2.2, i * 2.2 + 1.9));
  const cues = Array.from({ length: 8 }, (_, i) => ({ id: nextId(), sfx: 'whoosh' as const, time: i * 2, gain: 0.8 }));
  const bon = analyzeProject(
    project({ clips, captions: [caption(0.2, 2.4), ...captions], cues, music: { name: 'm', url: 'blob:m', duration: 30, gain: 0.3, offset: 0 } }),
  );

  assert.ok(mou.score < 40, `montage mou noté ${mou.score}, attendu sous 40`);
  assert.ok(bon.score > 75, `montage travaillé noté ${bon.score}, attendu au-dessus de 75`);
});

test('la note reste dans les bornes 0-100', () => {
  const extreme = analyzeProject(
    project({
      clips: Array.from({ length: 60 }, () => clip(0.3)),
      captions: Array.from({ length: 40 }, (_, i) => caption(i * 0.4, i * 0.4 + 0.4)),
      cues: Array.from({ length: 80 }, (_, i) => ({ id: nextId(), sfx: 'boom' as const, time: i * 0.2, gain: 1 })),
    }),
  );
  assert.ok(extreme.score >= 0 && extreme.score <= 100, `note hors bornes : ${extreme.score}`);
});

test('un projet vide renvoie une note nulle et un conseil de démarrage', () => {
  const empty = analyzeProject(project());
  assert.equal(empty.score, 0);
  assert.equal(empty.criteria.length, 0);
  assert.equal(empty.advice.length, 1);
});

test('une accroche texte dès la première image fait monter le hook', () => {
  const clips = [clip(1.5), clip(1.5), clip(1.5)];
  const sans = analyzeProject(project({ clips }));
  const avec = analyzeProject(project({ clips, captions: [caption(0, 2)] }));

  const hook = (a: ReturnType<typeof analyzeProject>) => a.criteria.find((c) => c.id === 'hook')!.score;
  assert.ok(hook(avec) > hook(sans) + 0.3, 'le texte d’accroche devrait peser lourd dans le hook');
});

test('les conseils sont triés du plus rentable au moins rentable', () => {
  const { advice } = analyzeProject(project({ clips: [clip(20)] }));
  assert.ok(advice.length > 1);
  for (let i = 1; i < advice.length; i++) {
    assert.ok(advice[i - 1].impact >= advice[i].impact, 'conseils mal triés');
  }
});

test('les descentes de tension sont horodatées dans la timeline', () => {
  const analysis = analyzeProject(project({ clips: [clip(2), clip(10)] }));
  const slump = analysis.slumps[0];
  assert.ok(slump, 'une alerte était attendue');
  assert.ok(slump.start >= 2 && slump.end <= analysis.duration + 0.1);
});

test('chaque critère porte une consigne de correction non vide', () => {
  const clips = [clip(20)];
  for (const criterion of analyzeProject(project({ clips })).criteria) {
    assert.ok(criterion.remedy.length > 10, `${criterion.id} sans consigne exploitable`);
    assert.ok(criterion.detail.length > 10, `${criterion.id} sans description`);
  }
});

test('la consigne du hook dépend de ce qui manque réellement', () => {
  const clips = [clip(2), clip(2), clip(2)];

  // Sans accroche, la consigne doit renvoyer vers la pose d'un texte.
  const sansTexte = analyzeProject(project({ clips })).criteria.find((c) => c.id === 'hook')!;
  assert.match(sansTexte.remedy, /Accroche/);

  // Avec une accroche mais un seul plan, c'est la coupe qui manque.
  const seulPlan = analyzeProject(
    project({ clips: [clip(20)], captions: [caption(0, 2)] }),
  ).criteria.find((c) => c.id === 'hook')!;
  assert.match(seulPlan.remedy, /ciseaux|couper/i);
});

test('la consigne de rythme cite la durée du plan fautif', () => {
  const rythme = analyzeProject(project({ clips: [clip(19.5)] })).criteria.find((c) => c.id === 'rythme')!;
  assert.match(rythme.remedy, /19\.5 s/, 'la consigne doit nommer le plan à couper');
});

test('la consigne sur le son dépend de ce qui est déjà en place', () => {
  const clips = [clip(2), clip(2)];

  const sansRien = analyzeProject(project({ clips })).criteria.find((c) => c.id === 'son')!;
  assert.match(sansRien.remedy, /Whoosh/);

  const avecBruitages = analyzeProject(
    project({ clips, cues: [{ id: nextId(), sfx: 'whoosh', time: 1, gain: 0.8 }] }),
  ).criteria.find((c) => c.id === 'son')!;
  assert.match(avecBruitages.remedy, /musique/);
});

test('un critère au maximum ne réclame aucune correction urgente', () => {
  const clips = Array.from({ length: 8 }, () => clip(1.6));
  const cues = Array.from({ length: 6 }, (_, i) => ({ id: nextId(), sfx: 'whoosh' as const, time: i * 2, gain: 0.8 }));
  const tension = analyzeProject(project({ clips, cues })).criteria.find((c) => c.id === 'tension')!;

  assert.equal(tension.score, 1);
  assert.match(tension.remedy, /Rien à corriger/);
});
