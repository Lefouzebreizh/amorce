import { test } from 'node:test';
import assert from 'node:assert/strict';

import { activerSiMonetisable, lienAffilieReel } from '../affiliation-regles.mjs';

const base = (niche = {}, outils = []) => ({
  niche: { id: 'ecomm', actif: false, activation_automatique: true, ...niche },
  outils,
});

test('un lien de démonstration ne réveille jamais une niche', () => {
  const b = base({}, [{ lien_affiliation: 'https://exemple-affiliation.com/go/test' }]);
  assert.equal(lienAffilieReel(b.outils[0]), false);
  assert.equal(activerSiMonetisable(b), false);
  assert.equal(b.niche.actif, false);
});

test('le premier vrai lien réveille une niche préparée', () => {
  const b = base({}, [{ lien_affiliation: 'https://programme.example/erwann' }]);
  assert.equal(activerSiMonetisable(b), true);
  assert.equal(b.niche.actif, true);
});

test('une niche non autorisée reste en pause même avec un vrai lien', () => {
  const b = base({ activation_automatique: false }, [
    { lien_affiliation: 'https://programme.example/erwann' },
  ]);
  assert.equal(activerSiMonetisable(b), false);
  assert.equal(b.niche.actif, false);
});

test('un outil marqué sans programme ne déclenche pas le lancement', () => {
  const b = base({}, [{
    lien_affiliation: 'https://editeur.example/produit',
    sans_programme: true,
  }]);
  assert.equal(activerSiMonetisable(b), false);
});
