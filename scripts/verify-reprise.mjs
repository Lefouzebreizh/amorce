/**
 * Vérifie que le montage revient après un rechargement de page.
 *
 * Seule preuve possible pour la reprise : les tests unitaires couvrent la mise
 * en forme du projet, jamais l'aller-retour réel dans IndexedDB, ni le fait que
 * les liens objets rebranchés décodent vraiment. Un montage restauré dont les
 * plans pointent dans le vide s'ouvrirait normalement et se révélerait noir à
 * la lecture — d'où le contrôle sur les pixels, et non sur le DOM.
 *
 * Prérequis : `npm run fixtures` puis `npm run dev` dans un autre terminal.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const RUSHES = join(process.cwd(), '.fixtures', 'rushes');

if (!existsSync(RUSHES) || readdirSync(RUSHES).length === 0) {
  console.error('Rushes absents. Lance d’abord : npm run fixtures');
  process.exit(1);
}

const files = readdirSync(RUSHES).map((f) => join(RUSHES, f));

const browser = await chromium.launch();
const page = await browser.newPage();

let bad = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} | ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) bad++;
};

/** Durée totale affichée par le transport, en secondes. */
const totalShown = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/\/\s*(\d+):(\d+\.\d)/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  });

/** Luminosité et détail de l'image affichée. */
const sample = () =>
  page.evaluate(() => {
    const source = document.querySelector('canvas');
    if (!source) return { mean: 0, deviation: 0 };
    const probe = document.createElement('canvas');
    probe.width = 48; probe.height = 85;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
    const values = [];
    for (let i = 0; i < data.length; i += 4) values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    return { mean, deviation: Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length) };
  });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.setInputFiles('input[type=file][accept="video/*"]', files);
await page.waitForFunction(() => document.querySelectorAll('li img').length >= 4, { timeout: 90000 });
await page.getByRole("button", { name: /⚡ Monter automatiquement/ }).click();
await page.waitForTimeout(1500);

const avantVignettes = await page.locator('li img').count();
const avantDuree = await totalShown();
console.log(`avant : ${avantVignettes} vignettes, montage de ${avantDuree} s`);

// Laisse partir l'écriture différée, puis recharge — c'est ce que fait un
// navigateur qui a libéré l'onglet passé en arrière-plan.
await page.waitForTimeout(3000);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

const apresVignettes = await page.locator('li img').count();
const apresDuree = await totalShown();
console.log(`après : ${apresVignettes} vignettes, montage de ${apresDuree} s`);

check('Les rushes reviennent', apresVignettes === avantVignettes, `${apresVignettes}/${avantVignettes}`);
check(
  'Le montage revient à sa longueur',
  apresDuree !== null && avantDuree !== null && Math.abs(apresDuree - avantDuree) < 0.2,
  `${apresDuree} s pour ${avantDuree} s`,
);

// Les liens rebranchés doivent décoder, pas seulement exister : on lit.
await page.getByRole('button', { name: /Lire|Jouer|▶/ }).first().click().catch(() => {});
await page.waitForTimeout(300);
const frames = [];
for (let i = 0; i < 8; i++) { frames.push(await sample()); await page.waitForTimeout(400); }
const eclairees = frames.filter((f) => f.mean > 6).length;
const texturees = frames.filter((f) => f.deviation > 8).length;
check('Un rush repris se décode réellement', eclairees >= 5, `${eclairees}/8 images éclairées`);
check('L’image reprise contient du détail', texturees >= 5, `${texturees}/8 images texturées`);

const erreurs = await page.evaluate(() => (window.__probe?.errors ?? []).slice(0, 3));
check('Aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

await browser.close();
console.log(bad === 0 ? '\n--- reprise : tout passe ---' : `\n--- reprise : ${bad} échec(s) ---`);
process.exit(bad === 0 ? 0 : 1);
