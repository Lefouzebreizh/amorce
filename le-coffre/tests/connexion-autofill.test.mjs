import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

test('la connexion reste compatible avec le gestionnaire de mots de passe', () => {
  assert.match(page, /<form[^>]+autoComplete="on"/);
  assert.match(page, /name="username"[\s\S]+autoComplete="username"/);
  assert.match(page, /name="password"[\s\S]+autoComplete="current-password"/);
  assert.doesNotMatch(page, /name="code-acces-tiroir-secret"/);
});

test('un refus conserve la valeur pour permettre sa vérification', () => {
  const brancheRefus = page.match(/if \(messageErreur\) \{([\s\S]*?)\n\s*return;/)?.[1] ?? '';
  assert.ok(brancheRefus, 'la branche de refus doit exister');
  assert.doesNotMatch(brancheRefus, /setMotDePasse\(''\)/);
  assert.match(brancheRefus, /\.select\(\)/);
});
