import test from 'node:test';
import assert from 'node:assert/strict';

import { lirePrix, normaliserMontant } from '../workers/prix.js';

// Les échantillons ci-dessous suivent les normes publiées (schema.org,
// microdonnées, OpenGraph) — ils n'imitent aucun éditeur en particulier. Ce
// que ces tests prouvent est la lecture d'un format, pas la couverture d'un
// site : celle-là demande une session qui joigne les dix pages.

test('un prix déclaré en JSON-LD est lu', () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Product","name":"Abonnement",
     "offers":{"@type":"Offer","price":"12.99","priceCurrency":"EUR"}}
  </script></head><body></body></html>`;
  assert.deepEqual(lirePrix(html), { montant: 12.99, source: 'json-ld' });
});

test('un JSON-LD imbriqué dans @graph est atteint', () => {
  const html = `<script type="application/ld+json">
    {"@graph":[{"@type":"WebSite"},{"@type":"Product",
      "offers":[{"@type":"Offer","price":7.99}]}]}
  </script>`;
  assert.equal(lirePrix(html).montant, 7.99);
});

test('les microdonnées prennent le relais quand le JSON-LD se tait', () => {
  const html = `<div itemscope itemtype="https://schema.org/Offer">
    <meta itemprop="price" content="9.99"><span itemprop="priceCurrency">EUR</span></div>`;
  assert.deepEqual(lirePrix(html), { montant: 9.99, source: 'microdonnees' });
});

test('un prix en microdonnées écrit en toutes lettres est lu', () => {
  const html = `<span itemprop="price">14,50 €</span>`;
  assert.deepEqual(lirePrix(html), { montant: 14.5, source: 'microdonnees' });
});

test('OpenGraph est consulté en dernier', () => {
  const html = `<meta property="product:price:amount" content="5.99">`;
  assert.deepEqual(lirePrix(html), { montant: 5.99, source: 'opengraph' });
});

test('deux tarifs déclarés ne donnent aucun prix', () => {
  // Mensuel et annuel sur la même page : le cas le plus courant, et celui où
  // un analyseur naïf fabrique une courbe.
  const html = `<script type="application/ld+json">
    {"@type":"Product","offers":[{"price":"12.99"},{"price":"99.00"}]}
  </script>`;
  const lu = lirePrix(html);
  assert.equal(lu.montant, null);
  assert.match(lu.raison!, /2 montants/);
  assert.deepEqual(lu.candidats, [12.99, 99]);
});

test('deux déclarations du même montant restent un prix', () => {
  const html = `<script type="application/ld+json">
    {"@type":"Product","offers":[{"price":"12.99"},{"price":12.99}]}
  </script>`;
  assert.equal(lirePrix(html).montant, 12.99);
});

test('une page muette ne rend aucun prix', () => {
  assert.equal(lirePrix('<html><body><h1>Nos tarifs</h1></body></html>').montant, null);
  assert.equal(lirePrix('').montant, null);
});

test('un JSON-LD malformé ne fait pas tomber la lecture', () => {
  const html = `<script type="application/ld+json">{ ceci n'est pas du JSON </script>
    <meta property="product:price:amount" content="8.99">`;
  assert.deepEqual(lirePrix(html), { montant: 8.99, source: 'opengraph' });
});

test('un montant aberrant ou gratuit n’est pas retenu', () => {
  assert.equal(lirePrix('<meta itemprop="price" content="0">').montant, null);
  assert.equal(lirePrix('<meta itemprop="price" content="45000">').montant, null);
});

test('le séparateur décimal se tranche sur le nombre de décimales', () => {
  assert.equal(normaliserMontant('12,99'), 12.99);   // européen
  assert.equal(normaliserMontant('12.99'), 12.99);   // anglo-saxon
  assert.equal(normaliserMontant('1,299'), 1299);    // millier, pas une décimale
  assert.equal(normaliserMontant('1.299,50'), 1299.5);
  assert.equal(normaliserMontant('1,299.50'), 1299.5);
  assert.equal(normaliserMontant('7'), 7);
});

test('les symboles et mentions autour du montant sont ignorés', () => {
  assert.equal(normaliserMontant('€ 12,99'), 12.99);
  assert.equal(normaliserMontant('12,99 €/mois'), 12.99);
  assert.equal(normaliserMontant('USD 5.99'), 5.99);
  assert.equal(normaliserMontant('gratuit'), null);
  assert.equal(normaliserMontant(null), null);
});
