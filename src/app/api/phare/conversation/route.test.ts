import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GET, POST } from './route.ts';

test('private chat rejects anonymous requests and disabled billing without contacting a provider', async () => {
  const old = { hash: process.env.PHARE_ACCESS_HASH, key: process.env.GEMINI_API_KEY, enabled: process.env.PHARE_CHAT_ENABLED };
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('No network in this test'); };
  try {
    process.env.PHARE_ACCESS_HASH = createHash('sha256').update('test-private-access').digest('hex');
    process.env.GEMINI_API_KEY = 'unit-test-not-a-key'; process.env.PHARE_CHAT_ENABLED = 'false';
    assert.equal((await GET()).status, 200);
    assert.equal((await POST(new Request('http://localhost/api/phare/conversation', { method: 'POST', body: '{}' }))).status, 401);
    assert.equal((await POST(new Request('http://localhost/api/phare/conversation', { method: 'POST', headers: { Authorization: 'Bearer test-private-access' }, body: '{}' }))).status, 503);
    assert.equal(calls, 0);
    process.env.PHARE_CHAT_ENABLED = 'true';
    const request = (body: unknown, origin = 'http://localhost') => new Request('http://localhost/api/phare/conversation', { method: 'POST', headers: { Authorization: 'Bearer test-private-access', origin }, body: JSON.stringify(body) });
    const body = { message: 'Écris un refrain', context: {}, history: [] };
    assert.equal((await POST(request(body, 'https://foreign.example'))).status, 403);
    assert.equal((await POST(request({ ...body, message: 'x'.repeat(10001) }))).status, 400);
    assert.equal((await POST(request({ ...body, context: { huge: 'x'.repeat(150001) } }))).status, 413);
    assert.equal(calls, 0);
    globalThis.fetch = async () => { calls++; return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: 'Une proposition', actions: [] }) }] } }] }); };
    const response = await POST(request(body));
    assert.equal(response.status, 200); assert.equal((await response.json()).reply, 'Une proposition'); assert.equal(calls, 1);
    globalThis.fetch = async () => new Response('private provider diagnostic', { status: 429 });
    const failure = await POST(request(body)); assert.equal(failure.status, 502); assert.ok(!(await failure.text()).includes('private provider diagnostic'));
  } finally {
    globalThis.fetch = original;
    for (const [key, value] of Object.entries({ PHARE_ACCESS_HASH: old.hash, GEMINI_API_KEY: old.key, PHARE_CHAT_ENABLED: old.enabled })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
