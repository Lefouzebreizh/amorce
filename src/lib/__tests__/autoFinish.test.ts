import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeProject } from '../analysis.ts';
import { CAPTION_SETS, applyFinish, buildFinish, captionSet, cinemaFor, soundsOnCuts, thinCues } from '../autoFinish.ts';
import { emptyProject, totalDuration } from '../timeline.ts';
import { DEFAULT_CLIP, type Caption, type MediaAsset, type Project } from '../types.ts';

/** Identifiants prévisibles, pour pouvoir comparer ce qui est produit. */
function counter() {
  let n = 0;
  return () => `id${n++}`;
}

function asset(id: string): MediaAsset {
  return { id, name: `${id}.mp4`, url: `blob:${id}`, duration: 30, width: 1080, height: 1920, thumbnail: '', hasAudio: true };
}

/** Un montage nu : des plans, rien d'autre. C'est le cas qu'on vient corriger. */
function bare(shots: number[]): Project {
  return {
    ...emptyProject(),
    assets: [asset('a')],
    clips: shots.map((seconds, i) => ({
      ...DEFAULT_CLIP,
      id: `c${i}`,
      assetId: 'a',
      outPoint: seconds,
      transition: 'cut' as const,
      transitionDuration: 0,
    })),
  };
}

const run = (project: Project, setId = 'bande-annonce') =>
  applyFinish(project, analyzeProject(project), setId, counter());

test('la note monte franchement sur un montage nu', () => {
  const project = bare([2.5, 2.5, 2.5, 2.5, 2.5]);
  const avant = analyzeProject(project).score;
  const apres = analyzeProject(run(project)).score;

  // Un montage nu marque déjà sur le rythme et la tension : ce qui compte
  // n'est pas son niveau de départ mais l'écart que le bouton produit.
  assert.ok(apres - avant >= 25, `la note ne gagne que ${apres - avant} points (${avant} → ${apres})`);
  assert.ok(apres >= 75, `la note devrait dépasser 75, elle est à ${apres}`);
});

test('les plans trop longs sont découpés, les autres intacts', () => {
  const project = bare([2, 8, 2]);
  const { clips } = buildFinish(project, analyzeProject(project), 'bande-annonce', counter());

  // 8 s découpées en morceaux d'environ 2 s : quatre morceaux, plus les deux
  // plans courts laissés tels quels.
  assert.equal(clips.length, 6);
  for (const clip of clips) {
    assert.ok((clip.outPoint - clip.inPoint) / clip.speed <= 3.5);
  }
  // La durée totale ne bouge pas : découper ne rallonge pas le montage.
  assert.ok(Math.abs(totalDuration(clips) - totalDuration(project.clips)) < 1e-6);
});

test('le plan d’ouverture reçoit un mouvement', () => {
  const { clips } = buildFinish(bare([2, 2]), analyzeProject(bare([2, 2])), 'bande-annonce', counter());
  assert.equal(clips[0].motion, 'zoomIn');
});

test('un mouvement déjà choisi n’est pas remplacé', () => {
  const project = bare([2, 2]);
  project.clips[0] = { ...project.clips[0], motion: 'shake' };
  const { clips } = buildFinish(project, analyzeProject(project), 'bande-annonce', counter());
  assert.equal(clips[0].motion, 'shake');
});

test('la trame commence à la toute première image', () => {
  const { captions } = buildFinish(bare([3, 3, 3]), analyzeProject(bare([3, 3, 3])), 'bande-annonce', counter());
  const first = [...captions].sort((a, b) => a.start - b.start)[0];
  assert.equal(first.start, 0);
  assert.ok(first.text.length > 0, 'l’ouverture ne doit pas être un emplacement vide');
});

test('la trame se répartit proportionnellement, quelle que soit la durée', () => {
  for (const shots of [[2, 2, 2], [6, 6, 6, 6, 6]]) {
    const project = bare(shots);
    const duration = totalDuration(project.clips);
    const { captions } = buildFinish(project, analyzeProject(project), 'bande-annonce', counter());

    for (const caption of captions) {
      assert.ok(caption.start >= 0, 'un texte commence avant la vidéo');
      assert.ok(caption.end <= duration + 1e-6, `un texte dépasse la fin (${caption.end} > ${duration})`);
      assert.ok(caption.end > caption.start);
    }
  }
});

test('les textes existants ne sont jamais remplacés ni recouverts', () => {
  const project = bare([3, 3, 3]);
  const mien: Caption = { id: 'mien', text: 'ce que j’ai écrit', start: 0, end: 4, style: 'punch', y: 0.3 };
  project.captions = [mien];

  const finished = run(project);
  assert.ok(finished.captions.some((c) => c.id === 'mien' && c.text === 'ce que j’ai écrit'));

  // Aucun texte posé ne vient se superposer au mien.
  for (const caption of finished.captions.filter((c) => c.id !== 'mien')) {
    assert.ok(caption.start >= mien.end || caption.end <= mien.start, `« ${caption.text} » recouvre mon texte`);
  }
});

test('un emplacement vide ne compte pas dans la couverture', () => {
  // Assez long pour qu'il reste un vrai trou entre deux textes de la trame.
  const project = bare([4, 4, 4, 4, 4]);
  const finished = run(project);

  const vides = finished.captions.filter((c) => c.text.trim() === '');
  assert.ok(vides.length > 0, 'des emplacements à remplir doivent être proposés');

  const sansVides = { ...finished, captions: finished.captions.filter((c) => c.text.trim() !== '') };
  assert.equal(
    analyzeProject(finished).criteria.find((c) => c.id === 'texte')?.score,
    analyzeProject(sansVides).criteria.find((c) => c.id === 'texte')?.score,
  );
});

test('aucun bruitage n’est posé là où il y en a déjà un', () => {
  const project = bare([2, 2, 2]);
  project.cues = [{ id: 'deja', sfx: 'boom', time: 2, gain: 0.8 }];

  const finished = run(project);
  const times = finished.cues.map((c) => c.time).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] - times[i - 1] >= 0.15 - 1e-9, `deux bruitages se confondent à ${times[i]} s`);
  }
});

test('un bruitage sonne dans la première seconde', () => {
  const finished = run(bare([2, 2, 2]));
  assert.ok(finished.cues.some((c) => c.time <= 1));
});

test('les bruitages tombent sur les coupes', () => {
  const cues = soundsOnCuts(bare([2, 2, 2]).clips, [], counter());
  assert.deepEqual(cues.map((c) => c.time).sort((a, b) => a - b), [0.02, 2, 4]);
});

test('un rendu déjà choisi est respecté, l’absence de parti pris reçoit celui de la trame', () => {
  const naturel = bare([2, 2]);
  naturel.cinema = { ...naturel.cinema, look: 'naturel' };
  assert.equal(run(naturel).cinema.look, 'blockbuster');

  const choisi = bare([2, 2]);
  choisi.cinema = { ...choisi.cinema, look: 'argentique' };
  assert.equal(run(choisi).cinema.look, 'argentique');
});

test('les trois trames sont utilisables et distinctes', () => {
  assert.equal(new Set(CAPTION_SETS.map((s) => s.id)).size, CAPTION_SETS.length);
  for (const set of CAPTION_SETS) {
    assert.ok(set.slots.length >= 3, `${set.id} n’a pas assez de textes`);
    assert.equal(set.slots[0].at, 0, `${set.id} ne commence pas à la première image`);
    assert.equal(captionSet(set.id).id, set.id);
  }
  // Un identifiant inconnu retombe sur la première trame plutôt que d'échouer.
  assert.equal(captionSet('inconnue').id, CAPTION_SETS[0].id);
});

test('un montage vide ne produit rien et ne casse pas', () => {
  const vide = emptyProject();
  const finished = applyFinish(vide, analyzeProject(vide), 'bande-annonce', counter());
  assert.deepEqual(finished.captions, []);
  assert.deepEqual(finished.clips, []);
});

test('l’allègement rend du silence entre les impacts', () => {
  const project = bare([2, 2, 2, 2, 2]); // 10 s
  // Quinze bruitages en dix secondes : le mur constaté sur un montage réel.
  const cues = Array.from({ length: 15 }, (_, i) => ({
    id: `s${i}`,
    sfx: 'boom' as const,
    time: i * 0.66,
    gain: 0.85,
  }));

  const gardes = thinCues(cues, 10);

  assert.ok(gardes.length < cues.length, 'rien n’a été retiré');
  assert.ok(gardes.length >= 4, `il n’en reste que ${gardes.length}, le rythme disparaîtrait`);

  // L'impact d'ouverture est celui qui fait lever les yeux : jamais sacrifié.
  assert.equal(gardes[0].time, cues[0].time);

  // Plus rien ne se confond à l'oreille.
  for (let i = 1; i < gardes.length; i++) {
    assert.ok(gardes[i].time - gardes[i - 1].time >= 1.5, `deux impacts collés à ${gardes[i].time} s`);
  }
  void project;
});

test('un montage déjà aéré n’est pas touché', () => {
  const cues = [0, 3, 6, 9].map((t, i) => ({ id: `s${i}`, sfx: 'boom' as const, time: t, gain: 0.8 }));
  assert.deepEqual(thinCues(cues, 12), cues);
});

test('la trame impose son rendu, sauf si un choix a été fait', () => {
  const set = captionSet('bande-annonce');

  // Absence de parti pris, et le rendu que pose le montage express : ni l'un ni
  // l'autre n'est une décision.
  assert.equal(cinemaFor(set, { look: 'naturel', intensity: 0.5, bars: 0 }).look, 'blockbuster');
  assert.equal(cinemaFor(set, { look: 'cinema', intensity: 0.7, bars: 0 }).look, 'blockbuster');

  // Un rendu choisi est une décision : on n'y touche pas.
  assert.equal(cinemaFor(set, { look: 'argentique', intensity: 0.6, bars: 0 }).look, 'argentique');
  assert.equal(cinemaFor(set, { look: 'noir', intensity: 0.4, bars: 0 }).intensity, 0.4);
});

test('la trame « Poser les réglages » applique bien le rendu', () => {
  const project = bare([3, 3, 3]);
  project.cinema = { look: 'cinema', intensity: 0.7, bars: 0 };
  const finished = run(project);

  assert.equal(finished.cinema.look, 'blockbuster');
  assert.ok(finished.cinema.intensity >= 0.85);
});
