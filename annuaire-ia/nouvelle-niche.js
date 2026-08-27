#!/usr/bin/env node
/**
 * Dégrossit un douzième site : le fichier de base, la couleur, la place dans
 * la réserve, et la consigne à donner pour le remplir.
 *
 * Ajouter une niche à la main demande de retrouver quelle teinte n'est pas
 * déjà prise, de recopier la forme exacte du bloc `niche`, de calibrer deux
 * balises au caractère près et de ne pas oublier l'entrée dans `BACKLOG` —
 * cinq occasions de se tromper pour zéro décision intéressante. Le seul vrai
 * travail est éditorial : quels outils, quel angle, quel ton.
 *
 * Ce script fait donc les cinq premières et s'arrête là où le jugement
 * commence : il écrit une base valide mais vide, que `valider.js` signale
 * comme « en chantier » tant que personne ne l'a remplie.
 *
 * Usage :
 *   node nouvelle-niche.js transport "IA Transport" 🚚 https://ia-transport.fr \
 *     --metier "transporteurs et logisticiens"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireBases } from './valider.js';

const racine = path.dirname(fileURLToPath(import.meta.url));

/* Teintes espacées sur la roue : deux sites voisins en couleur se ressemblent
   en capture d'écran, et le réseau doit avoir l'air de onze marques, pas d'un
   gabarit décliné onze fois. */
const PALETTE = [
  ['#f97316', '#fb923c'], ['#eab308', '#facc15'], ['#84cc16', '#a3e635'],
  ['#10b981', '#34d399'], ['#14b8a6', '#2dd4bf'], ['#06b6d4', '#38bdf8'],
  ['#3b82f6', '#60a5fa'], ['#6366f1', '#818cf8'], ['#8b5cf6', '#a78bfa'],
  ['#d946ef', '#e879f9'], ['#ef4444', '#fb7185'], ['#f43f5e', '#fda4af'],
  ['#a855f7', '#c084fc'], ['#0ea5e9', '#7dd3fc'], ['#22c55e', '#4ade80'],
];

function usage(message) {
  console.error(
    (message ? message + '\n\n' : '') +
    'node nouvelle-niche.js <id> <nom> <emoji> <domaine> [--metier "..."]\n' +
    '  id       minuscules, chiffres et tirets — sert d’adresse : ?niche=<id>\n' +
    '  nom      nom du site, affiché en pied de page et dans les balises sociales\n' +
    '  emoji    favicon du site\n' +
    '  domaine  adresse https complète du domaine prévu\n\n' +
    'Exemple :\n' +
    '  node nouvelle-niche.js transport "IA Transport" 🚚 https://ia-transport.fr \\\n' +
    '    --metier "transporteurs et logisticiens"'
  );
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  const iMetier = argv.indexOf('--metier');
  const metier = iMetier === -1 ? null : argv[iMetier + 1];
  const positionnels = iMetier === -1 ? argv : argv.slice(0, iMetier).concat(argv.slice(iMetier + 2));
  const [id, nom, emoji, domaine] = positionnels;

  if (!id || !nom || !emoji || !domaine) usage('Il manque un argument.');
  if (!/^[a-z0-9-]{1,40}$/.test(id)) usage(`Identifiant invalide : ${id}`);
  try {
    if (new URL(domaine).protocol !== 'https:') usage(`Le domaine doit être en https : ${domaine}`);
  } catch {
    usage(`Domaine invalide : ${domaine}`);
  }

  const fichier = path.join(racine, 'niches', `${id}.json`);
  if (fs.existsSync(fichier)) usage(`niches/${id}.json existe déjà.`);

  const existantes = lireBases();
  if (existantes.some(({ base }) => base.niche.domaine === domaine)) {
    usage(`Ce domaine est déjà pris par une autre niche : ${domaine}`);
  }
  const prises = new Set(existantes.map(({ base }) => base.niche.theme?.primaire?.toLowerCase()));
  const libre = PALETTE.find(([p]) => !prises.has(p.toLowerCase()));
  if (!libre) usage('Plus une seule teinte libre dans la palette : en ajouter une dans nouvelle-niche.js.');

  const modele = existantes[0].base.niche;
  const base = {
    niche: {
      id,
      nom,
      emoji,
      domaine,
      metier: metier || 'À REMPLIR — à qui ce site parle, en trois mots',
      h1_accent: 'À REMPLIR — début du titre, en couleur',
      h1_suite: 'À REMPLIR — fin du titre',
      slogan: 'À REMPLIR — une phrase qui dit ce que le métier gagne à lire cette page.',
      meta_titre: `${nom} — À REMPLIR (70 caractères au plus)`,
      meta_description: 'À REMPLIR — de 110 à 165 caractères : les usages couverts, puis ce qu’on trouve sur la page (prix, avis, limites).',
      theme: { primaire: libre[0], secondaire: libre[1] },
      note_transparence: modele.note_transparence,
    },
    outils: [],
  };

  fs.writeFileSync(fichier, JSON.stringify(base, null, 2) + '\n', 'utf8');

  console.log(`niches/${id}.json écrit — teinte ${libre[0]}, encore vide.\n`);
  console.log('Il reste le seul travail qui ne s’automatise pas. Dans l’ordre :\n');
  console.log(`  1. Remplir les champs « À REMPLIR » du bloc niche.`);
  console.log(`  2. Écrire trois outils réels du métier dans « outils », au format des autres bases`);
  console.log(`     (voir niches/${existantes[0].base.niche.id}.json), avec date_ajout d’aujourd’hui.`);
  console.log(`  3. Ajouter la réserve dans auto-pilot.js, sans quoi l’auto-pilote n’aura rien à publier ici :\n`);
  console.log(`       ${id}: [`);
  console.log(`         // cinq outils, même format, sans date_ajout — elle est posée à la publication`);
  console.log(`       ],\n`);
  console.log('  4. `npm run valider` puis `npm run verifier` — le second ouvre vraiment la page.');
  console.log(`  5. Acheter ${new URL(domaine).host}, puis \`npm run sites\` et déposer dist/${id}/.`);
}

try {
  main();
} catch (erreur) {
  console.error(erreur.message);
  process.exit(1);
}
