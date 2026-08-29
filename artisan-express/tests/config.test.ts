import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { aUnCourrielDirect, aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';

/*
 * Ce fichier éprouve un seul comportement, et c'est le plus cher de la page :
 * ce qu'elle fait quand **rien** n'est réglé.
 *
 * Les tests tournent sans aucune variable d'environnement — c'est exactement
 * l'état d'un premier déploiement, et c'est celui qui perdait les demandes.
 */

test('sans rien de réglé, il reste un chemin pour joindre le vendeur', () => {
  /*
   * Le défaut réparé ici : la page déployée sans variable disait « réessaie
   * dans quelques minutes » à quelqu'un qui venait de taper son nom, son
   * métier et son numéro. Une page de vente qui perd ses prospects en silence
   * est pire qu'une page absente — elle a l'air de marcher.
   */
  assert.equal(aUnCourrielDirect, true, 'aucun chemin de repli sur une page nue');
  assert.match(contact.courrielDirect, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test('ce qui n’est pas réglé disparaît, et n’est jamais inventé', () => {
  // Un numéro faux sur une page de vente coûte plus cher qu'un bouton absent.
  assert.equal(aUnTelephone, false);
  assert.equal(aUnWhatsapp, false);
  assert.equal(contact.telephoneAffiche, '');
});
