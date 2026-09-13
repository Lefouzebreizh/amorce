import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { request as requeteHttp, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { chargerReglages, creerServeur, LIMITE_CORPS } from '../http.ts';
import type { Reglages } from '../index.ts';

const envTest = (): NodeJS.ProcessEnv => ({
  STRIPE_SECRET_KEY: 'rk_test_factice',
  STRIPE_PRICE_ID: 'price_factice',
  STRIPE_WEBHOOK_SECRET: 'whsec_factice',
  AUDIT_ORIGINES: 'https://audit.example,https://preview.example',
  AUDIT_URL_SUCCES: 'https://audit.example/?paiement=succes',
  AUDIT_URL_ANNULATION: 'https://audit.example/?paiement=annule',
  AUDIT_RECEPTION_URL: 'https://registre.example/commandes',
  AUDIT_RECEPTION_SECRET: 's'.repeat(32),
});

async function demarrer(t: TestContext, partiel: Partial<Reglages> = {}): Promise<Server> {
  const serveur = creerServeur({
    ...chargerReglages(envTest()),
    fetch: async () => { throw new Error('Réseau externe interdit dans ce test'); },
    ...partiel,
  });
  await new Promise<void>((resolve) => serveur.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => serveur.close((err) => err ? reject(err) : resolve())));
  return serveur;
}

async function appeler(serveur: Server, chemin: string, corps?: string, entetes: Record<string, string> = {}) {
  return new Promise<{ status: number; corps: string; origine: string | undefined }>((resolve, reject) => {
    const req = requeteHttp({
      hostname: '127.0.0.1', port: (serveur.address() as AddressInfo).port,
      path: chemin, method: corps === undefined ? 'GET' : 'POST', agent: false,
      headers: { ...entetes, ...(corps === undefined ? {} : { 'content-length': Buffer.byteLength(corps) }) },
    }, (res) => {
      const morceaux: Buffer[] = [];
      res.on('data', (morceau) => morceaux.push(morceau));
      res.on('end', () => resolve({ status: res.statusCode!, corps: Buffer.concat(morceaux).toString(),
        origine: res.headers['access-control-allow-origin'] as string | undefined }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(corps);
  });
}

test('charge les réglages test et refuse chaque variable absente sans afficher de valeur', () => {
  const reglages = chargerReglages(envTest());
  assert.equal(reglages.idPrixStripe, 'price_factice');
  assert.deepEqual(reglages.origines, ['https://audit.example', 'https://preview.example']);
  for (const nom of Object.keys(envTest())) {
    const env = envTest();
    delete env[nom];
    assert.throws(() => chargerReglages(env), new RegExp(nom));
  }
});

test('refuse le mode live, une réception HTTP, les origines avec chemin et les secrets trop courts', () => {
  for (const [nom, valeur] of [
    ['STRIPE_SECRET_KEY', 'rk_live_factice'],
    ['AUDIT_RECEPTION_URL', 'http://registre.example/commandes'],
    ['AUDIT_RECEPTION_URL', 'https://identifiant:secret@registre.example/commandes'],
    ['AUDIT_ORIGINES', 'https://audit.example/chemin'],
    ['AUDIT_RECEPTION_SECRET', 'court'],
  ]) {
    assert.throws(() => chargerReglages({ ...envTest(), [nom]: valeur }), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes(nom));
      assert.ok(!err.message.includes(valeur));
      return true;
    });
  }
});

test('sert health et les statuts du gestionnaire sur HTTP local', async (t) => {
  const serveur = await demarrer(t);
  const sante = await appeler(serveur, '/health');
  assert.equal(sante.status, 200);
  assert.deepEqual(JSON.parse(sante.corps), { statut: 'ok', mode: 'test' });
  assert.equal((await appeler(serveur, '/inconnu')).status, 404);
  const invalide = await appeler(serveur, '/creer-session', '{', { Origin: 'https://audit.example' });
  assert.equal(invalide.status, 400);
  assert.equal(invalide.origine, 'https://audit.example');
});

test('préserve le corps brut UTF-8 et la signature du webhook', async (t) => {
  let recus = 0;
  const serveur = await demarrer(t, { fetch: async (url, options) => {
    recus += 1;
    assert.equal(url, 'https://registre.example/commandes');
    assert.equal(JSON.parse(options!.body as string).url, 'https://example.com/été');
    return new Response(null, { status: 201 });
  } });
  const corps = '{\n "type" : "checkout.session.completed", "data": { "object": { "id":"cs_test_http", "payment_status":"paid", "metadata": { "url_a_auditer":"https://example.com/été" }, "customer_details":{"email":"client@example.com"} } }\n}\n';
  const temps = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', envTest().STRIPE_WEBHOOK_SECRET!)
    .update(`${temps}.${corps}`).digest('hex');
  const resultat = await appeler(serveur, '/webhook', corps, { 'Stripe-Signature': `t=${temps},v1=${signature}` });
  assert.equal(resultat.status, 200);
  assert.equal(recus, 1);
  // Une signature calculée sur des espaces différents doit être refusée.
  assert.equal((await appeler(serveur, '/webhook', corps + ' ', {
    'Stripe-Signature': `t=${temps},v1=${signature}`,
  })).status, 400);
  assert.equal(recus, 1);
});

test('refuse un corps trop volumineux avant le gestionnaire', async (t) => {
  const serveur = await demarrer(t);
  const resultat = await appeler(serveur, '/webhook', 'x'.repeat(LIMITE_CORPS + 1));
  assert.equal(resultat.status, 413);
});

test('une panne ne révèle pas les données internes du transport', async (t) => {
  const serveur = await demarrer(t, { fetch: async () => { throw new Error('détail interne confidentiel'); } });
  const resultat = await appeler(serveur, '/creer-session', JSON.stringify({ url: 'https://example.com' }));
  assert.equal(resultat.status, 500);
  assert.ok(!resultat.corps.includes('confidentiel'));
});
