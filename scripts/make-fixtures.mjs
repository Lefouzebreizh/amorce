/**
 * Fabrique des rushes de test.
 *
 * Aucun fichier vidéo n'est versionné : ils sont produits à la demande par
 * Chromium, en animant un canvas et en l'enregistrant avec `MediaRecorder` —
 * exactement la technique qu'utilise l'export du studio. Chaque rush porte une
 * piste sonore synthétique, sans quoi il serait impossible de vérifier plus tard
 * que le mixage restitue bien le son d'origine des plans.
 *
 * Usage : npm run fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.fixtures', 'rushes');

/** Quatre plans de durées inégales, pour éprouver le calcul de la timeline. */
const SPECS = [
  { name: 'rush1', hue: 205, label: 'PLAN 1', seconds: 4 },
  { name: 'rush2', hue: 330, label: 'PLAN 2', seconds: 3 },
  { name: 'rush3', hue: 95, label: 'PLAN 3', seconds: 5 },
  { name: 'rush4', hue: 35, label: 'PLAN 4', seconds: 3 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.AMORCE_CHROMIUM || undefined,
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

await browser.close();
console.log(`\nRushes écrits dans ${OUT}`);
