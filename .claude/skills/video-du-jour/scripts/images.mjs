/**
 * Ramène des images à 1080 × 1920, recadrées autour de leur sujet.
 *
 * Le studio recouvre en centrant. C'est le bon défaut, mais sur une image large
 * dont le sujet n'est pas au milieu, ça garde le fond et jette le sujet — un
 * zèbre dont il ne reste que la croupe, un logo hors champ. Ici on décide où
 * couper, et on le voit avant de monter.
 *
 *   node images.mjs mesurer  img1.png img2.jpg …
 *   node images.mjs essayer  img.webp --ancrages 0.35,0.5,0.65 --sortie /tmp/essais
 *   node images.mjs recadrer --sortie /tmp/plans img1.webp:0.62 img2.png img3.jpg:0.4
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { ouvrirNavigateur } from './outils.mjs';

const LARGEUR = 1080;
const HAUTEUR = 1920;

/** Qualité JPEG de sortie. Au-delà le fichier double sans gain sur un écran de téléphone. */
const QUALITE = 0.92;

const MIMES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };

const [commande, ...reste] = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = reste.indexOf(`--${nom}`);
  return i === -1 ? defaut : reste[i + 1];
};
const fichiers = reste.filter((a) => !a.startsWith('--') && !reste[reste.indexOf(a) - 1]?.startsWith('--'));

if (!commande) {
  console.error('usage : node images.mjs <mesurer|essayer|recadrer> …');
  process.exit(1);
}

const navigateur = await ouvrirNavigateur();
const page = await navigateur.newPage();
await page.goto('about:blank');

/** Charge une image dans la page et rend ses dimensions natives. */
async function mesurer(chemin) {
  const mime = MIMES[extname(chemin).toLowerCase()] ?? 'image/png';
  const b64 = readFileSync(chemin).toString('base64');
  return page.evaluate(
    async ({ b64, mime }) => {
      const image = new Image();
      image.src = `data:${mime};base64,${b64}`;
      await image.decode();
      return { w: image.naturalWidth, h: image.naturalHeight };
    },
    { b64, mime },
  );
}

/** Recadre en 9:16 autour d'un point horizontal, et rend le JPEG en base64. */
async function recadrer(chemin, ancrage, hauteurUtile) {
  const mime = MIMES[extname(chemin).toLowerCase()] ?? 'image/png';
  const b64 = readFileSync(chemin).toString('base64');
  return page.evaluate(
    async ({ b64, mime, ancrage, hauteurUtile, LARGEUR, HAUTEUR, QUALITE }) => {
      const image = new Image();
      image.src = `data:${mime};base64,${b64}`;
      await image.decode();
      const w = image.naturalWidth;
      const h = image.naturalHeight;

      // `hauteurUtile` sert à exclure une bande — un texte incrusté en bas, un
      // bandeau. On cadre alors plus serré, ce qui vaut toujours mieux qu'un
      // texte étranger tronqué à l'écran.
      const hUtile = Math.min(h, Math.round(h * hauteurUtile));
      const largeur = Math.min(w, hUtile * (9 / 16));
      const hauteur = largeur * (16 / 9);
      const x = Math.max(0, Math.min(w - largeur, w * ancrage - largeur / 2));
      const y = Math.max(0, Math.min(h - hauteur, (hUtile - hauteur) / 2));

      const canvas = document.createElement('canvas');
      canvas.width = LARGEUR;
      canvas.height = HAUTEUR;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, x, y, largeur, hauteur, 0, 0, LARGEUR, HAUTEUR);

      return {
        data: canvas.toDataURL('image/jpeg', QUALITE).split(',')[1],
        source: `${w}x${h}`,
        fenetre: `${Math.round(x)}→${Math.round(x + largeur)}`,
      };
    },
    { b64, mime, ancrage, hauteurUtile, LARGEUR, HAUTEUR, QUALITE },
  );
}

if (commande === 'mesurer') {
  for (const chemin of fichiers) {
    const { w, h } = await mesurer(chemin);
    const couverture = Math.max(LARGEUR / w, HAUTEUR / h);
    const visible = (LARGEUR / (w * couverture)) * 100;
    const verdict =
      visible > 95
        ? 'déjà vertical, rien à faire'
        : visible > 60
          ? 'sujet centré : le recadrage centré suffit'
          : 'LARGE — vérifie où est le sujet avant de monter';
    console.log(`${basename(chemin).padEnd(28)} ${String(w).padStart(5)} × ${String(h).padEnd(5)}  ${visible.toFixed(0).padStart(3)} % de la largeur visible  — ${verdict}`);
  }
}

if (commande === 'essayer') {
  const sortie = option('sortie', '/tmp/essais-cadrage');
  mkdirSync(sortie, { recursive: true });
  const ancrages = option('ancrages', '0.35,0.5,0.65').split(',').map(Number);
  const hauteurUtile = Number(option('hauteur', 1));

  for (const chemin of fichiers) {
    for (const ancrage of ancrages) {
      const r = await recadrer(chemin, ancrage, hauteurUtile);
      const nom = join(sortie, `${basename(chemin, extname(chemin))}-${ancrage}.jpg`);
      writeFileSync(nom, Buffer.from(r.data, 'base64'));
      console.log(`${nom}  (fenêtre ${r.fenetre} sur ${r.source})`);
    }
  }
  console.log('\n→ Regarde-les avant de choisir. Un recadrage se juge à l’œil, pas au calcul.');
}

if (commande === 'recadrer') {
  const sortie = option('sortie', '/tmp/plans');
  mkdirSync(sortie, { recursive: true });
  const hauteurUtile = Number(option('hauteur', 1));

  let index = 0;
  for (const specification of fichiers) {
    // « chemin:ancrage » — l'ancrage est facultatif et vaut le centre par défaut.
    const separateur = specification.lastIndexOf(':');
    const aUnAncrage = separateur > 2 && !Number.isNaN(Number(specification.slice(separateur + 1)));
    const chemin = aUnAncrage ? specification.slice(0, separateur) : specification;
    const ancrage = aUnAncrage ? Number(specification.slice(separateur + 1)) : 0.5;

    const r = await recadrer(chemin, ancrage, hauteurUtile);
    const numero = String(++index).padStart(2, '0');
    const nom = join(sortie, `${numero}-${basename(chemin, extname(chemin))}.jpg`);
    const buffer = Buffer.from(r.data, 'base64');
    writeFileSync(nom, buffer);
    console.log(`${basename(nom).padEnd(32)} ${r.source.padEnd(11)} → 1080x1920  ${(buffer.length / 1024).toFixed(0)} Ko`);
  }
}

await navigateur.close();
