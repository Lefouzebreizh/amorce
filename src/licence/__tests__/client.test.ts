import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demanderEtat, lireReponse } from '../client.ts';
import { ETAT_INITIAL } from '../types.ts';

/**
 * Un `fetch` qui échoue s'il est appelé.
 *
 * C'est la seule façon de prouver qu'aucune requête ne part : une assertion
 * sur le seul résultat ne montrerait rien, puisque le repli rend la même chose
 * qu'un succès vide.
 */
function fetchInterdit(): { chercher: typeof fetch; appele: () => boolean } {
  let appele = false;
  const chercher = (async () => {
    appele = true;
    throw new Error('le réseau ne doit pas être touché');
  }) as unknown as typeof fetch;
  return { chercher, appele: () => appele };
}

test('sans serveur configuré, rien n’est demandé', async () => {
  const { chercher, appele } = fetchInterdit();
  assert.deepEqual(await demanderEtat('une-cle', chercher), { etat: ETAT_INITIAL, joignable: true });
  assert.equal(appele(), false, 'une requête est partie sans serveur configuré');
});

test('sans clé, rien n’est demandé non plus', async () => {
  /*
   * Une clé absente n'est pas une erreur : c'est quelqu'un qui n'a pas acheté,
   * et l'offre libre est déjà la réponse. Envoyer la requête quand même
   * ferait partir un appel pour se faire refuser, et apprendrait au serveur
   * qu'un studio tourne ici — ce qu'il n'a pas à savoir.
   */
  for (const vide of ['', '   ', '\n']) {
    const { chercher, appele } = fetchInterdit();
    assert.deepEqual(await demanderEtat(vide, chercher), { etat: ETAT_INITIAL, joignable: true });
    assert.equal(appele(), false, `une requête est partie avec la clé ${JSON.stringify(vide)}`);
  }
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

test('une réponse valide se réduit à son statut', () => {
  assert.deepEqual(lireReponse({ statut: 'pro' }), { statut: 'pro' });
  assert.deepEqual(lireReponse({ statut: 'libre' }), { statut: 'libre' });
});

test('rien d’autre que le statut ne traverse', () => {
  /*
   * Amorce se vend une fois : il n'y a ni date de fin, ni renouvellement. Un
   * champ supplémentaire dans la réponse est donc ignoré, jamais recopié.
   *
   * Ce n'est pas de la rigueur pour la forme : ce qui vient du réseau ne doit
   * traverser que par des champs nommés ici. Une recopie en bloc ferait entrer
   * dans le studio ce que le serveur voudrait, y compris ce que personne n'a
   * prévu.
   */
  assert.deepEqual(lireReponse({ statut: 'pro', finLe: 1e12 }), { statut: 'pro' });
  assert.deepEqual(
    lireReponse({ statut: 'pro', bonus: true, remise: 'X', __proto__: { sale: 1 } }),
    { statut: 'pro' },
  );
});

