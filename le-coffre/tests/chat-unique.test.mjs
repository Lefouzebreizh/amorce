import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/app/coffre/page.tsx', import.meta.url), 'utf8');
const assistant = fs.readFileSync(new URL('../src/app/coffre/AssistantCoffre.tsx', import.meta.url), 'utf8');

test('le tableau de bord conserve un seul copilote dans le flux', () => {
  assert.equal(page.split('<AssistantCoffre').length - 1, 1, 'le tableau de bord doit monter un seul chat');
  assert.equal(page.includes('assistantOuvert') || page.includes('questionAssistant') || page.includes('demanderAAssistant'), false, 'aucun second formulaire de chat ne doit subsister');
});

test('le champ du chat reste sélectionnable dans l’aperçu, sans envoyer à Gemini', () => {
  const debutComposer = assistant.indexOf('<form onSubmit={envoyer}');
  const finComposer = assistant.indexOf('</form>', debutComposer);
  assert.ok(debutComposer >= 0 && finComposer > debutComposer, 'champ et bouton d’envoi introuvables');

  const composer = assistant.slice(debutComposer, finComposer);
  assert.equal(composer.includes('disabled={enCours}'), true, 'seul un envoi en cours doit désactiver le champ');
  assert.equal(composer.includes('disabled={modeDemo || enCours || !question.trim()}'), true, 'l’envoi doit rester désactivé en démo');

  assert.equal(assistant.includes('if (!texte || enCours || modeDemo) return;'), true, 'la démo ne doit jamais appeler Gemini');
});
