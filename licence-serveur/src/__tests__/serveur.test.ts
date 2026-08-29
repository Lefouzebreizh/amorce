import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fabriquerCle, referenceDeLaCle } from '../cles.ts';
import { traiter, type Base, type Reglages } from '../index.ts';
import { signatureValide } from '../signature.ts';

const SECRET_WEBHOOK = 'whsec_test';
const SECRET_CLES = 'sceau_test';

/** Une base en mémoire : le serveur se juge sur son comportement, pas sur D1. */
function baseEnMemoire(): Base & { table: Map<string, { revoquee: boolean }> } {
  const table = new Map<string, { revoquee: boolean }>();
  return {
    table,
    async lire(reference) {
      return table.get(reference) ?? null;
    },
    async enregistrer(reference) {
      // Stripe rejoue ses événements : enregistrer deux fois ne doit rien casser.
      if (!table.has(reference)) table.set(reference, { revoquee: false });
    },
    async revoquer(reference) {
      const ligne = table.get(reference);
      if (ligne) ligne.revoquee = true;
    },
  };
}

function reglages(base: Base): Reglages {
  return { base, secretWebhook: SECRET_WEBHOOK, secretCles: SECRET_CLES, origines: ['https://amorce.app'] };
}

async function signer(corps: string, secret = SECRET_WEBHOOK, quand = Math.floor(Date.now() / 1000)) {
  const encodeur = new TextEncoder();
  const clef = await crypto.subtle.importKey(
    'raw', encodeur.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const brut = await crypto.subtle.sign('HMAC', clef, encodeur.encode(`${quand}.${corps}`));
  const hexa = [...new Uint8Array(brut)].map((o) => o.toString(16).padStart(2, '0')).join('');
  return `t=${quand},v1=${hexa}`;
}

const paiement = (id: string) => JSON.stringify({ type: 'checkout.session.completed', data: { object: { id } } });

// ----------------------------------------------------------- La signature

test('une signature forgée ou rejouée est refusée', async () => {
  /*
   * C'est la seule chose qui empêche n'importe qui d'accorder une licence en
   * appelant l'adresse du webhook. Quatre façons d'être fausse, quatre refus.
   */
  const corps = paiement('cs_test_123');
  assert.equal(await signatureValide(corps, await signer(corps), SECRET_WEBHOOK), true);
  assert.equal(await signatureValide(corps, await signer(corps, 'mauvais'), SECRET_WEBHOOK), false);
  assert.equal(await signatureValide(corps, null, SECRET_WEBHOOK), false, 'en-tête absent');
  assert.equal(await signatureValide(corps, 't=1,v1=zz', SECRET_WEBHOOK), false, 'signature inventée');
  // Rejeu : signature authentique, mais vieille d'une heure.
  const vieille = await signer(corps, SECRET_WEBHOOK, Math.floor(Date.now() / 1000) - 3600);
  assert.equal(await signatureValide(corps, vieille, SECRET_WEBHOOK), false, 'rejeu accepté');
});

test('le corps signé est celui qu’on vérifie', async () => {
  // Signer un corps et en envoyer un autre est l'attaque évidente : la
  // signature est valide, le contenu non.
  const entete = await signer(paiement('cs_vrai'));
  assert.equal(await signatureValide(paiement('cs_autre'), entete, SECRET_WEBHOOK), false);
});

// ---------------------------------------------------------------- Les clés

test('une clé se vérifie sans rien lire, et ne se bricole pas', async () => {
  const cle = await fabriquerCle(SECRET_CLES, 'ABC123');
  assert.equal(await referenceDeLaCle(SECRET_CLES, cle), 'ABC123');

  // Chaque façon de tricher rend null, jamais une référence.
  const truquees = [
    cle.replace(/.$/, 'X'),                    // sceau modifié
    cle.replace('ABC123', 'ABC124'),           // référence modifiée
    'AMO-ABC123-TROPCOURT',                    // sceau tronqué
    'XXX-ABC123-' + cle.split('-')[2],         // préfixe changé
    'ABC123',                                  // pas une clé
    '',
  ];
  for (const fausse of truquees) {
    assert.equal(await referenceDeLaCle(SECRET_CLES, fausse), null, `acceptée à tort : ${fausse}`);
  }
});

test('un autre secret n’ouvre aucune clé', async () => {
  const cle = await fabriquerCle(SECRET_CLES, 'ABC123');
  assert.equal(await referenceDeLaCle('autre', cle), null);
});

test('une clé ne contient ni O, ni I, ni 0, ni 1', async () => {
  // Elle se recopie à la main depuis un courriel : ces quatre-là s'échangent
  // sans qu'on s'en aperçoive, et le support reçoit une clé « fausse » qui
  // était seulement mal lue.
  const sceau = (await fabriquerCle(SECRET_CLES, 'REF')).split('-')[2];
  assert.doesNotMatch(sceau, /[OI01]/);
});

// ------------------------------------------------------------- Le parcours

test('le parcours complet : payer, vérifier, se faire rembourser', async () => {
  const base = baseEnMemoire();
  const r = reglages(base);
  const demander = (cle: string) =>
    traiter(new Request('https://x/etat', { headers: { Authorization: `Bearer ${cle}` } }), r);

  const cle = await fabriquerCle(SECRET_CLES, '4F5A6B7C8D9E');

  // Avant tout paiement, une clé authentique ne vaut rien : elle n'a pas été payée.
  assert.deepEqual(await (await demander(cle)).json(), { statut: 'libre' });

  const corps = paiement('cs_test_a1b2c34F5A6B7C8D9E');
  const reponse = await traiter(new Request('https://x/webhook', {
    method: 'POST', body: corps, headers: { 'Stripe-Signature': await signer(corps) },
  }), r);
  assert.equal(reponse.status, 200);

  assert.deepEqual(await (await demander(cle)).json(), { statut: 'pro' });

  const rembours = JSON.stringify({ type: 'charge.refunded', data: { object: { id: 'cs_test_a1b2c34F5A6B7C8D9E' } } });
  await traiter(new Request('https://x/webhook', {
    method: 'POST', body: rembours, headers: { 'Stripe-Signature': await signer(rembours) },
  }), r);

  assert.deepEqual(await (await demander(cle)).json(), { statut: 'libre' }, 'un remboursement rend la licence');
});

test('tout ce qui n’est pas une licence valide rend « libre » en 200', async () => {
  /*
   * Jamais de 401 : le studio n'a pas à savoir qu'on ne le connaît pas, il a à
   * savoir quoi proposer. Et un code d'erreur renseignerait sur ce que le
   * serveur sait.
   */
  const r = reglages(baseEnMemoire());
  const cas = [
    new Request('https://x/etat'),
    new Request('https://x/etat', { headers: { Authorization: 'Bearer ' } }),
    new Request('https://x/etat', { headers: { Authorization: 'AMO-X-Y' } }),
    new Request('https://x/etat', { headers: { Authorization: 'Bearer AMO-X-FAUX' } }),
  ];
  for (const requete of cas) {
    const reponse = await traiter(requete, r);
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { statut: 'libre' });
  }
});

test('un événement rejoué ou inconnu ne casse rien', async () => {
  // Stripe réessaie pendant des jours tout ce qui n'est pas un 2xx : répondre
  // en erreur à ce dont on ne fait rien fabrique une file qui ne se vide pas.
  const base = baseEnMemoire();
  const r = reglages(base);
  const corps = paiement('cs_repete');
  const entete = await signer(corps);

  for (let i = 0; i < 3; i += 1) {
    const reponse = await traiter(new Request('https://x/webhook', {
      method: 'POST', body: corps, headers: { 'Stripe-Signature': entete },
    }), r);
    assert.equal(reponse.status, 200);
  }
  assert.equal(base.table.size, 1, 'un rejeu a créé une seconde ligne');

  const inconnu = JSON.stringify({ type: 'invoice.upcoming', data: { object: { id: 'x' } } });
  const reponse = await traiter(new Request('https://x/webhook', {
    method: 'POST', body: inconnu, headers: { 'Stripe-Signature': await signer(inconnu) },
  }), r);
  assert.equal(reponse.status, 200);
});

test('le partage d’origine ne s’ouvre qu’aux origines nommées', async () => {
  // `*` laisserait n'importe quel site interroger le serveur avec la clé de
  // quelqu'un d'autre.
  const r = reglages(baseEnMemoire());
  const avec = await traiter(new Request('https://x/etat', { headers: { Origin: 'https://amorce.app' } }), r);
  assert.equal(avec.headers.get('access-control-allow-origin'), 'https://amorce.app');

  const sans = await traiter(new Request('https://x/etat', { headers: { Origin: 'https://pirate.example' } }), r);
  assert.equal(sans.headers.get('access-control-allow-origin'), null);
});
