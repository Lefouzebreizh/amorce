import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/app/coffre/page.tsx', import.meta.url), 'utf8');

test('la saisie initiale est démontée lorsque la conversation est ouverte', () => {
  const debutSaisieInitiale = page.indexOf('{!assistantOuvert && (');
  const debutConversation = page.indexOf('{assistantOuvert && (', debutSaisieInitiale);

  assert.ok(debutSaisieInitiale >= 0, 'condition de la saisie initiale introuvable');
  assert.ok(debutConversation > debutSaisieInitiale, 'condition de la conversation introuvable');

  const saisieInitiale = page.slice(debutSaisieInitiale, debutConversation);
  assert.match(saisieInitiale, /<form[\s\S]*type="search"/);
  assert.match(saisieInitiale, /demanderAAssistant\(recherche\.trim\(\)\)/);
});
