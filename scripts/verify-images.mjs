/**
 * Vérifie qu'une image fixe devient réellement un plan à l'écran.
 *
 * Rien de tout cela ne se teste hors d'un navigateur : les tests unitaires
 * couvrent le calcul de la timeline, jamais le fait qu'un `<img>` se trace sur
 * le canvas de composition. Or l'échec redouté est silencieux — un montage qui
 * s'ouvre normalement, une durée juste, et une image noire. D'où un contrôle
 * sur les pixels, et non sur le DOM.
 *
 * Le défilé est volontairement plus long que `DECODEURS_MAX` : c'est le cas qui
 * ferait sortir un export noir si les images étaient comptées comme des
 * décodeurs vidéo, et c'est exactement ce que demande une vidéo faite de pages
 * qui s'enchaînent.
 *
 * Prérequis : `npm run fixtures` puis `npm run dev` dans un autre terminal.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { optionsChromium } from './chromium.mjs';

const IMAGES = join(process.cwd(), '.fixtures', 'images');
const URL_BASE = process.env.AMORCE_URL || 'http://localhost:3000';

/** Nombre d'imports successifs. Deux images par tour, soit dix plans. */
const TOURS = 5;

if (!existsSync(IMAGES) || readdirSync(IMAGES).length === 0) {
  console.error('Illustrations absentes. Lance d’abord : npm run fixtures');
  process.exit(1);
}

const files = readdirSync(IMAGES)
  .filter((f) => f.endsWith('.png'))
  .map((f) => join(IMAGES, f));

const attendus = files.length * TOURS;

const browser = await chromium.launch({
  ...optionsChromium,
});
const page = await browser.newPage();

let bad = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} | ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) bad++;
};

/** Luminosité et détail de l'image affichée. */
const sample = () =>
  page.evaluate(() => {
    const source = document.querySelector('canvas');
    if (!source) return { mean: 0, deviation: 0 };
    const probe = document.createElement('canvas');
    probe.width = 48;
    probe.height = 85;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
    const values = [];
    for (let i = 0; i < data.length; i += 4) values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    return { mean, deviation: Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length) };
  });

await page.goto(URL_BASE, { waitUntil: 'networkidle' });

// Le même lot, importé plusieurs fois : chaque tour crée de nouveaux médias, et
// c'est le moyen le plus court d'obtenir un défilé plus long que le plafond de
// décodeurs sans dépendre d'un geste de l'interface.
for (let tour = 0; tour < TOURS; tour++) {
  await page.setInputFiles('input[type=file][accept*="video/*"]', files);
  await page.waitForFunction(
    (n) => document.querySelectorAll('li img').length >= n,
    files.length * (tour + 1),
    { timeout: 60000 },
  );
}

const importees = await page.locator('li img').count();
check('Les illustrations sont importées', importees === attendus, `${importees}/${attendus}`);

const vignettes = await page.evaluate(() =>
  [...document.querySelectorAll('li img')].every((img) => img.src.startsWith('data:image/jpeg')),
);
check('Chaque illustration a sa vignette', vignettes);

await page.getByRole('button', { name: /⚡ Monter automatiquement/ }).click();
await page.waitForTimeout(1500);

const duree = await page.evaluate(() => {
  const m = document.body.innerText.match(/\/\s*(\d+):(\d+\.\d)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
});
check('Le montage a une durée', duree !== null && duree > 5, `${duree} s`);

// On lit le montage entier : c'est le seul moyen de voir un plan tardif rendre
// du noir, ce que la seule première image ne montrerait jamais.
await page.getByRole('button', { name: /Lire|Jouer|▶/ }).first().click().catch(() => {});

const frames = [];
const pas = 400;
const tours = Math.ceil(((duree ?? 20) * 1000) / pas);
for (let i = 0; i < tours; i++) {
  frames.push(await sample());
  await page.waitForTimeout(pas);
}

const eclairees = frames.filter((f) => f.mean > 6).length;
const texturees = frames.filter((f) => f.deviation > 8).length;
const noires = frames.filter((f) => f.mean <= 6).length;

check(
  'Une image fixe se trace vraiment',
  eclairees >= frames.length * 0.8,
  `${eclairees}/${frames.length} images éclairées`,
);
check(
  'L’image tracée porte le détail de l’illustration',
  texturees >= frames.length * 0.8,
  `${texturees}/${frames.length} images texturées`,
);
// Le contrôle qui compte : au-delà du plafond de décodeurs, un plan d'image ne
// doit pas cesser de rendre. Deux images noires isolées restent tolérées — une
// transition sur fond sombre en produit — mais pas une traîne.
check(
  `Aucune traîne noire au-delà de ${attendus} plans`,
  noires <= 2,
  `${noires} image(s) noire(s)`,
);

const erreurs = await page.evaluate(() => (window.__probe?.errors ?? []).slice(0, 3));
check('Aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

await browser.close();
console.log(bad === 0 ? '\n--- images : tout passe ---' : `\n--- images : ${bad} échec(s) ---`);
process.exit(bad === 0 ? 0 : 1);
