import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextStep } from '../guide.ts';
import { emptyProject } from '../timeline.ts';
import { DEFAULT_CLIP, type Caption, type Clip, type MediaAsset, type Project, type SoundCue } from '../types.ts';

let counter = 0;
const id = () => `g${counter++}`;

function asset(duration = 30): MediaAsset {
  return { id: 'a', name: 'r.mp4', kind: 'video', url: 'blob:a', duration, width: 1080, height: 1920, thumbnail: '', hasAudio: true };
}

function clip(seconds: number): Clip {
  return { ...DEFAULT_CLIP, id: id(), assetId: 'a', outPoint: seconds, transition: 'cut' };
}

function caption(text = 'Attends la fin'): Caption {
  return { id: id(), text, start: 0, end: 2, style: 'punch', y: 0.3 };
}

function cue(time: number): SoundCue {
  return { id: id(), sfx: 'whoosh', time, gain: 0.8 };
}

/** Projet complet, que le guide doit déclarer prêt. */
function ready(): Project {
  return {
    ...emptyProject(),
    assets: [asset()],
    clips: Array.from({ length: 10 }, () => clip(2)),
    captions: [caption(), { ...caption('suite'), start: 2, end: 18 }],
    cues: Array.from({ length: 6 }, (_, i) => cue(i * 3)),
    cinema: { look: 'cinema', intensity: 0.7, bars: 0 },
  };
}

test('sans rush, le guide demande d’importer', () => {
  const step = nextStep(emptyProject());
  assert.match(step.title, /Importe/);
  assert.deepEqual(step.action, { kind: 'goto', step: 'import' });
});

test('avec des rushes mais rien sur la timeline, il lance le montage express', () => {
  const step = nextStep({ ...emptyProject(), assets: [asset()] });
  assert.equal(step.action.kind, 'autoEdit');
});

test('un montage trop court appelle une duplication', () => {
  const step = nextStep({ ...emptyProject(), assets: [asset()], clips: [clip(3)] });
  assert.match(step.title, /3\.0 s/);
  assert.equal(step.action.kind, 'duplicateLongest');
});

test('sans accroche, c’est elle qui passe avant le reste', () => {
  const project = { ...emptyProject(), assets: [asset()], clips: Array.from({ length: 6 }, () => clip(2)) };
  const step = nextStep(project);
  assert.match(step.title, /accroche/i);
});

test('une accroche vide ne compte pas comme une accroche', () => {
  const project = {
    ...emptyProject(),
    assets: [asset()],
    clips: Array.from({ length: 6 }, () => clip(2)),
    captions: [caption('   ')],
  };
  assert.match(nextStep(project).title, /accroche/i);
});

test('un plan qui s’étire appelle un découpage, chiffres à l’appui', () => {
  const project = {
    ...emptyProject(),
    assets: [asset()],
    clips: [clip(12)],
    captions: [caption()],
  };
  const step = nextStep(project);
  assert.match(step.title, /12\.0 s/);
  assert.equal(step.action.kind, 'chopLongest');
});

test('un montage rythmé mais muet appelle des bruitages', () => {
  const project = {
    ...emptyProject(),
    assets: [asset()],
    clips: Array.from({ length: 8 }, () => clip(2)),
    captions: [caption()],
  };
  assert.equal(nextStep(project).action.kind, 'soundsOnCuts');
});

test('un rendu naturel appelle un étalonnage', () => {
  const project = { ...ready(), cinema: { look: 'naturel' as const, intensity: 0.7, bars: 0 } };
  const step = nextStep(project);
  assert.match(step.title, /rendu/i);
  assert.deepEqual(step.action, { kind: 'goto', step: 'cinema' });
});

test('un montage complet est déclaré prêt et propose l’export', () => {
  const step = nextStep(ready());
  assert.equal(step.done, true);
  assert.deepEqual(step.action, { kind: 'goto', step: 'export' });
});

test('le guide ne donne jamais qu’une consigne, toujours motivée', () => {
  const projets = [
    emptyProject(),
    { ...emptyProject(), assets: [asset()] },
    { ...emptyProject(), assets: [asset()], clips: [clip(3)] },
    { ...emptyProject(), assets: [asset()], clips: [clip(12)], captions: [caption()] },
    ready(),
  ];

  for (const projet of projets) {
    const step = nextStep(projet);
    assert.ok(step.title.length > 5, 'consigne vide');
    assert.ok(step.why.length > 20, 'consigne sans justification');
    assert.ok(step.actionLabel.length > 3, 'bouton sans intitulé');
  }
});
