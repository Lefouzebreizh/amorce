#!/usr/bin/env node
/**
 * Fabrique un sitemap et un robots.txt par niche, dans `sitemaps/`.
 *
 * Dix domaines, dix sitemaps : un moteur de recherche n'accepte dans un
 * sitemap que des adresses du domaine où ce sitemap est servi, et un fichier
 * unique mélangeant les dix sites serait rejeté en bloc. L'adresse de chaque
 * site est donc écrite dans sa propre base (`niche.domaine`), à côté du reste
 * de sa configuration — c'est le seul endroit où un site du réseau se décrit.
 *
 * Deux règles qui ont l'air de détails et n'en sont pas :
 *
 * - **Les adresses portent toujours `?niche=<id>`**, y compris l'accueil d'un
 *   domaine qui sert déjà cette niche par défaut. C'est exactement la forme que
 *   `index.html` écrit dans sa balise canonique ; deux formes concurrentes pour
 *   la même page, ce sont deux pages en double aux yeux de Google.
 * - **`lastmod` est la vraie date d'ajout de l'outil**, jamais la date du jour.
 *   Un sitemap qui déclare tout modifié à chaque exécution perd sa crédibilité
 *   auprès du moteur, qui cesse alors de s'y fier pour prioriser son
 *   exploration — soit précisément ce qu'on lui demande.
 *
 * Usage :
 *   node generate-sitemap.js                        adresse lue dans chaque niche
 *   node generate-sitemap.js https://mon-site.com   même adresse pour toutes (essai local)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierNiches = path.join(racine, 'niches');
const dossierSortie = path.join(racine, 'sitemaps');

const echapper = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Base terminée par « / » : sans elle, `new URL('?x', base)` écraserait le
 *  dernier segment du chemin quand le site est servi dans un sous-dossier. */
function normaliser(brut, provenance) {
  let url;
  try {
    url = new URL(brut);
  } catch {
    throw new Error(`Adresse invalide (${provenance}) : ${brut}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Adresse invalide (${provenance}) : ${brut}`);
  }
  return url.origin + url.pathname.replace(/\/*$/, '/');
}

function lireNiches() {
  if (!fs.existsSync(dossierNiches)) throw new Error(`Dossier introuvable : ${dossierNiches}`);
  const fichiers = fs.readdirSync(dossierNiches).filter((f) => f.endsWith('.json')).sort();
  if (fichiers.length === 0) throw new Error('Aucune base de niche dans niches/.');
  return fichiers.map((f) => {
    const base = JSON.parse(fs.readFileSync(path.join(dossierNiches, f), 'utf8'));
    if (!base?.niche?.id) throw new Error(`${f} : bloc « niche » absent ou sans identifiant.`);
    if (!Array.isArray(base.outils)) throw new Error(`${f} : champ « outils » absent.`);
    for (const outil of base.outils) {
      if (!outil.id) throw new Error(`${f} : un outil sans identifiant (${outil.nom || 'sans nom'}).`);
    }
    return base;
  });
}

/** Faute de date d'ajout, on retombe sur la date de modification du fichier :
 *  toujours plus honnête qu'une date du jour inventée. */
function jour(valeur, secours) {
  const t = Date.parse(valeur);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : secours;
}

export function entreesDeNiche(niche, outils, base) {
  const secours = new Date().toISOString().slice(0, 10);
  const dates = outils.map((o) => jour(o.date_ajout, secours));
  return [
    { adresse: new URL(`?niche=${niche.id}`, base).href, date: dates.slice().sort().at(-1), priorite: '1.0', frequence: 'daily' },
    ...outils.map((outil, i) => ({
      adresse: new URL(`?niche=${niche.id}&outil=${encodeURIComponent(outil.id)}`, base).href,
      date: dates[i],
      priorite: '0.8',
      frequence: 'weekly',
    })),
  ];
}

export function robots(base) {
  return 'User-agent: *\nAllow: /\n\n' + `Sitemap: ${new URL('sitemap.xml', base).href}\n`;
}

export function sitemap(entrees) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entrees
      .map(
        ({ adresse, date, priorite, frequence }) =>
          '  <url>\n' +
          `    <loc>${echapper(adresse)}</loc>\n` +
          `    <lastmod>${date}</lastmod>\n` +
          `    <changefreq>${frequence}</changefreq>\n` +
          `    <priority>${priorite}</priority>\n` +
          '  </url>\n'
      )
      .join('') +
    '</urlset>\n'
  );
}

function main() {
  const impose = process.argv[2] || process.env.SITE_URL;
  const niches = lireNiches();

  fs.mkdirSync(dossierSortie, { recursive: true });

  let total = 0;
  for (const { niche, outils } of niches) {
    /* Une niche encore vide n'a rien à proposer à un moteur : la déclarer
       reviendrait à faire explorer une page qui n'existe pas. */
    if (outils.length === 0) {
      console.log(`  ${`(${niche.id})`.padEnd(30)} niche vide, sitemap non écrit`);
      continue;
    }
    if (!impose && !niche.domaine) {
      throw new Error(
        `${niche.id} : aucun « domaine » dans sa base.\n` +
        '  Ajoutez-le, ou passez une adresse commune : node generate-sitemap.js https://mon-site.com'
      );
    }
    const base = normaliser(impose || niche.domaine, impose ? 'ligne de commande' : `niches/${niche.id}.json`);
    const entrees = entreesDeNiche(niche, outils, base);

    const nomSitemap = `sitemap-${niche.id}.xml`;
    fs.writeFileSync(path.join(dossierSortie, nomSitemap), sitemap(entrees), 'utf8');
    fs.writeFileSync(
      path.join(dossierSortie, `robots-${niche.id}.txt`),
      robots(base),
      'utf8'
    );

    total += entrees.length;
    console.log(`  ${nomSitemap.padEnd(30)} ${entrees.length} adresses — ${base}`);
  }

  console.log(`\n${niches.length} sitemaps écrits dans sitemaps/, ${total} adresses au total.`);
  console.log('Au déploiement : sitemap-<niche>.xml devient sitemap.xml à la racine du domaine,');
  console.log('robots-<niche>.txt devient robots.txt, puis on déclare le sitemap dans Search Console.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (erreur) {
    console.error(erreur.message);
    process.exit(1);
  }
}
