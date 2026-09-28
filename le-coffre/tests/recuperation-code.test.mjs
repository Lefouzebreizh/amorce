import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(
  new URL('../src/app/reinitialiser-code/page.tsx', import.meta.url),
  'utf8',
);
const accueil = fs.readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const coffre = fs.readFileSync(new URL('../src/app/coffre/page.tsx', import.meta.url), 'utf8');
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

test('un lien de récupération ne redirige pas vers le coffre sans afficher le formulaire', () => {
  assert.match(accueil, /event === 'PASSWORD_RECOVERY'\) transmettreLeLien\(\)/);
  assert.match(accueil, /recherche\.has\('code'\)/);
  assert.match(accueil, /recherche\.get\('flux'\) === 'reinitialisation'/);
  assert.match(accueil, /fragment\.get\('type'\) === 'recovery'/);
  assert.match(accueil, /routeur\.replace\(`\/reinitialiser-code\$\{url\}`\)/);
});

test('sur mobile, la vidéo garde une zone visuelle distincte du texte', () => {
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*?\.coffre-mer__image \{ height: 66%;[^}]*object-position: 52% 43%/);
  assert.match(styles, /\.coffre-mer \{ min-height: 44rem/);
});

test('les champs et le module des rendez-vous restent lisibles en thème clair', () => {
  assert.match(coffre, /id="rendez-vous"[\s\S]*?<Champ name="libelle"/);
  assert.match(styles, /\.coffre-page \.studio-module input,[\s\S]*?background: #ffffff !important;[\s\S]*?color: #183247 !important/);
  assert.match(styles, /\.coffre-page \.studio-module input\[type='date'\][\s\S]*?color-scheme: light/);
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
  assert.match(page, /messageErreurMiseAJourMotDePasse\(error\)/);
  assert.match(page, /autoComplete="new-password"/);
  assert.match(page, /minLength=\{12\}/);
});
