#!/usr/bin/env node
/**
 * Parcours de vérification d'un site du réseau, dans un vrai Chromium.
 *
 * Une page unique sans étape de compilation n'a ni typecheck ni lint pour
 * l'attraper : la seule chose qui dise si elle marche est de l'ouvrir. Trois
 * défauts de la première version ne se voyaient qu'ainsi — une recherche qui
 * renvoyait tout, une fenêtre de détail qui restait ouverte quand le CDN
 * tardait, un bouton coupé en deux lignes.
 *
 * Le script sert le dossier lui-même sur un port libre : `outils.json` est
 * refusé en `file://`, et dépendre d'un serveur lancé à côté fait rater le
 * parcours une fois sur deux.
 *
 *   node .claude/skills/annuaire-ia/scripts/verifier.mjs             # niche par défaut
 *   node .claude/skills/annuaire-ia/scripts/verifier.mjs btp         # une niche précise
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { chromium } from 'playwright';

const dossier = resolve('annuaire-ia');
const nicheDemandee = process.argv[2] || null;
const captures = resolve('.verif-ci/annuaire');
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
                '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const serveur = createServer(async (req, reponse) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const fichier = join(dossier, normalize(chemin === '/' ? '/index.html' : chemin));
  if (!fichier.startsWith(dossier)) { reponse.writeHead(403).end(); return; }
  try {
    const corps = await readFile(fichier);
    reponse.writeHead(200, { 'content-type': TYPES[extname(fichier)] || 'application/octet-stream' });
    reponse.end(corps);
  } catch { reponse.writeHead(404).end('introuvable'); }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${serveur.address().port}/`;

const resultats = [];
const controle = (nom, condition, detail = '') =>
  resultats.push({ nom, ok: Boolean(condition), detail });

// Le mandataire de certains environnements bloque les CDN. On le contourne pour
// le serveur local, et l'absence de style ne doit pas faire échouer le parcours :
// les contrôles portent sur le comportement, pas sur l'apparence.
const navigateur = await chromium.launch({
  ...(process.env.AMORCE_CHROMIUM ? { executablePath: process.env.AMORCE_CHROMIUM } : {}),
  ...(process.env.HTTPS_PROXY
    ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } }
    : {}),
});
const page = await navigateur.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const plantages = [];
page.on('pageerror', (e) => plantages.push(String(e)));

try {
  // La niche par défaut est déclarée dans le gabarit lui-même : la lire évite
  // qu'ajouter un site oblige à toucher ce script.
  const gabarit = await readFile(join(dossier, 'index.html'), 'utf8');
  const parDefaut = gabarit.match(/name="niche-par-defaut" content="([a-z0-9-]+)"/)?.[1];
  const niche = nicheDemandee || parDefaut;
  if (!niche) throw new Error('niche par défaut introuvable dans index.html');
  const adresse = `${base}?niche=${niche}`;

  await page.goto(adresse, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grille article', { timeout: 15000 });

  const outils = JSON.parse(await readFile(join(dossier, `niches/${niche}.json`), 'utf8')).outils;
  console.log(`  ── niche « ${niche} », ${outils.length} outils`);
  const cartes = await page.locator('#grille article').count();
  controle('toutes les fiches de la base sont affichées', cartes === outils.length,
           `${cartes} cartes pour ${outils.length} fiches`);

  const categories = new Set(outils.map((o) => o.categorie));
  const filtres = await page.locator('#filtres button').count();
  controle('un filtre par catégorie, plus « Tous »', filtres === categories.size + 1,
           `${filtres} boutons pour ${categories.size} catégories`);

  // Une recherche qui renvoie tout est le défaut le plus discret de cet écran :
  // l'écran a l'air normal. Un mot d'une seule fiche doit n'en renvoyer qu'une.
  const seul = outils[outils.length - 1];
  await page.fill('#recherche', seul.nom.slice(0, 5).toLowerCase());
  await page.waitForTimeout(150);
  const trouves = await page.locator('#grille article h2').allTextContents();
  // Le titre de carte peut porter un badge collé au nom (« Write.homesNouveau ») :
  // comparer par préfixe, sinon le contrôle échoue sur sa propre exigence.
  controle('la recherche discrimine',
           trouves.length < outils.length && trouves.some((t) => t.startsWith(seul.nom)),
           `« ${seul.nom.slice(0, 5)} » → ${trouves.join(', ') || 'rien'}`);

  await page.fill('#recherche', 'zzzzz');
  await page.waitForTimeout(150);
  controle('l’état vide se montre', await page.locator('#vide').isVisible());
  await page.click('[data-action="reinitialiser"]');
  controle('la réinitialisation rend toutes les fiches',
           (await page.locator('#grille article').count()) === outils.length);

  const cat = [...categories][0];
  await page.click(`[data-categorie="${cat}"]`);
  const attendus = outils.filter((o) => o.categorie === cat).length;
  const filtres_ = await page.locator('#grille article').count();
  controle(`le filtre « ${cat} » ne garde que les siennes`, filtres_ === attendus,
           `${filtres_} au lieu de ${attendus}`);
  await page.click('[data-categorie="Tous"]');

  const cible = outils[0];
  await page.locator(`[data-outil="${cible.id}"]`).click();
  await page.waitForSelector('#modale:not(.hidden)');
  controle('la fenêtre de détail porte le bon outil',
           (await page.locator('#modale-titre').textContent()) === cible.nom);
  controle('l’avis long est mis en forme',
           (await page.locator('#modale-corps h3').count()) >= 3);
  controle('le lien affilié est marqué comme tel',
           (await page.locator('#modale-lien').getAttribute('rel'))?.includes('sponsored'));
  controle('la fiche a sa propre adresse',
           page.url().includes(`niche=${niche}`) && page.url().includes(`outil=${cible.id}`),
           page.url());
  controle('le titre de page suit la fiche', (await page.title()).startsWith(cible.nom));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  // Sans la règle `.hidden` écrite en dur dans la page, la fenêtre reste ouverte
  // par-dessus le contenu dès que le CDN tarde : le site devient inutilisable.
  controle('Échap referme vraiment, même sans le style du CDN',
           await page.locator('#modale').isHidden());

  await page.goto(`${adresse}&outil=${outils[1].id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modale:not(.hidden)', { timeout: 10000 });
  controle('un lien profond ouvre la bonne fiche',
           (await page.locator('#modale-titre').textContent()) === outils[1].nom);

  const ld = JSON.parse(await page.locator('#donnees-structurees').textContent());
  controle('les données structurées décrivent toutes les fiches',
           ld.numberOfItems === outils.length && ld.itemListElement?.[0]?.item?.aggregateRating,
           `${ld.numberOfItems} entrées`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(adresse, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grille article');
  const debord = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  controle('rien ne déborde sur un téléphone', debord === 0, `${debord} px`);

  await page.screenshot({ path: join(captures, `${niche}-telephone.png`) }).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: join(captures, `${niche}-ordinateur.png`) }).catch(() => {});

  controle('aucune erreur JavaScript', plantages.length === 0, plantages.join(' | '));
} catch (erreur) {
  controle('le parcours va jusqu’au bout', false, String(erreur));
} finally {
  await navigateur.close();
  serveur.close();
}

let echec = 0;
for (const { nom, ok, detail } of resultats) {
  if (!ok) echec = 1;
  console.log(`  ${ok ? 'VERT ' : 'ROUGE'}  ${nom}${detail && !ok ? `  — ${detail}` : ''}`);
}
console.log(echec ? 'Des contrôles ont échoué.' : `${resultats.length} contrôles, tout vert. Captures : ${captures}/`);
process.exit(echec);
