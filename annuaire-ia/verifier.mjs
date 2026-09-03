#!/usr/bin/env node
/**
 * Le parcours du réseau, joué dans un vrai navigateur.
 *
 * Onze sites qui n'ont ni compilateur, ni typage, ni test unitaire possible :
 * tout ce qui compte ici — la charte qui suit la niche, la modale, l'adresse
 * profonde, le repli — ne se voit qu'en exécutant la page. `valider.js` dit
 * que les données sont saines ; celui-ci dit que le site les affiche.
 *
 * **Les attentes sont tirées des données, jamais écrites en dur.** La première
 * version de ce parcours affirmait « trois cartes » ; l'auto-pilote en a publié
 * une quatrième le lendemain et le parcours est passé au rouge sans qu'aucun
 * défaut n'existe. Un filet qui se déchire à chaque publication n'est pas un
 * filet — c'est une corvée qu'on finit par désactiver.
 *
 * Usage :
 *   node verifier.mjs                tout le réseau
 *   node verifier.mjs btp            une seule niche, pour isoler un défaut
 *   AMORCE_CHROMIUM=/opt/... node verifier.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierNiches = path.join(racine, 'niches');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright est introuvable.\n' +
    '  Il vient des dépendances du dépôt : lancer `npm install` à la racine d’Amorce.\n' +
    '  Le navigateur, lui, est déjà là — ne pas lancer `playwright install`.'
  );
  process.exit(1);
}

/* Chromium de l'environnement : sa révision n'est pas celle que Playwright
   attend, et sans ce chemin explicite il tenterait un téléchargement qui
   n'aboutira pas. Même contrainte que le parcours d'Amorce. */
const CHEMIN_CHROMIUM = process.env.AMORCE_CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.xml': 'application/xml', '.txt': 'text/plain' };

function servir() {
  const serveur = http.createServer((req, res) => {
    const chemin = new URL(req.url, 'http://local').pathname;
    const fichier = path.join(racine, chemin === '/' ? 'index.html' : decodeURIComponent(chemin));
    if (!fichier.startsWith(racine) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('404');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    res.end(fs.readFileSync(fichier));
  });
  return new Promise((resoudre) => {
    serveur.listen(0, () => resoudre({ serveur, port: serveur.address().port }));
  });
}

const bases = fs
  .readdirSync(dossierNiches)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dossierNiches, f), 'utf8')));

const demandees = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const aParcourir = demandees.length ? bases.filter((b) => demandees.includes(b.niche.id)) : bases;
if (aParcourir.length === 0) {
  console.error(`Aucune niche ne correspond à : ${demandees.join(', ')}`);
  process.exit(1);
}

let echecs = 0;
let controles = 0;
function verifier(nom, ok, detail = '') {
  controles += 1;
  console.log(`${ok ? '  ok  ' : '  ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`);
  if (!ok) echecs += 1;
}

const { serveur, port } = await servir();
const adresse = (suffixe = '') => `http://localhost:${port}/${suffixe}`;

const navigateur = await chromium.launch({ executablePath: CHEMIN_CHROMIUM });
/* Format téléphone : c'est là que le réseau sera lu, et une carte qui déborde
   ne se voit pas sur un écran d'ordinateur. */
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
const erreursJs = [];
page.on('pageerror', (e) => erreursJs.push(String(e)));

async function ouvrir(suffixe) {
  await page.goto(adresse(suffixe), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#grille article').length > 0, { timeout: 10000 });
}

/* --- Ce qui ne dépend d'aucune niche en particulier ---------------------- */
const parDefaut = /content="([a-z0-9-]+)"/.exec(
  /<meta name="niche-par-defaut"[^>]*>/.exec(fs.readFileSync(path.join(racine, 'index.html'), 'utf8'))?.[0] ?? ''
)?.[1];
const baseDefaut = bases.find((b) => b.niche.id === parDefaut);

await ouvrir('');
verifier(
  `sans paramètre → ${parDefaut}`,
  (await page.title()) === baseDefaut.niche.meta_titre,
  await page.title()
);
verifier(
  'canonique portée par la niche du domaine',
  (await page.getAttribute('link[rel=canonical]', 'href')).endsWith(`?niche=${parDefaut}`)
);

await page.goto(adresse('?niche=niche-qui-nexiste-pas'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelectorAll('#grille article').length > 0, { timeout: 10000 });
verifier(
  'niche inconnue → repli sur la niche du domaine, pas une page d’erreur',
  (await page.locator('#grille article').count()) === baseDefaut.outils.length
);

/* --- Chaque niche, avec ses propres attentes ----------------------------- */
for (const { niche, outils } of aParcourir) {
  if (outils.length === 0) {
    console.log(`\n${niche.emoji ?? '·'} ${niche.id} — niche vide, rien à parcourir`);
    continue;
  }
  console.log(`\n${niche.emoji ?? '·'} ${niche.id}`);
  await ouvrir(`?niche=${niche.id}`);

  verifier('titre de la niche', (await page.title()) === niche.meta_titre);
  const h1 = (await page.textContent('h1')).replace(/\s+/g, ' ').trim();
  verifier('accroche de la niche', h1.includes(niche.h1_accent) && h1.includes(niche.h1_suite), h1);
  verifier('slogan de la niche', (await page.textContent('#slogan')).trim() === niche.slogan);

  const teinte = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--teinte-1').trim());
  verifier('charte graphique appliquée', teinte.toLowerCase() === niche.theme.primaire.toLowerCase(), teinte);

  const cartes = await page.locator('#grille article').count();
  verifier('tous les outils affichés', cartes === outils.length, `${cartes}/${outils.length}`);

  /* Aucun lien mort visible, quel que soit l'état d'avancement des programmes.

     `exemple-affiliation.com` est un gabarit : le domaine n'existe pas. Le
     02/09/2026, 99 outils sur 106 le portaient et le bouton y menait quand
     même — sur le seul élément de la page qui rapporte. Le gabarit masque
     désormais le bouton tant que l'adresse n'est pas posée ; ce contrôle
     existe pour que le retrait de ce garde-fou se voie ici et non en ligne.

     Il se lit dans les deux sens : les boutons visibles doivent valoir
     exactement le nombre d'outils dont l'adresse est réellement posée. */
  const morts = await page.locator('a[href*="exemple-affiliation"]').count();
  verifier('aucun lien de démonstration cliquable', morts === 0, `${morts} trouvé(s)`);

  const poses = outils.filter((o) => {
    const a = typeof o.lien_affiliation === 'string' ? o.lien_affiliation.trim() : '';
    return a !== '' && !/exemple-affiliation\.com/.test(a);
  }).length;
  const visibles = await page.locator('#grille article a.bouton-accent').count();
  verifier('un bouton affilié par adresse posée', visibles === poses, `${visibles} bouton(s) / ${poses} posée(s)`);

  if (niche.emoji) {
    const favicon = decodeURIComponent(await page.getAttribute('link[rel=icon]', 'href'));
    verifier('favicon de la niche', favicon.includes(niche.emoji));
  }

  /* Recherche : on cherche un mot pris dans le premier outil, et on attend
     qu'il en reste au moins un et strictement moins que tous. */
  const premier = outils[0];
  const motif = premier.nom.split(/[\s.]/)[0];
  await page.fill('#recherche', motif);
  await page.waitForFunction(
    (n) => document.querySelectorAll('#grille article').length <= n,
    cartes, { timeout: 5000 }
  );
  const filtres = await page.locator('#grille article').count();
  /* Strictement moins, comme l'annonce le commentaire ci-dessus. Avec `<=`, une
     recherche qui ne filtre plus rien — le champ ignoré, la casse mal traitée —
     passait au vert : la grille entière satisfait `filtres <= cartes`. C'est le
     défaut le plus discret de cet écran, puisque la page a l'air normale. */
  verifier(`recherche « ${motif} »`, filtres >= 1 && filtres < cartes, `${filtres}/${cartes} carte(s)`);
  await page.fill('#recherche', '');

  /* Filtre : le compte attendu se calcule sur la base, il suit donc chaque
     publication de l'auto-pilote sans qu'on retouche ce fichier. */
  const categorie = premier.categorie;
  const attendus = outils.filter((o) => o.categorie === categorie).length;
  await page.click(`button[data-categorie="${categorie.replace(/"/g, '\\"')}"]`);
  await page.waitForFunction(
    (n) => document.querySelectorAll('#grille article').length === n,
    attendus, { timeout: 5000 }
  ).catch(() => {});
  verifier(`filtre « ${categorie} »`, (await page.locator('#grille article').count()) === attendus, `attendu ${attendus}`);
  await page.click('button[data-categorie="Tous"]');

  /* Modale et adresse profonde : c'est par là qu'arrive le trafic du sitemap. */
  await page.click(`button[data-outil="${premier.id}"]`);
  await page.waitForSelector('#modale:not(.hidden)');
  verifier('modale ouverte sans rechargement', (await page.textContent('#modale-titre')) === premier.nom);
  verifier('avis tracé en sections', (await page.locator('#modale-corps h3').count()) >= 4);
  verifier('adresse profonde poussée', page.url().includes(`?niche=${niche.id}&outil=${premier.id}`));
  verifier('titre suit l’outil ouvert', (await page.title()).startsWith(premier.nom));
  /* Deux régimes, et le contrôle doit tenir les deux — sans quoi il devient
     vert par accident le jour où le pied de fenêtre est masqué à tort.

     Adresse posée : le pied s'affiche, le lien porte `sponsored` et pointe
     exactement sur elle. Adresse encore en gabarit : le pied est masqué, et
     surtout le visiteur n'a rien à cliquer qui mène au vide. */
  const adressePremier = typeof premier.lien_affiliation === 'string' ? premier.lien_affiliation.trim() : '';
  const posee = adressePremier !== '' && !/exemple-affiliation\.com/.test(adressePremier);
  const piedVisible = await page.isVisible('#modale-lien');
  if (posee) {
    verifier(
      'lien affilié en rel="sponsored"',
      piedVisible
      && (await page.getAttribute('#modale-lien', 'rel')).includes('sponsored')
      && (await page.getAttribute('#modale-lien', 'href')) === premier.lien_affiliation
    );
  } else {
    verifier(
      'adresse pas encore posée → aucun bouton à cliquer',
      !piedVisible,
      piedVisible ? 'le pied de fenêtre reste affiché' : ''
    );
    verifier(
      'le focus reste dans la fenêtre quand le bouton est retiré',
      await page.evaluate(() => document.activeElement?.closest('#modale') !== null)
    );
  }
  await page.keyboard.press('Escape');
  verifier('échap referme', await page.isHidden('#modale-corps'));

  /* Entrée directe, exactement comme depuis un résultat de recherche. */
  const dernier = outils.at(-1);
  await ouvrir(`?niche=${niche.id}&outil=${dernier.id}`);
  await page.waitForSelector('#modale:not(.hidden)');
  verifier('entrée directe sur une fiche', (await page.textContent('#modale-titre')) === dernier.nom);
  await page.keyboard.press('Escape');

  /* Cibles tactiles : la règle du dépôt est 44 px, et une grille qui déborde
     ne se voit sur aucun écran d'ordinateur. */
  const troppetits = await page.evaluate(() =>
    [...document.querySelectorAll('#grille a, #grille button')]
      .filter((e) => e.getBoundingClientRect().height < 44).length);
  verifier('cibles tactiles d’au moins 44 px', troppetits === 0, `${troppetits} trop petites`);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  verifier('rien ne déborde en largeur', !deborde);
}

/* --- Le sitemap décrit-il ce que le site sert ? -------------------------- */
const dossierSitemaps = path.join(racine, 'sitemaps');
if (fs.existsSync(dossierSitemaps)) {
  console.log('\n· sitemaps');
  for (const { niche, outils } of aParcourir) {
    if (outils.length === 0) continue;
    const fichier = path.join(dossierSitemaps, `sitemap-${niche.id}.xml`);
    if (!fs.existsSync(fichier)) {
      verifier(`sitemap-${niche.id}.xml présent`, false, 'absent — lancer npm run sitemap');
      continue;
    }
    const xml = fs.readFileSync(fichier, 'utf8');
    const adresses = (xml.match(/<loc>/g) || []).length;
    verifier(
      `sitemap-${niche.id}.xml à jour`,
      adresses === outils.length + 1,
      `${adresses} adresses pour ${outils.length} outils`
    );
    const manquants = outils.filter((o) => !xml.includes(`outil=${o.id}`)).map((o) => o.id);
    verifier(`sitemap-${niche.id}.xml complet`, manquants.length === 0, manquants.join(', '));
  }
}

verifier('aucune erreur JavaScript', erreursJs.length === 0, erreursJs.join(' | '));

await navigateur.close();
serveur.close();

console.log(
  echecs === 0
    ? `\nTout est vert — ${controles} contrôles sur ${aParcourir.length} niche(s).`
    : `\n${echecs} contrôle(s) en échec sur ${controles}.`
);
process.exit(echecs === 0 ? 0 : 1);
