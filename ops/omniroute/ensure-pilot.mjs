import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
if (!process.argv[2]) throw new Error('Usage: node ensure-pilot.mjs <pilot-root>');
const root = resolve(process.argv[2]);
const codexRoot = resolve(root, '..', 'OmniRouteCodex');
function running(pidName) {
  const path = join(root, '.runtime', pidName);
  if (!existsSync(path)) return false;
  const pid = Number(readFileSync(path, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error(`PID local invalide : ${pidName}`);
  try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; }
}
async function ready(url, status) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'manual' });
    await response.body?.cancel();
    return response.status === status;
  } catch { return false; }
}
async function ensure(label, url, status, script, args, pidName) {
  if (await ready(url, status)) return;
  if (!running(pidName)) {
    console.log(`Demarrage de ${label}...`);
    const r = spawnSync(process.execPath, [join(root, script), ...args], { stdio: 'inherit', timeout: 30000 });
    if (r.status !== 0 && !running(pidName)) throw new Error(`Le lancement de ${label} a echoue. Les fichiers ont ete conserves.`);
  }
  console.log(`Attente de ${label} (jusqu'a 3 minutes)...`);
  const deadline = Date.now() + 180000;
  let progressAt = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await ready(url, status)) return;
    if (Date.now() >= progressAt) { console.log(`${label} demarre encore...`); progressAt = Date.now() + 15000; }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`${label} ne repond pas encore. Consulter les journaux locaux.`);
}
await ensure('Codex', 'http://127.0.0.1:1456/readyz', 200, 'launch-codex.mjs', [root, codexRoot], 'codex-pid');
// The API bridge has no /healthz; an anonymous 401 proves it is ready and requires a key.
await ensure('OmniRoute', 'http://127.0.0.1:20129/v1/models', 401, 'launch-local.mjs', [root], 'pid');
console.log('OmniRoute est pret. Ouverture de Claude Code...');
