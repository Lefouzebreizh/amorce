import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFRES, autorise, bornes } from '../limites.ts';
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
});

test('l’offre libre exporte, autant qu’elle veut', () => {
  /*
   * Rien n'est mutilé, et rien n'est compté. Un plafond d'exports ne
   * s'appliquerait nulle part : le montage tourne dans le navigateur, un
   * compteur local s'efface en trois secondes, et le porter côté serveur
   * reviendrait à pister ce que la personne fabrique — ce que ce dépôt
   * s'interdit.
   *
   * Ce test garde donc une absence, ce qui est inhabituel mais volontaire :
   * il échouera le jour où quelqu'un réintroduira une borne de quantité, et
   * l'obligera à relire pourquoi il n'y en a pas.
   */
  for (const offre of Object.values(OFFRES)) {
    for (const valeur of Object.values(offre)) {
      assert.equal(typeof valeur, 'boolean', 'une borne de quantité est réapparue dans l’offre');
    }
  }
});

test('l’abonnement retire la signature et ouvre la pleine définition', () => {
  assert.equal(autorise(pro, 'sansSignature'), true);
  assert.equal(autorise(pro, 'pleineDefinition'), true);
  assert.equal(autorise(libre, 'sansSignature'), false);
  assert.equal(autorise(libre, 'pleineDefinition'), false);
});

test('chaque capacité annoncée existe dans les deux offres', () => {
  /*
   * Une capacité citée dans un panneau mais absente d'une offre rendrait
   * `bornes(...)[capacite]` indéfini — donc faux, donc refusé, sans qu'aucune
   * erreur ne le dise. C'est le défaut silencieux qu'on ne veut pas dans un
   * chemin qui décide de ce qu'un client a payé.
   */
  for (const offre of Object.values(OFFRES)) {
    for (const clef of ['sansSignature', 'pleineDefinition'] as const) {
      assert.ok(clef in offre, `${clef} manque à une offre`);
    }
  }
});
