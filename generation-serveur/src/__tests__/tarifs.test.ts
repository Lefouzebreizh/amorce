import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAFOND_MENSUEL, TARIFS, autorise, cout, type Prestation } from '../tarifs.ts';

const plan: Prestation = { genre: 'video', modele: 'MiniMax-Hailuo-2.3', secondes: 6 };

test('la grille est vide, et c’est ce qui est attendu tant qu’aucun prix n’a été lu', () => {
  // Les cinq hôtes de MiniMax rendent 000 d'ici : la grille ne peut pas être
  // remplie sans inventer. Ce test tombera le jour où quelqu'un y écrira un
  // prix — et c'est le moment où il faudra dire d'où il vient.
  assert.equal(TARIFS.length, 0);
  assert.equal(cout(plan), null);
});

test('une prestation sans prix connu est refusée, et le refus dit quoi faire', () => {
  const verdict = autorise(plan, 0);
  assert.equal(verdict.autorise, false);
  assert.equal(verdict.refus.motif, 'prix-inconnu');
  assert.match(verdict.refus.explication, /relever le prix à sa source/);
});

test('le prix inconnu passe avant le plafond : on ne plafonne pas ce qu’on ne chiffre pas', () => {
  // Même avec le plafond déjà crevé, c'est le prix manquant qui est nommé —
  // sans quoi le message enverrait chercher au mauvais endroit.
  const verdict = autorise(plan, PLAFOND_MENSUEL * 10);
  assert.equal(verdict.autorise, false);
  assert.equal(verdict.refus.motif, 'prix-inconnu');
});

test('le plafond du propriétaire est de vingt dollars par mois', () => {
  assert.equal(PLAFOND_MENSUEL, 20);
});

// À partir d'ici, une grille de bois : la vraie est vide, et la branche qui
// protège l'argent doit être éprouvée quand même.
const GRILLE = [
  {
    genre: 'video' as const,
    modele: 'MiniMax-Hailuo-2.3',
    prixUnitaire: 0.5,
    source: 'grille de test — aucun prix réel',
    releveLe: '2026-09-08',
  },
];

test('un prix connu se calcule à la seconde pour une vidéo', () => {
  assert.equal(cout(plan, GRILLE), 3);
});

test('sous le plafond, la génération part, et le verdict porte son coût', () => {
  const verdict = autorise(plan, 10, GRILLE);
  assert.equal(verdict.autorise, true);
  assert.equal(verdict.cout, 3);
});

test('le plafond mord à l’euro près, et le refus montre les deux nombres', () => {
  // 17,50 déjà dépensés plus 3 font 20,50 : au-dessus de vingt, donc refusé.
  const verdict = autorise(plan, 17.5, GRILLE);
  assert.equal(verdict.autorise, false);
  assert.equal(verdict.refus.motif, 'plafond');
  assert.equal(verdict.refus.dejaDepense, 17.5);
  assert.equal(verdict.refus.cout, 3);
});

test('atteindre exactement le plafond est permis, le dépasser ne l’est pas', () => {
  assert.equal(autorise(plan, 17, GRILLE).autorise, true);
  assert.equal(autorise(plan, 17.01, GRILLE).autorise, false);
});

test('une durée nulle ou négative n’a pas de prix : elle ne part pas', () => {
  assert.equal(cout({ ...plan, secondes: 0 }, GRILLE), null);
  assert.equal(cout({ ...plan, secondes: -3 }, GRILLE), null);
});

test('une image se compte à l’unité, pas à la seconde', () => {
  const grilleImage = [
    { ...GRILLE[0], genre: 'image' as const, modele: 'image-01', prixUnitaire: 0.02 },
  ];
  assert.equal(cout({ genre: 'image', modele: 'image-01', secondes: 0 }, grilleImage), 0.02);
});

test('un modèle voisin ne prend pas le tarif de l’autre', () => {
  assert.equal(cout({ ...plan, modele: 'MiniMax-Hailuo-02' }, GRILLE), null);
});
