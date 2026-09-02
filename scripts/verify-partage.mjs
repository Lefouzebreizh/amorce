/**
 * Vérifie la réception d'un fichier par le bouton « Partager ».
 *
 * L'intention de partage d'Android n'est pas déclenchable depuis Playwright.
 * Tout le reste l'est, et c'est l'essentiel : on envoie depuis la page un POST
 * multipart sur la cible déclarée, exactement ce que le système enverrait, et
 * c'est le vrai code du service worker qui s'exécute.
 *
 * Le contrôle le plus important n'est pas celui du partage mais celui du cache.
 * Un service worker qui met en cache sert une vieille version pendant des
 * heures — le défaut qui a coûté une soirée à ce projet. On vérifie donc qu'il
 * n'existe aucun cache du tout.
 *
 * Prérequis : `npm run dev` dans un autre terminal.
 */
import { chromium } from 'playwright';
import { optionsChromium } from './chromium.mjs';

const BASE = 'http://localhost:3000';

// Même variable que les autres scripts : elle désigne le Chromium déjà présent
// sur la machine, quand celui de Playwright n'y a pas été téléchargé.
const browser = await chromium.launch({
  ...optionsChromium,
});
const page = await browser.newPage();

let bad = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} | ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) bad++;
};

await page.goto(BASE, { waitUntil: 'networkidle' });

// Le worker prend la main de lui-même (`skipWaiting` puis `clients.claim`) :
// sans cela il resterait en attente et ne recevrait aucun partage.
const controlled = await page
  .waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 25000 })
  .then(() => true)
  .catch(() => false);
check('Le service worker prend la main sans attendre', controlled);

if (controlled) {
  /*
   * Le POST que le système enverrait, envoyé depuis la page.
   *
   * Le fichier est un vrai WAV fabriqué sur place : un blob vide passerait le
   * filtre du worker et ne prouverait rien, puisque c'est précisément le
   * fichier de zéro octet qu'on cherche à écarter.
   */
  const shared = await page.evaluate(async () => {
    const rate = 44100;
    const count = rate;
    const samples = new Int16Array(count);
    for (let i = 0; i < count; i++) samples[i] = Math.round(Math.sin(i * 0.05) * 12000);

    const header = new DataView(new ArrayBuffer(44));
    const text = (offset, value) => {
      for (let i = 0; i < value.length; i++) header.setUint8(offset + i, value.charCodeAt(i));
    };
    text(0, 'RIFF');
    header.setUint32(4, 36 + samples.byteLength, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, 1, true);
    header.setUint32(24, rate, true);
    header.setUint32(28, rate * 2, true);
    header.setUint16(32, 2, true);
    header.setUint16(34, 16, true);
    text(36, 'data');
    header.setUint32(40, samples.byteLength, true);

    const blob = new Blob([header.buffer, samples.buffer], { type: 'audio/wav' });
    const form = new FormData();
    form.append('fichiers', new File([blob], 'voix-partagee.wav', { type: 'audio/wav' }));

    const response = await fetch('/partage', { method: 'POST', body: form });
    return { url: response.url, taille: blob.size };
  });

  check(
    'Le partage est accepté et renvoie vers l’application',
    shared.url.includes('partage=1'),
    shared.url.replace(BASE, ''),
  );

  // Le fichier doit être dans la réserve, avec ses octets : c'est tout l'objet
  // de la manœuvre, le sélecteur de fichiers en rendait zéro.
  const stored = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('amorce-partage', 1);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('recus', 'readonly').objectStore('recus').getAll();
          all.onsuccess = () => {
            const files = all.result ?? [];
            resolve(files.map((f) => ({ name: f.name, size: f.blob?.size ?? 0 })));
            db.close();
          };
          all.onerror = () => resolve([]);
        };
        open.onerror = () => resolve([]);
      }),
  );

  check('Le fichier est rangé avec ses octets', stored.length === 1 && stored[0].size > 1000,
    stored.length ? `${stored[0].name}, ${stored[0].size} octets` : 'réserve vide');

  // L'application doit le trouver au démarrage et le proposer.
  await page.goto(`${BASE}/?partage=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const visible = await page.evaluate(() => document.body.innerText.includes('reçu par partage'));
  check('L’application propose le fichier reçu', visible);

  const nameShown = await page.evaluate(() => document.body.innerText.includes('voix-partagee.wav'));
  check('Le fichier reçu est nommé', nameShown);

  // La réserve doit être vide : un partage relu deux fois importerait en double.
  const drained = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('amorce-partage', 1);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('recus', 'readonly').objectStore('recus').getAll();
          all.onsuccess = () => {
            resolve((all.result ?? []).length);
            db.close();
          };
          all.onerror = () => resolve(-1);
        };
        open.onerror = () => resolve(-1);
      }),
  );
  check('La réserve est vidée après lecture', drained === 0, `${drained} fichier(s) restant(s)`);

  const flag = await page.evaluate(() => window.location.search);
  check('Le drapeau est retiré de l’adresse', !flag.includes('partage'), flag || '(vide)');
}

/*
 * Le contrôle qui compte le plus.
 *
 * Aucun cache ne doit exister. C'est la seule garantie qu'une correction
 * déployée parvienne à l'appareil au lieu d'y rester bloquée derrière une
 * version périmée servie par le worker.
 */
const caches = await page.evaluate(() => caches.keys());
check('Le worker ne met rien en cache', caches.length === 0, caches.join(', ') || 'aucun cache');

const erreurs = await page.evaluate(() => (window.__probe?.errors ?? []).slice(0, 3));
check('Aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

await browser.close();
console.log(bad === 0 ? '\n--- partage : tout passe ---' : `\n--- partage : ${bad} échec(s) ---`);
process.exit(bad === 0 ? 0 : 1);
