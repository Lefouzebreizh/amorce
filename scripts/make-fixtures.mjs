/**
 * Fabrique les médias de test.
 *
 * Aucun fichier vidéo n'est versionné : ils sont produits à la demande par
 * Chromium pour dessiner chaque image, puis FFmpeg pour les encoder hors
 * temps réel. Chaque rush porte une
 * piste sonore synthétique, sans quoi il serait impossible de vérifier plus tard
 * que le mixage restitue bien le son d'origine des plans.
 *
 * Aux quatre rushes s'ajoutent deux illustrations fixes, au format d'un dessin
 * et non d'un écran de téléphone : c'est la matière de quiconque publie ce
 * qu'il dessine, et c'est elle qui éprouve le recadrage en 9:16.
 *
 * Prérequis : FFmpeg et ffprobe sur le PATH. Usage : npm run fixtures
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { optionsChromium } from './chromium.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.fixtures', 'rushes');
const IMAGES = join(ROOT, '.fixtures', 'images');

/** Quatre plans de durées inégales, pour éprouver le calcul de la timeline. */
const SPECS = [
  { name: 'rush1', hue: 205, label: 'PLAN 1', seconds: 4 },
  { name: 'rush2', hue: 330, label: 'PLAN 2', seconds: 3 },
  { name: 'rush3', hue: 95, label: 'PLAN 3', seconds: 5 },
  { name: 'rush4', hue: 35, label: 'PLAN 4', seconds: 3 },
  /*
   * Le cinquième est en paysage, et il n'est pas là pour faire nombre.
   *
   * Les quatre premiers sont en 9:16, comme tout ce que ce dossier fabriquait :
   * ils n'ont **aucun côté à perdre**, donc aucune vérification de ce dépôt ne
   * pouvait voir que le recouvrement gardait le milieu quoi qu'il arrive. Sur
   * un 16:9, il en jette 68,4 %.
   *
   * Son sujet traverse toute la largeur, en sortant franchement de la fenêtre
   * centrale : un cadrage centré le perd de vue, un cadrage qui suit le garde.
   * C'est la seule matière avec laquelle la différence se regarde.
   */
  { name: 'rush-paysage', hue: 150, label: 'PAYSAGE', seconds: 4, width: 1920, height: 1080 },
];

/**
 * Deux illustrations, dans deux formats qu'aucun téléphone ne produit.
 *
 * Le carré et le paysage encadrent le cas réel — une page, une couverture —
 * et obligent le recouvrement 9:16 à rogner dans les deux sens.
 */
const IMAGE_SPECS = [
  { name: 'illustration-carree', hue: 265, label: 'PAGE 1', width: 1400, height: 1400 },
  { name: 'illustration-paysage', hue: 20, label: 'PAGE 2', width: 1920, height: 1080 },
];

// Échouer avant d'ouvrir Chromium si les encodeurs requis sont absents.
execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });

mkdirSync(OUT, { recursive: true });
mkdirSync(IMAGES, { recursive: true });

const browser = await chromium.launch({
  ...optionsChromium,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.goto('about:blank');

// La capture temps réel rendait parfois un paysage de 0,28 s pour 4 s et
// des gels dans les rushes eux-mêmes sur le runner. Le temps du dessin vient
// désormais du numéro d'image, jamais de la charge CPU ou de l'horloge.
for (const spec of SPECS) {
  const output = join(OUT, `${spec.name}.webm`);
  const frames = spec.seconds * 30;
  const encoder = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', '30', '-i', 'pipe:0',
    '-f', 'lavfi', '-i', `aevalsrc=0.25*(2*(t*${180 + spec.hue}-floor(t*${180 + spec.hue}))-1):s=48000`,
    '-t', String(spec.seconds), '-c:v', 'libvpx', '-b:v', '4M',
    '-deadline', 'good', '-cpu-used', '4', '-threads', '2', '-g', '30',
    '-pix_fmt', 'yuv420p', '-c:a', 'libopus', output,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let errorText = '';
  encoder.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-4000); });
  encoder.on('error', error => { errorText = error.message; });
  // L'erreur est propagée par le callback de write et la fermeture ci-dessous.
  encoder.stdin.on('error', () => {});
  const closed = new Promise(resolve => encoder.once('close', code => resolve(code)));
  try {
    for (let frame = 0; frame < frames; frame++) {
      const base64 = await page.evaluate(({ hue, label, width, height, frame }) => {
        const L = width ?? 1080;
        const H = height ?? 1920;
        const canvas = document.createElement('canvas');
        canvas.width = L;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        const t = frame / 30;
        // Le fond et le disque bougent en continu : deux images consécutives
        // doivent différer, sinon les contrôles de « l'image change » seraient
        // satisfaits par une vidéo figée.
        ctx.fillStyle = `hsl(${hue + t * 12} 55% ${20 + Math.sin(t * 2) * 8}%)`;
        ctx.fillRect(0, 0, L, H);
        ctx.fillStyle = `hsl(${hue + 40} 80% 62%)`;
        ctx.beginPath();
        // Sur un plan large, le sujet balaie toute la largeur — c'est ce qui
        // fait sortir un cadrage centré. Sur un 9:16, il tourne comme avant.
        const large = L > H;
        const cx = large
          ? L / 2 + Math.sin(t * 1.1) * (L / 2 - H * 0.16)
          : L / 2 + Math.sin(t * 1.6) * (L * 0.28);
        const cy = large ? H / 2 : H / 2 + Math.cos(t * 1.2) * (H * 0.21);
        ctx.arc(cx, cy, Math.min(L, H) * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.round(Math.min(L, H) * 0.13)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy + Math.min(L, H) * 0.045);
        ctx.font = `600 ${Math.round(Math.min(L, H) * 0.06)}px monospace`;
        ctx.fillText(`${t.toFixed(2)}s`, L / 2, H * 0.88);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { ...spec, frame });
      await new Promise((resolve, reject) => {
        encoder.stdin.write(Buffer.from(base64, 'base64'), error => error ? reject(error) : resolve());
      });
    }
    encoder.stdin.end();
    if (await closed !== 0) throw new Error(errorText || 'Encodage des rushes impossible.');
  } catch (error) {
    encoder.stdin.destroy();
    encoder.kill();
    await closed;
    await browser.close();
    throw new Error(`${spec.name}: ${errorText || error.message}`);
  }

  // La présence seule ne suffit pas : on décode et compte les vraies images.
  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-count_frames', '-show_entries',
    'format=duration:stream=codec_type,nb_read_frames,width,height', '-of', 'json', output,
  ], { encoding: 'utf8' }));
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.some(stream => stream.codec_type === 'audio');
  const duration = Number(probe.format.duration);
  if (Number(video?.nb_read_frames) !== frames || !audio
      || video.width !== (spec.width ?? 1080) || video.height !== (spec.height ?? 1920)
      || !Number.isFinite(duration) || Math.abs(duration - spec.seconds) > 0.1) {
    await browser.close();
    throw new Error(`${spec.name}: durée, dimensions, images ou son invalides.`);
  }
  console.log(`${spec.name}.webm  ${(statSync(output).size / 1024).toFixed(0)} Ko — ${frames} images, ${probe.format.duration} s`);
}

for (const spec of IMAGE_SPECS) {
  const base64 = await page.evaluate(({ hue, label, width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Un aplat suffirait à passer les contrôles, mais pas à les rendre
    // informatifs : une image tramée révèle un recadrage de travers, là où un
    // fond uni le laisserait passer.
    ctx.fillStyle = `hsl(${hue} 45% 22%)`;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = `hsl(${hue + 30} 70% 60%)`;
    ctx.lineWidth = Math.max(2, width / 220);
    for (let i = -height; i < width; i += width / 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
    ctx.fillStyle = `hsl(${hue + 60} 85% 65%)`;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.round(Math.min(width, height) / 9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, width / 2, height * 0.2);

    return canvas.toDataURL('image/png').split(',')[1];
  }, spec);

  const buffer = Buffer.from(base64, 'base64');
  writeFileSync(join(IMAGES, `${spec.name}.png`), buffer);
  console.log(`${spec.name}.png  ${(buffer.length / 1024).toFixed(0)} Ko`);
}

await browser.close();
console.log(`\nRushes écrits dans ${OUT}`);
console.log(`Illustrations écrites dans ${IMAGES}`);
