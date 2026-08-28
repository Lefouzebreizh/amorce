import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { Commande } from '@/lib/commande';
import { ecrireDossier } from '@/lib/dossier';
import { corpsDuCourriel } from '@/lib/courriel';

const commande: Commande = {
  modele: 'btp', entreprise: 'Maçonnerie Dupont', telephone: '06 12 34 56 78', ville: 'Rennes',
  couleur: '#ff6600', slogan: 'Le mur droit du premier coup.',
  options: ['appel', 'video-titan'], presentation: 'Vingt ans de métier.', services: 'Enduit — 45 €/m²',
};

async function racine() {
  return mkdtemp(path.join(tmpdir(), 'titan-test-'));
}

test('le dossier porte le nom de l’entreprise et la date', async () => {
  const base = await racine();
  const ecrit = await ecrireDossier(base, commande, [], '2026-08-27');
  assert.equal(ecrit.reference, 'maconnerie-dupont-2026-08-27');
  assert.ok(ecrit.chemin.endsWith('maconnerie-dupont-2026-08-27'));
});

test('le récapitulatif enregistré porte le prix recalculé, pas un prix reçu', async () => {
  const base = await racine();
  const ecrit = await ecrireDossier(base, commande, [], '2026-08-27');
  const resume = JSON.parse(await readFile(path.join(ecrit.chemin, 'commande.json'), 'utf8'));
  assert.equal(resume.prix_total_euros, 499);
  assert.equal(resume.commande.entreprise, 'Maçonnerie Dupont');
});

test('les photos sont écrites, numérotées et rendues dans l’ordre', async () => {
  const base = await racine();
  const photos = [
    { nom: 'chantier.jpg', octets: new Uint8Array([1, 2, 3]) },
    { nom: 'camion.png', octets: new Uint8Array([4, 5]) },
  ];
  const ecrit = await ecrireDossier(base, commande, photos, '2026-08-27');
  assert.deepEqual(ecrit.fichiers, ['01-chantier.jpg', '02-camion.png']);
  const surDisque = (await readdir(ecrit.chemin)).sort();
  assert.deepEqual(surDisque, ['01-chantier.jpg', '02-camion.png', 'commande.json']);
});

test('un nom de photo qui remonte l’arborescence est neutralisé', async () => {
  const base = await racine();
  const ecrit = await ecrireDossier(
    base, commande, [{ nom: '../../evasion.sh', octets: new Uint8Array([0]) }], '2026-08-27',
  );
  assert.deepEqual(ecrit.fichiers, ['01-evasion.sh']);
  assert.ok(!ecrit.fichiers[0].includes('/'));
});

test('le courriel porte le total, les options payantes et les photos', () => {
  const corps = corpsDuCourriel(commande, 'maconnerie-dupont-2026-08-27', ['01-chantier.jpg'], '/tmp/x');
  assert.ok(corps.includes('TOTAL       : 499 €'));
  assert.ok(corps.includes('Vidéo Titan AZEROTH'));
  assert.ok(corps.includes('+ 200 €'));
  assert.ok(corps.includes('01-chantier.jpg'));
  assert.ok(corps.includes('06 12 34 56 78'));
});

test('un champ vide se lit « vide » plutôt que de laisser un blanc', () => {
  const corps = corpsDuCourriel({ ...commande, presentation: '  ', slogan: '' }, 'r', [], '/tmp/x');
  assert.ok(corps.includes('(vide)'));
  assert.ok(corps.includes('(aucun)'));
  assert.ok(corps.includes('(aucune)'));
});
