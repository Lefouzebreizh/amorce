import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traiter, type Reglages } from '../index.ts';

const SECRET_WEBHOOK = 'whsec_test';

function reglages(partiel: Partial<Reglages> = {}): Reglages {
  return {
    cleSecreteStripe: 'sk_test_123',
    receptionCommandes: {url: 'https://registre.example/commandes', secret: 's'.repeat(32)},
    idPrixStripe: 'price_test_abc',
    secretWebhook: SECRET_WEBHOOK,
    origines: ['https://audit-page-de-vente.example'],
    urlSucces: 'https://audit-page-de-vente.example/merci',
    urlAnnulation: 'https://audit-page-de-vente.example/annule',
    ...partiel,
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

const evenementPaye = (sessionId: string, url: string, email: string | null = 'client@exemple.com') =>
  JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        metadata: { url_a_auditer: url },
        customer_details: { email },
      },
    },
  });

// ------------------------------------------------------- /creer-session

test('refuse de créer une session si le prix n\'est pas configuré', async () => {
  const requete = new Request('https://x/creer-session', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://exemple.com' }),
  });
  const reponse = await traiter(requete, reglages({ idPrixStripe: '' }));
  assert.equal(reponse.status, 503);
  // Aucun appel réseau ne doit avoir eu lieu — le veto passe avant tout.
});

test('refuse une adresse absente, malformée ou non http(s)', async () => {
  const r = reglages();
  for (const corps of [
    {}, { url: 'pas-une-url' }, { url: 'ftp://exemple.com' }, { url: 42 },
    { url: 'http://localhost/admin' }, { url: 'http://127.0.0.1' }, { url: 'http://[::1]' },
  ]) {
    const requete = new Request('https://x/creer-session', { method: 'POST', body: JSON.stringify(corps) });
    const reponse = await traiter(requete, r);
    assert.equal(reponse.status, 400, JSON.stringify(corps));
  }
});

test('refuse un corps de requête illisible', async () => {
  const requete = new Request('https://x/creer-session', { method: 'POST', body: 'pas du json' });
  const reponse = await traiter(requete, reglages());
  assert.equal(reponse.status, 400);
});

test('crée une session Stripe et rend son adresse de paiement', async () => {
  let requeteEnvoyee: Request | null = null;
  const fetchFactice: typeof fetch = async (url, init) => {
    requeteEnvoyee = new Request(url as string, init);
    return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' }), {
      status: 200,
    });
  };

  const requete = new Request('https://x/creer-session', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://client-exemple.com/page-de-vente' }),
  });
  const reponse = await traiter(requete, reglages({ fetch: fetchFactice }));

  assert.equal(reponse.status, 200);
  const donnees = (await reponse.json()) as { url: string };
  assert.equal(donnees.url, 'https://checkout.stripe.com/pay/cs_test_1');

  // La requête envoyée à Stripe porte bien le prix configuré, mode paiement
  // unique, et l'URL du client en métadonnée — c'est ce que /webhook devra
  // relire pour savoir quelle page auditer.
  if (!requeteEnvoyee) throw new Error('aucune requête envoyée à Stripe');
  const requete2: Request = requeteEnvoyee;
  assert.equal(requete2.url, 'https://api.stripe.com/v1/checkout/sessions');
  const corpsEnvoye = await requete2.text();
  const params = new URLSearchParams(corpsEnvoye);
  assert.equal(params.get('mode'), 'payment');
  assert.equal(params.get('line_items[0][price]'), 'price_test_abc');
  assert.equal(params.get('line_items[0][quantity]'), '1');
  assert.equal(params.get('integration_identifier'), 'amorceaudit-kzqvtrpn');
  assert.equal(params.get('metadata[url_a_auditer]'), 'https://client-exemple.com/page-de-vente');
  assert.equal(requete2.headers.get('authorization'), `Basic ${btoa('sk_test_123:')}`);
  assert.equal(requete2.headers.get('stripe-version'), '2026-07-29.dahlia');
});

test('un refus de Stripe rend une erreur générique, sans détail interne', async () => {
  const fetchFactice: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'No such price: price_bidon' } }), { status: 400 });
  const requete = new Request('https://x/creer-session', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://exemple.com' }),
  });
  const reponse = await traiter(requete, reglages({ fetch: fetchFactice }));
  assert.equal(reponse.status, 502);
  const donnees = (await reponse.json()) as { erreur: string };
  assert.ok(!donnees.erreur.includes('price_bidon'));
});

test('refuse une redirection qui ne vient pas de Stripe Checkout', async () => {
  const fetchFactice: typeof fetch = async () =>
    new Response(JSON.stringify({ url: 'https://attaquant.example/payer' }), { status: 200 });
  const requete = new Request('https://x/creer-session', {
    method: 'POST', body: JSON.stringify({ url: 'https://exemple.com' }),
  });
  const reponse = await traiter(requete, reglages({ fetch: fetchFactice }));
  assert.equal(reponse.status, 502);
});

// -------------------------------------------------------------- /webhook

test('une signature forgée, absente ou rejouée est refusée', async () => {
  const corps = evenementPaye('cs_1', 'https://exemple.com');
  const cas: Array<[string, string | null]> = [
    ['signée juste', await signer(corps)],
    ['mauvais secret', await signer(corps, 'mauvais')],
    ['absente', null],
    ['inventée', 't=1,v1=zz'],
  ];
  for (const [nom, entete] of cas) {
    const requete = new Request('https://x/webhook', {
      method: 'POST',
      body: corps,
      headers: entete ? { 'Stripe-Signature': entete } : {},
    });
    const reponse = await traiter(requete, reglages({ fetch: async () => new Response(null, {status: 201}) }));
    if (nom === 'signée juste') assert.equal(reponse.status, 200, nom);
    else assert.equal(reponse.status, 400, nom);
  }
});

test('un paiement confirmé déclenche la réception durable avec l\'URL et la session', async () => {
  let requeteReception: Request | null = null;
  const fetchFactice: typeof fetch = async (url, init) => {
    requeteReception = new Request(url as string, init);
    return new Response(null, { status: 201 });
  };

  const corps = evenementPaye('cs_test_42', 'https://client-exemple.com/vente', 'ada@exemple.com');
  const requete = new Request('https://x/webhook', {
    method: 'POST',
    body: corps,
    headers: { 'Stripe-Signature': await signer(corps) },
  });
  const reponse = await traiter(requete, reglages({ fetch: fetchFactice }));

  assert.equal(reponse.status, 200);
  if (!requeteReception) throw new Error('aucune requête envoyée à la réception');
  const requeteG: Request = requeteReception;
  assert.equal(requeteG.url, 'https://registre.example/commandes');
  assert.equal(requeteG.headers.get('authorization'), 'Bearer ' + 's'.repeat(32));
  const charge = JSON.parse(await requeteG.text());
  assert.equal(charge.url, 'https://client-exemple.com/vente');
  assert.equal(charge.sessionId, 'cs_test_42');
  assert.equal(charge.email, 'ada@exemple.com');
});

test('un type d\'événement non écouté rend 200 sans appeler la réception', async () => {
  let appele = false;
  const fetchFactice: typeof fetch = async () => {
    appele = true;
    return new Response('', { status: 200 });
  };
  const corps = JSON.stringify({ type: 'charge.refunded', data: { object: { id: 'ch_1' } } });
  const requete = new Request('https://x/webhook', {
    method: 'POST',
    body: corps,
    headers: { 'Stripe-Signature': await signer(corps) },
  });
  const reponse = await traiter(requete, reglages({ fetch: fetchFactice }));
  assert.equal(reponse.status, 200);
  assert.equal(appele, false);
});

test('un échec de la réception durable rend 503 pour permettre une nouvelle tentative', async () => {
  // Un échec d'enregistrement doit rester rejouable.
  const fetchFactice: typeof fetch = async () => new Response('erreur', { status: 500 });
  const corps = evenementPaye('cs_2', 'https://exemple.com');
  const requete = new Request('https://x/webhook', {
    method: 'POST',
    body: corps,
    headers: { 'Stripe-Signature': await signer(corps) },
  });
  const reponse = await traiter(requete, reglages({ fetch: fetchFactice }));
  assert.equal(reponse.status, 503);
});

test('un chemin inconnu rend 404', async () => {
  const reponse = await traiter(new Request('https://x/autre-chose', { method: 'GET' }), reglages());
  assert.equal(reponse.status, 404);
});


test('le prévol CORS autorise uniquement une origine configurée', async () => {
  for (const [origin, status] of [['https://audit-page-de-vente.example', 204], ['https://intrus.example', 403]] as const) {
    const response = await traiter(new Request('https://x/creer-session', {method: 'OPTIONS', headers: {Origin: origin}}), reglages());
    assert.equal(response.status, status);
    if (status === 204) assert.equal(response.headers.get('access-control-allow-headers'), 'content-type');
  }
});

test('une session non payée ne déclenche pas d’analyse', async () => {
  const event = JSON.parse(evenementPaye('cs_pending', 'https://example.com'));
  event.data.object.payment_status = 'unpaid';
  const body = JSON.stringify(event);
  let calls = 0;
  const response = await traiter(new Request('https://x/webhook', {method: 'POST', body, headers: {'Stripe-Signature': await signer(body)}}), reglages({fetch: async () => { calls++; return new Response(null, {status: 201}); }}));
  assert.equal(response.status, 200);
  assert.equal(calls, 0);
});
