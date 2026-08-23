import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { useStudio } from '../store.ts';
import { emptyProject } from '../timeline.ts';
import { MIN_CLIP_DURATION, type MediaAsset } from '../types.ts';
import { PLACEHOLDER_HOOK } from '../autoEdit.ts';

/**
 * Le studio est un magasin unique : chaque test repart d'un projet vierge,
 * sans quoi l'ordre d'exécution changerait les résultats.
 */
function reset() {
  useStudio.setState({ project: emptyProject(), selection: null, playhead: 0, playing: false });
}

function asset(id: string, duration: number): MediaAsset {
  return { id, name: `${id}.mp4`, url: `blob:${id}`, duration, width: 1080, height: 1920, thumbnail: '', hasAudio: true };
}

/** Monte deux plans de 5 s, coupe franche, et place la tête de lecture au bout. */
function twoClipsAtEnd() {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5), asset('b', 5)]);
  store.appendClip('a');
  store.appendClip('b');
  const clips = useStudio.getState().project.clips;
  for (const clip of clips) useStudio.getState().updateClip(clip.id, { transition: 'cut' });
  useStudio.getState().setPlayhead(9.5);
  return useStudio.getState().project.clips;
}

beforeEach(reset);

test('raccourcir un plan ramène la tête de lecture dans les bornes', () => {
  const clips = twoClipsAtEnd();
  assert.equal(useStudio.getState().playhead, 9.5);

  // Le second plan tombe de 5 s à 1 s : le montage ne dure plus que 6 s.
  useStudio.getState().updateClip(clips[1].id, { outPoint: 1 });

  assert.equal(useStudio.getState().duration(), 6);
  assert.equal(useStudio.getState().playhead, 6, 'la tête devrait être ramenée à la fin');
});

test('supprimer un plan ramène la tête de lecture dans les bornes', () => {
  const clips = twoClipsAtEnd();
  useStudio.getState().removeClip(clips[1].id);

  assert.equal(useStudio.getState().duration(), 5);
  assert.equal(useStudio.getState().playhead, 5);
});

test('retirer un média ramène la tête de lecture dans les bornes', () => {
  twoClipsAtEnd();
  // `removeAsset` libère une URL objet, absente hors navigateur.
  const original = globalThis.URL.revokeObjectURL;
  globalThis.URL.revokeObjectURL = () => undefined;
  try {
    useStudio.getState().removeAsset('b');
  } finally {
    globalThis.URL.revokeObjectURL = original;
  }

  assert.equal(useStudio.getState().duration(), 5);
  assert.equal(useStudio.getState().playhead, 5);
});

test('une tête de lecture déjà dans les bornes n’est pas déplacée', () => {
  const clips = twoClipsAtEnd();
  useStudio.getState().setPlayhead(2);
  useStudio.getState().updateClip(clips[1].id, { outPoint: 4 });

  assert.equal(useStudio.getState().playhead, 2, 'aucune raison de bouger la tête de lecture');
});

test('allonger un plan ne touche pas à la tête de lecture', () => {
  const clips = twoClipsAtEnd();
  useStudio.getState().updateClip(clips[0].id, { outPoint: 5 });
  assert.equal(useStudio.getState().playhead, 9.5);
});

test('la découpe refuse de produire un fragment sous la durée plancher', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5)]);
  store.appendClip('a');

  // Trop près du début : la première moitié serait plus courte que le plancher.
  useStudio.getState().setPlayhead(MIN_CLIP_DURATION / 2);
  useStudio.getState().splitClipAtPlayhead();
  assert.equal(useStudio.getState().project.clips.length, 1, 'la coupe aurait dû être refusée');

  // Trop près de la fin : c'est la seconde moitié qui serait trop courte.
  useStudio.getState().setPlayhead(5 - MIN_CLIP_DURATION / 2);
  useStudio.getState().splitClipAtPlayhead();
  assert.equal(useStudio.getState().project.clips.length, 1, 'la coupe aurait dû être refusée');
});

test('une découpe au milieu produit deux plans qui conservent la durée totale', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5)]);
  store.appendClip('a');

  useStudio.getState().setPlayhead(2);
  useStudio.getState().splitClipAtPlayhead();

  const clips = useStudio.getState().project.clips;
  assert.equal(clips.length, 2);
  assert.equal(clips[0].outPoint, 2);
  assert.equal(clips[1].inPoint, 2);
  // La seconde moitié démarre sec : un fondu sur une coupe interne créerait un
  // chevauchement avec la matière qui la précède immédiatement.
  assert.equal(clips[1].transition, 'cut');
  assert.equal(useStudio.getState().duration(), 5);
});

test('le premier plan ajouté démarre sans transition', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5), asset('b', 5)]);
  store.appendClip('a');
  store.appendClip('b');

  const clips = useStudio.getState().project.clips;
  assert.equal(clips[0].transition, 'cut', 'rien ne précède le premier plan');
  assert.notEqual(clips[1].transition, 'cut');
});

test('dupliquer un plan insère la copie juste après l’original', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5), asset('b', 5)]);
  store.appendClip('a');
  store.appendClip('b');

  const [first] = useStudio.getState().project.clips;
  useStudio.getState().duplicateClip(first.id);

  const clips = useStudio.getState().project.clips;
  assert.equal(clips.length, 3);
  assert.equal(clips[1].assetId, 'a', 'la copie devrait suivre immédiatement l’original');
  assert.notEqual(clips[1].id, first.id, 'la copie doit avoir sa propre identité');
  assert.equal(clips[2].assetId, 'b', 'les plans suivants sont décalés, pas remplacés');
});

test('la copie reprend les réglages de l’original et devient la sélection', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 8)]);
  store.appendClip('a');

  const [original] = useStudio.getState().project.clips;
  useStudio.getState().updateClip(original.id, { inPoint: 1, outPoint: 3, speed: 0.5, motion: 'zoomIn' });
  useStudio.getState().duplicateClip(original.id);

  const copy = useStudio.getState().project.clips[1];
  assert.deepEqual(
    { inPoint: copy.inPoint, outPoint: copy.outPoint, speed: copy.speed, motion: copy.motion },
    { inPoint: 1, outPoint: 3, speed: 0.5, motion: 'zoomIn' },
  );
  assert.deepEqual(useStudio.getState().selection, { kind: 'clip', id: copy.id });
});

test('dupliquer allonge le montage de la durée du plan copié', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5)]);
  store.appendClip('a');
  useStudio.getState().updateClip(useStudio.getState().project.clips[0].id, { outPoint: 2 });

  assert.equal(useStudio.getState().duration(), 2);
  useStudio.getState().duplicateClip(useStudio.getState().project.clips[0].id);

  // La copie arrive avec la transition de l'original, qui consomme du temps :
  // la durée totale est donc inférieure à la somme brute des deux plans.
  const total = useStudio.getState().duration();
  assert.ok(total > 2 && total <= 4, `durée totale inattendue : ${total}`);
});

test('ralentir un plan allonge sa place sur la timeline', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5)]);
  store.appendClip('a');
  const [clip] = useStudio.getState().project.clips;

  useStudio.getState().updateClip(clip.id, { inPoint: 0, outPoint: 2, speed: 1 });
  assert.equal(useStudio.getState().duration(), 2);

  // Moitié moins vite : deux secondes de rush en occupent quatre à l'écran.
  useStudio.getState().updateClip(clip.id, { speed: 0.5 });
  assert.equal(useStudio.getState().duration(), 4);
});

test('dupliquer un plan inexistant ne change rien', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 5)]);
  store.appendClip('a');

  useStudio.getState().duplicateClip('identifiant-inconnu');
  assert.equal(useStudio.getState().project.clips.length, 1);
});

test('un sous-titre ajouté ne reprend pas le texte de l’accroche automatique', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 10)]);
  store.appendClip('a');
  store.addCaption();

  const [caption] = useStudio.getState().project.captions;
  assert.notEqual(caption.text, PLACEHOLDER_HOOK, 'deux textes identiques se superposeraient sans prévenir');
  assert.ok(caption.text.length > 0, 'un sous-titre vide ne se verrait pas à l’écran');
});

test('deux sous-titres simultanés sont posés à des hauteurs différentes', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 10)]);
  store.appendClip('a');

  useStudio.getState().setPlayhead(1);
  useStudio.getState().addCaption();
  useStudio.getState().addCaption();

  const [first, second] = useStudio.getState().project.captions;
  assert.ok(
    Math.abs(first.y - second.y) > 0.08,
    `les deux sous-titres se recouvrent : y=${first.y} et y=${second.y}`,
  );
});

test('des sous-titres qui ne se croisent pas retrouvent la hauteur par défaut', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 20)]);
  store.appendClip('a');

  useStudio.getState().setPlayhead(0);
  useStudio.getState().addCaption();
  // Bien après la fin du premier : aucune raison de le décaler.
  useStudio.getState().setPlayhead(10);
  useStudio.getState().addCaption();

  const [first, second] = useStudio.getState().project.captions;
  assert.equal(first.y, second.y);
});

test('les hauteurs proposées restent dans la zone lisible', () => {
  const store = useStudio.getState();
  store.addAssets([asset('a', 20)]);
  store.appendClip('a');

  useStudio.getState().setPlayhead(1);
  for (let i = 0; i < 6; i++) useStudio.getState().addCaption();

  for (const caption of useStudio.getState().project.captions) {
    assert.ok(caption.y >= 0.15 && caption.y <= 0.85, `hauteur hors zone lisible : ${caption.y}`);
  }
});
