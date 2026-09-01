import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPARATIFS,
  economie,
  ETAPES,
  FORMULES,
  PRIX_UNITAIRE,
  TEMOIGNAGES,
} from '../contenu.ts';

/*
 * Ce que ces tests gardent n'est pas du code : c'est une page qui promet un
 * prix. Une remise annoncée fausse, un témoignage sans source ou une étape
 * manquante coûtent la confiance de gens qui ont déjà payé pour rien ailleurs,
 * et rien dans le typage ne les attrape.
 */

test('la remise annoncée est celle qu’on économise vraiment', () => {
  for (const formule of FORMULES) {
    assert.equal(economie(formule), formule.videos * PRIX_UNITAIRE - formule.prix);
    assert.ok(economie(formule) >= 0, `la formule ${formule.cle} coûte plus cher qu’à l’unité`);
  }
});

test('la formule à trois vidéos économise bien 27 €', () => {
  const trio = FORMULES.find((formule) => formule.videos === 3);
  assert.ok(trio, 'la formule à trois vidéos a disparu');
  assert.equal(trio.prix, 120);
  assert.equal(economie(trio), 27);
});

test('une seule formule est mise en avant', () => {
  assert.equal(FORMULES.filter((formule) => formule.vedette).length, 1);
});

test('aucun témoignage sans source', () => {
  /*
   * La garde tient tant que la liste est vide, et surtout après : elle empêche
   * qu'un avis soit ajouté un soir sans dire d'où il vient — c'est exactement
   * comme ça qu'un faux témoignage entre dans une page de vente.
   */
  for (const temoignage of TEMOIGNAGES) {
    assert.ok(temoignage.texte.trim().length > 0);
    assert.ok(temoignage.qui.trim().length > 0);
    assert.ok(temoignage.source.trim().length > 0, `témoignage de ${temoignage.qui} sans source`);
  }
});

test('trois avant/après, aux clés distinctes', () => {
  assert.equal(COMPARATIFS.length, 3);
  assert.equal(new Set(COMPARATIFS.map((comparatif) => comparatif.cle)).size, 3);
});

test('les étapes se suivent de 1 à 3', () => {
  assert.deepEqual(
    ETAPES.map((etape) => etape.numero),
    [1, 2, 3],
  );
});
