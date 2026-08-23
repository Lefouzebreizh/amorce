/**
 * Vérification de bout en bout du studio, dans un vrai navigateur.
 *
 * Les tests unitaires couvrent le calcul de la timeline et la notation, mais
 * l'essentiel du studio ne peut pas être vérifié hors d'un navigateur : décodage
 * vidéo, mixage Web Audio, tracé sur canvas, enregistrement du fichier. Ce
 * script pilote donc l'application pour de vrai et contrôle le résultat sur les
 * pixels et sur le signal sonore, pas sur la présence d'éléments dans le DOM.
 *
 * Prérequis : `npm run fixtures` puis `npm run dev` dans un autre terminal.
 * Usage : npm run verify
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUSHES = join(ROOT, '.fixtures', 'rushes');
const SHOTS = join(ROOT, '.fixtures', 'captures');
const URL_BASE = process.env.AMORCE_URL || 'http://localhost:3000';

/** Durée attendue du montage express sur les rushes de test, en secondes. */
const EXPECTED_DURATION = 7.5;

if (!existsSync(join(RUSHES, 'rush1.webm'))) {
  console.error('Rushes absents. Lance d’abord : npm run fixtures');
  process.exit(1);
}
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  OK  ' : ' ECHEC'} | ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.AMORCE_CHROMIUM || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
});

/**
 * Sonde audio.
 *
 * Tout nœud qui se branche sur la sortie alimente aussi un analyseur. C'est la
 * seule façon de mesurer le son réellement produit sans ajouter de code de
 * débogage dans l'application elle-même.
 */
await context.addInitScript(() => {
  window.__probe = { analysers: [], errors: [] };
  window.addEventListener('error', (e) => window.__probe.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__probe.errors.push(String(e.reason)));

  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    try {
      if (target === this.context.destination) {
        if (!this.context.__tap) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 2048;
          this.context.__tap = analyser;
          window.__probe.analysers.push(analyser);
        }
        connect.call(this, this.context.__tap);
      }
    } catch {
      // La sonde ne doit jamais faire échouer l'application observée.
    }
    return connect.call(this, target, ...rest);
  };
});

const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => consoleErrors.push(String(error)));

try {
  await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 20000 });
} catch {
  console.error(`Serveur injoignable sur ${URL_BASE}. Lance : npm run dev`);
  process.exit(1);
}
check('La page se charge', await page.locator('text=Dépose tes vidéos').isVisible());

// --------------------------------------------------------------- 1. Import
await page.setInputFiles(
  'input[type=file][accept="video/*"]',
  [1, 2, 3, 4].map((i) => join(RUSHES, `rush${i}.webm`)),
);
await page.waitForTimeout(4000);

const assetCount = await page.locator('li:has(img[alt=""])').count();
check('Les quatre rushes sont importés', assetCount === 4, `${assetCount} dans la bibliothèque`);

const thumbnailsOk = await page.evaluate(() =>
  [...document.querySelectorAll('li img')].every((img) => img.src.startsWith('data:image/jpeg')),
);
check('Les vignettes sont générées', thumbnailsOk);

const meta = (await page.locator('li p.text-\\[11px\\]').first().textContent())?.trim();
check('Les métadonnées sont lues', /\d+×\d+/.test(meta ?? ''), meta);

await page.screenshot({ path: join(SHOTS, '01-import.png') });

// -------------------------------------------------------- 2. Montage express
await page.click('text=Monter automatiquement');
await page.waitForTimeout(1500);

const canvasSize = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  return { width: canvas?.width, height: canvas?.height };
});
check(
  'Le canvas est à la définition de sortie',
  canvasSize.width === 1080 && canvasSize.height === 1920,
  `${canvasSize.width}×${canvasSize.height}`,
);

const score = await page.locator('header div.rounded-full span.font-display').textContent();
check('Une note de viralité est calculée', Number(score) > 0, `note ${score}/100`);
check('Le montage express a posé une accroche', await page.locator('text=Attends la fin').first().isVisible());

await page.screenshot({ path: join(SHOTS, '02-montage.png') });

/** Mesure la luminosité, le détail et le niveau sonore de l'instant courant. */
const sample = () =>
  page.evaluate(() => {
    const source = document.querySelector('canvas');
    const probe = document.createElement('canvas');
    probe.width = 48;
    probe.height = 85;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);

    const values = [];
    for (let i = 0; i < data.length; i += 4) values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);

    let rms = 0;
    for (const analyser of window.__probe.analysers) {
      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);
      let energy = 0;
      for (const value of buffer) energy += value * value;
      rms = Math.max(rms, Math.sqrt(energy / buffer.length));
    }

    return {
      mean,
      deviation,
      rms,
      state: window.__probe.analysers[0]?.context?.state ?? 'aucun',
      playhead: document.body.innerText.match(/(\d+:\d+\.\d)\s*\//)?.[1],
    };
  });

// ------------------------------------------------- 3. Lecture, image et son
await page.click('canvas'); // Geste utilisateur : débloque le contexte audio.
await page.waitForTimeout(600);

const frames = [];
for (let i = 0; i < 14; i++) {
  frames.push(await sample());
  if (i === 3) await page.screenshot({ path: join(SHOTS, '03-lecture.png') });
  await page.waitForTimeout(500);
}

check(
  'L’image n’est pas noire pendant la lecture',
  frames.filter((f) => f.mean > 6).length >= 10,
  `${frames.filter((f) => f.mean > 6).length}/14 images éclairées`,
);
check(
  'L’image contient du détail',
  frames.filter((f) => f.deviation > 8).length >= 10,
  `${frames.filter((f) => f.deviation > 8).length}/14 images texturées`,
);
check(
  'L’image change au fil du temps',
  new Set(frames.map((f) => f.mean.toFixed(1))).size >= 6,
  `${new Set(frames.map((f) => f.mean.toFixed(1))).size} niveaux distincts`,
);

const peak = Math.max(...frames.map((f) => f.rms));
check('Du son sort du mixage', peak > 0.001, `niveau crête ${peak.toFixed(4)} (contexte ${frames[0].state})`);
check(
  'La tête de lecture avance',
  frames.some((f) => f.playhead && f.playhead !== frames[0].playhead),
  `${frames[0].playhead} → ${frames.at(-1).playhead}`,
);

// ------------------------------------------------------------ 4. Étalonnage
/** Écart moyen entre canaux : proche de zéro, l'image est désaturée. */
const chroma = () =>
  page.evaluate(() => {
    const source = document.querySelector('canvas');
    const probe = document.createElement('canvas');
    probe.width = 40;
    probe.height = 71;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);

    let spread = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      spread += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      count++;
    }
    return spread / count;
  });

await page.click('nav >> text=5. Cinéma');
// La mesure se fait à pleine intensité : au dosage par défaut, une part de la
// couleur subsiste volontairement et le contrôle n'aurait rien prouvé.
await page.locator('input[aria-label="Intensité du rendu"]').fill('1');
await page.click('button:has-text("Naturel")');
await page.waitForTimeout(700);
const chromaNaturel = await chroma();

await page.click('button:has-text("Noir et blanc")');
await page.waitForTimeout(700);
const chromaNoir = await chroma();
await page.screenshot({ path: join(SHOTS, '04-cinema.png') });

check(
  'L’étalonnage agit sur l’image',
  chromaNoir < 4 && chromaNaturel > chromaNoir,
  `chroma ${chromaNaturel.toFixed(1)} en naturel → ${chromaNoir.toFixed(1)} en noir et blanc`,
);

await page.click('button:has-text("Cinéma")');
await page.locator('input[aria-label="Intensité du rendu"]').fill('0.7');
await page.waitForTimeout(400);

// ---------------------------------------------------------------- 5. Export
await page.click('nav >> text=7. Exporter');
await page.waitForTimeout(400);

const format = (await page.locator('dd').nth(1).textContent())?.trim();
check('Un format d’export est disponible', !/non pris en charge/.test(format ?? ''), format);

const downloading = page.waitForEvent('download', { timeout: 90000 });
await page.click('text=Exporter la vidéo');
await page.waitForTimeout(2500);
await page.screenshot({ path: join(SHOTS, '05-export.png') });

let exportPath = null;
try {
  const download = await downloading;
  exportPath = join(SHOTS, download.suggestedFilename());
  await download.saveAs(exportPath);
  check('Un fichier est téléchargé', true, download.suggestedFilename());
} catch (error) {
  check('Un fichier est téléchargé', false, String(error).slice(0, 120));
}

const pageErrors = await page.evaluate(() => window.__probe.errors);
check(
  'Aucune erreur JavaScript',
  pageErrors.length === 0 && consoleErrors.length === 0,
  [...pageErrors, ...consoleErrors].slice(0, 2).join(' | '),
);

// ------------------------------------------- 6. Relecture du fichier produit
if (exportPath) {
  const probe = await context.newPage();
  await probe.goto('about:blank');

  // Le fichier est rejoué pour de bon : un conteneur de la bonne taille mais
  // sans image décodable ni piste sonore passerait sinon pour un export réussi.
  const info = await probe.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
    const video = document.createElement('video');
    video.src = url;

    const ready = await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve(true);
      video.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 10000);
    });
    if (!ready) return { ready: false };

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    audioCtx.createMediaElementSource(video).connect(analyser);
    analyser.connect(audioCtx.destination);
    await audioCtx.resume();
    await video.play();

    let rms = 0;
    const buffer = new Float32Array(analyser.fftSize);
    const start = performance.now();
    while (performance.now() - start < 4000 && !video.ended) {
      analyser.getFloatTimeDomainData(buffer);
      let energy = 0;
      for (const value of buffer) energy += value * value;
      rms = Math.max(rms, Math.sqrt(energy / buffer.length));
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    video.pause();
    video.currentTime = Math.min(1.5, video.duration / 2);
    await new Promise((resolve) => {
      video.onseeked = resolve;
      setTimeout(resolve, 5000);
    });

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 57;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;

    return {
      ready: true,
      rms,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      brightness: sum / (data.length / 4),
      bytes: bytes.length,
    };
  }, readFileSync(exportPath).toString('base64'));

  check('Le fichier exporté est lisible', info.ready === true, info.ready ? `${info.duration.toFixed(2)} s` : 'métadonnées illisibles');
  check(
    'L’export est au format vertical attendu',
    info.width === 1080 && info.height === 1920,
    `${info.width}×${info.height}`,
  );
  check(
    'L’export dure la longueur du montage',
    Math.abs((info.duration ?? 0) - EXPECTED_DURATION) < 1.5,
    `${info.duration?.toFixed(2)} s pour ${EXPECTED_DURATION} s attendues`,
  );
  check('L’image de l’export n’est pas noire', (info.brightness ?? 0) > 6, `luminosité ${info.brightness?.toFixed(1)}`);
  check('L’export contient une piste sonore', (info.rms ?? 0) > 0.001, `niveau crête ${info.rms?.toFixed(4)}`);

  console.log(`\n  fichier : ${((info.bytes ?? 0) / 1024 / 1024).toFixed(2)} Mo — ${exportPath}`);
  await probe.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n--- BILAN : ${results.length - failed.length}/${results.length} vérifications passées ---`);
if (consoleErrors.length) {
  console.log('\nErreurs console :');
  for (const error of [...new Set(consoleErrors)].slice(0, 8)) console.log(`  ${error.slice(0, 200)}`);
}
console.log(`Captures : ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
