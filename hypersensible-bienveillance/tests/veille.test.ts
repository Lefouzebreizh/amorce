import test from 'node:test';
import assert from 'node:assert/strict';

// La rétention n'est pas importée : `workerd` refuse tout export nommé qui ne
// soit pas une fonction, et l'exporter empêchait le Worker de démarrer. Le
// test lit donc la valeur telle qu'elle est liée à la requête.
import { purgerQuotas, tournee } from '../workers/tracker-healer.js';

/**
 * Base factice. Elle n'exécute aucun SQL — la justesse de la requête se vérifie
 * contre un vrai D1 local, pas ici. Ce qu'elle éprouve est ce qu'un D1 local ne
 * dit pas : ce que la tournée fait du résultat, et ce qu'elle fait d'un refus.
 */
type Outil = { id: number; name: string; url: string; current_price: number };
type Options = { changes?: number; leve?: string | null; outils?: Outil[] };

function baseFactice({ changes = 0, leve = null, outils = [] }: Options = {}) {
  const vues: { sql: string; liaisons: unknown[] }[] = [];
  const db = {
    vues,
    prepare(sql: string) {
      const requete = {
        sql,
        liaisons: [] as unknown[],
        bind(...args: unknown[]) {
          requete.liaisons = args;
          return requete;
        },
        async all() {
          vues.push({ sql, liaisons: requete.liaisons });
          return { results: outils };
        },
        async run() {
          vues.push({ sql, liaisons: requete.liaisons });
          if (leve) throw new Error(leve);
          return { meta: { changes } };
        },
      };
      return requete;
    },
    async batch() {
      return [];
    },
  };
  return db;
}

test('la purge rend le nombre de lignes effacées', async () => {
  const db = baseFactice({ changes: 7 });
  assert.deepEqual(await purgerQuotas({ DB: db }), { supprimes: 7 });
});

test('la purge borne à trente jours, et le dit en jours', async () => {
  const db = baseFactice({ changes: 0 });
  await purgerQuotas({ DB: db });
  const requete = db.vues.at(-1)!;
  assert.equal(requete.liaisons[0], '-30 days');
});

test("la purge compare une date à une date, jamais à un horodatage", async () => {
  // Le piège, mesuré contre un vrai SQLite : « 2026-07-28 » passe devant
  // « 2026-07-28 10:52:00 », et la ligne du trentième jour partirait un jour
  // trop tôt. Un `datetime(` dans cette requête est une régression.
  const db = baseFactice();
  await purgerQuotas({ DB: db });
  const sql = db.vues.at(-1)!.sql;
  assert.match(sql, /date\('now', \?1\)/);
  assert.doesNotMatch(sql, /datetime\(/);
});

test('une base qui refuse la purge ne fait pas tomber la tournée', async () => {
  const db = baseFactice({ leve: 'no such table: users' });
  const bilan = await purgerQuotas({ DB: db });
  assert.equal(bilan.supprimes, 0);
  assert.match(bilan.echec ?? '', /no such table/);
});

test('le bilan de la tournée porte le résultat de la purge', async (t) => {
  // Sans lui, la purge serait invisible : elle tournerait, ou pas, et le
  // journal du Worker dirait la même chose dans les deux cas.
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 200 }));

  const db = baseFactice({
    changes: 4,
    outils: [{ id: 1, name: 'Calm', url: 'https://exemple.test', current_price: 12.99 }],
  });
  const bilan = await tournee({ DB: db, SIMULER_PRIX: '1' });

  assert.deepEqual(bilan.quotas, { supprimes: 4 });
  assert.equal(bilan.verifies, 1);
});
