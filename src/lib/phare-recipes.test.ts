import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRecipePlan, exportRecipe, importRecipe, preflightRecipe, RECIPE_LIMITS, validateRecipe } from './phare-recipes.ts';
import type { PhareRecipe, RecipePlanInput, RecipePreflightInput } from './phare-recipes.ts';
import type { EngineManifest } from './phare-engine-registry.ts';
import type { PhareTask } from './phare-orchestration.ts';
import { assertPlanExecutable } from './phare-orchestration.ts';

const capabilities = ['text.draft', 'text.review'];
function recipe(): PhareRecipe {
  return JSON.parse(readFileSync(new URL('../../docs/le-phare/recipes/preparer-atelier.json', import.meta.url), 'utf8'));
}
function engine(id = 'fixture-engine'): EngineManifest {
  return {
    schemaVersion: 1, id, version: 'fixture-1', capabilities: [...capabilities], execution: 'local_model', installed: true, available: true,
    qualification: { status: 'tested', testedAt: '2026-11-15T10:00:00Z', evidence: 'test-fixture-only' },
    minimumRamMiB: 512, minimumVramMiB: 0, modelSizeMiB: 256, locales: ['fr'],
  };
}
function input(): RecipePreflightInput {
  return {
    allowedCapabilities: capabilities, engines: [engine()],
    resources: { availableRamMiB: 2048, availableVramMiB: null, ramReserveMiB: 1024, vramReserveMiB: 0 },
    locale: 'fr-FR', localOnly: true, sourceRefs: ['doc-private-42'], bindings: { brief: ['doc-private-42'] },
  };
}
function task(): PhareTask {
  return {
    id: 'fixture-task', idempotencyKey: 'fixture-idempotent', ownerId: 'fixture-owner', projectId: 'private-project', goal: 'Fixture only',
    sourceRefs: ['doc-private-42'], state: 'prepared', privacyMode: 'local_only', allowedPermissions: ['read_task', 'write_draft'],
    approval: { state: 'not_required', scopes: [] }, estimatedCostMinor: 0, costCeilingMinor: 0, attempt: 0,
    createdAt: '2026-11-15T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z',
  };
}
function planInput(): RecipePlanInput {
  const { sourceRefs: _sources, bindings, localOnly: _local, ...environment } = input();
  return {
    task: task(), environment, bindings,
    definitions: [{ id: 'fixture-agent', role: 'Tests only', state: 'available', execution: 'local_model', permissions: ['read_task', 'write_draft'], maxParallelRuns: 1, dataScope: 'explicit_references' }],
    assignments: {
      preparer: { agentId: 'fixture-agent', engineId: 'fixture-engine', permissions: ['read_task', 'write_draft'] },
      relire: { agentId: 'fixture-agent', engineId: 'fixture-engine', permissions: ['read_task'] },
    },
    cost: { mayCost: false, estimatedCostMinor: 0, currency: null },
  };
}

test('the fictitious method roundtrips without copying bindings, permissions or engine choice into its export', () => {
  const original = recipe(), before = structuredClone(original);
  const output = exportRecipe(original, capabilities);
  assert.deepEqual(importRecipe(output, capabilities), original);
  const prepared = preflightRecipe(original, input());
  assert.equal(prepared.state, 'qualified');
  assert.deepEqual(prepared.steps[0].inputRefs, ['doc-private-42']);
  assert.ok(!output.includes('doc-private-42'));
  assert.ok(!output.includes('fixture-engine'));
  assert.ok(!output.includes('private-project'));
  assert.ok(!output.includes('permissions'));
  assert.deepEqual(original, before);
  assert.throws(() => exportRecipe(prepared, capabilities), /Champ/);
});

test('format, schema version, method revision and externally allowed capabilities are enforced', () => {
  const valid = recipe();
  assert.throws(() => validateRecipe({ ...valid, format: 'other' }, capabilities), /Format/);
  assert.throws(() => validateRecipe({ ...valid, version: 2 }, capabilities), /version/);
  assert.throws(() => validateRecipe({ ...valid, manifest: { ...valid.manifest, version: 'latest' } }, capabilities), /Version/);
  assert.throws(() => validateRecipe(valid, ['text.draft']), /capacité/);
  assert.throws(() => importRecipe('{', capabilities), /JSON/);
});

test('executable fields, endpoints, secrets, model IDs and inline input values cannot enter a pack', () => {
  for (const extra of [{ code: 'throw new Error()' }, { endpoint: '/fixture-endpoint' }, { model: 'model-id' }, { permissions: ['network'] }, { token: 'private' }, { project: { text: 'private' } }]) {
    assert.throws(() => validateRecipe({ ...recipe(), ...extra }, capabilities), /Champ/);
    const method = recipe();
    method.steps[0] = { ...method.steps[0], ...extra };
    assert.throws(() => validateRecipe(method, capabilities), /Champ/);
  }
  const inline = recipe();
  inline.inputs[0] = { ...inline.inputs[0], value: 'actual personal brief' } as unknown as PhareRecipe['inputs'][number];
  assert.throws(() => validateRecipe(inline, capabilities), /Champ/);
});

test('dependencies reject cycles, self reference, missing nodes and duplicate step or parameter IDs', () => {
  for (const kind of ['cycle', 'self', 'missing', 'duplicate', 'input-duplicate']) {
    const method = recipe();
    if (kind === 'cycle') method.steps[0].dependsOn = ['relire'];
    if (kind === 'self') method.steps[0].dependsOn = ['preparer'];
    if (kind === 'missing') method.steps[0].dependsOn = ['absent'];
    if (kind === 'duplicate') method.steps[1].id = 'preparer';
    if (kind === 'input-duplicate') method.inputs.push({ ...method.inputs[0] });
    assert.throws(() => validateRecipe(method, capabilities));
  }
});

test('size, instruction length, step count, unsupported parameter types and unsafe identifiers are bounded', () => {
  assert.throws(() => importRecipe(' '.repeat(RECIPE_LIMITS.bytes + 1), capabilities), /64 Kio/);
  const instructions = recipe(); instructions.steps[0].instructions = 'x'.repeat(RECIPE_LIMITS.instructions + 1);
  assert.throws(() => validateRecipe(instructions, capabilities));
  const steps = recipe(); steps.steps = Array.from({ length: 13 }, (_, i) => ({ ...steps.steps[0], id: 'step-' + i }));
  assert.throws(() => validateRecipe(steps, capabilities), /12 étapes/);
  const parameter = recipe(); parameter.inputs[0].type = 'string' as 'source_ref';
  assert.throws(() => validateRecipe(parameter, capabilities), /références/);
  const unsafe = recipe(); unsafe.inputs[0].id = '__proto__';
  assert.throws(() => validateRecipe(unsafe, capabilities), /Identifiant/);
  assert.throws(() => validateRecipe(Object.assign(Object.create({ hidden: true }), recipe()), capabilities));
});

test('binding uses only caller-selected task references and rejects missing or foreign data', () => {
  assert.throws(() => preflightRecipe(recipe(), { ...input(), bindings: {} }), /requise/);
  assert.throws(() => preflightRecipe(recipe(), { ...input(), bindings: { brief: ['foreign-document'] } }), /périmètre/);
  assert.throws(() => preflightRecipe(recipe(), { ...input(), bindings: { brief: ['doc-private-42'], extra: [] } }), /inconnu/);
  assert.throws(() => preflightRecipe(recipe(), { ...input(), bindings: { brief: ['doc-private-42', 'doc-private-42'] } }), /dupliquée/);
  const original = input(), copy = structuredClone(original);
  preflightRecipe(recipe(), original);
  assert.deepEqual(original, copy);
});

test('all unavailable stages block the method and compilation rather than returning a partial executable plan', () => {
  const e = engine(); e.capabilities = ['text.draft'];
  const preflight = preflightRecipe(recipe(), { ...input(), engines: [e] });
  assert.equal(preflight.state, 'blocked'); assert.deepEqual(preflight.blockedStepIds, ['relire']);
  const options = planInput(); options.environment.engines = [e];
  assert.throws(() => compileRecipePlan(recipe(), options), /indisponibles/);
  const noMemory = preflightRecipe(recipe(), { ...input(), resources: { ...input().resources, availableRamMiB: 1500 } });
  assert.deepEqual(noMemory.blockedStepIds, ['preparer', 'relire']);
});

test('local-only rejects a remote engine even if callers provide a compatible adapter', () => {
  const remote = { ...engine(), execution: 'provider_api' as const };
  const result = preflightRecipe(recipe(), { ...input(), engines: [remote] });
  assert.equal(result.state, 'blocked');
  assert.ok(result.steps.every(step => step.selection.rejections[0].codes.includes('remote_forbidden')));
  const options = planInput(); options.environment.engines = [remote]; options.definitions = [{ ...options.definitions[0], execution: 'provider_api' }];
  assert.throws(() => compileRecipePlan(recipe(), options), /indisponibles/);
});

test('trial opt-in preserves unqualified status and does not claim qualification', () => {
  const untested = { ...engine(), qualification: { status: 'untested' as const } };
  assert.equal(preflightRecipe(recipe(), { ...input(), engines: [untested] }).state, 'blocked');
  const result = preflightRecipe(recipe(), { ...input(), engines: [untested], allowUntestedForTrial: true });
  assert.equal(result.state, 'trial'); assert.ok(result.steps.every(step => step.selection.mode === 'trial'));
});

test('the same exported method prepares for two different qualified engine adapters without changing its data', () => {
  const method = importRecipe(exportRecipe(recipe(), capabilities), capabilities);
  const before = exportRecipe(method, capabilities);
  const a = compileRecipePlan(method, planInput());
  const options = planInput(); options.environment.engines = [engine('second-fixture-engine')];
  options.assignments = Object.fromEntries(Object.entries(options.assignments).map(([id, assignment]) => [id, { ...assignment, engineId: 'second-fixture-engine' }]));
  const b = compileRecipePlan(method, options);
  assert.equal(a.state, 'prepared_only'); assert.equal(b.state, 'prepared_only');
  assert.deepEqual(a.plan, b.plan);
  assert.notEqual(a.engineBindings[0].engineId, b.engineBindings[0].engineId);
  assert.equal(exportRecipe(method, capabilities), before);
  assert.equal(options.task.state, 'prepared'); assert.equal(options.task.attempt, 0);
});

test('compilation requires application-owned assignments and validates existing orchestration permissions', () => {
  const missing = planInput(); delete (missing.assignments as Record<string, unknown>).relire;
  assert.throws(() => compileRecipePlan(recipe(), missing), /Affectations/);
  const engineMismatch = planInput(); engineMismatch.assignments.preparer.engineId = 'not-selected';
  assert.throws(() => compileRecipePlan(recipe(), engineMismatch), /raccord/);
  const executionMismatch = planInput(); executionMismatch.definitions = [{ ...executionMismatch.definitions[0], execution: 'provider_api' }];
  assert.throws(() => compileRecipePlan(recipe(), executionMismatch), /raccord/);
  const escalation = planInput(); escalation.assignments.preparer.permissions = ['send_external'];
  assert.throws(() => compileRecipePlan(recipe(), escalation), /permissions/);
});

test('extra cost object properties cannot overwrite the compiled plan or task ownership', () => {
  const options = planInput();
  options.cost = { ...options.cost, steps: [], ownerId: 'foreign-owner', taskId: 'foreign-task', version: 99 } as RecipePlanInput['cost'];
  const prepared = compileRecipePlan(recipe(), options);
  assert.equal(prepared.plan.steps.length, 2);
  assert.equal(prepared.plan.ownerId, options.task.ownerId);
  assert.equal(prepared.plan.taskId, options.task.id);
  assert.equal(prepared.plan.version, 1);
});

test('a connected plan still requires external transfer approval and a qualified cost before execution', () => {
  const options = planInput(); options.task.privacyMode = 'connected_allowed';
  options.task.allowedPermissions = ['read_task', 'provider_call', 'transmit_data'];
  options.environment.engines = [{ ...engine(), execution: 'provider_api' }];
  options.definitions = [{ ...options.definitions[0], execution: 'provider_api', permissions: ['read_task', 'provider_call', 'transmit_data'] }];
  options.assignments = Object.fromEntries(Object.entries(options.assignments).map(([id, assignment]) => [id, { ...assignment, permissions: ['read_task', 'provider_call', 'transmit_data'] }]));
  assert.throws(() => compileRecipePlan(recipe(), options), /coût/);
  options.cost = { mayCost: true, estimatedCostMinor: null, currency: null };
  const prepared = compileRecipePlan(recipe(), options);
  assert.throws(() => assertPlanExecutable(options.task, prepared.plan, options.definitions), /confirmation/);
  assert.equal(options.task.state, 'prepared');
});
