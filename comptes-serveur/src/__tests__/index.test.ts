import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traiter, type Base, type Reglages } from '../index.ts';
import { ouvrir, sceller } from '../jetons.ts';

const SECRET_JETONS = 'jetons_test';
const SECRET_WEBHOOK = 'whsec_test';

/** Une base en mémoire : le serveur se juge sur son comportement, pas sur D1. */
function baseEnMemoire() {
  const comptes = new Map<string, { id: string; email: string; solde: number }>();
  const mouvements = new Map<string, { compteId: string; delta: number }>();
  const base: Base = {
    async compteParEmail(email) {
      for (const c of comptes.values()) if (c.email === email) return { id: c.id, solde: c.solde };
      return null;
    },
    async creerCompte(id, email) {
      if ([...comptes.values()].some((c) => c.email === email)) return;
      comptes.set(id, { id, email, solde: 0 });
    },
    async solde(compteId) {
      return comptes.get(compteId)?.solde ?? null;
    },
    async mouvement(id) {
      return mouvements.get(id) ?? null;
    },
    async crediter(id, compteId, delta) {
      if (mouvements.has(id)) return; // idempotent, comme la vraie base
      mouvements.set(id, { compteId, delta });
      const compte = comptes.get(compteId);
      if (compte) compte.solde += delta;
    },
  };
  return { base, comptes, mouvements };
}

function reglages(base: Base, extra: Partial<Reglages> = {}): Reglages {
  return {
    base,
    secretJetons: SECRET_JETONS,
    secretWebhook: SECRET_WEBHOOK,
    cleResend: 'resend_test',
    expediteur: 'Amorce <compte@amorce.example>',
    adresseSite: 'https://amorce.example',
    origines: ['https://amorce.example'],
    packs: {},
    ...extra,
  };
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

const paiement = (id: string, compteId: string, montant: number, intentionId: string) => JSON.stringify({
  type: 'checkout.session.completed',
  data: { object: { id, client_reference_id: compteId, amount_total: montant, payment_intent: intentionId } },
});

const remboursement = (intentionId: string) => JSON.stringify({
  type: 'charge.refunded',
  data: { object: { payment_intent: intentionId } },
});

// ------------------------------------------------------------- La connexion

test('demander un lien de connexion ne touche jamais la base', async () => {
  // Le compte se crée à la vérification, pas à la demande — sinon une
  // adresse mal tapée créerait un compte fantôme.
  const { base, comptes } = baseEnMemoire();
  const reponse = await traiter(
    new Request('https://x/connexion', { method: 'POST', body: JSON.stringify({ email: 'nouveau@exemple.fr' }) }),
    reglages(base),
  );
  assert.equal(reponse.status, 200);
  assert.equal(comptes.size, 0, 'un compte a été créé avant toute vérification');
});

test('une adresse illisible est refusée avant tout envoi', async () => {
  const { base } = baseEnMemoire();
  for (const email of ['', 'pas-une-adresse', '@sans-partie-locale.fr', 'sans-arobase.fr']) {
    const reponse = await traiter(
      new Request('https://x/connexion', { method: 'POST', body: JSON.stringify({ email }) }),
      reglages(base),
    );
    assert.equal(reponse.status, 400, `acceptée à tort : « ${email} »`);
  }
});

test('le parcours complet : demander, vérifier, lire le solde', async () => {
  const { base } = baseEnMemoire();
  const r = reglages(base);

  await traiter(
    new Request('https://x/connexion', { method: 'POST', body: JSON.stringify({ email: 'client@exemple.fr' }) }),
    r,
  );

  // Le lien de connexion n'est jamais renvoyé par la route — on scelle le
  // même jeton que la route aurait envoyé par courriel, pour vérifier ce que
  // `/verifier` en fait.
  const lienJeton = await sceller(SECRET_JETONS, { email: 'client@exemple.fr', type: 'connexion' }, 900);
  const verif = await traiter(new Request(`https://x/verifier?jeton=${encodeURIComponent(lienJeton)}`), r);
  assert.equal(verif.status, 200);
  const { jeton: session, solde: soldeInitial } = await verif.json() as { jeton: string; solde: number };
  assert.equal(soldeInitial, 0);

  const lecture = await traiter(
    new Request('https://x/solde', { headers: { Authorization: `Bearer ${session}` } }),
    r,
  );
  assert.deepEqual(await lecture.json(), { connecte: true, solde: 0 });
});

test('vérifier le même lien deux fois ne crée pas deux comptes', async () => {
  // Un clic accidentel sur le lien, ou l'aperçu automatique d'un client de
  // messagerie qui suit les liens des courriels reçus.
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base);
  const jeton = await sceller(SECRET_JETONS, { email: 'deux-fois@exemple.fr', type: 'connexion' }, 900);

  const a = await traiter(new Request(`https://x/verifier?jeton=${jeton}`), r);
  const b = await traiter(new Request(`https://x/verifier?jeton=${jeton}`), r);

  const { jeton: sessionA } = await a.json() as { jeton: string };
  const { jeton: sessionB } = await b.json() as { jeton: string };
  const chargeA = await ouvrir<{ compteId: string }>(SECRET_JETONS, sessionA);
  const chargeB = await ouvrir<{ compteId: string }>(SECRET_JETONS, sessionB);

  assert.equal(chargeA?.compteId, chargeB?.compteId);
  assert.equal(comptes.size, 1);
});

test('un lien expiré, forgé ou d’un autre type est refusé', async () => {
  const { base } = baseEnMemoire();
  const r = reglages(base);

  const expire = await sceller(SECRET_JETONS, { email: 'x@y.fr', type: 'connexion' }, -1);
  const mauvaisType = await sceller(SECRET_JETONS, { email: 'x@y.fr', type: 'session' }, 900);

  for (const jeton of [expire, mauvaisType, 'forge.faux', '']) {
    const reponse = await traiter(new Request(`https://x/verifier?jeton=${encodeURIComponent(jeton)}`), r);
    assert.equal(reponse.status, 400, `accepté à tort : « ${jeton} »`);
  }
});

// ------------------------------------------------------------------ Le solde

test('sans jeton, avec un jeton faux ou périmé, le solde rend « non connecté », jamais 401', async () => {
  const { base } = baseEnMemoire();
  const r = reglages(base);
  const perime = await sceller(SECRET_JETONS, { compteId: 'x', type: 'session' }, -1);

  const cas = [
    new Request('https://x/solde'),
    new Request('https://x/solde', { headers: { Authorization: 'Bearer ' } }),
    new Request('https://x/solde', { headers: { Authorization: 'Bearer forge.faux' } }),
    new Request('https://x/solde', { headers: { Authorization: `Bearer ${perime}` } }),
  ];
  for (const requete of cas) {
    const reponse = await traiter(requete, r);
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { connecte: false });
  }
});

// -------------------------------------------------------------- Le webhook

test('un achat crédite le bon compte, du bon montant', async () => {
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base, { packs: { '1900': 100 } });
  const jeton = await sceller(SECRET_JETONS, { email: 'ach@exemple.fr', type: 'connexion' }, 900);
  const { jeton: session } = await (await traiter(new Request(`https://x/verifier?jeton=${jeton}`), r)).json() as { jeton: string };
  const { compteId } = await ouvrir<{ compteId: string }>(SECRET_JETONS, session) ?? {};

  const corps = paiement('cs_test_1', compteId!, 1900, 'pi_test_1');
  const reponse = await traiter(
    new Request('https://x/webhook', { method: 'POST', body: corps, headers: { 'Stripe-Signature': await signer(corps) } }),
    r,
  );
  assert.equal(reponse.status, 200);
  assert.equal(comptes.get(compteId!)?.solde, 100);
});

test('un montant sans palier connu est ignoré, sans erreur et sans créditer', async () => {
  // Attendu quand les prix changent sur Stripe avant que ce serveur ne soit
  // redéployé avec la table à jour — voir la note dans index.ts.
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base, { packs: { '1900': 100 } });
  comptes.set('c1', { id: 'c1', email: 'x@y.fr', solde: 0 });

  const corps = paiement('cs_test_2', 'c1', 3000, 'pi_test_2'); // 3000 : aucun palier ne le connaît
  const reponse = await traiter(
    new Request('https://x/webhook', { method: 'POST', body: corps, headers: { 'Stripe-Signature': await signer(corps) } }),
    r,
  );
  assert.equal(reponse.status, 200);
  assert.equal(comptes.get('c1')?.solde, 0);
});

test('un achat rejoué ne crédite pas deux fois', async () => {
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base, { packs: { '1900': 100 } });
  comptes.set('c1', { id: 'c1', email: 'x@y.fr', solde: 0 });

  const corps = paiement('cs_test_3', 'c1', 1900, 'pi_test_3');
  const entete = await signer(corps);
  for (let i = 0; i < 3; i += 1) {
    await traiter(new Request('https://x/webhook', { method: 'POST', body: corps, headers: { 'Stripe-Signature': entete } }), r);
  }
  assert.equal(comptes.get('c1')?.solde, 100, 'un rejeu a crédité une seconde fois');
});

test('un remboursement retire exactement ce que l’achat avait donné', async () => {
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base, { packs: { '1900': 100 } });
  comptes.set('c1', { id: 'c1', email: 'x@y.fr', solde: 0 });

  const achat = paiement('cs_test_4', 'c1', 1900, 'pi_test_4');
  await traiter(new Request('https://x/webhook', { method: 'POST', body: achat, headers: { 'Stripe-Signature': await signer(achat) } }), r);
  assert.equal(comptes.get('c1')?.solde, 100);

  const remb = remboursement('pi_test_4');
  await traiter(new Request('https://x/webhook', { method: 'POST', body: remb, headers: { 'Stripe-Signature': await signer(remb) } }), r);
  assert.equal(comptes.get('c1')?.solde, 0);
});

test('un remboursement peut passer le solde sous zéro si les crédits sont déjà dépensés', async () => {
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base, { packs: { '1900': 100 } });
  comptes.set('c1', { id: 'c1', email: 'x@y.fr', solde: 0 });

  const achat = paiement('cs_test_5', 'c1', 1900, 'pi_test_5');
  await traiter(new Request('https://x/webhook', { method: 'POST', body: achat, headers: { 'Stripe-Signature': await signer(achat) } }), r);
  comptes.get('c1')!.solde -= 80; // dépensés ailleurs, hors de ce test

  const remb = remboursement('pi_test_5');
  await traiter(new Request('https://x/webhook', { method: 'POST', body: remb, headers: { 'Stripe-Signature': await signer(remb) } }), r);
  assert.equal(comptes.get('c1')?.solde, -80, 'une dette réelle plafonnée à zéro cacherait le problème');
});

test('un remboursement sans achat connu ne fait rien planter', async () => {
  const { base } = baseEnMemoire();
  const r = reglages(base);
  const remb = remboursement('pi_jamais_vu');
  const reponse = await traiter(new Request('https://x/webhook', { method: 'POST', body: remb, headers: { 'Stripe-Signature': await signer(remb) } }), r);
  assert.equal(reponse.status, 200);
});

test('une signature refusée ou un corps illisible ne créditent rien', async () => {
  const { base, comptes } = baseEnMemoire();
  const r = reglages(base, { packs: { '1900': 100 } });
  comptes.set('c1', { id: 'c1', email: 'x@y.fr', solde: 0 });

  const corps = paiement('cs_test_6', 'c1', 1900, 'pi_test_6');
  const sansSignature = await traiter(new Request('https://x/webhook', { method: 'POST', body: corps }), r);
  assert.equal(sansSignature.status, 400);

  const illisible = await traiter(
    new Request('https://x/webhook', { method: 'POST', body: '{pas du json', headers: { 'Stripe-Signature': await signer('{pas du json') } }),
    r,
  );
  assert.equal(illisible.status, 400);

  assert.equal(comptes.get('c1')?.solde, 0);
});

// --------------------------------------------------------------- Le partage

test('le partage d’origine ne s’ouvre qu’aux origines nommées', async () => {
  const { base } = baseEnMemoire();
  const r = reglages(base);
  const avec = await traiter(new Request('https://x/solde', { headers: { Origin: 'https://amorce.example' } }), r);
  assert.equal(avec.headers.get('access-control-allow-origin'), 'https://amorce.example');

  const sans = await traiter(new Request('https://x/solde', { headers: { Origin: 'https://pirate.example' } }), r);
  assert.equal(sans.headers.get('access-control-allow-origin'), null);
});
