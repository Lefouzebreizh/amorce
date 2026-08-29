import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demanderEtat, lireReponse } from '../client.ts';
import { ETAT_INITIAL } from '../types.ts';

test('sans serveur configuré, rien n’est demandé', async () => {
  /*
   * Le studio ne doit pas émettre une seule requête tant qu'aucune adresse
   * n'existe. Ce test le prouve en passant un `fetch` qui échouerait s'il
   * était appelé — une assertion sur le résultat seul ne l'aurait pas montré,
   * puisque le repli rend la même chose qu'un succès vide.
   */
  let appele = false;
  const chercher = (async () => {
    appele = true;
    throw new Error('le réseau ne doit pas être touché');
  }) as unknown as typeof fetch;

  assert.deepEqual(await demanderEtat(chercher), ETAT_INITIAL);
  assert.equal(appele, false, 'une requête est partie sans serveur configuré');
});

test('une réponse illisible vaut l’offre libre', () => {
  // Chacune de ces réponses a une façon différente d'être fausse, et aucune ne
  // doit produire un objet à moitié rempli : un statut indéfini se compare à
  // 'pro' sans erreur, donc faux, donc refusé — et personne ne saurait pourquoi
  // un abonné paie pour rien.
  for (const cas of [null, undefined, 42, 'pro', {}, { statut: 'patron' }, { statut: 3 }]) {
    assert.deepEqual(lireReponse(cas), ETAT_INITIAL, `réponse acceptée à tort : ${JSON.stringify(cas)}`);
  }
});

test('une réponse valide est lue, la date comprise', () => {
  assert.deepEqual(lireReponse({ statut: 'pro' }), { statut: 'pro' });
  assert.deepEqual(lireReponse({ statut: 'pro', finLe: 1e12 }), { statut: 'pro', finLe: 1e12 });
  // Une date qui n'en est pas ne doit pas voyager jusqu'à l'affichage.
  assert.deepEqual(lireReponse({ statut: 'pro', finLe: 'demain' }), { statut: 'pro' });
  assert.deepEqual(lireReponse({ statut: 'pro', finLe: Number.NaN }), { statut: 'pro' });
});
