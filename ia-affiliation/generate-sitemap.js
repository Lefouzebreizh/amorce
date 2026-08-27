#!/usr/bin/env node
/**
 * Générateur de sitemap — Radar IA
 *
 * Lit `outils.json` et écrit `sitemap.xml` à la racine du site. Deux points
 * méritent d'être expliqués plutôt que subis :
 *
 * 1. **Une URL par fiche, et une URL qui répond.** Le site est une page unique.
 *    Déclarer des adresses inventées (`/outils/chatgpt`) ferait répondre 404 au
 *    robot, ce qui est le plus sûr moyen de faire baisser la confiance accordée
 *    au sitemap entier. On déclare donc `?outil=<id>` : la page existe, répond
 *    200, et `index.html` y ouvre l'avis correspondant en changeant le titre du
 *    document — c'est ce qui les distingue aux yeux de Google.
 * 2. **`lastmod` vient de la donnée, pas de l'horloge.** Dater tout le sitemap
 *    du jour de génération à chaque exécution reviendrait à dire au robot que
 *    vingt fiches ont changé alors qu'une seule a été ajoutée. Chaque URL porte
 *    la date de sa fiche ; l'accueil porte la plus récente d'entre elles.
 *
 * L'adresse du site se règle par la variable d'environnement SITE_URL, ce que
 * fait le workflow ; sans elle, c'est le domaine de démonstration qui sert.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FICHIER_SOURCE = path.join(__dirname, 'outils.json');
const FICHIER_SORTIE = path.join(__dirname, 'sitemap.xml');
const SITE = (process.env.SITE_URL || 'https://radar-ia.example').replace(/\/+$/, '');

// Les cinq caractères que XML ne tolère pas nus dans un contenu d'élément.
function echapper(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dateValide(valeur) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valeur));
}

function dateDuJour() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const jour = String(maintenant.getDate()).padStart(2, '0');
  return maintenant.getFullYear() + '-' + mois + '-' + jour;
}

function lireCatalogue() {
  if (!fs.existsSync(FICHIER_SOURCE)) {
    throw new Error('outils.json est introuvable à côté de ce script.');
  }
  const donnees = JSON.parse(fs.readFileSync(FICHIER_SOURCE, 'utf8'));
  if (!Array.isArray(donnees)) {
    throw new Error('outils.json doit contenir un tableau.');
  }
  return donnees.filter((o) => o && typeof o.id === 'string' && o.id.length > 0);
}

function entree(url, lastmod, changefreq, priority) {
  return [
    '  <url>',
    '    <loc>' + echapper(url) + '</loc>',
    '    <lastmod>' + lastmod + '</lastmod>',
    '    <changefreq>' + changefreq + '</changefreq>',
    '    <priority>' + priority + '</priority>',
    '  </url>'
  ].join('\n');
}

function main() {
  console.log("── Génération du sitemap — Radar IA");

  const catalogue = lireCatalogue();
  const dates = catalogue.map((o) => o.date_ajout).filter(dateValide).sort();
  const plusRecente = dates.length > 0 ? dates[dates.length - 1] : dateDuJour();

  const lignes = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entree(SITE + '/', plusRecente, 'daily', '1.0')
  ];

  catalogue.forEach((outil) => {
    const url = SITE + '/?outil=' + encodeURIComponent(outil.id);
    const lastmod = dateValide(outil.date_ajout) ? outil.date_ajout : plusRecente;
    lignes.push(entree(url, lastmod, 'weekly', '0.8'));
  });

  lignes.push('</urlset>');

  fs.writeFileSync(FICHIER_SORTIE, lignes.join('\n') + '\n', 'utf8');

  console.log('· Domaine   : ' + SITE);
  console.log('· URLs      : ' + (catalogue.length + 1) + ' (accueil + ' + catalogue.length + ' fiches)');
  console.log('· Dernière modification annoncée : ' + plusRecente);
  console.log('· Écrit dans ' + FICHIER_SORTIE);
}

try {
  main();
} catch (e) {
  console.error('✗ Sitemap non généré : ' + e.message);
  process.exit(1);
}
