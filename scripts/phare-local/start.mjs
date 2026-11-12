import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
const root = path.resolve(process.env.PHARE_LOCAL_DATA_DIR || '.phare-local');
for (const tool of ['ffmpeg', 'ffprobe']) if (spawnSync(tool, ['-version'], { windowsHide: true }).status !== 0) { console.error(`Installe ${tool} et ajoute-le au PATH avant d’ouvrir le Studio.`); process.exit(1); }
await fs.mkdir(root, { recursive: true, mode: 0o700 });
const tokenPath = path.join(root, 'access-code');
let token; try { token = (await fs.readFile(tokenPath, 'utf8')).trim(); } catch { token = randomBytes(24).toString('base64url'); await fs.writeFile(tokenPath, token, { mode: 0o600 }); }
const port = process.env.PORT || '3010';
console.log(`\nLe Phare : http://localhost:${port}/phare/atelier\nCode local : ${token}\nBibliothèque : ${root}\nAucun fournisseur de génération activé.\n`);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], { stdio: 'inherit', env: { ...process.env, PHARE_LOCAL_DATA_DIR: root, PHARE_LOCAL_TOKEN: token, PHARE_CHAT_ENABLED: 'false' } });
process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM')); child.on('exit', code => process.exitCode = code || 0);
