import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/app/coffre/page.tsx', import.meta.url), 'utf8');
const coffre = fs.readFileSync(new URL('../src/lib/coffre.ts', import.meta.url), 'utf8');
const assistant = fs.readFileSync(new URL('../supabase/functions/assistant-coffre/index.ts', import.meta.url), 'utf8');
const assistantUi = fs.readFileSync(new URL('../src/app/coffre/AssistantCoffre.tsx', import.meta.url), 'utf8');
const classement = fs.readFileSync(new URL('../supabase/functions/classer-document/index.ts', import.meta.url), 'utf8');
const formulaire = fs.readFileSync(new URL('../supabase/functions/suggerer-champs-formulaire/index.ts', import.meta.url), 'utf8');

test('la photo est une action principale visible, jamais une icône seule sur mobile', () => {
  assert.equal((page.match(/Photographier et ranger/g) || []).length, 1);
  assert.match(page, /<strong>Photographier et ranger<\/strong>/);
  assert.doesNotMatch(page, /hidden sm:inline">Photographier/);
});

test('les données de démonstration restent fictives et limitées à un aperçu Vercel', () => {
  assert.match(page, /mon-tiroir-secret-\.\+-erwannchevallier-6916s-projects/);
  assert.match(page, /modeDemoAutorise && new URLSearchParams/);
  assert.match(page, /alex\.martin@example\.invalid/);
  assert.doesNotMatch(page, /erwann@demo\.local/);
});

test('le choix Gemini gratuit et son compromis de confidentialité sont visibles', () => {
  assert.match(page, /Google peut utiliser les données transmises pour améliorer ses produits/);
  assert.match(page, /Pour ne transmettre aucun document à une IA/);
  assert.match(page, /choisis « Importer des fichiers »/);
});

test('le champ caméra déclenche le parcours intelligent direct', () => {
  const capture = page.slice(page.indexOf('ref={entreePhoto}'), page.indexOf('ref={entreeDossier}', page.indexOf('ref={entreePhoto}')));
  assert.match(capture, /capture="environment"/);
  assert.match(capture, /photographierEtRanger\(fichiers\)/);
});

test('l import classique reste séparé de l analyse intelligente', () => {
  const debutDepot = page.indexOf('async function surDepot(');
  const finDepot = page.indexOf('async function photographierEtRanger(', debutDepot);
  const depotPrive = page.slice(debutDepot, finDepot);
  assert.match(depotPrive, /analyseIntelligente\s*\?\s*await analyserDocumentPourClassement/);
  assert.match(depotPrive, /:\s*await proposerClassement/);
  assert.match(page.slice(finDepot), /analyserDocumentPourClassement\(fichier\)/);
});

test('un dossier complet peut être choisi et classé par Gemini avec une file de vérification', () => {
  const dossier = page.slice(page.indexOf('ref={entreeDossier}'), page.indexOf('<datalist', page.indexOf('ref={entreeDossier}')));
  assert.match(dossier, /webkitdirectory/);
  assert.match(dossier, /surDepot\(fichiers, true\)/);
  assert.match(page, /Analyser un dossier complet/);
  assert.match(page, /À vérifier/);
  assert.match(page, /executerAvecConcurrence\(nouveaux, analyseIntelligente \? 2/);
});

test('le copilote appelle Gemini sans envoyer la liste des documents du coffre', () => {
  assert.match(coffre, /invoke\('assistant-coffre'/);
  assert.match(coffre, /body: \{ question, historique, piecesJointes \}/);
  assert.doesNotMatch(coffre, /documents: digestIndex\(index\)/);
  assert.doesNotMatch(coffre, /return repliLocal/);
  assert.match(assistant, /const MODELE = "gemini-2\.5-flash"/);
  assert.match(assistantUi, /documentsDisponibles/);
});

test('Gemini ne reçoit que les pièces jointes choisies, sous des types et une taille bornés', () => {
  assert.match(assistant, /piecesJointes\?: PieceJointe\[\]/);
  assert.match(assistant, /TYPES_JOINTS/);
  assert.match(assistant, /MAX_TAILLE_JOINTES/);
  assert.match(assistant, /inlineData: \{ mimeType: piece.type, data: piece.donnees \}/);
  assert.match(assistant, /nomsSelectionnes/);
});

test('la fonction LLM utilise le modèle généraliste actuel et ses outils', () => {
  assert.match(assistant, /const MODELE = "gemini-2\.5-flash"/);
  assert.match(assistant, /googleSearch/);
  assert.match(assistant, /GEMINI_API_KEY/);
  assert.match(assistant, /vrai copilote généraliste/);
});

test('aucune fonction IA du coffre ne dépend encore de Claude', () => {
  for (const fonction of [assistant, classement, formulaire]) {
    assert.match(fonction, /const MODELE = "gemini-2\.5-flash"/);
    assert.match(fonction, /GEMINI_API_KEY/);
    assert.doesNotMatch(fonction, /ANTHROPIC_API_KEY|api\.anthropic\.com|claude-sonnet/);
  }
});

test('les trois fonctions Gemini exigent une vraie session utilisateur', () => {
  for (const fonction of [assistant, classement, formulaire]) {
    assert.match(fonction, /\/auth\/v1\/user/);
    assert.match(fonction, /Session utilisateur requise/);
    assert.match(fonction, /verification\.ok/);
  }
});

test('les aperçus Vercel du coffre peuvent appeler les trois fonctions Gemini', () => {
  for (const fonction of [assistant, classement, formulaire]) {
    assert.match(fonction, /const ORIGINE_APERCU_VERCEL/);
    assert.match(fonction, /erwannchevallier-6916s-projects\\\.vercel\\\.app/);
    assert.match(fonction, /ORIGINE_APERCU_VERCEL\.test\(origin\)/);
    assert.match(fonction, /origin && origineAutorisee\(origin\)/);
  }
});
