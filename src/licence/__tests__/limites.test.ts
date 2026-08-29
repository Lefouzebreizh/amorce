import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFRES, autorise, bornes, exportsRestants } from '../limites.ts';
import { ETAT_INITIAL, type Etat } from '../types.ts';

const libre: Etat = { statut: 'libre' };
const pro: Etat = { statut: 'pro' };

test('serveur éteint, le studio garde l’offre libre', () => {
  /*
   * La règle du dépôt : le studio doit rester utilisable si le serveur est
   * éteint. `inconnu` retombe donc sur l'offre libre — pas sur un refus, et
   * pas sur le pro.
   *
   * Refuser aurait fait payer une panne à quelqu'un qui n'y est pour rien.
   * Ouvrir le pro aurait été généreux une seconde et odieux la suivante :
   * l'interface aurait retiré ce qu'elle venait d'accorder.
   */
  assert.deepEqual(bornes(ETAT_INITIAL), OFFRES.libre);
  assert.equal(exportsRestants(ETAT_INITIAL, 0), OFFRES.libre.exportsParJour);
});

test('l’offre libre monte, règle et exporte', () => {
  // Rien n'est mutilé : ce que l'abonnement retire est la signature et le
  // compteur, jamais une fonction du studio. Un export reste possible sans
  // payer, sinon l'outil ne sert à rien tant qu'on n'a pas sorti la carte.
  assert.ok(exportsRestants(libre, 0) > 0, 'l’offre libre n’exporte pas');
});

test('l’abonnement retire la signature et le compteur', () => {
  assert.equal(autorise(pro, 'sansSignature'), true);
  assert.equal(autorise(libre, 'sansSignature'), false);
  assert.equal(exportsRestants(pro, 999), Number.POSITIVE_INFINITY);
});

test('le compteur ne descend jamais sous zéro', () => {
  // Un compte tenu ailleurs peut dépasser — horloge changée, onglets
  // multiples. Un reste négatif s'afficherait tel quel dans l'interface.
  assert.equal(exportsRestants(libre, 99), 0);
});

test('chaque capacité annoncée existe dans les deux offres', () => {
  /*
   * Une capacité citée dans un panneau mais absente d'une offre rendrait
   * `bornes(...)[capacite]` indéfini — donc faux, donc refusé, sans qu'aucune
   * erreur ne le dise. C'est le défaut silencieux qu'on ne veut pas dans un
   * chemin qui décide de ce qu'un client a payé.
   */
  for (const offre of Object.values(OFFRES)) {
    for (const clef of ['sansSignature', 'exportsParJour', 'pleineDefinition'] as const) {
      assert.ok(clef in offre, `${clef} manque à une offre`);
    }
  }
});
