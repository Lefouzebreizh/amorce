import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTaskHandoff, readSchedulerRow, readVerifiedHandoff, handoffDigest, HANDOFF_HANDLER, SCHEDULER_SOURCE_SHA256 } from './phare-task-handoff.ts';
import type { SchedulerRow } from './phare-task-handoff.ts';
import type { PhareRecipe, RecipePlanInput } from './phare-recipes.ts';
import type { EngineManifest } from './phare-engine-registry.ts';

function recipe(): PhareRecipe {
  return { format: 'le-phare-recipe', version: 1, manifest: { id: 'fixture-audit', title: 'Fixture only', version: '1.0.0', author: 'Test', license: 'CC0-1.0' }, inputs: [{ id: 'brief', title: 'Selected fixture', type: 'source_ref', required: true }], steps: [{ id: 'verify', capability: 'fixtures.verify', dependsOn: [], inputIds: ['brief'], instructions: 'Vérifier les références synthétiques sélectionnées.', outputKind: 'fixture-audit' }] };
}
function options(): RecipePlanInput {
  const engine: EngineManifest = { schemaVersion: 1, id: 'fixture-audit-engine', version: '1.0.0', capabilities: ['fixtures.verify'], execution: 'deterministic_local', installed: true, available: true, qualification: { status: 'tested', testedAt: '2026-11-15T10:00:00Z', evidence: 'fixture:test-only' }, minimumRamMiB: 32, minimumVramMiB: 0, modelSizeMiB: 0, locales: ['fr'] };
  return {
    task: { id: 'task-fixture', idempotencyKey: 'once-fixture', ownerId: 'owner-fixture', projectId: 'project-fixture', goal: 'Synthetic audit', sourceRefs: ['fixture:brief'], state: 'prepared', privacyMode: 'local_only', allowedPermissions: ['read_task'], approval: { state: 'not_required', scopes: [] }, estimatedCostMinor: 0, costCeilingMinor: 0, attempt: 0, createdAt: '2026-11-15T10:00:00Z', updatedAt: '2026-11-15T10:00:00Z' },
    environment: { allowedCapabilities: ['fixtures.verify'], engines: [engine], resources: { availableRamMiB: 1024, availableVramMiB: null, ramReserveMiB: 128, vramReserveMiB: 0 }, locale: 'fr' },
    bindings: { brief: ['fixture:brief'] }, definitions: [{ id: 'fixture-audit-agent', role: 'Test only', state: 'available', execution: 'deterministic_local', permissions: ['read_task'], maxParallelRuns: 1, dataScope: 'explicit_references' }], assignments: { verify: { agentId: 'fixture-audit-agent', engineId: engine.id, permissions: ['read_task'] } }, cost: { mayCost: false, estimatedCostMinor: 0, currency: null },
  };
}
function row(): SchedulerRow {
  const h = prepareTaskHandoff(recipe(), options());
  return { id: 'scheduler-fixture-id', projet: h.projet, type: h.nom, payload: h.payload, etat: 'terminee', checkpoint: { phase: 'references_selected', count: 1 }, resultat: { format: 'phare-synthetic-reference-audit-result', version: 1, synthetic: true, taskId: h.payload.task.id, ownerId: h.payload.task.ownerId, projectId: h.projet, stepId: h.payload.stepId, sources: [{ ref: 'fixture:brief', size: 10, sha256: 'a'.repeat(64) }], networkUsed: false, originalsChanged: false }, erreur: null, date: '2026-11-15T10:00:00+00:00' };
}

test('preparation targets the exact scheduler signature and never starts, mutates or exports private contents', () => {
  const o = options(), before = structuredClone(o), h = prepareTaskHandoff(recipe(), o);
  assert.equal(h.nom, HANDOFF_HANDLER); assert.equal(h.schedulerSourceSha256, SCHEDULER_SOURCE_SHA256);
  assert.equal(h.delai_secondes, 5); assert.equal(h.lourd, false);
  assert.deepEqual(h.payload.sourceRefs, ['fixture:brief']); assert.deepEqual(o, before);
  assert.equal(Object.hasOwn(h.payload, 'instructions'), false);
  assert.equal(Object.hasOwn(h.payload, 'command'), false);
  assert.equal(Object.hasOwn(h.payload, 'path'), false);
});

test('all unsupported graph, capability, permission and model choices fail closed', () => {
  const multi = recipe(); multi.steps.push({ ...multi.steps[0], id: 'second' });
  const m = options(); m.assignments = { ...m.assignments, second: { ...m.assignments.verify } };
  assert.throws(() => prepareTaskHandoff(multi, m), /une étape/);
  const p = options(); p.task.allowedPermissions.push('write_draft'); p.definitions[0].permissions.push('write_draft'); p.assignments.verify.permissions.push('write_draft');
  assert.throws(() => prepareTaskHandoff(recipe(), p), /permission/);
  const model = options(); model.environment.engines = [{ ...model.environment.engines[0], execution: 'local_model' }]; model.definitions[0].execution = 'local_model';
  assert.throws(() => prepareTaskHandoff(recipe(), model), /moteur/);
  const other = recipe(); other.steps[0].capability = 'text.draft';
  assert.throws(() => prepareTaskHandoff(other, options()), /capacité/);
});

test('current state, resource headroom, qualification, cost and owner identifiers are revalidated before handoff', () => {
  const running = options(); running.task.state = 'running';
  assert.throws(() => prepareTaskHandoff(recipe(), running), /préparée/);
  const low = options(); low.environment.resources.availableRamMiB = 1;
  assert.throws(() => prepareTaskHandoff(recipe(), low), /indisponibles/);
  const trial = options(); trial.environment.allowUntestedForTrial = true;
  assert.throws(() => prepareTaskHandoff(recipe(), trial), /essai/);
  const cost = options(); cost.cost.estimatedCostMinor = null;
  assert.throws(() => prepareTaskHandoff(recipe(), cost), /inconnu/);
  const owner = options(); owner.task.ownerId = '../foreign';
  assert.throws(() => prepareTaskHandoff(recipe(), owner), /propriétaire/);
});

test('SQLite state mapping never turns terminee into verified completion on its own', () => {
  const h = prepareTaskHandoff(recipe(), options());
  assert.equal(readSchedulerRow(row(), h).state, 'needs_verification');
  for (const [etat, state] of [['en_attente', 'prepared'], ['en_cours', 'running'], ['erreur', 'failed'], ['annulee', 'cancelled'], ['interrompue', 'interrupted']] as const) assert.equal(readSchedulerRow({ ...row(), etat }, h).state, state);
  assert.throws(() => readSchedulerRow({ ...row(), etat: 'unknown' }, h), /inconnu/);
});

test('foreign task, owner, project, malformed row or unchecked completion receipts are refused', () => {
  const h = prepareTaskHandoff(recipe(), options());
  const foreign = row(); (foreign.payload as typeof h.payload).task.ownerId = 'foreign';
  assert.throws(() => readSchedulerRow(foreign, h), /étranger/);
  assert.throws(() => readSchedulerRow({ ...row(), projet: 'other' }, h), /étranger/);
  assert.throws(() => readSchedulerRow({ ...row(), extra: true }, h), /Schéma/);
  const receipt = { state: 'succeeded', verified: true, signature: handoffDigest(h), newTasks: 1, row: row() };
  assert.equal(readVerifiedHandoff(receipt, h).state, 'completed');
  assert.throws(() => readVerifiedHandoff({ ...receipt, verified: false }, h), /non vérifié/);
  assert.throws(() => readVerifiedHandoff({ ...receipt, signature: 'b'.repeat(64) }, h), /non vérifié/);
  const changed = row(); (changed.resultat as { ownerId: string }).ownerId = 'foreign';
  assert.throws(() => readVerifiedHandoff({ ...receipt, row: changed }, h), /incompatible/);
});

test('real pinned Python scheduler roundtrip: selected sources, persistent result and idempotent second submission', { skip: !process.env.PHARE_SCHEDULER_REFERENCE }, () => {
  const root = mkdtempSync(join(tmpdir(), 'phare-handoff-'));
  try {
    const h = prepareTaskHandoff(recipe(), options());
    const sourceRoot = join(root, 'sources');
    mkdirSync(sourceRoot);
    const content = Buffer.from('Donnée synthétique : atelier fictif.\n');
    writeFileSync(join(sourceRoot, 'brief.txt'), content);
    writeFileSync(join(sourceRoot, 'PHARE_HANDOFF_FIXTURES.json'), JSON.stringify({ format: 'phare-handoff-fixtures', version: 1, synthetic: true, ownerId: h.payload.task.ownerId, projectId: h.projet, sources: [{ ref: 'fixture:brief', name: 'brief.txt', size: content.length, sha256: createHash('sha256').update(content).digest('hex') }] }));
    const submission = join(root, 'submission.json'); writeFileSync(submission, JSON.stringify(h));
    const args = [fileURLToPath(new URL('../../scripts/phare-task-handoff/bridge.py', import.meta.url)), '--submission', submission, '--sources', sourceRoot, '--registry', join(root, 'state', 'tasks.sqlite'), '--scheduler-source', process.env.PHARE_SCHEDULER_REFERENCE!, '--owner', h.payload.task.ownerId, '--project', h.projet, '--synthetic-only'];
    const python = process.env.PHARE_TEST_PYTHON || 'python3';
    const first = JSON.parse(execFileSync(python, args, { encoding: 'utf8', timeout: 10000 }));
    assert.equal(readVerifiedHandoff(first, h).state, 'completed'); assert.equal(first.newTasks, 1);
    const second = JSON.parse(execFileSync(python, args, { encoding: 'utf8', timeout: 10000 }));
    assert.equal(readVerifiedHandoff(second, h).reused, true); assert.equal(second.newTasks, 0); assert.equal(first.row.id, second.row.id);
    assert.deepEqual(readFileSync(join(sourceRoot, 'brief.txt')), content);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
