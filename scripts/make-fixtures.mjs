/**
 * Fabrique les médias de test.
 *
 * Aucun fichier vidéo n'est versionné : ils sont produits à la demande par
 * Chromium, en animant un canvas et en l'enregistrant avec `MediaRecorder` —
 * exactement la technique qu'utilise l'export du studio. Chaque rush porte une
 * piste sonore synthétique, sans quoi il serait impossible de vérifier plus tard
 * que le mixage restitue bien le son d'origine des plans.
 *
 * Aux quatre rushes s'ajoutent deux illustrations fixes, au format d'un dessin
 * et non d'un écran de téléphone : c'est la matière de quiconque publie ce
 * qu'il dessine, et c'est elle qui éprouve le recadrage en 9:16.
 *
 * Usage : npm run fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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

mkdirSync(OUT, { recursive: true });
mkdirSync(IMAGES, { recursive: true });

const browser = await chromium.launch({
  ...optionsChromium,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.goto('about:blank');

for (const spec of SPECS) {
  const base64 = await page.evaluate(async ({ hue, label, seconds }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const destination = audioCtx.createMediaStreamDestination();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 180 + hue;
    gain.gain.value = 0.25;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();

    const stream = canvas.captureStream(30);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();

    const start = performance.now();
    await new Promise((resolve) => {
      const draw = () => {
        const t = (performance.now() - start) / 1000;
        if (t >= seconds) return resolve();
        // Le fond et le disque bougent en continu : deux images consécutives
        // doivent différer, sinon les contrôles de « l'image change » seraient
        // satisfaits par une vidéo figée.
        ctx.fillStyle = `hsl(${hue + t * 12} 55% ${20 + Math.sin(t * 2) * 8}%)`;
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.fillStyle = `hsl(${hue + 40} 80% 62%)`;
        ctx.beginPath();
        ctx.arc(540 + Math.sin(t * 1.6) * 300, 960 + Math.cos(t * 1.2) * 400, 190, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '900 150px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, 540, 400);
        ctx.font = '600 70px monospace';
        ctx.fillText(`${t.toFixed(2)}s`, 540, 1650);
        requestAnimationFrame(draw);
      };
      draw();
    });

    recorder.stop();
    await stopped;
    oscillator.stop();
    await audioCtx.close();

    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }, spec);

  const buffer = Buffer.from(base64, 'base64');
  writeFileSync(join(OUT, `${spec.name}.webm`), buffer);
  console.log(`${spec.name}.webm  ${(buffer.length / 1024).toFixed(0)} Ko`);
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
