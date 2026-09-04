/**
 * L'application, conduite sur des **vrais chats**.
 *
 * `epreuve.mjs` compare deux moteurs sur des signaux fabriqués, au bit près.
 * Celui-ci pose l'autre question, la seule qui compte pour un utilisateur :
 * **les deux chaînes concluent-elles la même chose sur du son réel ?**
 *
 * L'égalité bit pour bit est ici hors de portée, et c'est voulu. Les fichiers
 * sont en 44,1 kHz : ffmpeg les rééchantillonne d'un côté, le navigateur de
 * l'autre, avec deux filtres différents. Exiger le bit reviendrait à exiger
 * que deux filtres soient le même filtre.
 *
 * Mesuré le 04/09/2026 sur les 60 fichiers d'ESC-50 — 40 chats, 20 témoins :
 * **60 verdicts identiques sur 60**. Les deux rééchantillonnages divergent
 * dans les décimales et la décision ne bouge pas.
 *
 * Le corpus n'est pas versionné (CC BY-NC, et binaire). Le récupérer et
 * produire la référence d'abord :
 *
 *     python3 chat-traducteur/scripts/mesurer_esc50.py
 *     python3 chat-traducteur/web/outils/engendrer-temoins-corpus.py
 *     npm run bati && node outils/epreuve-corpus.mjs
 *
 * Code 0 vert, 1 rouge, 3 non effectué.
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const RACINE = resolve(import.meta.dirname, '..');
const CORPUS = join(RACINE, '..', '.fixtures', 'esc50');
const REFERENCE = join(RACINE, '..', '.fixtures', 'esc50-python.json');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

for (const [quoi, chemin] of [
  ['Chromium', CHROME],
  ['le modèle yamnet.tflite', join(RACINE, '..', 'modeles', 'yamnet.tflite')],
  ['les dépendances (npm install)', join(RACINE, 'node_modules', '@tensorflow')],
  ['le bâti (npm run bati)', join(RACINE, 'dist', 'verdict.js')],
  ['le corpus (scripts/mesurer_esc50.py)', CORPUS],
  ['la référence (outils/engendrer-temoins-corpus.py)', REFERENCE],
]) {
  if (!existsSync(chemin)) { console.log(`⊘ non effectué : ${quoi} est absent.`); process.exit(3); }
}

const { chromium } = await import(join(RACINE, '..', '..', 'node_modules', 'playwright', 'index.mjs'));
const TF = join(RACINE, 'node_modules', '@tensorflow');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript',
  '.json':'application/json', '.wasm':'application/wasm', '.tflite':'application/octet-stream' };
const ALIAS = {
  '/page/modeles/': join(RACINE, '..', 'modeles'),
  '/page/wasm/': join(TF, 'tfjs-tflite', 'wasm'),
  '/page/donnees/': join(RACINE, 'donnees'),
  '/page/dist/': join(RACINE, 'dist'),
  '/page/tf/tf-core.js': join(TF, 'tfjs-core', 'dist', 'tf-core.js'),
  '/page/tf/tf-backend-cpu.js': join(TF, 'tfjs-backend-cpu', 'dist', 'tf-backend-cpu.js'),
  '/page/tf/tf-tflite.js': join(TF, 'tfjs-tflite', 'dist', 'tf-tflite.js'),
};

const serveur = createServer(async (req, res) => {
  const url = decodeURI(req.url.split('?')[0]);
  let chemin = null;
  for (const [p, c] of Object.entries(ALIAS)) {
    if (url === p) { chemin = c; break; }
    if (p.endsWith('/') && url.startsWith(p)) { chemin = join(c, normalize(url.slice(p.length))); break; }
  }
  if (!chemin) chemin = join(RACINE, normalize(url));
  try {
    const o = await readFile(chemin);
    res.writeHead(200, { 'content-type': TYPES[extname(chemin)] ?? 'application/octet-stream' });
    res.end(o);
  } catch { res.writeHead(404); res.end('non'); }
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const port = serveur.address().port;

const py = JSON.parse(await readFile(REFERENCE, 'utf-8'));
const nav = await chromium.launch({ executablePath: CHROME });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/page/index.html`);
await page.waitForFunction('window.appliPrete === true', { timeout: 180_000 });

const fichiers = (await readdir(CORPUS)).filter((f) => f.endsWith('.wav')).sort();
let accord = 0;
const desaccords = [];
for (const f of fichiers) {
  const octets = await readFile(join(CORPUS, f));
  const r = await page.evaluate(async (o) => {
    await window.ecouterOctets(new Uint8Array(o).buffer);
    return { v: window.dernierVerdict(), n: window.nbFenetres() };
  }, Array.from(octets));
  if (r.v.intention === py[f].intention) accord++;
  else desaccords.push([f, py[f].intention, r.v.intention, py[f].fenetres, r.n]);
}

await nav.close();
serveur.close();

console.log(`  ${desaccords.length === 0 ? '✓' : '✗'} corpus réel  ` +
  `${accord}/${fichiers.length} verdicts identiques au Python`);
for (const [f, a, b, fa, fb] of desaccords)
  console.log(`      ${f.padEnd(26)} python ${a.padEnd(13)} navigateur ${b.padEnd(13)} (${fa} vs ${fb} fenêtres)`);
if (erreurs.length) { console.log('      erreurs de page :'); erreurs.slice(0, 3).forEach((e) => console.log('       ', e)); }
process.exit(desaccords.length === 0 && erreurs.length === 0 ? 0 : 1);
