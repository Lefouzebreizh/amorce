import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(process.argv[2]); const data = join(root, '.runtime');
const require = createRequire(join(root, 'node_modules', 'omniroute', 'package.json'));
const WebSocket = require('ws'); const token = readFileSync(join(data, 'codex-ws-token'), 'utf8').trim();
const ws = new WebSocket('ws://127.0.0.1:1456', { headers: { Authorization: `Bearer ${token}` } });
const pending = new Map(); let id = 0;
const timer = setTimeout(() => { console.error('Direct turn timed out'); ws.terminate(); process.exitCode = 1; }, 45000);
function rpc(method, params) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }); }
ws.on('error', e => { console.error(e.message); clearTimeout(timer); process.exitCode = 1; });
ws.on('message', raw => {
  const m = JSON.parse(String(raw)); const p = pending.get(m.id);
  if (p) { pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'error') console.log(JSON.stringify({ event: m.method, error: m.params?.error }));
  if (m.method === 'item/completed' && m.params?.item?.type === 'agentMessage') console.log(JSON.stringify({ event: m.method, text: m.params.item.text?.slice(0, 100) }));
  if (m.method === 'turn/completed') { console.log(JSON.stringify({ event: m.method, status: m.params?.turn?.status, error: m.params?.turn?.error })); clearTimeout(timer); ws.close(); }
});
ws.on('open', async () => {
  try {
    await rpc('initialize', { clientInfo: { name: 'omniroute_direct_probe', version: '1.0.0' }, capabilities: { experimentalApi: false } }); ws.send(JSON.stringify({ method: 'initialized' }));
    const r = await rpc('thread/start', { model: process.argv[3] || 'gpt-5.3-codex-spark', modelProvider: 'openai', cwd: join(data, 'codex-work'), approvalPolicy: 'never', sandbox: 'read-only', ephemeral: true });
    await rpc('turn/start', { threadId: r.thread.id, effort: 'low', input: [{ type: 'text', text: 'Reply only OK. Do not use tools or read files.', text_elements: [] }] });
  } catch (e) { console.error(e.message); clearTimeout(timer); ws.close(); process.exitCode = 1; }
});
