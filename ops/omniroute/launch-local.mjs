// Temporary local launch while the VPS identity is being verified.
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const root = resolve(process.argv[2] || '.');
const pkg = join(root, 'node_modules', 'omniroute');
if (JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version !== '3.8.50') {
  throw new Error('Expected OmniRoute 3.8.50');
}
if (existsSync(join(homedir(), '.omniroute', '.env'))) {
  throw new Error('Existing OmniRoute environment found; inspect before importing any settings');
}
const data = join(root, '.runtime');
mkdirSync(data, { recursive: true, mode: 0o700 });
const pidFile = join(data, 'pid');
if (existsSync(pidFile)) {
  const oldPid = Number(readFileSync(pidFile, 'utf8'));
  let alive = false;
  if (Number.isSafeInteger(oldPid) && oldPid > 0) {
    try { process.kill(oldPid, 0); alive = true; } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  if (alive) throw new Error('Previous pilot process still running; verify it before restarting');
}
const secretFile = join(data, 'secrets.json');
const keys = ['JWT_SECRET', 'API_KEY_SECRET', 'INITIAL_PASSWORD', 'STORAGE_ENCRYPTION_KEY'];
if (!existsSync(secretFile)) {
  writeFileSync(secretFile, JSON.stringify(Object.fromEntries(keys.map(k => [k, randomBytes(32).toString('hex')]))), { mode: 0o600, flag: 'wx' });
}
const secrets = JSON.parse(readFileSync(secretFile, 'utf8'));
if (keys.some(k => !/^[a-f0-9]{64}$/.test(secrets[k] || '')) || Object.keys(secrets).length !== keys.length) {
  throw new Error('Incomplete local secrets; preserved without modification');
}
// Do not pass provider API keys, npm credentials or other application secrets.
const allow = new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE','HOMEDRIVE','HOMEPATH','COMSPEC','PATHEXT','PROGRAMFILES','PROGRAMFILES(X86)','COMMONPROGRAMFILES','OS','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','COMPUTERNAME','USERNAME','USERDOMAIN']);
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => allow.has(k.toUpperCase())));
Object.assign(env, secrets, {
  DATA_DIR: data, NODE_ENV: 'production', HOSTNAME: '127.0.0.1',
  PORT: '20128', DASHBOARD_PORT: '20128', API_PORT: '20129', API_HOST: '127.0.0.1',
  REQUIRE_API_KEY: 'true', STORAGE_ENCRYPTION_KEY_VERSION: 'v1',
  OMNIROUTE_DISABLE_BACKGROUND_SERVICES: 'true', OMNIROUTE_ENABLE_LIVE_WS: 'false',
  OPENROUTER_PROVIDER_STATS_ENABLED: 'false', ARENA_ELO_SYNC_ENABLED: 'false',
  PRICING_SYNC_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1',
  OMNIROUTE_CLI_SKIP_REPO_ENV: '1', NO_UPDATE_NOTIFIER: '1', APP_LOG_LEVEL: 'warn',
  OMNIROUTE_SERVER_HOST: '127.0.0.1',
  ...(existsSync(join(data, 'codex-ws-token')) ? {
    OMNIROUTE_CODEX_APPSERVER_WS: 'ws://127.0.0.1:1456',
    OMNIROUTE_CODEX_APPSERVER_WS_TOKEN_FILE: join(data, 'codex-ws-token'),
    OMNIROUTE_CODEX_APPSERVER_CWD: join(data, 'codex-work'),
    OMNIROUTE_CODEX_APPSERVER_SANDBOX: 'read-only',
    OMNIROUTE_CODEX_APPSERVER_APPROVAL: 'never',
  } : {}),
});
const child = spawn(process.execPath, [join(pkg, 'bin', 'omniroute.mjs'), 'serve', '--no-open', '--no-tray', '--max-restarts', '0'], {
  cwd: root, env, detached: true, windowsHide: true,
  stdio: ['ignore', openSync(join(data, 'stdout.log'), 'a', 0o600), openSync(join(data, 'stderr.log'), 'a', 0o600)],
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('spawn', () => {
  writeFileSync(pidFile, String(child.pid), { mode: 0o600 });
  child.unref();
  console.log('Local process started. Health and authentication still require verification.');
});
