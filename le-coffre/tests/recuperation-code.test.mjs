import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(
  new URL('../src/app/reinitialiser-code/page.tsx', import.meta.url),
  'utf8',
);
const fonction = fs.readFileSync(
  new URL('../supabase/functions/recuperer-code-coffre/index.ts', import.meta.url),
  'utf8',
);
const fonctionConnexion = fs.readFileSync(
  new URL('../supabase/functions/connexion-coffre/index.ts', import.meta.url),
  'utf8',
);

test('la nouvelle adresse stable peut appeler le login Supabase', () => {
  assert.match(fonctionConnexion, /"https:\/\/mon-tiroir-secret-erwann\.vercel\.app"/);
});

test('le lien de récupération ouvre toujours la page stable de changement de mot de passe', () => {
  assert.match(
    fonction,
    /const REDIRECTION = "https:\/\/coffre-puce\.vercel\.app\/reinitialiser-code"/,
  );
  assert.match(fonction, /redirect_to: REDIRECTION/);
});

test('la nouvelle adresse stable peut appeler le flux de récupération', () => {
  assert.match(fonction, /"https:\/\/mon-tiroir-secret-erwann\.vercel\.app"/);
});

test('la page attend explicitement la session PASSWORD_RECOVERY', () => {
  assert.match(page, /onAuthStateChange\(traiterEvenement\)/);
  assert.match(page, /event === 'PASSWORD_RECOVERY'/);
  assert.match(page, /subscription\.unsubscribe\(\)/);
  assert.doesNotMatch(page, /getSession\(\)\.then\(\(\{ data \}\) => setPret/);
});

test('le flux PKCE est échangé avant de proposer le nouveau mot de passe', () => {
  assert.match(page, /parametres\.get\('code'\)/);
  assert.match(page, /exchangeCodeForSession\(codePkce\)/);
  assert.match(page, /if \(error \|\| !data\.session\)/);
});

test('les jetons de récupération sont retirés de la barre d’adresse', () => {
  assert.match(page, /history\.replaceState\(\{\}, '', '\/reinitialiser-code'\)/);
});

test('le formulaire met à jour le mot de passe de la session récupérée', () => {
  assert.match(page, /updateUser\(\{ password: code \}\)/);
  assert.match(page, /autoComplete="new-password"/);
  assert.match(page, /minLength=\{12\}/);
});
