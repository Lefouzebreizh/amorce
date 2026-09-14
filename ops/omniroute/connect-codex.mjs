import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(process.argv[2]); const data = join(root, '.runtime');
const base = 'http://127.0.0.1:20128';
const password = JSON.parse(readFileSync(join(data, 'secrets.json'), 'utf8')).INITIAL_PASSWORD;
const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000) });
if (!login.ok) throw new Error(`Login HTTP ${login.status}`);
const cookie = login.headers.get('set-cookie')?.split(';')[0]; if (!cookie) throw new Error('Missing login cookie');
async function api(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const json = await r.json(); if (!r.ok) throw new Error(`${method} ${path}: HTTP ${r.status} ${JSON.stringify(json)}`); return json;
}
const settings = await api('/api/settings'); if (settings.cloudEnabled !== false) throw new Error('Cloud sync is still enabled; connection not created');
// v3.8.50 creates this no-auth provider at request time from launcher ENV.
// An allowedConnections list would exclude its synthetic connection.
const keyPath = join(data, 'client-key.json'); let key;
if (existsSync(keyPath)) key = JSON.parse(readFileSync(keyPath, 'utf8'));
else { key = await api('/api/keys', 'POST', { name: 'OmniRoute PC - Spark', noLog: true }); if (!key.id || !key.key) throw new Error('Unexpected key response'); writeFileSync(keyPath, JSON.stringify(key), { flag: 'wx', mode: 0o600 }); }
await api('/api/keys/' + encodeURIComponent(key.id), 'PATCH', { modelAccessMode: 'restricted', allowedModels: ['cxa/gpt-5.3-codex-spark', 'codex-app-server/gpt-5.3-codex-spark'], allowedConnections: [], autoResolve: false, compressionEnabled: false, cacheDefaultMode: 'bypass', noLog: true });
const check = await api('/api/keys/' + encodeURIComponent(key.id));
const expectedModels = ['codex-app-server/gpt-5.3-codex-spark', 'cxa/gpt-5.3-codex-spark'];
const actualModels = Array.isArray(check.allowedModels) ? [...check.allowedModels].sort() : [];
if (check.modelAccessMode !== 'restricted' || check.autoResolve !== false ||
  !Array.isArray(check.allowedConnections) || check.allowedConnections.length !== 0 ||
  JSON.stringify(actualModels) !== JSON.stringify(expectedModels) || check.noLog !== true ||
  check.compressionEnabled !== false || check.cacheDefaultMode !== 'bypass') {
  throw new Error('Key restrictions and privacy settings not verified');
}
console.log('Client key restricted to Codex Spark and stored locally. No inference performed.');
