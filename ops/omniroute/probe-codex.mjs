// Official app-server metadata only: no turn/start and no inference.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(process.argv[2]);
const require = createRequire(join(root, 'node_modules', 'omniroute', 'package.json'));
const WebSocket = require('ws');
const token = readFileSync(join(root, '.runtime', 'codex-ws-token'), 'utf8').trim();
const ws = new WebSocket('ws://127.0.0.1:1456', { headers: { Authorization: `Bearer ${token}` } });
const pending = new Map(); let id = 0;
ws.on('message', raw => { const m = JSON.parse(String(raw)); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
const timer = setTimeout(() => { console.error('Metadata probe timed out'); ws.terminate(); process.exitCode = 1; }, 25000);
function rpc(method, params) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }); }
ws.on('error', e => { console.error(e.message); clearTimeout(timer); process.exitCode = 1; });
ws.on('open', async () => {
  try {
    await rpc('initialize', { clientInfo: { name: 'omniroute_pilot_probe', version: '1.0.0' }, capabilities: { experimentalApi: false } });
    ws.send(JSON.stringify({ method: 'initialized' }));
    const account = await rpc('account/read', {});
    const rates = await rpc('account/rateLimits/read', {});
    const models = await rpc('model/list', { limit: 30 });
    const summary = { at: new Date().toISOString(), accountType: account.account?.type, planType: account.account?.planType, rates, models: models.data?.map(m => ({ id: m.id, model: m.model, isDefault: m.isDefault })) };
    writeFileSync(join(root, '.runtime', 'codex-status.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(summary));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { clearTimeout(timer); ws.close(); }
});
