import test from 'node:test';
import assert from 'node:assert/strict';
import { makeClipPlan, quoteClip, validateClipPlan } from './phare-production.ts';
import { spawnSync } from 'node:child_process';
test('dated quote includes all requested variants and matches remote worker without paid calls', () => {
  const plan = makeClipPlan('Le Phare');
  const q = quoteClip(plan);
  assert.equal(q.seconds, 180); assert.equal(q.music, .16);
  assert.ok(Math.abs(q.video - 37.53216) < .000001);
  const worker = spawnSync('python3', ['-c', 'import sys,json; sys.path.insert(0,"scripts/phare-production"); import worker; print(json.dumps(worker.quote(json.loads(sys.stdin.read()))))'], { input: JSON.stringify(plan), encoding: 'utf8' });
  assert.equal(worker.status, 0, worker.stderr);
  const remote = JSON.parse(worker.stdout);
  for (const field of ['video', 'music', 'indicative', 'reserve', 'seconds'] as const) assert.ok(Math.abs(remote[field] - q[field]) < .000001, field);
});
test('invalid or under-covered plans cannot be quoted as valid', () => {
  const p = makeClipPlan('Clip');
  for (const change of [{ duration: Infinity }, { takes: 0 }, { duration: 301 }, { scenes: [{ prompt: 'Mer', duration: 3 }] }]) assert.throws(() => validateClipPlan({ ...p, ...change }));
  const single = { ...p, duration: 15, takes: 1, scenes: [{ prompt: 'Mer', duration: 15 }] };
  assert.equal(quoteClip(single).seconds, 15);
});
