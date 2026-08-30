import assert from 'node:assert/strict';
import { test } from 'node:test';

/*
 * Un fichier à part, et c'est le sujet même du test.
 *
 * `ADRESSE_SERVEUR` est figée au chargement de `etat.ts` :
 * `export const ADRESSE_SERVEUR = process.env.NEXT_PUBLIC_LICENCE_URL ?? ''`.
 * Poser la variable après un `import` n'a donc aucun effet — le module est déjà
 * évalué, et le premier jet de ce test voyait un serveur « non configuré » là
 * où il croyait en avoir posé un.
 *
 * `node --test` donne un processus par fichier : celui-ci part d'un registre de
 * modules vierge, peut poser la variable avant tout import, et laisse au
 * fichier voisin ses cas « sans serveur configuré ».
 */
process.env.NEXT_PUBLIC_LICENCE_URL = 'https://licence.exemple';

const { demanderEtat } = await import('../client.ts');
const { ETAT_INITIAL } = await import('../types.ts');

/*
 * Un serveur injoignable ne doit pas passer pour une clé refusée.
 *
 * C'est la correction d'un raisonnement, pas un raffinement. On avait écrit
 * que le client ne pouvait pas distinguer les deux cas ; il le peut, et la
 * différence décide de ce qu'on affiche à quelqu'un qui vient de payer.
 *
 * Le cas qui arrive vraiment est le partage entre origines : si l'adresse du
 * studio n'est pas listée dans les réglages du serveur, le navigateur bloque
 * la réponse et `fetch` lève. Tout le monde retombe sur l'offre libre — et
 * sans cette distinction, l'application accuse la clé.
 */
test('une coupure est signalée comme telle, pas comme une clé refusée', async () => {
  const coupe = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;

  const muet = await demanderEtat('AMO-AAAAAAAA-BBBBBBBB', coupe);
  assert.equal(muet.joignable, false, 'une coupure devrait être signalée comme telle');
  assert.deepEqual(muet.etat, ETAT_INITIAL, 'et laisser l’offre libre');
});

test('un serveur qui refuse la clé reste joignable', async () => {
  const refus = (async () =>
    new Response(JSON.stringify({ statut: 'libre' }), { status: 200 })) as unknown as typeof fetch;

  const refuse = await demanderEtat('AMO-AAAAAAAA-BBBBBBBB', refus);
  assert.equal(refuse.joignable, true, 'un serveur qui répond est joignable, même s’il refuse');
  assert.equal(refuse.etat.statut, 'libre');
});

test('un serveur qui reconnaît la clé rend le statut payé', async () => {
  const accepte = (async () =>
    new Response(JSON.stringify({ statut: 'pro' }), { status: 200 })) as unknown as typeof fetch;

  const ouvert = await demanderEtat('AMO-AAAAAAAA-BBBBBBBB', accepte);
  assert.equal(ouvert.joignable, true);
  assert.equal(ouvert.etat.statut, 'pro');
});

/*
 * Une erreur du serveur n'est pas une panne de transport.
 *
 * Il a répondu : le studio n'a donc pas à parler de réseau, et l'offre libre
 * est déjà la réponse. Confondre les deux ferait dire « le serveur n'a pas
 * répondu » alors qu'il vient de le faire.
 */
test('un serveur en erreur reste joignable', async () => {
  const erreur = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;

  const rendu = await demanderEtat('AMO-AAAAAAAA-BBBBBBBB', erreur);
  assert.equal(rendu.joignable, true);
  assert.deepEqual(rendu.etat, ETAT_INITIAL);
});
