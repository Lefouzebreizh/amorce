import test from 'node:test';
import assert from 'node:assert/strict';
import { initialWorkspace, addEntry } from './phare.ts';
import { CAPABILITIES, routeLocalCommand } from './phare-capabilities.ts';
test('internal note and resume commands work without any provider and preserve original text', () => {
  const w = initialWorkspace();
  const result = routeLocalCommand(w, w.projects[0].id, 'note : Mes mots sans les réécrire !')!;
  assert.equal(result.workspace.projects[0].entries[0].text, 'Mes mots sans les réécrire !');
  assert.equal(result.workspace.projects[0].entries[0].origin, 'Mes mots');
  assert.equal(w.projects[0].entries.length, 0);
  const resume = routeLocalCommand(result.workspace, w.projects[1].id, 'On reprend « Le Phare »')!;
  assert.equal(resume.selected, w.projects[0].id); assert.match(resume.reply, /1 texte/);
});
test('internal search changes scope only when asked and production command never submits a job', () => {
  const w = initialWorkspace();
  w.projects[1] = addEntry(w.projects[1], { text: 'Mon ancre', origin: 'Mes mots', source: 'Carnet', section: 'Idée' });
  assert.match(routeLocalCommand(w, w.projects[0].id, 'cherche : ancre')!.reply, /Aucun résultat/);
  assert.match(routeLocalCommand(w, w.projects[0].id, 'cherche dans mes projets : ancre')!.reply, /Ça va[\s\S]*Mes mots[\s\S]*Carnet/);
  const production = routeLocalCommand(w, w.projects[0].id, 'prépare mon clip')!;
  assert.equal(production.production, true); assert.equal(production.workspace, w); assert.match(production.reply, /Aucune génération/);
  assert.equal(routeLocalCommand(w, w.projects[0].id, 'Écris toute la chanson'), null);
  assert.ok(CAPABILITIES.filter(c => ['produce','devices','assistant'].includes(c.id)).every(c => c.state === 'À connecter'));
});
