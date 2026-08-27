#!/usr/bin/env node
/**
 * Fabrique `sitemap.xml` et `robots.txt` à partir de `outils.json`.
 *
 * Une page unique ne donne qu'une seule adresse à Google, et un annuaire dont
 * une seule URL est indexée ne captera jamais les recherches par nom d'outil —
 * qui sont l'essentiel du trafic qualifié. Chaque fiche est donc adressable par
 * `?outil=<id>` : un paramètre de requête est une URL distincte pour un moteur,
 * là où un fragment `#id` n'en est pas une. L'index.html sert ces adresses sans
 * configuration de serveur particulière, et ouvre la bonne fiche au chargement.
 *
 * Usage :
 *   node generate-sitemap.js https://mon-site.com
 *   SITE_URL=https://mon-site.com node generate-sitemap.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(fileURLToPath(import.meta.url));

function urlDuSite() {
  const brut = process.argv[2] || process.env.SITE_URL;
  if (!brut) {
    console.error(
      'Adresse du site manquante.\n' +
      '  node generate-sitemap.js https://mon-site.com\n' +
      '  SITE_URL=https://mon-site.com node generate-sitemap.js'
    );
    process.exit(1);
  }
  let url;
  try {
    url = new URL(brut);
  } catch {
    console.error(`Adresse invalide : ${brut}`);
    process.exit(1);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    console.error(`Adresse invalide : ${brut}`);
    process.exit(1);
  }
  // Base terminée par « / » : sans elle, `new URL('?outil=x', base)` écraserait
  // le dernier segment du chemin quand le site est servi dans un sous-dossier.
  return url.origin + url.pathname.replace(/\/*$/, '/');
}

const echapper = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function lireOutils() {
  const fichier = path.join(racine, 'outils.json');
  const donnees = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  if (!Array.isArray(donnees.outils) || donnees.outils.length === 0) {
    throw new Error('outils.json ne contient aucun outil.');
  }
  for (const outil of donnees.outils) {
    if (!outil.id) throw new Error(`Un outil sans identifiant : ${outil.nom || '(sans nom)'}`);
  }
  return donnees.outils;
}

function main() {
  const base = urlDuSite();
  const outils = lireOutils();
  const jour = new Date().toISOString().slice(0, 10);

  const entrees = [
    { adresse: base, priorite: '1.0', frequence: 'daily' },
    ...outils.map((outil) => ({
      adresse: new URL(`?outil=${encodeURIComponent(outil.id)}`, base).href,
      priorite: '0.8',
      frequence: 'weekly',
    })),
  ];

  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entrees
      .map(
        ({ adresse, priorite, frequence }) =>
          '  <url>\n' +
          `    <loc>${echapper(adresse)}</loc>\n` +
          `    <lastmod>${jour}</lastmod>\n` +
          `    <changefreq>${frequence}</changefreq>\n` +
          `    <priority>${priorite}</priority>\n` +
          '  </url>\n'
      )
      .join('') +
    '</urlset>\n';

  const robots =
    'User-agent: *\n' +
    'Allow: /\n\n' +
    `Sitemap: ${new URL('sitemap.xml', base).href}\n`;

  fs.writeFileSync(path.join(racine, 'sitemap.xml'), sitemap, 'utf8');
  fs.writeFileSync(path.join(racine, 'robots.txt'), robots, 'utf8');

  console.log(`sitemap.xml écrit — ${entrees.length} adresses (1 accueil + ${outils.length} fiches)`);
  console.log(`robots.txt écrit — pointe vers ${new URL('sitemap.xml', base).href}`);
  console.log('Dernière étape : déclarer le sitemap dans Google Search Console pour forcer l’exploration.');
}

main();
