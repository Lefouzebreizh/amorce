import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVisuel, sharedCount } from '../share.ts';

test('le compte annoncé par le partage se lit dans l’adresse', () => {
  assert.equal(sharedCount('?partage=3'), 3);
  assert.equal(sharedCount('?autre=1&partage=1'), 1);
});

test('une adresse sans partage, ou sans fichier, n’ouvre rien', () => {
  assert.equal(sharedCount(''), 0);
  assert.equal(sharedCount('?autre=1'), 0);
  // Le worker annonce zéro quand il n'a rien retenu : il ne faut pas aller voir.
  assert.equal(sharedCount('?partage=0'), 0);
});

test('un compte absurde ne déclenche pas de lecture', () => {
  assert.equal(sharedCount('?partage=abc'), 0);
  assert.equal(sharedCount('?partage=-4'), 0);
  assert.equal(sharedCount('?partage='), 0);
});

test('le type déclaré décide de la destination', () => {
  assert.equal(isVisuel({ type: 'video/mp4', name: 'rush.mp4' }), true);
  assert.equal(isVisuel({ type: 'audio/mpeg', name: 'voix.mp3' }), false);
  // Un conteneur commun aux deux : c'est le type qui tranche, pas l'extension.
  assert.equal(isVisuel({ type: 'audio/mp4', name: 'voix.mp4' }), false);
});

test('une image fixe rejoint la bibliothèque, pas la voix off', () => {
  assert.equal(isVisuel({ type: 'image/png', name: 'illustration.png' }), true);
  assert.equal(isVisuel({ type: 'image/jpeg', name: 'couverture.jpg' }), true);
  // Le format des captures d'écran d'un iPhone, que rien ne déclare sur Android.
  assert.equal(isVisuel({ type: '', name: 'IMG_4312.HEIC' }), true);
});

test('l’extension tranche quand Android ne déclare aucun type', () => {
  // Android laisse le type vide plus souvent qu'on ne croit ; sans ce repli, un
  // rush partirait dans la voix off.
  assert.equal(isVisuel({ type: '', name: 'rush.MP4' }), true);
  assert.equal(isVisuel({ type: '', name: 'plan.webm' }), true);
  assert.equal(isVisuel({ type: '', name: 'ElevenLabs_druide.mp3' }), false);
  // Inconnu des deux côtés : traité comme un son, la destination la plus
  // fréquente et celle dont l'erreur se corrige d'un geste.
  assert.equal(isVisuel({ type: '', name: 'sans-extension' }), false);
});
