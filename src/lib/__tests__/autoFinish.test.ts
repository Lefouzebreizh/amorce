import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeProject } from '../analysis.ts';
import {
  CAPTION_SETS,
  applyFinish,
  buildFinish,
  captionSet,
  cinemaFor,
  soundsOnCuts,
  thinCues,
} from '../autoFinish.ts';
import { emptyProject, totalDuration } from '../timeline.ts';
import { DEFAULT_CLIP, type Caption, type MediaAsset, type Project, type SoundCue } from '../types.ts';

/** Identifiants prévisibles, pour pouvoir comparer ce qui est produit. */
function counter() {
  let n = 0;
  return () => `id${n++}`;
}

function asset(id: string): MediaAsset {
  return { id, name: `${id}.mp4`, kind: 'video', url: `blob:${id}`, duration: 30, width: 1080, height: 1920, thumbnail: '', hasAudio: true };
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
  // La trame pose désormais son propre rendu plutôt que le générique
  // « cinema » : une bande-annonce n'a pas la couleur d'un tutoriel.
  const naturel = bare([2, 2]);
  naturel.cinema = { ...naturel.cinema, look: 'naturel' };
  assert.equal(run(naturel).cinema.look, 'blockbuster');

  const choisi = bare([2, 2]);
  choisi.cinema = { ...choisi.cinema, look: 'argentique' };
  assert.equal(run(choisi).cinema.look, 'argentique');

  // Une trame qui ne déclare aucun rendu ne touche à rien.
  const tutoriel = bare([2, 2]);
  tutoriel.cinema = { ...tutoriel.cinema, look: 'naturel' };
  assert.equal(run(tutoriel, 'tutoriel').cinema.look, 'naturel');
});

test('la trame impose son rendu, sauf si un choix a été fait', () => {
  const set = captionSet('bande-annonce');

  // Absence de parti pris, et le rendu que pose le montage express : ni l'un ni
  // l'autre n'est une décision.
  assert.equal(cinemaFor(set, { look: 'naturel', intensity: 0.5, bars: 0 }).look, 'blockbuster');
  assert.equal(cinemaFor(set, { look: 'cinema', intensity: 0.7, bars: 0 }).look, 'blockbuster');

  // Un rendu choisi est une décision : on n'y touche pas, ni à son intensité.
  assert.equal(cinemaFor(set, { look: 'argentique', intensity: 0.6, bars: 0 }).look, 'argentique');
  assert.equal(cinemaFor(set, { look: 'noir', intensity: 0.4, bars: 0 }).intensity, 0.4);
});

test('les trames sont utilisables, distinctes, et laissent leurs crochets', () => {
  assert.equal(new Set(CAPTION_SETS.map((s) => s.id)).size, CAPTION_SETS.length);
  for (const set of CAPTION_SETS) {
    assert.ok(set.slots.length >= 3, `${set.id} n’a pas assez de textes`);
    assert.equal(set.slots[0].at, 0, `${set.id} ne commence pas à la première image`);
    assert.equal(captionSet(set.id).id, set.id);
    // Chaque trame doit garder au moins un crochet : c'est la marque de ce que
    // l'utilisateur seul peut écrire, et une trame entièrement pré-remplie
    // ferait publier les mots de quelqu'un d'autre.
    assert.ok(set.slots.some((slot) => slot.text.includes('[')),
      `${set.id} ne laisse aucun crochet à remplir`);
    // La dernière rend la main : sans elle, la trame s'arrête sur un constat.
    assert.ok(set.slots[set.slots.length - 1].at > 0.6,
      `${set.id} n’a pas de texte de fin`);
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

test('l’allègement ramène les bruitages dans la plage visée', () => {
  const cues = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, sfx: 'boom', time: i * 0.5, gain: 1 }) satisfies SoundCue);
  const gardes = thinCues(cues, 10);
  // Six pour dix secondes est le haut de la plage : au-delà, la notation punit.
  assert.ok(gardes.length <= 6, `${gardes.length} bruitages gardés pour 10 s`);
  assert.ok(gardes.length >= 2, 'jamais moins de deux, sinon la ponctuation disparaît');
});

test('l’allègement garde l’ordre du montage, sans trier sur autre chose', () => {
  const cues = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, sfx: 'boom', time: i * 0.8, gain: 1 }) satisfies SoundCue);
  const gardes = thinCues(cues, 10);
  const temps = gardes.map((c) => c.time);
  assert.deepEqual(temps, [...temps].sort((a, b) => a - b));
});

test('un montage déjà dans la plage n’est pas allégé', () => {
  const cues = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, sfx: 'boom', time: i * 2, gain: 1 }) satisfies SoundCue);
  assert.equal(thinCues(cues, 10).length, 4);
});

test('poser un bruitage par coupe dégrade le son d’un montage déjà ponctué', () => {
  // La raison d'être du bouton conditionné : le remède abîmait ce qu'il visait.
  const dense: Project = {
    ...bare([2, 2, 2, 2, 2]),
    cues: Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, sfx: 'boom', time: i * 1.2, gain: 1 }) satisfies SoundCue),
  };
  const son = (p: Project) => analyzeProject(p).criteria.find((c) => c.id === 'son')?.score ?? 0;
  const ajoutes = soundsOnCuts(dense.clips, dense.cues, (() => { let n = 0; return () => `n${n++}`; })());
  assert.ok(
    son({ ...dense, cues: [...dense.cues, ...ajoutes] }) < son(dense),
    'sans cette baisse, le bouton conditionné n’aurait plus de raison d’être',
  );
});

/*
 * Ce que « Poser les réglages » change vraiment, et ce qu'il laisse.
 *
 * Le panneau d'analyse annonçait « rien de ce que tu as déjà fait n'est
 * remplacé ». C'est vrai des textes et des bruitages, et faux des plans :
 * `alterneLesRushes` réordonne le montage pour que deux morceaux d'un même
 * rush ne se suivent pas. Quelqu'un qui a passé l'étape 2 à ranger ses plans
 * les retrouve rebattus, sans qu'on le lui ait dit.
 *
 * Le comportement est bon — c'est lui qui évite les trente vignettes
 * identiques sur quarante. C'est la phrase qui était fausse, et ces deux tests
 * l'ancrent : le jour où le comportement change, l'un des deux tombe et la
 * formulation se rediscute.
 */
test('poser les réglages garde tous les textes et bruitages existants', () => {
  const project: Project = {
    ...bare([2, 2, 2, 2]),
    captions: [
      { id: 'mien', text: 'Mon texte à moi', start: 0.5, end: 2, style: 'punch', y: 0.3 },
    ],
    cues: [{ id: 'mien-son', sfx: 'boom', time: 1, gain: 1 }],
  };

  const apres = run(project);

  assert.ok(
    apres.captions.some((c) => c.id === 'mien' && c.text === 'Mon texte à moi'),
    'le texte écrit à la main devrait survivre tel quel',
  );
  assert.ok(apres.cues.some((c) => c.id === 'mien-son'), 'le bruitage posé à la main devrait survivre');
});

test('poser les réglages peut réordonner les plans de plusieurs rushes', () => {
  const project: Project = {
    ...emptyProject(),
    assets: [asset('a'), asset('b')],
    // Deux morceaux de « a » qui se suivent : exactement ce que l'alternance
    // est là pour défaire.
    clips: [
      { ...DEFAULT_CLIP, id: 'a1', assetId: 'a', outPoint: 2, transition: 'cut', transitionDuration: 0 },
      { ...DEFAULT_CLIP, id: 'a2', assetId: 'a', outPoint: 2, transition: 'cut', transitionDuration: 0 },
      { ...DEFAULT_CLIP, id: 'b1', assetId: 'b', outPoint: 2, transition: 'cut', transitionDuration: 0 },
    ],
  };

  const rushes = run(project).clips.map((c) => c.assetId);

  assert.equal(rushes.length, 3, 'aucun plan ne devrait disparaître');
  assert.notDeepEqual(rushes, ['a', 'a', 'b'], 'l’ordre d’origine ne devrait pas être conservé tel quel');
  assert.notEqual(rushes[0], rushes[1], 'deux morceaux du même rush ne devraient plus se suivre');
});
