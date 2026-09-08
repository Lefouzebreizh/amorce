import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeProject } from '../analysis.ts';
import { DUREE_PUBLIABLE, PLAN_QUI_DORT, detecterManques, matiereInutilisee } from '../manques.ts';
import { emptyProject } from '../timeline.ts';
import {
  DEFAULT_CLIP,
  type Caption,
  type Clip,
  type MediaAsset,
  type Project,
  type SoundCue,
} from '../types.ts';

let compteur = 0;
const prochainId = () => `id${compteur++}`;

function media(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'a1',
    name: 'rush.mp4',
    kind: 'video',
    url: 'blob:x',
    duration: 60,
    width: 1080,
    height: 1920,
    thumbnail: '',
    hasAudio: true,
    ...overrides,
  };
}

function plan(secondes: number, overrides: Partial<Clip> = {}): Clip {
  return { ...DEFAULT_CLIP, id: prochainId(), assetId: 'a1', outPoint: secondes, transition: 'cut', ...overrides };
}

function texte(start: number, end: number): Caption {
  return { id: prochainId(), text: 'hop', start, end, style: 'punch', y: 0.5 };
}

function bruit(time: number): SoundCue {
  return { id: prochainId(), sfx: 'boom', time, gain: 0.8 };
}

/** Un montage d'un seul plan fixe et long : le cas que la notice interdit. */
function montageMou(overrides: Partial<Project> = {}): Project {
  return { ...emptyProject(), assets: [media()], clips: [plan(14)], ...overrides };
}

function detecter(project: Project) {
  return detecterManques(project, analyzeProject(project));
}

test('un montage vide n’a aucun manque : il n’a rien du tout', () => {
  const project = emptyProject();
  assert.deepEqual(detecterManques(project, analyzeProject(project)), []);
});

test('un rush déposé et jamais monté est la matière la moins chère qui soit', () => {
  const project = montageMou({ assets: [media(), media({ id: 'a2' })] });
  assert.deepEqual(matiereInutilisee(project), ['a2']);

  // Tant qu'il reste de la matière sur l'appareil, aucun trou ne justifie d'en
  // fabriquer : le principe directeur appliqué à la détection elle-même.
  const natures = detecter(project).map((m) => m.nature);
  assert.ok(!natures.includes('matiere'));
  assert.ok(!natures.includes('accroche'));
});

test('un plan immobile qui dure est un manque de matière, et la fenêtre commence où il traîne', () => {
  const matiere = detecter(montageMou()).filter((m) => m.nature === 'matiere');

  assert.equal(matiere.length, 1);
  assert.deepEqual(matiere[0].fenetre, { debut: PLAN_QUI_DORT, fin: 14 });
  assert.match(matiere[0].mesure, /fixe/);
});

test('les calques ne changent rien au diagnostic : c’est l’image qui décide', () => {
  // La première rédaction conditionnait le manque à une fenêtre déjà couverte
  // de texte et de son, l'idée étant que les remèdes gratuits avaient été
  // essayés. Comme un sous-titre affiché tient à lui seul la courbe au-dessus
  // du plancher d'un creux — 0,12 + 0,2 contre 0,28 —, « creux » et « fenêtre
  // habillée » s'excluent, et le détecteur ne pouvait jamais se déclencher. Ce
  // test fige la correction : nu ou habillé, même verdict.
  const nu = detecter(montageMou()).filter((m) => m.nature === 'matiere');
  const habille = detecter(montageMou({ captions: [texte(0, 14)], cues: [bruit(1)] })).filter(
    (m) => m.nature === 'matiere',
  );

  assert.equal(nu.length, 1);
  assert.deepEqual(
    nu.map((m) => m.fenetre),
    habille.map((m) => m.fenetre),
  );
});

test('un plan qui bouge, ou qui reste court, n’est pas un manque', () => {
  const quiBouge = montageMou({ clips: [plan(14, { motion: 'zoomIn' })] });
  assert.equal(
    detecter(quiBouge).some((m) => m.nature === 'matiere'),
    false,
  );

  // `plan(n)` pose l'`outPoint` : quatre plans de trois secondes, pas un plan
  // qui grandit — la première rédaction de ce test lisait la valeur comme une
  // durée cumulée et fabriquait exactement le plan qui dort qu'elle voulait
  // exclure.
  const enCoupes = montageMou({ clips: [plan(3), plan(3), plan(3), plan(3)] });
  assert.equal(
    detecter(enCoupes).some((m) => m.nature === 'matiere'),
    false,
  );
});

test('une ouverture fixe et muette réclame une accroche', () => {
  const project = montageMou({ captions: [texte(5, 14)], cues: [bruit(6)] });
  const accroche = detecter(project).find((m) => m.nature === 'accroche');

  assert.ok(accroche, 'ni mouvement, ni texte tôt, ni coupe rapide');
  assert.deepEqual(accroche.fenetre, { debut: 0, fin: 3 });
});

test('une ouverture qui bouge n’en réclame pas', () => {
  const project = montageMou({
    clips: [plan(14, { motion: 'zoomIn' })],
    captions: [texte(5, 14)],
    cues: [bruit(6)],
  });
  assert.equal(
    detecter(project).some((m) => m.nature === 'accroche'),
    false,
  );
});

test('toute vidéo publiable veut sa miniature, et un montage trop court n’en veut pas', () => {
  const miniature = detecter(montageMou()).find((m) => m.nature === 'miniature');
  assert.ok(miniature);
  assert.equal(miniature.fenetre, null);

  const tropCourt = montageMou({ clips: [plan(DUREE_PUBLIABLE - 2)] });
  assert.equal(
    detecter(tropCourt).some((m) => m.nature === 'miniature'),
    false,
  );
});

test('la détection est pure : deux appels rendent la même chose, et le projet ne bouge pas', () => {
  const project = montageMou({ captions: [texte(0, 14)], cues: [bruit(1)] });
  const avant = JSON.stringify(project);
  const un = detecter(project);
  const deux = detecter(project);

  assert.deepEqual(un, deux);
  assert.equal(JSON.stringify(project), avant);
});

test('aucun fournisseur n’est nommé dans ce que la détection rend', () => {
  // La frontière du module tient dans cette phrase : un manque décrit un
  // besoin, jamais une commande. Si un nom de service apparaît un jour dans un
  // libellé, c'est que la frontière a bougé sans que personne le décide.
  const rendu = JSON.stringify(detecter(montageMou())).toLowerCase();
  for (const interdit of ['kling', 'hailuo', 'meta', 'muse', 'minimax', 'http', 'api']) {
    assert.equal(rendu.includes(interdit), false, `« ${interdit} » n’a rien à faire ici`);
  }
});
