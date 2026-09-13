import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { traiter, type Reglages } from '../index.ts';

// Le transport réseau est remplacé, mais pas la réception WSGI ni SQLite.
// Chaque appel Python ouvre un processus distinct : une réponse 200 doit
// correspondre à une commande encore lisible après fermeture de la réception.
const dossierAudit = fileURLToPath(new URL('../../..', import.meta.url));
const secretReception = 'reception-test-sans-secret-reel-32-caracteres';
const secretWebhook = 'whsec_factice_contrat';
const adresseReception = 'https://registre.example/commandes';
const receptionPython = `
import io, json, sys
from pathlib import Path
from reception import application
from commandes import Commandes

entree = json.load(sys.stdin)
if entree['action'] == 'recevoir':
    corps = entree['corps'].encode('utf-8')
    statut = []
    app = application(entree['base'], entree['secret'])
    resultat = app({
        'PATH_INFO': '/commandes', 'REQUEST_METHOD': 'POST',
        'HTTP_AUTHORIZATION': entree['autorisation'],
        'CONTENT_LENGTH': str(len(corps)), 'wsgi.input': io.BytesIO(corps),
    }, lambda code, entetes: statut.append(int(code.split()[0])))
    print(json.dumps({'statut': statut[0], 'corps': b''.join(resultat).decode('utf-8')}))
else:
    if not Path(entree['base']).exists():
        print(json.dumps({'commandes': []}))
    else:
        base = Commandes(entree['base'])
        try:
            print(json.dumps({'commandes': [base.lire(c['session']) for c in base.a_traiter()]}))
        finally:
            base.fermer()
`;

function appelerPython(entree: Record<string, unknown>): {
  statut?: number; corps?: string;
  commandes?: { session: string; url: string; email: string; etat: string }[];
} {
  const resultat = spawnSync('python3', ['-c', receptionPython], {
    cwd: dossierAudit, input: JSON.stringify(entree), encoding: 'utf-8', timeout: 15_000,
  });
  assert.ifError(resultat.error);
  assert.equal(resultat.status, 0, resultat.stderr);
  return JSON.parse(resultat.stdout);
}

test('un webhook signé transmet une commande durable à la file opérateur, avec rejeu et panne', async (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'audit-contrat-'));
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  // Parent absent au départ : véritable échec d'écriture SQLite.
  const disque = join(racine, 'disque');
  const fichierBase = join(disque, 'commandes.sqlite');
  const statutsReception: number[] = [];
  const reglages: Reglages = {
    cleSecreteStripe: 'rk_test_factice', idPrixStripe: 'price_factice',
    secretWebhook, origines: ['https://audit.example'],
    urlSucces: 'https://audit.example/?paiement=succes',
    urlAnnulation: 'https://audit.example/?paiement=annule',
    receptionCommandes: { url: adresseReception, secret: secretReception },
    fetch: async (adresse, options) => {
      // Aucun repli vers fetch : même une requête Stripe imprévue fait échouer le test.
      assert.equal(adresse, adresseReception);
      assert.equal(options?.method, 'POST');
      assert.equal(options?.redirect, 'error');
      const resultat = appelerPython({
        action: 'recevoir', base: fichierBase, secret: secretReception,
        autorisation: new Headers(options?.headers).get('authorization'),
        corps: options?.body,
      });
      statutsReception.push(resultat.statut!);
      return new Response(resultat.corps, { status: resultat.statut });
    },
  };
  const lireFile = () => appelerPython({ action: 'lire', base: fichierBase }).commandes!;
  const envoyer = (email = 'client@example.com', paye = true, signatureCorrecte = true) => {
    const corps = JSON.stringify({ type: 'checkout.session.completed', data: { object: {
      id: 'cs_test_contrat', payment_status: paye ? 'paid' : 'unpaid',
      metadata: { url_a_auditer: 'https://example.com/été' }, customer_details: { email },
    } } });
    const temps = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', signatureCorrecte ? secretWebhook : 'incorrect')
      .update(`${temps}.${corps}`).digest('hex');
    return traiter(new Request('https://audit.example/webhook', {
      method: 'POST', body: corps,
      headers: { 'Stripe-Signature': `t=${temps},v1=${signature}` },
    }), reglages);
  };

  assert.equal((await envoyer(undefined, true, false)).status, 400);
  assert.equal((await envoyer(undefined, false)).status, 200);
  assert.deepEqual(statutsReception, []);
  assert.deepEqual(lireFile(), []);

  assert.equal((await envoyer()).status, 503);
  assert.deepEqual(statutsReception, [503]);
  assert.deepEqual(lireFile(), []);

  mkdirSync(disque);
  assert.equal((await envoyer()).status, 200);
  assert.equal((await envoyer()).status, 200);
  assert.deepEqual(statutsReception, [503, 201, 200]);
  const commandes = lireFile();
  assert.equal(commandes.length, 1);
  assert.equal(commandes[0].session, 'cs_test_contrat');
  assert.equal(commandes[0].url, 'https://example.com/été');
  assert.equal(commandes[0].email, 'client@example.com');
  assert.equal(commandes[0].etat, 'attente');

  // Un rejeu incompatible reste non acquitté, sans écraser l'achat initial.
  assert.equal((await envoyer('autre@example.com')).status, 503);
  assert.equal(statutsReception.at(-1), 409);
  assert.deepEqual(lireFile(), commandes);
});
