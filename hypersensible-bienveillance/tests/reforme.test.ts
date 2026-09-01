import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/reforme.ts';

/**
 * Base factice qui note ce qu'on a tenté d'écrire. C'est tout ce qui compte
 * ici : le garde-fou du sel ne se juge pas à ce qu'il répond, mais à ce qu'il
 * s'abstient de mettre en base.
 */
function baseFactice() {
  const ecritures: string[] = [];
  return {
    ecritures,
    prepare(sql: string) {
      const requete = {
        bind: () => requete,
        async first() {
          ecritures.push(sql);
          return { restant: 4 };
        },
        async run() {
          ecritures.push(sql);
          return { meta: { changes: 1 } };
        },
        async all() {
          ecritures.push(sql);
          return { results: [] };
        },
      };
      return requete;
    },
  };
}

function requete(entetes: Record<string, string> = {}) {
  return new Request('https://exemple.test/api/reforme', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...entetes },
    body: JSON.stringify({ texte: 'tu ne réponds jamais à mes messages', src: 'externe' }),
  });
}

/** `onRequestPost` attend le contexte d'une Pages Function ; seuls deux champs comptent. */
const appeler = (request: Request, env: unknown) =>
  (onRequestPost as (c: { request: Request; env: unknown }) => Promise<Response>)({ request, env });

test('du vrai trafic sans sel : on sert, et on n’écrit rien en base', async () => {
  const db = baseFactice();
  const reponse = await appeler(requete({ 'cf-connecting-ip': '203.0.113.7' }), { DB: db });
  const charge = (await reponse.json()) as Record<string, unknown>;

  assert.equal(reponse.status, 200);
  assert.equal(charge.acces, 'degrade');
  // Le cœur du garde-fou : aucune empreinte non salée ne part en base.
  assert.deepEqual(db.ecritures, []);
});

test('du vrai trafic avec sel : le décompte reprend son cours', async () => {
  const db = baseFactice();
  const reponse = await appeler(
    requete({ 'cf-connecting-ip': '203.0.113.7' }),
    { DB: db, SEL_QUOTA: 'un-sel-bien-long-et-aleatoire' },
  );
  const charge = (await reponse.json()) as Record<string, unknown>;

  assert.equal(reponse.status, 200);
  assert.notEqual(charge.acces, 'degrade');
  assert.ok(db.ecritures.length > 0, 'le quota doit être consommé');
});

test('en local, l’absence de sel ne bloque rien', async () => {
  // wrangler ne pose pas `cf-connecting-ip` : le repli public est alors sans
  // conséquence, et exiger le secret rendrait le projet inessayable.
  const db = baseFactice();
  const reponse = await appeler(requete(), { DB: db });
  const charge = (await reponse.json()) as Record<string, unknown>;

  assert.equal(reponse.status, 200);
  assert.notEqual(charge.acces, 'degrade');
  assert.ok(db.ecritures.length > 0);
});

test('le groupe reste hors du garde-fou comme du décompte', async () => {
  const db = baseFactice();
  const request = new Request('https://exemple.test/api/reforme', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
    body: JSON.stringify({ texte: 'tu ne réponds jamais', src: 'groupe' }),
  });
  const charge = (await (await appeler(request, { DB: db })).json()) as Record<string, unknown>;

  assert.equal(charge.acces, 'groupe');
  assert.deepEqual(db.ecritures, []);
});
