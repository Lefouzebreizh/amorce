import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PanicDetector, QualityGovernor, QUALITY_TIERS, tierById } from '../quality.ts';

/**
 * Nombre d'images observées avant chaque décision. Doit rester aligné sur la
 * constante interne de la surveillance.
 */
const WINDOW = 45;

/**
 * Alimente la surveillance sur un nombre donné de fenêtres d'observation.
 *
 * Une décision est prise par fenêtre, et elle ne déplace le palier que d'un
 * cran : raisonner en fenêtres plutôt qu'en images évite de confondre « la
 * surveillance refuse de dégrader » et « elle n'a pas encore eu l'occasion ».
 */
function feed(governor: QualityGovernor, frameMs: number, windows: number, startAt = 0) {
  let last = null;
  let clock = startAt;
  for (let i = 0; i < windows * WINDOW; i++) {
    clock += 3000; // Au-delà du délai de garde entre deux décisions.
    const changed = governor.observe(frameMs, clock);
    if (changed) last = changed;
  }
  return { last, clock };
}

test('une cadence confortable ne déclenche aucun changement', () => {
  const governor = new QualityGovernor(tierById('medium'));
  const { last } = feed(governor, 20, 6);
  assert.equal(last, null);
  assert.equal(governor.current().id, 'medium');
});

test('chaque décision ne descend que d’un palier', () => {
  const governor = new QualityGovernor(tierById('full'));
  const { last } = feed(governor, 60, 1);
  assert.ok(last, 'un changement était attendu');
  assert.equal(governor.current().id, 'high');
});

test('une cadence durablement trop lente descend palier par palier', () => {
  const governor = new QualityGovernor(tierById('full'));
  feed(governor, 60, 2);
  // Deux dégradations suffisent à atteindre la limite volontaire : au-delà, la
  // surveillance cesse de bouger pour ne pas osciller.
  assert.equal(governor.current().id, 'medium');
});

test('la descente s’arrête au palier le plus bas', () => {
  const governor = new QualityGovernor(tierById('low'));
  const { last } = feed(governor, 200, 8);
  assert.equal(last, null, 'aucun palier sous « fluide » ne devrait exister');
  assert.equal(governor.current().id, 'low');
});

test('une machine rapide remonte d’un palier par décision', () => {
  const governor = new QualityGovernor(tierById('medium'));
  // L'horloge est chaînée d'un appel à l'autre : deux décisions rapprochées
  // sont volontairement ignorées par le délai de garde.
  const first = feed(governor, 8, 1);
  assert.equal(governor.current().id, 'high');
  feed(governor, 8, 1, first.clock);
  assert.equal(governor.current().id, 'full');
});

test('la remontée cesse après deux dégradations, pour éviter l’oscillation', () => {
  const governor = new QualityGovernor(tierById('full'));
  const { clock } = feed(governor, 60, 2); // full -> high -> medium
  assert.equal(governor.current().id, 'medium');

  // Même avec des images très rapides, le palier ne doit plus remonter :
  // l'appareil a déjà montré qu'il ne suivait pas.
  feed(governor, 5, 6, clock);
  assert.equal(governor.current().id, 'medium');
});

test('un choix explicite réarme la surveillance', () => {
  const governor = new QualityGovernor(tierById('full'));
  const { clock } = feed(governor, 60, 2);
  assert.equal(governor.current().id, 'medium');

  governor.set(tierById('full'));
  assert.equal(governor.current().id, 'full');

  // Le compteur de dégradations repart de zéro : après une seule dégradation,
  // la remontée redevient possible.
  const after = feed(governor, 60, 1, clock);
  assert.equal(governor.current().id, 'high');
  feed(governor, 5, 1, after.clock);
  assert.equal(governor.current().id, 'full');
});

test('les à-coups isolés sont ignorés par la médiane', () => {
  const governor = new QualityGovernor(tierById('high'));
  let clock = 0;
  // Une image longue sur cinq — typique d'un changement de plan — ne doit pas
  // suffire à dégrader la qualité.
  for (let i = 0; i < WINDOW * 6; i++) {
    clock += 3000;
    governor.observe(i % 5 === 0 ? 90 : 18, clock);
  }
  assert.equal(governor.current().id, 'high');
});

test('les paliers vont du plus fin au plus fluide, sans doublon', () => {
  const scales = QUALITY_TIERS.map((t) => t.scale);
  for (let i = 1; i < scales.length; i++) {
    assert.ok(scales[i] < scales[i - 1], 'les paliers devraient décroître');
  }
  assert.equal(new Set(QUALITY_TIERS.map((t) => t.id)).size, QUALITY_TIERS.length);
  assert.equal(QUALITY_TIERS[0].scale, 1, 'le palier maximal doit être à la définition de sortie');
});

test('un identifiant inconnu retombe sur un palier intermédiaire', () => {
  // @ts-expect-error valeur volontairement invalide
  assert.equal(tierById('inexistant').id, 'medium');
});

test('le filet de sécurité ignore une cadence acceptable', () => {
  const panic = new PanicDetector();
  for (let i = 0; i < 200; i++) assert.equal(panic.observe(40), false);
});

test('le filet de sécurité se déclenche sur une interface bloquée', () => {
  const panic = new PanicDetector();
  // 222 ms par image : la valeur mesurée sur un téléphone bridé au palier le
  // plus fin, où l'application cesse de répondre aux gestes.
  const triggers = Array.from({ length: 40 }, () => panic.observe(222)).filter(Boolean);
  assert.equal(triggers.length, 1, 'le secours ne doit se déclencher qu’une fois');
});

test('une image lente isolée ne déclenche rien', () => {
  const panic = new PanicDetector();
  let fired = false;
  for (let i = 0; i < 300; i++) {
    // Une image longue de temps en temps — un changement de plan — au milieu
    // d'une cadence saine ne doit jamais passer pour un blocage.
    if (panic.observe(i % 10 === 0 ? 300 : 20)) fired = true;
  }
  assert.equal(fired, false);
});

test('la remise à zéro réarme le filet de sécurité', () => {
  const panic = new PanicDetector();
  assert.ok(Array.from({ length: 40 }, () => panic.observe(222)).some(Boolean));
  panic.reset();
  assert.ok(Array.from({ length: 40 }, () => panic.observe(222)).some(Boolean), 'le secours devrait pouvoir se redéclencher');
});
