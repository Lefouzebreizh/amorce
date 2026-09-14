import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const root = resolve(process.argv[2]);
const cliRoot = resolve(process.argv[3]);
const data = join(root, '.runtime');
mkdirSync(join(data, 'codex-work'), { recursive: true, mode: 0o700 });
const tokenPath = join(data, 'codex-ws-token');
if (!existsSync(tokenPath)) writeFileSync(tokenPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
if (!/^[a-f0-9]{64}$/.test(readFileSync(tokenPath, 'utf8'))) throw new Error('Invalid capability token; preserved');
const pidPath = join(data, 'codex-pid');
if (existsSync(pidPath)) {
  const pid = Number(readFileSync(pidPath, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Invalid previous PID');
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch (e) { if (e.code !== 'ESRCH') throw e; }
  if (alive) throw new Error('Previous Codex process still running');
}
const child = spawn(process.execPath, [join(cliRoot, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
  'app-server', '--listen', 'ws://127.0.0.1:1456', '--ws-auth', 'capability-token', '--ws-token-file', tokenPath,
  '-c', 'model_provider="openai"', '-c', 'sandbox_mode="read-only"', '-c', 'approval_policy="never"',
  '-c', 'analytics.enabled=false'], {
  cwd: join(data, 'codex-work'), detached: true, windowsHide: true,
  stdio: ['ignore', openSync(join(data, 'codex-stdout.log'), 'a', 0o600), openSync(join(data, 'codex-stderr.log'), 'a', 0o600)],
});
child.on('error', e => { console.error(e.message); process.exitCode = 1; });
child.on('spawn', () => {
  writeFileSync(pidPath, String(child.pid), { mode: 0o600 });
  child.unref();
  console.log('Codex app-server started; authentication and quota still require verification.');
});
