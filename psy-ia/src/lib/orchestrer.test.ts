import assert from 'node:assert/strict';
import test from 'node:test';

import { traiterMessage } from './orchestrer';

test('une clé malformée est refusée avant fetch et jamais renvoyée', async () => {
  const cle = 'sk-ant-api03-premiere\nsk-ant-api03-seconde';
  let appele = false;
  const resultat = await traiterMessage('Bonjour', [], undefined, cle, async () => {
    appele = true;
    return new Response('{}');
  });
  assert.equal(appele, false);
  assert.equal(resultat.statut, 500);
  assert.equal(JSON.stringify(resultat).includes(cle), false);
});

test('le corps fournisseur est journalisé avec les clés masquées', async () => {
  const cle = 'sk-ant-api03-secret-de-test';
  const journaux: string[] = [];
  const ancien = console.error;
  console.error = (...argumentsJournal) => journaux.push(argumentsJournal.join(' '));
  try {
    const resultat = await traiterMessage('Bonjour', [], undefined, cle, async () =>
      new Response(`invalid x-api-key ${cle}`, { status: 401 }),
    );
    assert.equal(resultat.statut, 502);
  } finally {
    console.error = ancien;
  }
  assert.equal(journaux.join('\n').includes(cle), false);
  assert.match(journaux.join('\n'), /SECRET MASQUE/);
});
