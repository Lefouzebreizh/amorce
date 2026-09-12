import assert from 'node:assert/strict';
import { test } from 'node:test';
import { construireMessageCrise, REPRISE_AUTOMATIQUE_INTERDITE } from './crisisMessage';

// Ces tests couvrent la troisième retouche du 12/09/2026 (voir l'entête de
// crisisMessage.ts) : le reflet littéral, la séquence reflet+question avant
// les ressources, et la clôture en question de sécurité. Ils prouvent que le
// code fait ce que ces règles demandent, jamais que le texte est
// cliniquement juste — ça reste la couche 4 (SECURITY.md).

test('un motif détecté est cité mot pour mot dans le reflet', () => {
  const message = construireMessageCrise('plus envie de rien');
  assert.ok(
    message.includes('Tu dis « plus envie de rien »'),
    'le message devrait citer explicitement le motif détecté',
  );
});

test('sans motif à refléter, le message retombe sur une ouverture générique', () => {
  const message = construireMessageCrise(undefined);
  assert.ok(!message.includes('Tu dis «'), "l'ouverture ne doit citer personne quand il n'y a rien à citer");
  assert.ok(
    message.startsWith('Ce que tu traverses est réel'),
    "l'ouverture générique doit rester celle déjà validée par Erwann",
  );
});

test('le libellé synthétique de la co-occurrence peur/pulsion ne doit JAMAIS être cité comme une citation', () => {
  const message = construireMessageCrise('peur de ses propres pulsions inhabituelles');
  assert.ok(
    !message.includes('Tu dis «'),
    "un libellé composé par le code n'est pas une phrase que la personne a prononcée",
  );
});

test('le reflet et la question ouverte précèdent le rappel du cadre et les ressources', () => {
  const message = construireMessageCrise('plus envie de rien');
  const positionReflet = message.indexOf('Tu dis');
  const positionCadre = message.indexOf("Je suis un outil d'accompagnement");
  const position3114 = message.indexOf('3114');
  const position15112 = message.indexOf('15 (SAMU)');
  assert.ok(positionReflet < positionCadre, 'le reflet doit arriver avant le rappel du cadre');
  assert.ok(positionCadre < position3114, "le rappel du cadre précède les ressources, jamais l'inverse");
  assert.ok(position3114 < position15112, 'le 3114 (soutien) précède le 15/112 (urgence), ordre déjà validé');
});

test('les deux ressources restent présentes et distinctes, quel que soit le motif reflété', () => {
  for (const motif of [undefined, 'plus envie de rien', 'peur de ses propres pulsions inhabituelles']) {
    const message = construireMessageCrise(motif);
    assert.ok(message.includes('3114'), 'le 3114 doit toujours être présent, sans délai ni condition');
    assert.ok(message.includes('15 (SAMU)') && message.includes('112'), 'le 15 et le 112 doivent toujours être présents');
  }
});

test("la clôture est une question de sécurité ancrée dans l'instant, pas une offre de présence", () => {
  const message = construireMessageCrise('plus envie de rien');
  assert.ok(message.trim().endsWith('Es-tu seul·e en ce moment ? Où es-tu, là ?'));
  assert.ok(!message.includes('Je suis là si tu as besoin de parler'));
});

test('la reprise automatique reste interdite après ce message', () => {
  assert.equal(REPRISE_AUTOMATIQUE_INTERDITE, true);
});
