import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEngine, validateEngineRegistry } from './phare-engine-registry.ts';
import type { EngineManifest, EngineRequest, EngineResources } from './phare-engine-registry.ts';

const resources: EngineResources = { availableRamMiB: 8192, availableVramMiB: null, ramReserveMiB: 2048, vramReserveMiB: 0 };
const request: EngineRequest = { capability: 'text.draft', locale: 'fr-FR', localOnly: true };
function engine(id: string, patch: Partial<EngineManifest> = {}): EngineManifest {
  return {
    schemaVersion: 1, id, version: 'fixture-1', capabilities: ['text.draft'], execution: 'local_model', installed: true, available: true,
    qualification: { status: 'tested', testedAt: '2026-11-15T10:00:00Z', evidence: 'fixture:test-only' },
    minimumRamMiB: 4096, minimumVramMiB: 0, modelSizeMiB: 2048, locales: ['fr'], ...patch,
  };
}

test('a text engine never satisfies a video request; an empty registry stays unavailable', () => {
  const r = selectEngine({ ...request, capability: 'video.generate' }, [engine('text')], resources);
  assert.equal(r.selected, null); assert.equal(r.mode, 'unavailable');
  assert.deepEqual(r.rejections[0].codes, ['capability_missing']);
  assert.equal(selectEngine(request, [], resources).selected, null);
});

test('local only refuses remote and does not pretend an absent model was installed', () => {
  const r = selectEngine(request, [engine('remote', { execution: 'provider_api' }), engine('missing', { installed: false })], resources);
  assert.equal(r.selected, null);
  assert.deepEqual(r.rejections.map(x => x.codes), [['remote_forbidden'], ['not_installed']]);
  assert.equal(selectEngine({ ...request, localOnly: false }, [engine('remote', { execution: 'provider_api', minimumRamMiB: null, minimumVramMiB: null })], { ...resources, availableRamMiB: null }).selected?.id, 'remote');
});

test('memory reserve applies to live free memory, not model disk size', () => {
  const r = selectEngine(request, [engine('large-runtime', { minimumRamMiB: 7000, modelSizeMiB: 1 }), engine('fits', { minimumRamMiB: 6144, modelSizeMiB: 9999 })], resources);
  assert.equal(r.selected?.id, 'fits');
  assert.deepEqual(r.rejections[0].codes, ['ram_insufficient']);
  assert.equal(selectEngine(request, [engine('fits')], { ...resources, availableRamMiB: null }).rejections[0].codes[0], 'ram_available_unknown');
});

test('unknown requirements and unknown GPU memory block, while explicit CPU execution permits absent VRAM', () => {
  assert.equal(selectEngine(request, [engine('unknown', { minimumRamMiB: null })], resources).rejections[0].codes[0], 'ram_requirement_unknown');
  assert.equal(selectEngine(request, [engine('gpu', { minimumVramMiB: 4000 })], resources).rejections[0].codes[0], 'vram_available_unknown');
  assert.equal(selectEngine(request, [engine('unknown-gpu', { minimumVramMiB: null })], resources).rejections[0].codes[0], 'vram_requirement_unknown');
  assert.equal(selectEngine(request, [engine('cpu')], resources).selected?.id, 'cpu');
});

test('trial opt-in preserves the fact a model is not qualified', () => {
  const untested = engine('trial', { qualification: { status: 'untested' } });
  assert.equal(selectEngine(request, [untested], resources).rejections[0].codes[0], 'not_qualified');
  const r = selectEngine({ ...request, allowUntestedForTrial: true }, [untested], resources);
  assert.equal(r.selected?.id, 'trial'); assert.equal(r.mode, 'trial');
  assert.equal(untested.qualification.status, 'untested');
});

test('stable selection respects explicit preference and never ranks a bigger model as better', () => {
  const engines = [engine('zeta', { modelSizeMiB: 1 }), engine('alpha', { modelSizeMiB: 9000 })];
  assert.equal(selectEngine(request, engines, resources).selected?.id, 'alpha');
  assert.equal(selectEngine(request, [...engines].reverse(), resources).selected?.id, 'alpha');
  assert.equal(selectEngine({ ...request, preferredEngineIds: ['missing', 'zeta'] }, engines, resources).selected?.id, 'zeta');
  assert.equal(engines[0].id, 'zeta');
});

test('locale routing supports regional variants but does not invent unsupported languages', () => {
  assert.equal(selectEngine({ ...request, locale: 'en' }, [engine('fr')], resources).rejections[0].codes[0], 'locale_unsupported');
  assert.equal(selectEngine({ ...request, locale: 'fr-CA' }, [engine('fr')], resources).selected?.id, 'fr');
  assert.equal(selectEngine({ ...request, locale: 'fr' }, [engine('region', { locales: ['fr-FR'] })], resources).selected, null);
});

test('duplicate IDs, invalid numbers and qualified models without evidence fail visibly', () => {
  assert.throws(() => validateEngineRegistry([engine('same'), engine('same', { version: '2' })]), /dupliqué/);
  for (const value of [-1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => selectEngine(request, [engine('bad', { minimumRamMiB: value })], resources));
    assert.throws(() => selectEngine(request, [engine('ok')], { ...resources, ramReserveMiB: value }));
  }
  assert.throws(() => validateEngineRegistry([engine('no-proof', { qualification: { status: 'tested' } })]), /preuve/);
  assert.throws(() => validateEngineRegistry([engine('bad-date', { qualification: { status: 'tested', testedAt: 'wrong', evidence: 'fixture' } })]), /Date/);
});

test('unavailable models are rejected and validation never mutates input manifests', () => {
  const model = engine('off', { available: false }); const original = structuredClone(model);
  const r = selectEngine(request, [model], resources);
  assert.deepEqual(r.rejections[0].codes, ['not_available']); assert.deepEqual(model, original);
  assert.throws(() => selectEngine({ ...request, preferredEngineIds: ['x', 'x'] }, [], resources), /doublon/);
  assert.throws(() => selectEngine({ ...request, preferredEngineIds: null as unknown as string[] }, [], resources), /Préférences/);
});
