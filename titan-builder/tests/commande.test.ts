import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  MODELES, OPTIONS, PRIX_BASE, modeleParId, nomDossier, prixTotal, reproches,
} from '@/lib/commande';

test('les quatre modèles annoncés existent et sont distincts', () => {
  assert.equal(MODELES.length, 4);
  assert.equal(new Set(MODELES.map((m) => m.id)).size, 4);
  for (const attendu of ['routier', 'btp', 'food', 'beaute']) {
    assert.ok(modeleParId(attendu), `${attendu} manque`);
  }
});

test('un modèle inconnu ne se trouve pas', () => {
  assert.equal(modeleParId('camion-de-glace'), undefined);
});

test('le prix de base est celui annoncé sur la page', () => {
  assert.equal(prixTotal([]), PRIX_BASE);
  assert.equal(PRIX_BASE, 300);
});

test('la vidéo Titan ajoute deux cents euros, une seule fois', () => {
  assert.equal(prixTotal(['video-titan']), 500);
  // Une case envoyée deux fois ne facture pas deux fois.
  assert.equal(prixTotal(['video-titan', 'video-titan']), 500);
});

test('les options comprises ne coûtent rien', () => {
  const comprises = OPTIONS.filter((o) => o.supplement === 0).map((o) => o.id);
  assert.equal(prixTotal(comprises), PRIX_BASE);
});

test('une option inventée est ignorée plutôt que facturée', () => {
  assert.equal(prixTotal(['fusee-lunaire', 'video-titan']), 500);
});

test('le nom de dossier ne peut pas sortir de son dossier', () => {
  assert.equal(nomDossier('Maçonnerie Dupont', '2026-08-27'), 'maconnerie-dupont-2026-08-27');
  assert.equal(nomDossier('../../etc', '2026-08-27'), 'etc-2026-08-27');
  assert.equal(nomDossier('A / B', '2026-08-27'), 'a-b-2026-08-27');
  assert.ok(!nomDossier('n’importe/quoi', '2026-08-27').includes('/'));
});

test('un nom vide reste un dossier nommable', () => {
  assert.equal(nomDossier('', '2026-08-27'), 'sans-nom-2026-08-27');
  assert.equal(nomDossier('!!!', '2026-08-27'), 'sans-nom-2026-08-27');
});

test('un nom à rallonge est tronqué avant de devenir un chemin', () => {
  const long = nomDossier('a'.repeat(200), '2026-08-27');
  assert.ok(long.length <= 71, `${long.length} caractères`);
});

const valide = {
  modele: 'btp', entreprise: 'Dupont', telephone: '06 12 34 56 78', ville: 'Rennes',
  couleur: '#ff6600', slogan: '', options: [], presentation: '', services: '',
};

test('une commande complète ne se voit rien reprocher', () => {
  assert.deepEqual(reproches(valide), []);
});

test('chaque champ obligatoire manquant est nommé', () => {
  assert.deepEqual(reproches({}).length, 4);
  assert.ok(reproches({ ...valide, entreprise: '   ' })[0].includes('entreprise'));
});

test('un modèle absent du catalogue est refusé', () => {
  assert.ok(reproches({ ...valide, modele: 'camion' }).some((r) => r.includes('modèle')));
});

test('un téléphone trop court est refusé, un format libre accepté', () => {
  assert.ok(reproches({ ...valide, telephone: '0612' }).some((r) => r.includes('téléphone')));
  assert.deepEqual(reproches({ ...valide, telephone: '+33 6 12 34 56 78' }), []);
});

test('une couleur qui n’est pas hexadécimale est refusée', () => {
  assert.ok(reproches({ ...valide, couleur: 'rouge' }).some((r) => r.includes('hexadécimal')));
  // Vide reste accepté : la couleur a une valeur par défaut côté page.
  assert.deepEqual(reproches({ ...valide, couleur: '' }), []);
});
