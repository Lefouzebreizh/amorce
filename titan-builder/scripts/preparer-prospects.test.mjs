import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { selectionner, preparer } from './preparer-prospects.mjs';

const p = { id: 'atelier-test', name: 'Atelier TEST fictif', city: 'Rennes', observation: 'Votre fiche de test présente la menuiserie.', sources: ['https://example.com'], phone: '02 99 00 00 00', phone_source: 'https://example.com', services: 'Menuiserie', metier: 'menuisier' };
const input = prospects => ({ prospects, exclusions: [], signature: 'Équipe de test' });
test('opposition ultérieure et contacts déjà envoyés bloquent tous leurs doublons', () => {
  assert(selectionner(input([p, { ...p, opposition: true }])).every(x => x.reason === 'exclusion'));
  assert.equal(selectionner(input([{ ...p, sent: true }]))[0].reason, 'exclusion');
  assert.equal(selectionner({ ...input([p]), exclusions: ['Atelier Test fictif'] })[0].reason, 'exclusion');
});
test('déduplication et refus des chemins injectés', () => {
  assert.equal(selectionner(input([p, { ...p, id: 'autre' }]))[1].reason, 'doublon');
  assert.equal(selectionner(input([{ ...p, id: '../../ailleurs' }]))[0].reason, 'identifiant invalide');
});
test('parcours réel, dossier incomplet, plafond et conservation du lot existant', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'prospects-'));
  try {
    const out = path.join(temp, 'lot');
    const candidats = [p, { ...p, id: 'incomplet', name: 'Autre atelier', phone: '', phone_source: '' }, ...Array.from({ length: 5 }, (_, i) => ({ ...p, id: `reserve-${i}`, name: `Réserve ${i}`, phone: '', services: '' }))];
    const result = await preparer(input(candidats), out);
    assert.equal(result[0].status, 'a_valider');
    assert.equal(result[1].status, 'a_completer');
    assert.equal(result.filter(x => x.status === 'differe').length, 2);
    assert.match(await readFile(path.join(out, p.id, 'index.html'), 'utf8'), /noindex/);
    assert.doesNotMatch(result[1].message, /J’ai préparé/);
    assert(result.filter(x => x.message).every(x => x.approved === false && x.sent === false));
    await assert.rejects(preparer(input([p]), out), /EEXIST/);
    assert.equal(JSON.parse(await readFile(path.join(out, 'file.json'), 'utf8')).envois, 0);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
