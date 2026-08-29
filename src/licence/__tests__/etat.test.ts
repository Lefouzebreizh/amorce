import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEXTE_SIGNATURE, serveurConfigure, signatureAAfficher } from '../etat.ts';
import { ETAT_INITIAL, type Etat } from '../types.ts';

const libre: Etat = { statut: 'libre' };
const pro: Etat = { statut: 'pro' };

test('sans endroit où payer, aucune signature n’est apposée', () => {
  /*
   * C'est la règle qui protège du procédé. Une marque qu'on ne peut pas
   * retirer laisse la personne chercher comment s'en défaire et ne rien
   * trouver : on lui a vendu une frustration au lieu d'un abonnement.
   *
   * La condition se lève d'elle-même le jour où le serveur est configuré,
   * et jamais avant — ce n'est pas un interrupteur qu'on oublie.
   */
  assert.equal(serveurConfigure(), false, 'aucun serveur n’est configuré en test');
  assert.equal(signatureAAfficher(libre), undefined);
  assert.equal(signatureAAfficher(ETAT_INITIAL), undefined);
  assert.equal(signatureAAfficher(pro), undefined);
});

test('la signature est un texte, jamais un état', () => {
  // Le moteur reçoit ce que cette fonction rend. S'il recevait un booléen ou
  // un statut, il connaîtrait l'abonnement — la frontière tomberait ici.
  assert.equal(typeof TEXTE_SIGNATURE, 'string');
  assert.ok(TEXTE_SIGNATURE.length > 0);
});
