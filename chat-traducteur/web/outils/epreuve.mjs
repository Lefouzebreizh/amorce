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
  ['le signal d\'épreuve (npm run temoins:chaine)', join(RACINE, 'temoins', 'signal.wav')],
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
const TF = join(RACINE, 'node_modules', '@tensorflow');
const ALIAS = {
  // L'application charge tout en **relatif** — `./modeles/`, `./wasm/`,
  // `./tf/` — pour être servie depuis n'importe quel sous-dossier, y compris
  // une page de projet GitHub. Le serveur d'épreuve reconstitue donc ces
  // chemins-là, plutôt que de recopier 45 Mo dans `page/`.
  '/page/modeles/': join(RACINE, '..', 'modeles'),
  '/page/wasm/': join(TF, 'tfjs-tflite', 'wasm'),
  '/page/donnees/': join(RACINE, 'donnees'),
  '/page/dist/': join(RACINE, 'dist'),
  '/page/tf/tf-core.js': join(TF, 'tfjs-core', 'dist', 'tf-core.js'),
  '/page/tf/tf-backend-cpu.js': join(TF, 'tfjs-backend-cpu', 'dist', 'tf-backend-cpu.js'),
  '/page/tf/tf-tflite.js': join(TF, 'tfjs-tflite', 'dist', 'tf-tflite.js'),
  '/modeles/': join(RACINE, '..', 'modeles'),
  '/wasm/': join(TF, 'tfjs-tflite', 'wasm'),
};

const serveur = createServer(async (req, res) => {
  const url = decodeURI(req.url.split('?')[0]);
  let chemin = null;
  for (const [prefixe, cible] of Object.entries(ALIAS)) {
    if (url === prefixe) { chemin = cible; break; }
    if (prefixe.endsWith('/') && url.startsWith(prefixe)) {
      chemin = join(cible, normalize(url.slice(prefixe.length))); break;
    }
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

// Le micro simulé : Chromium rejoue un fichier à la place du matériel, ce qui
// rend `getUserMedia` éprouvable sans micro et sans clic. `--use-fake-ui`
// accorde l'autorisation d'office — sans lui, la demande reste pendante et la
// page attend indéfiniment.
const nav = await chromium.launch({
  executablePath: CHROME,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${join(RACINE, 'temoins', 'signal.wav')}`,
  ],
});
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

// ── Deuxième moitié : l'application elle-même, conduite comme un utilisateur
// la conduit ────────────────────────────────────────────────────────────────
//
// La première moitié compare deux moteurs sur des échantillons déjà prêts.
// Celle-ci part d'un **fichier** et fait donc entrer le décodage, le
// rééchantillonnage et le fenêtrage dans la comparaison — la partie que rien
// ne couvrait, et celle où deux implémentations divergent le plus facilement.
console.log('');
const chaine = JSON.parse(await readFile(join(RACINE, 'temoins', 'chaine.json'), 'utf-8'));
const appli = await nav.newPage();
const erreursAppli = [];
appli.on('pageerror', (e) => erreursAppli.push(String(e)));
await appli.setViewportSize({ width: 393, height: 873 });   // le terrain de référence
await appli.goto(`http://127.0.0.1:${port}/page/index.html`);
await appli.waitForFunction('window.appliPrete === true', { timeout: 120_000 });

const wav = await readFile(join(RACINE, 'temoins', 'signal.wav'));
await appli.evaluate(async (octets) => {
  await window.ecouterOctets(new Uint8Array(octets).buffer);
}, Array.from(wav));

const obtenuChaine = await appli.evaluate(() => ({
  verdict: window.dernierVerdict(), fenetres: window.nbFenetres(),
  texte: document.getElementById('etat').textContent,
}));

const memeChaine =
  obtenuChaine.fenetres === chaine.fenetres &&
  obtenuChaine.verdict.intention === chaine.verdict.intention &&
  obtenuChaine.verdict.source === chaine.verdict.source &&
  obtenuChaine.verdict.raison === chaine.verdict.raison &&
  obtenuChaine.verdict.classeDominante === chaine.verdict.classeDominante;
if (!memeChaine) echecs++;
console.log(`  ${memeChaine ? '✓' : '✗'} chaîne complète  ` +
  `${obtenuChaine.fenetres} fenêtres (python ${chaine.fenetres})  ` +
  `${obtenuChaine.verdict.intention} (python ${chaine.verdict.intention})`);
if (!memeChaine) {
  console.log('      python  :', JSON.stringify(chaine.verdict));
  console.log('      browser :', JSON.stringify(obtenuChaine.verdict));
}
await appli.screenshot({ path: join(RACINE, 'temoins', 'ecran-refus.png') });

// Et la carte, par la couture : les scores mesurés sur un vrai ronronnement du
// corpus, tels que `fabriquer_cartes.py` les emploie côté Python. Ce n'est pas
// une simulation — c'est un son réel dont on rejoue la mesure au lieu de le
// rejouer lui-même.
const carte = await appli.evaluate(() =>
  window.jugerScores([{ Cat: 0.500, Purr: 0.586 }]));
const carteOk = carte.intention === 'contentement' && carte.source === 'mesuree';
if (!carteOk) echecs++;
console.log(`  ${carteOk ? '✓' : '✗'} carte à l'écran  ${carte.intention} (${carte.source})`);
await appli.screenshot({ path: join(RACINE, 'temoins', 'ecran-carte.png') });

// ── Le micro, et ce que cette épreuve peut en dire ─────────────────────────
//
// Elle ne compare **rien** au Python, et c'est délibéré : une capture passe
// par le rééchantillonnage de l'appareil — 48 kHz ici — puis par un encodage
// Opus avec perte. Exiger l'égalité serait exiger l'impossible.
//
// Ce qu'elle prouve est plus modeste et n'était pas prouvé : `getUserMedia`,
// `MediaRecorder`, le décodage, le rééchantillonnage vers 16 kHz et le
// fenêtrage s'enchaînent pour de bon, et l'application rend un verdict au
// lieu de rester muette. C'est le seul chemin que l'utilisateur empruntera,
// et il n'avait jamais servi.
// **On recharge avant de mesurer**, et ce n'est pas de la coquetterie : le
// premier jet lisait `dernierVerdict()` sans le remettre à zéro, si bien que
// la boucle d'attente sortait aussitôt sur le verdict de l'étape précédente.
// L'épreuve rendait « contentement » sur un glissando — impossible, et verte.
// Recharger repart d'un état vierge et éprouve en prime l'initialisation.
await appli.reload();
await appli.waitForFunction('window.appliPrete === true', { timeout: 120_000 });

const micro = await appli.evaluate(async () => {
  document.getElementById('micro').click();
  await new Promise((r) => setTimeout(r, 1500));       // on laisse enregistrer
  document.getElementById('micro').click();            // et on arrête
  for (let i = 0; i < 200 && !window.dernierVerdict(); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return { verdict: window.dernierVerdict(), fenetres: window.nbFenetres(),
           texte: document.getElementById('etat').textContent };
});
const microOk = micro.verdict !== null && micro.fenetres > 0;
if (!microOk) echecs++;
console.log(`  ${microOk ? '✓' : '✗'} micro simulé    ` +
  `${micro.fenetres} fenêtre(s) capturées -> ${micro.verdict?.intention ?? 'aucun verdict'}`);
if (!microOk) console.log('      état de la page :', micro.texte);

if (erreursAppli.length) {
  console.log("Erreurs de l'application :");
  erreursAppli.forEach((e) => console.log('   ', e));
  echecs++;
}

await nav.close();
serveur.close();

if (erreurs.length) { console.log('Erreurs de page :'); erreurs.forEach((e) => console.log('   ', e)); echecs++; }
console.log(echecs === 0
  ? '✓ le navigateur rend exactement ce que le Python rend.'
  : `✗ ${echecs} signal/signaux divergent.`);
process.exit(echecs === 0 ? 0 : 1);
