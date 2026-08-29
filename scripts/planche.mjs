/**
 * La planche d'images d'un montage, pour le regarder au lieu de le mesurer.
 *
 * Le dépôt tient qu'un montage se regarde avant d'être livré : « une mesure
 * disait vert et le fichier était faux » a coûté vingt-cinq versions d'un même
 * épisode en une nuit. `verify` mesure et affirme ; ce script-ci ne conclut
 * rien — il produit une planche d'images couvrant tout le film, dernière
 * seconde comprise, et laisse l'œil décider.
 *
 * Ce qu'il a trouvé du premier coup, qu'aucune mesure ne disait : sur un
 * montage de trente-et-une secondes, une seule phrase de texte, présente sur
 * les trois premières images et plus rien ensuite.
 *
 * Il fabrique aussi ses rushes : le nombre de plans change tout au montage
 * express, et les quatre rushes de `npm run fixtures` n'éprouvent jamais ce qui
 * se passe à vingt-huit.
 *
 * Prérequis : `npm run dev` dans un autre terminal, et ffmpeg.
 * Usage : npm run planche -- [nombre de rushes]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = process.env.AMORCE_URL || 'http://localhost:3000';
const NB = Number(process.argv[2]) || 28;
const LOT = join(ROOT, '.fixtures', `lot${NB}`);
const SORTIE = join(ROOT, '.fixtures', 'captures');

/**
 * Des rushes qu'on reconnaît à l'image.
 *
 * Chacun porte son numéro en grand et une barre qui s'allonge de plan en plan :
 * sur la planche, un plan répété, un plan manquant ou un ordre inversé se
 * voient sans compter. Une teinte différente par plan rend les fondus lisibles
 * — c'est là que se logent les défauts de raccord.
 */
function fabriquerRushes() {
  if (existsSync(LOT) && readdirSync(LOT).length >= NB) return;
  mkdirSync(LOT, { recursive: true });
  console.log(`fabrication de ${NB} rushes…`);
  for (let i = 1; i <= NB; i += 1) {
    const couleur = `0x${[(i * 29) % 200 + 55, (i * 61) % 200 + 55, (i * 97) % 200 + 55]
      .map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=540x960:d=5:r=30',
      '-f', 'lavfi', '-i', `sine=frequency=${200 + i * 40}:duration=5`,
      '-vf', [
        `drawbox=x=0:y=0:w=540:h=960:color=${couleur}:t=fill`,
        `drawtext=text='PLAN ${i}':fontsize=90:fontcolor=white:x=(w-tw)/2:y=(h-th)/2`,
        `drawbox=x=40:y=40:w=${20 + i * 15}:h=60:color=white:t=fill`,
      ].join(','),
      '-c:v', 'libvpx', '-b:v', '700k', '-c:a', 'libopus', '-shortest',
      join(LOT, `plan${String(i).padStart(2, '0')}.webm`),
    ]);
  }
}

fabriquerRushes();
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 640 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
const page = await contexte.newPage();
await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.setInputFiles(
  'input[type=file][accept*="video/*"]',
  readdirSync(LOT).sort().map((f) => join(LOT, f)),
);
// Décoder vingt-huit vidéos prend un temps qu'aucun délai fixe ne couvre : on
// attend que le bouton du montage express apparaisse, c'est lui le signal.
for (let i = 0; i < 180; i += 1) {
  if (await page.locator('button:has-text("Monter automatiquement (")').count()) break;
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(4000);

const bouton = page.locator('button:has-text("Monter automatiquement (")').first();
console.log('bouton :', (await bouton.innerText()).trim().replace(/\s+/g, ' '));
await bouton.click();
await page.waitForTimeout(6000);
console.log('note  :', await page.locator('header [role="status"]').getAttribute('aria-label'));

const section = page.locator('#etape-export');
await section.waitFor({ state: 'attached' });
await section.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
const exporter = page.locator('button:has-text("⬇ Exporter la vidéo")');
await exporter.scrollIntoViewIfNeeded();
const attente = page.waitForEvent('download', { timeout: 600000 });
await exporter.click();
const telechargement = await attente;
const film = join(SORTIE, `planche-${NB}-${telechargement.suggestedFilename()}`);
await telechargement.saveAs(film);
await navigateur.close();

const duree = Number(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film])
    .toString().trim(),
);
const IMAGES = 40;
const planche = `${film.replace(/\.\w+$/, '')}-planche.png`;
/*
 * Quarante images réparties sur toute la durée, en huit colonnes.
 *
 * Le pas se calcule sur la durée réelle et non sur une cadence fixe : c'est ce
 * qui garantit que la dernière seconde est sur la planche. C'est là que se
 * logent les cartons hérités et les textes qui traînent, et c'est précisément
 * l'endroit qu'un échantillonnage régulier rate.
 */
execFileSync('ffmpeg', [
  '-v', 'error', '-y', '-i', film,
  '-vf', `fps=${IMAGES}/${duree.toFixed(3)},scale=216:384,tile=8x5`,
  '-frames:v', '1', planche,
]);

console.log(`film   : ${film} — ${duree.toFixed(1)} s`);
console.log(`planche: ${planche}`);
console.log('\nÀ regarder, dans cet ordre :');
console.log('  1. la dernière image — un carton de fin hérité ne se voit que là ;');
console.log('  2. le texte — combien d’images en portent, et où il se trouve ;');
console.log('  3. les fondus — deux plans superposés trop souvent font un film mou ;');
console.log('  4. l’ordre et les répétitions — les numéros de plan doivent monter.');
