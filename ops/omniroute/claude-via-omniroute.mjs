// Dedicated local gateway session; existing Claude settings stay untouched.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
if (!process.argv[2] || !process.env.APPDATA) throw new Error('Usage: node claude-via-omniroute.mjs <pilot-root> [Claude arguments]');
const root = resolve(process.argv[2]);
const packageRoot = join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code');
const nativeCli = join(packageRoot, 'bin', 'claude.exe'), cli = existsSync(nativeCli) ? nativeCli : join(packageRoot, 'cli.js');
if (!existsSync(cli)) throw new Error('Installed Claude Code CLI was not found');
let key;
try { ({ key } = JSON.parse(readFileSync(join(root, '.runtime', 'client-key.json'), 'utf8'))); }
catch { throw new Error('Cannot read the dedicated OmniRoute client key'); }
if (typeof key !== 'string' || !/^[\x21-\x7e]{16,4096}$/.test(key)) throw new Error('Invalid dedicated OmniRoute client key');
const config = join(root, '.runtime', 'claude-config');
mkdirSync(config, { recursive: true, mode: 0o700 });
const allow = new Set('PATH SYSTEMROOT WINDIR TEMP TMP LOCALAPPDATA APPDATA USERPROFILE HOMEDRIVE HOMEPATH COMSPEC PATHEXT PROGRAMFILES PROGRAMFILES(X86) COMMONPROGRAMFILES OS NUMBER_OF_PROCESSORS PROCESSOR_ARCHITECTURE COMPUTERNAME USERNAME USERDOMAIN TERM COLORTERM'.split(' '));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => allow.has(name.toUpperCase())));
const model = 'cxa/gpt-5.3-codex-spark';
Object.assign(env, {
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:20129', ANTHROPIC_AUTH_TOKEN: key,
  ANTHROPIC_MODEL: model, ANTHROPIC_DEFAULT_MODEL: model,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: model, ANTHROPIC_DEFAULT_SONNET_MODEL: model,
  ANTHROPIC_DEFAULT_OPUS_MODEL: model, ANTHROPIC_DEFAULT_FABLE_MODEL: model,
  ANTHROPIC_SMALL_FAST_MODEL: model, CLAUDE_CODE_SUBAGENT_MODEL: model,
  CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1', CLAUDE_CONFIG_DIR: config,
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
  CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1',
});
const child = spawn(cli === nativeCli ? cli : process.execPath, [...(cli === nativeCli ? [] : [cli]), ...process.argv.slice(3)], { env, stdio: 'inherit' });
child.on('error', () => { console.error('Unable to start Claude Code'); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
