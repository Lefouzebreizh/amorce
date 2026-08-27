/**
 * Du plan au fichier publiable, en une commande.
 *
 *   node monter.mjs <plan.json> [--sortie /tmp/jour-1.mp4]
 *
 * Trois étapes, et chacune corrige un piège qui, sans elle, produit un fichier
 * qui s'ouvre normalement et se révèle inutilisable :
 *
 * 1. Enregistrer la composition en temps réel, image poussée par image.
 * 2. Réencoder en H.264 + AAC — c'est ce que TikTok ingère sans transcoder.
 * 3. Contrôler sur les pixels et sur le signal sonore, pas sur les métadonnées.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { cheminFfmpeg, ffmpeg, ouvrirNavigateur, servir } from './outils.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../../../..');

const [cheminPlan, ...reste] = process.argv.slice(2);
if (!cheminPlan) {
  console.error('usage : node monter.mjs <plan.json> [--sortie fichier.mp4]');
  process.exit(1);
}

const option = (nom, defaut) => {
  const i = reste.indexOf(`--${nom}`);
  return i === -1 ? defaut : reste[i + 1];
};

/*
 * Le plan est relu ici uniquement pour échouer tout de suite s'il est mal
 * formé. Le compositeur le charge lui-même, dans le navigateur ; une virgule
 * en trop s'y traduirait sinon par une page muette et une erreur qui ne parle
 * ni du fichier ni de la ligne fautive.
 */
JSON.parse(readFileSync(cheminPlan, 'utf8'));
const atelier = dirname(resolve(cheminPlan));
const sortie = resolve(option('sortie', join(atelier, 'montage.mp4')));

// --------------------------------------------------------- Préparer l'atelier
mkdirSync(atelier, { recursive: true });
copyFileSync(join(ICI, '../assets/montage.html'), join(atelier, 'montage.html'));

/*
 * Les transitions sont compilées depuis le module du dépôt, jamais recopiées.
 * Une copie à la main donnerait deux implémentations, et la seconde dériverait
 * au premier réglage sans que rien ne le signale.
 */
const source = readFileSync(join(RACINE, 'src/lib/transitions.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
writeFileSync(join(atelier, 'types.js'), 'export const OUTPUT_WIDTH = 1080;\nexport const OUTPUT_HEIGHT = 1920;\n');
writeFileSync(join(atelier, 'transitions.js'), outputText.replace("'./types.ts'", "'./types.js'"));

const binaireFfmpeg = cheminFfmpeg('/tmp/outillage-video');

// ------------------------------------------------------------- 1. Enregistrer
const serveur = servir(atelier);
await serveur.pret;

const navigateur = await ouvrirNavigateur();
const page = await navigateur.newPage();
page.on('pageerror', (e) => console.log(`  [page] ${e.message}`));
await page.goto(`${serveur.base}/montage.html`);

/*
 * Attendre que le module se soit exécuté avant de l'interroger.
 *
 * Le compositeur est un module, et un module s'exécute après le chargement de
 * la page. Interroger `window.__pret` dès que `goto` rend la main tombe donc
 * sur `undefined`, et l'erreur — « Cannot read properties of undefined » —
 * ne dit rien de la course qui l'a produite.
 */
await page.waitForFunction(() => window.__pret !== undefined, undefined, { timeout: 30000 });
const infos = await page.evaluate(() => window.__pret);
console.log(`composition : ${infos.duree} s à ${infos.fps} i/s`);

const brut = await page.evaluate(async ({ duree, fps, voix }) => {
  const canvas = document.getElementById('scene');
  const flux = canvas.captureStream(0);
  const piste = flux.getVideoTracks()[0];

  let source = null;
  let audioCtx = null;
  if (voix) {
    audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(await (await fetch(voix)).arrayBuffer());
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const destination = audioCtx.createMediaStreamDestination();
    source.connect(destination);
    for (const p of destination.stream.getAudioTracks()) flux.addTrack(p);
  }

  const formats = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  const format = formats.find((f) => MediaRecorder.isTypeSupported(f));
  if (!format) throw new Error('Aucun format d’enregistrement disponible.');

  const recorder = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 8_000_000 });
  const morceaux = [];
  recorder.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
  const fini = new Promise((r) => (recorder.onstop = r));

  recorder.start();
  source?.start();
  const depart = performance.now();

  /*
   * Capture manuelle, image par image.
   *
   * En rendu logiciel, composer une image de 1080 × 1920 coûte souvent plus que
   * le tiers de seconde alloué. Avec `captureStream(fps)`, le muxeur horodate
   * alors à la cadence nominale et le fichier sort trois fois trop court. En
   * poussant nous-mêmes chaque image, l'horloge suit le temps réel : on perd
   * des images sur une machine lente, jamais la durée ni la synchronisation.
   */
  let images = 0;
  await new Promise((resolve) => {
    const boucle = () => {
      const t = (performance.now() - depart) / 1000;
      if (t >= duree) return resolve();
      window.dessiner(t);
      piste.requestFrame();
      images++;
      const retard = (performance.now() - depart) / 1000 - t;
      setTimeout(boucle, Math.max(0, 1000 / fps - retard * 1000));
    };
    boucle();
  });

  // Une dernière image tenue : couper au ras de la fin laisse parfois le
  // conteneur sans image sur son dernier segment.
  window.dessiner(duree - 0.01);
  piste.requestFrame();
  await new Promise((r) => setTimeout(r, 200));

  recorder.stop();
  await fini;
  source?.stop();
  await audioCtx?.close();

  const octets = new Uint8Array(await new Blob(morceaux, { type: format }).arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  }
  return { b64: btoa(binaire), format, images, cadence: images / duree };
}, infos);

await navigateur.close();
serveur.arreter();

const cheminBrut = join(atelier, 'brut.mp4');
writeFileSync(cheminBrut, Buffer.from(brut.b64, 'base64'));
console.log(`enregistré : ${brut.images} images, ${brut.cadence.toFixed(1)} i/s réelles`);

// --------------------------------------------------------------- 2. Réencoder
/*
 * MediaRecorder annonce `video/mp4` puis y range du VP9 et de l'Opus, que la
 * plupart des plateformes refusent ou transcodent mal. Le réencodage règle ça
 * et, au passage, réécrit une durée exacte dans l'en-tête — celle du fichier
 * brut est fausse, et un lecteur qui la croit s'arrête au tiers de la vidéo.
 */
execFileSync(binaireFfmpeg, [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', cheminBrut,
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-r', String(infos.fps), '-crf', '20', '-preset', 'slow',
  '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  // Sans faststart, l'index reste en fin de fichier : la lecture ne démarre
  // qu'une fois tout téléchargé.
  '-movflags', '+faststart',
  sortie,
]);

// --------------------------------------------------------------- 3. Contrôler
const sonde = ffmpeg(binaireFfmpeg, ['-i', sortie]);
const duree = sonde.match(/Duration: (\d+):(\d+):([\d.]+)/);
const secondes = duree ? Number(duree[1]) * 3600 + Number(duree[2]) * 60 + Number(duree[3]) : 0;
const flux = [...sonde.matchAll(/Stream #\d+:\d+.*: (Video|Audio): (\w+).*/g)].map((m) => `${m[1]} ${m[2]}`);

// La luminosité image par image est le seul contrôle qui verrait un export
// noir : il ne lève aucune erreur, il annonce la bonne durée, et il est noir.
const luminosites = [...ffmpeg(binaireFfmpeg, [
  '-i', sortie,
  '-vf', "select='not(mod(n,10))',signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
  '-vsync', '0', '-f', 'null', '-',
]).matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));

const volume = ffmpeg(binaireFfmpeg, ['-i', sortie, '-af', 'volumedetect', '-f', 'null', '-']);
const crete = volume.match(/max_volume: (-?[\d.]+) dB/);

const noires = luminosites.filter((y) => y < 6);
const controle = (libelle, ok, detail = '') =>
  console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} | ${libelle}${detail ? ` — ${detail}` : ''}`);

console.log(`\n${basename(sortie)}`);
controle('Le fichier est lisible', secondes > 0, `${secondes.toFixed(2)} s`);
controle('La durée correspond à la composition', Math.abs(secondes - infos.duree) < 0.6, `${secondes.toFixed(2)} s pour ${infos.duree} s`);
controle('Codecs acceptés sans transcodage', flux.some((f) => f.includes('h264')) && (!infos.voix || flux.some((f) => f.includes('aac'))), flux.join(', '));
controle('Aucune image noire', luminosites.length > 0 && noires.length === 0, `${noires.length} sur ${luminosites.length} images mesurées`);
if (infos.voix) {
  controle('Le son est présent et non saturé', crete && Number(crete[1]) > -40 && Number(crete[1]) < -0.5, crete ? `crête ${crete[1]} dB` : 'non mesurée');
}

console.log(`\n→ ${sortie}`);
console.log('→ Regarde-le avant de le publier : une planche-contact ne remplace pas la lecture.');
