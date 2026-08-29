import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COTE, SEUIL, distance, empreinte, groupesSemblables } from '../ressemblance.ts';

/** Une image de 8 × 8 dont on choisit combien de cases sont claires. */
function image(claires: number): number[] {
  return Array.from({ length: COTE * COTE }, (_, i) => (i < claires ? 255 : 0));
}

/**
 * Une empreinte à distance connue d'une autre.
 *
 * `depuis` compte, et c'est une leçon de ce test : en retournant toujours les
 * mêmes premiers bits, deux « voisines » à 11 et 20 de la base ne sont plus
 * qu'à 9 l'une de l'autre, et se regroupent. La fausse distance était dans
 * l'outil de mesure, pas dans le module.
 */
function voisine(base: string, bits: number, depuis = 0): string {
  const quartets = base.split('').map((c) => parseInt(c, 16));
  for (let n = 0; n < bits; n += 1) {
    const rang = depuis + n;
    quartets[Math.floor(rang / 4) % quartets.length] ^= 1 << rang % 4;
  }
  return quartets.map((q) => q.toString(16)).join('');
}

test('l’empreinte tient sur seize caractères et sépare deux images opposées', () => {
  const claire = empreinte(image(48));
  const sombre = empreinte(image(16));
  assert.equal(claire.length, 16);
  assert.equal(distance(claire, claire), 0);
  assert.ok(distance(claire, sombre) > SEUIL, `${distance(claire, sombre)} bits d’écart seulement`);
});

test('une image trop petite ne rend pas une fausse empreinte', () => {
  // Une vignette absente donnerait une chaîne vide, et deux chaînes vides se
  // ressembleraient parfaitement — on annoncerait une répétition inventée.
  assert.equal(empreinte([1, 2, 3]), '');
  assert.equal(distance('', 'abc'), 64, 'une empreinte manquante doit valoir la distance maximale');
});

test('le regroupement est transitif, comme sur le montage rejeté', () => {
  /*
   * Mesuré sur le montage qui a motivé cette mesure : les plans 0 et 7 sont à
   * 11 l'un de l'autre, mais tous deux à moins de 7 du plan 6. Par paires
   * isolées on aurait annoncé trois petits groupes ; il n'y a qu'une seule
   * chose, répétée sept fois — et c'est ce nombre-là qui compte pour celui qui
   * regarde.
   */
  const base = empreinte(image(32));
  const entrees = [
    { id: 'a', empreinte: base },
    { id: 'b', empreinte: voisine(base, 6) },
    { id: 'c', empreinte: voisine(base, 11) },
    // Franchement différent, sur des bits que personne d'autre n'a touchés :
    // sinon sa distance à « c » ne serait que de leur écart.
    { id: 'loin', empreinte: voisine(base, 20, 24) },
  ];

  const groupes = groupesSemblables(entrees);
  assert.equal(groupes.length, 1, 'un seul groupe attendu');
  assert.deepEqual(groupes[0].sort(), ['a', 'b', 'c'], 'le groupe transitif est incomplet');
});

test('un projet sans empreinte n’annonce aucune répétition', () => {
  // Les projets enregistrés avant cette mesure n'en portent pas. Les
  // rassembler annoncerait une répétition qui n'existe pas.
  const groupes = groupesSemblables([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.deepEqual(groupes, []);
});
