import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GradePipeline, getLook, LOOKS } from '../grade.ts';
import { activeWordIndex, popScale } from '../captions.ts';
import type { Caption } from '../types.ts';

const pipeline = new GradePipeline();

test('à pleine intensité, le filtre est celui du rendu choisi', () => {
  const look = getLook('cinema');
  assert.equal(pipeline.baseFilter(look, 1), 'contrast(1.120) saturate(1.080)');
});

test('à intensité nulle, aucun filtre n’est appliqué', () => {
  assert.equal(pipeline.baseFilter(getLook('cinema'), 0), 'none');
  assert.equal(pipeline.baseFilter(getLook('naturel'), 1), 'none');
});

test('à mi-intensité, chaque fonction est ramenée à mi-chemin du neutre', () => {
  // contrast neutre = 1, donc 1,12 à 50 % donne 1,06.
  assert.equal(pipeline.baseFilter(getLook('cinema'), 0.5), 'contrast(1.060) saturate(1.040)');
});

test('sepia et grayscale s’interpolent vers zéro, pas vers un', () => {
  // grayscale(1) à 50 % doit donner 0,5 — et non 1, qui laisserait l’image
  // entièrement désaturée quel que soit le curseur.
  const filter = pipeline.baseFilter(getLook('noir'), 0.5);
  assert.match(filter, /grayscale\(0\.500\)/);
});

test('tous les rendus déclarent des réglages dans les bornes', () => {
  for (const look of LOOKS) {
    for (const key of ['vignette', 'grain', 'bloom', 'fade'] as const) {
      assert.ok(look[key] >= 0 && look[key] <= 1, `${look.id}.${key} hors bornes`);
    }
    assert.ok(look.label.length > 0 && look.description.length > 0, `${look.id} mal décrit`);
  }
});

test('un identifiant inconnu retombe sur le rendu naturel', () => {
  // @ts-expect-error on force volontairement une valeur invalide
  assert.equal(getLook('inexistant').id, 'naturel');
});

test('l’apparition des sous-titres dépasse 1 avant de se stabiliser', () => {
  assert.equal(popScale(-1), 0);
  assert.equal(popScale(5), 1);
  const overshoot = Math.max(...Array.from({ length: 24 }, (_, i) => popScale(i * 0.01)));
  assert.ok(overshoot > 1, 'sans dépassement, le rebond serait imperceptible');
});

test('le mot karaoké actif progresse et reste dans les bornes', () => {
  const caption: Caption = { id: 'c', text: '', start: 0, end: 4, style: 'karaoke', y: 0.5 };
  assert.equal(activeWordIndex(caption, 0, 4), 0);
  assert.equal(activeWordIndex(caption, 2, 4), 2);
  assert.equal(activeWordIndex(caption, 99, 4), 3);
  assert.equal(activeWordIndex(caption, -5, 4), 0);
});
