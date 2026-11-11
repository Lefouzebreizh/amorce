import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, initialWorkspace, mergeWorkspace, parseWorkspace, searchEntries } from './phare.ts';

test('variant preserves original, provenance and project boundaries', () => {
  const workspace = initialWorkspace();
  const first = addEntry(workspace.projects[0], { text: 'Je garde le fil', origin: 'Mes mots', source: 'Carnet personnel', section: 'Refrain' });
  const variant = addEntry(first, { text: 'Je retrouve le fil', origin: 'Proposition IA', source: 'Suggestion dans la conversation', section: 'Refrain' }, first.entries[0].id);
  assert.equal(first.entries.length, 1);
  assert.equal(variant.entries[0].text, 'Je garde le fil');
  assert.equal(variant.entries[1].parentId, first.entries[0].id);
  assert.equal(workspace.projects[1].entries.length, 0);
  assert.throws(() => addEntry(workspace.projects[1], variant.entries[1], first.entries[0].id));
});
test('backup roundtrip and additive restore never replace current projects', () => {
  const workspace = initialWorkspace();
  assert.deepEqual(parseWorkspace(JSON.stringify(workspace)), workspace);
  const merged = mergeWorkspace(workspace, workspace);
  assert.equal(merged.projects.length, 6);
  assert.deepEqual(merged.projects.slice(0, 3), workspace.projects);
  assert.notEqual(merged.projects[3].id, workspace.projects[0].id);
});
test('reject invalid backups, unsupported schemas and cross-project lineage', () => {
  for (const raw of ['null', '{}', '{', '{"version":2,"projects":[]}', 'x'.repeat(2_000_001)]) assert.throws(() => parseWorkspace(raw));
  const workspace = initialWorkspace();
  workspace.projects[0] = addEntry(workspace.projects[0], { text: 'Texte', origin: 'Mes mots', source: 'Carnet', section: 'Idée' });
  workspace.projects[0].entries[0].parentId = 'absent';
  assert.throws(() => parseWorkspace(JSON.stringify(workspace)));
});
test('search ignores accents and keeps rejected entries retrievable', () => {
  let project = initialWorkspace().projects[0];
  project = addEntry(project, { text: 'Écouter sans juger', origin: 'Mes mots', source: 'Carnet', section: 'Couplet' });
  project.entries[0].status = 'Écarté';
  assert.equal(searchEntries(project, 'ecouter ecarte').length, 1);
  assert.equal(searchEntries(project, 'autre').length, 0);
});
