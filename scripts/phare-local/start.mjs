import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
const root = path.resolve(process.env.PHARE_LOCAL_DATA_DIR || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local', 'LePhare', 'MaMatiere') : '.phare-local'));
for (const tool of ['ffmpeg', 'ffprobe']) if (spawnSync(tool, ['-version'], { windowsHide: true }).status !== 0) { console.error(`Installe ${tool} et ajoute-le au PATH avant d’ouvrir le Studio.`); process.exit(1); }
await fs.mkdir(root, { recursive: true, mode: 0o700 });
const tokenPath = path.join(root, 'access-code');
let token; try { token = (await fs.readFile(tokenPath, 'utf8')).trim(); } catch { token = randomBytes(24).toString('base64url'); await fs.writeFile(tokenPath, token, { mode: 0o600 }); }
const port = process.env.PORT || '3010';
let lan = process.env.PHARE_LAN_IP || '';
if (!lan) { try { const settings = JSON.parse(await fs.readFile(path.join(root, 'wifi.json'), 'utf8')); lan = os.networkInterfaces()[settings.interface]?.find(a => a.family === 'IPv4' && !a.internal)?.address || ''; } catch {} }
if (lan && !/^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(lan)) throw new Error('Adresse Wi-Fi privée invalide.');
if (!/^\d{2,5}$/.test(port) || Number(port) > 65535) throw new Error('Port local invalide.');
const url = `http://localhost:${port}/phare/atelier#studio=${token}`;
function open() { if (process.env.PHARE_NO_OPEN === 'true') return; const child = process.platform === 'win32' ? spawn('explorer.exe', [url], { detached: true, stdio: 'ignore', windowsHide: true }) : process.platform === 'darwin' ? spawn('open', [url], { detached: true, stdio: 'ignore' }) : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }); child.on('error', () => console.log('Ouvre l’adresse locale affichée ci-dessus.')); child.unref(); }
async function alreadyRunning() { try { const r = await fetch(`http://127.0.0.1:${port}/api/phare/local/state`, { headers: { Cookie: `phare_local=${token}` }, signal: AbortSignal.timeout(1500) }); const data = await r.json(); return r.ok && data.version === 1 && Array.isArray(data.media); } catch { return false; } }
if (await alreadyRunning()) { console.log('Le Phare est déjà ouvert.'); open(); }
else {
  let built = false; try { await fs.access('.next/BUILD_ID'); built = true; } catch {}
  const mode = built && process.env.PHARE_DEV !== 'true' ? 'start' : 'dev';
  console.log(`\nLe Phare : http://localhost:${port}/phare/atelier\nCode local : ${token}\nBibliothèque : ${root}\nMode ${mode === 'start' ? 'préparé' : 'développement'} · aucun fournisseur de génération activé.\n`);
  if (lan) console.log(`Lien mobile personnel : http://${lan}:${port}/phare/atelier#studio=${token}`);
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, '--hostname', lan ? '0.0.0.0' : '127.0.0.1', '--port', port], { stdio: 'inherit', windowsHide: true, env: { ...process.env, PHARE_ALLOWED_LAN_HOST: lan ? `${lan}:${port}` : '', PHARE_LOCAL_DATA_DIR: root, PHARE_LOCAL_TOKEN: token, PHARE_CHAT_ENABLED: 'false' } });
  let opening = false;
  const timer = setInterval(async () => { if (!opening && await alreadyRunning()) { opening = true; clearInterval(timer); open(); } }, 1000);
  process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('error', error => { clearInterval(timer); console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { clearInterval(timer); process.exitCode = code || 0; });
}
