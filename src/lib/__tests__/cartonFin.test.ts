import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANDE_SURE, crochetsARemplir } from '../captions.ts';
import { aUneFinEcrite, cartonFinPropose, DUREE_CARTON } from '../cartonFin.ts';
import type { Caption } from '../types.ts';

const texte = (p: Partial<Caption> & Pick<Caption, 'start' | 'end'>): Caption => ({
  id: 'c', text: 'un mot', style: 'punch', y: 0.38, ...p,
});

test('un film qui s’arrête sans un mot n’a pas de fin écrite', () => {
  assert.equal(aUneFinEcrite([], 13.8), false);
  // Le cas réel : le dernier texte s'arrête bien avant la fin.
  assert.equal(aUneFinEcrite([texte({ start: 0, end: 2.5 })], 13.8), false);
});

test('un texte encore à l’écran au dernier instant compte comme une fin', () => {
  assert.equal(aUneFinEcrite([texte({ start: 12, end: 13.8 })], 13.8), true);
  // Tolérance : s'arrêter deux dixièmes avant la fin reste une fin écrite.
  assert.equal(aUneFinEcrite([texte({ start: 12, end: 13.6 })], 13.8), true);
});

test('un texte vide ne compte pas — il n’affiche rien', () => {
  assert.equal(aUneFinEcrite([texte({ start: 12, end: 13.8, text: '   ' })], 13.8), false);
});

test('le carton est proposé quand il manque, et pas quand il y en a un', () => {
  assert.equal(cartonFinPropose([texte({ start: 12, end: 13.8 })], 13.8), null);
  const carton = cartonFinPropose([], 13.8);
  assert.ok(carton);
  assert.equal(carton.end, 13.8);
  assert.equal(Number(carton.start.toFixed(2)), Number((13.8 - DUREE_CARTON).toFixed(2)));
});

test('le carton reste dans la bande que les trois plateformes laissent libre', () => {
  /*
   * C'est ce qui décide de sa lisibilité : TikTok recouvre tout à partir de
   * 72 %, et un carton centré ou posé bas serait mangé par la colonne de
   * droite. Le vérifier ici évite de le redécouvrir sur une vidéo publiée.
   */
  const carton = cartonFinPropose([], 13.8);
  assert.ok(carton);
  assert.ok(carton.y >= BANDE_SURE.haut && carton.y <= BANDE_SURE.bas,
    `hauteur ${carton.y} hors de la bande ${BANDE_SURE.haut}–${BANDE_SURE.bas}`);
});

test('le carton porte un crochet, pour qu’il ne parte pas gravé tel quel', () => {
  /*
   * Écrire la phrase à la place de quelqu'un serait lui mettre des mots dans
   * la bouche. Le crochet fait que `crochetsARemplir` le voit et empêche un
   * gabarit non rempli de partir dans le fichier — quatre l'avaient déjà fait.
   */
  const carton = cartonFinPropose([], 13.8);
  assert.ok(carton);
  assert.equal(crochetsARemplir([{ ...carton, id: 'x' }]).length, 1);
});

test('sur un film plus court que le carton, on prend ce qu’il reste', () => {
  const carton = cartonFinPropose([], 1.0);
  assert.ok(carton);
  assert.equal(carton.start, 0);
  assert.equal(carton.end, 1.0);
});

test('un film de durée nulle ne propose rien', () => {
  assert.equal(cartonFinPropose([], 0), null);
  assert.equal(aUneFinEcrite([], 0), false);
});
