/**
 * L'épreuve du navigateur : le même son, les deux moteurs, le même verdict.
 *
 * Ce fichier ne teste pas que YAMNet a raison — personne ne le mesure. Il teste
 * que le WASM du navigateur rend **exactement** ce que le `ai_edge_litert` de
 * Python a rendu sur les mêmes échantillons, puis que le cœur porté en
 * TypeScript en tire le même verdict que sa jumelle.
 *
 * Il vit dans `outils/` et non dans `tests/` à dessein : il a besoin d'un
 * Chromium, d'un serveur et de 41 Mo de WASM, là où `npm test` ne demande rien
 * et tourne en une fraction de seconde. Les mélanger ferait d'une suite rapide
 * une suite qu'on n'ose plus lancer.
 *
 *     node outils/epreuve.mjs        # code 0 vert, 1 rouge, 3 non effectué
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const RACINE = resolve(import.meta.dirname, '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Trois choses peuvent manquer sans que le code soit en cause : Chromium, le
// modèle (4 Mo non versionnés) et les dépendances. On rend 3 — « non
// effectué » — plutôt que rouge : punir le code d'un manque de la machine
// apprend à ignorer le vérificateur.
for (const [quoi, chemin] of [
  ['Chromium', CHROME],
  ['le modèle yamnet.tflite', join(RACINE, '..', 'modeles', 'yamnet.tflite')],
  ['les dépendances (npm install)', join(RACINE, 'node_modules', '@tensorflow')],
  ['le bâti (npm run bati)', join(RACINE, 'dist', 'verdict.js')],
]) {
  if (!existsSync(chemin)) {
    console.log(`⊘ non effectué : ${quoi} est absent.`);
    process.exit(3);
  }
}

const { chromium } = await import(join(RACINE, '..', '..', 'node_modules', 'playwright', 'index.mjs'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json',
  '.wasm': 'application/wasm', '.tflite': 'application/octet-stream',
};

// Le modèle et les WASM ne vivent pas sous `web/` : on les sert depuis là où
// ils sont, plutôt que de les recopier. Une copie se périme.
const ALIAS = {
  '/modeles/': join(RACINE, '..', 'modeles'),
  '/wasm/': join(RACINE, 'node_modules', '@tensorflow', 'tfjs-tflite', 'wasm'),
};

const serveur = createServer(async (req, res) => {
  const url = decodeURI(req.url.split('?')[0]);
  let chemin = null;
  for (const [prefixe, dossier] of Object.entries(ALIAS)) {
    if (url.startsWith(prefixe)) { chemin = join(dossier, normalize(url.slice(prefixe.length))); break; }
  }
  if (!chemin) chemin = join(RACINE, normalize(url));
  try {
    const octets = await readFile(chemin);
    res.writeHead(200, { 'content-type': TYPES[extname(chemin)] ?? 'application/octet-stream' });
    res.end(octets);
  } catch { res.writeHead(404); res.end('non'); }
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const port = serveur.address().port;

const temoins = JSON.parse(await readFile(join(RACINE, 'temoins', 'oreille.json'), 'utf-8'));

const nav = await chromium.launch({ executablePath: CHROME });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/page/epreuve.html`);
await page.waitForFunction('window.pret === true', { timeout: 120_000 });

let echecs = 0;
for (const cas of temoins.cas) {
  const obtenu = await page.evaluate(
    ([nom, n]) => window.epreuve(nom, n), [cas.nom, cas.fenetres]);

  let ecartMax = 0;
  for (let f = 0; f < cas.scores.length; f++) {
    for (let i = 0; i < 521; i++) {
      const d = Math.abs(cas.scores[f][i] - obtenu.scores[f][i]);
      if (d > ecartMax) ecartMax = d;
    }
  }
  const memeVerdict =
    obtenu.verdict.intention === cas.verdict.intention &&
    obtenu.verdict.source === cas.verdict.source &&
    obtenu.verdict.confiance === cas.verdict.confiance &&
    obtenu.verdict.raison === cas.verdict.raison &&
    obtenu.verdict.classeDominante === cas.verdict.classeDominante;

  // Zéro strict, et pas une tolérance. Les deux moteurs ont rendu le même
  // vecteur bit pour bit le 04/09/2026 ; accepter un epsilon reviendrait à ne
  // plus voir le jour où ce n'est plus vrai.
  const vert = ecartMax === 0 && memeVerdict;
  if (!vert) echecs++;
  console.log(`  ${vert ? '✓' : '✗'} ${cas.nom.padEnd(10)} ` +
    `écart max ${ecartMax.toExponential(1)}  verdict ${memeVerdict ? 'identique' : 'DIFFÉRENT'}`);
  if (!memeVerdict) {
    console.log('      python  :', JSON.stringify(cas.verdict));
    console.log('      browser :', JSON.stringify(obtenu.verdict));
  }
}

await nav.close();
serveur.close();

if (erreurs.length) { console.log('Erreurs de page :'); erreurs.forEach((e) => console.log('   ', e)); echecs++; }
console.log(echecs === 0
  ? '✓ le navigateur rend exactement ce que le Python rend.'
  : `✗ ${echecs} signal/signaux divergent.`);
process.exit(echecs === 0 ? 0 : 1);
