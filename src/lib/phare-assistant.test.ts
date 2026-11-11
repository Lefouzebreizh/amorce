import test from 'node:test';
import assert from 'node:assert/strict';
import { initialWorkspace, addEntry, parseWorkspace, mergeWorkspace } from './phare.ts';
import { applyAssistantActions, assistantContext, validateResult } from './phare-assistant.ts';
import type { AssistantAction } from './phare-assistant.ts';
const action = (kind: AssistantAction['kind'], value = '', projectId = ''): AssistantAction => ({ kind, value, projectId, section: 'Refrain' });
test('one conversation survives old backups and additive restore without overwriting profile or sources', () => {
  const old = initialWorkspace(); assert.deepEqual(parseWorkspace(JSON.stringify(old)), old);
  const current = { ...old, profile: 'Mes mots d’abord', conversation: [{ id: 'msg1', role: 'user' as const, text: 'Bonjour', created: new Date().toISOString(), projectId: old.projects[0].id }] };
  assert.deepEqual(parseWorkspace(JSON.stringify(current)), current);
  const restored = mergeWorkspace(current, current);
  assert.equal(restored.profile, current.profile);
  assert.equal(restored.conversation?.length, 2);
  assert.equal(restored.conversation?.[1].projectId, restored.projects[3].id);
  assert.notEqual(restored.conversation?.[1].id, 'msg1');
  assert.throws(() => parseWorkspace(JSON.stringify({ ...current, conversation: [{ ...current.conversation[0], role: 'system' }] })));
});
test('assistant changes are additive, routed to selected project and reversible by retaining original workspace', () => {
  const original = initialWorkspace();
  original.projects[0] = addEntry(original.projects[0], { text: 'Mes paroles', origin: 'Mes mots', source: 'Carnet', section: 'Couplet' });
  const result = applyAssistantActions(original, original.projects[0].id, [action('select_project', '', original.projects[1].id), action('keep_text', 'Une proposition'), action('next', 'Écouter le refrain')]);
  assert.equal(result.selected, original.projects[1].id);
  assert.equal(result.workspace.projects[1].entries[0].origin, 'Proposition IA');
  assert.deepEqual(result.workspace.projects[0], original.projects[0]);
  assert.equal(original.projects[1].entries.length, 0);
  assert.throws(() => applyAssistantActions(original, original.projects[0].id, [action('select_project', '', 'unknown')]));
});
test('context excludes other project texts unless cross-project search is explicitly asked', () => {
  const w = initialWorkspace();
  w.projects[1] = addEntry(w.projects[1], { text: 'Ancre secrète', origin: 'Mes mots', source: 'Mon carnet', section: 'Idée' });
  assert.equal(assistantContext(w, w.projects[0].id, 'Cherche ancre').texts.length, 0);
  assert.equal(assistantContext(w, w.projects[0].id, 'Cherche ancre dans mes projets').texts.length, 1);
});
test('malformed model output cannot introduce unknown or destructive actions', () => {
  for (const v of [null, {}, { reply: 'Bonjour', actions: [action('keep_text'), { ...action('next'), kind: 'delete_project' }] }, { reply: '', actions: [] }]) assert.throws(() => validateResult(v));
  assert.deepEqual(validateResult({ reply: 'Bonjour', actions: [] }), { reply: 'Bonjour', actions: [] });
});
