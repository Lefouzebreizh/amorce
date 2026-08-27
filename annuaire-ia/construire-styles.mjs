#!/usr/bin/env node
/**
 * Compile `styles.src.css` en `styles.css`, la feuille que servent les sites.
 *
 * Le réseau n'a ni serveur ni étape de compilation au déploiement : le CSS est
 * donc **versionné**, et cette commande est le seul moment où il se fabrique.
 * D'où le mode `--verifier`, que joue l'intégration continue : si quelqu'un
 * ajoute une classe dans `index.html` sans recompiler, la feuille en ligne ne
 * la contient pas et le défaut ne se voit qu'à l'œil, sur un écran, un jour où
 * personne ne regarde. Comparer le fichier compilé à ce qu'il devrait être
 * transforme cet oubli silencieux en ligne rouge.
 *
 * Tailwind vient des dépendances d'Amorce, à la racine du dépôt : rien à
 * installer dans ce dossier, et rien à télécharger au chargement de la page.
 *
 * Usage :
 *   node construire-styles.mjs             compile
 *   node construire-styles.mjs --verifier  échoue si styles.css n'est plus à jour
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(racine, 'styles.src.css');
const sortie = path.join(racine, 'styles.css');
const VERIFIER = process.argv.includes('--verifier');

let postcss, tailwind;
try {
  postcss = (await import('postcss')).default;
  tailwind = (await import('@tailwindcss/postcss')).default;
} catch {
  console.error(
    'Tailwind est introuvable.\n' +
    '  Il vient des dépendances du dépôt : lancer `npm install` à la racine d’Amorce.'
  );
  process.exit(1);
}

const brut = fs.readFileSync(source, 'utf8');
const resultat = await postcss([tailwind()]).process(brut, { from: source, to: sortie });

const entete =
  '/* Fichier compilé — ne pas modifier à la main.\n' +
  '   La source est styles.src.css ; recompiler avec `npm run styles`. */\n';
const compile = entete + resultat.css.trimEnd() + '\n';

if (VERIFIER) {
  const enPlace = fs.existsSync(sortie) ? fs.readFileSync(sortie, 'utf8') : '';
  if (enPlace !== compile) {
    console.error(
      'styles.css n’est plus à jour.\n' +
      '  Une classe a changé dans index.html sans recompilation : lancer `npm run styles` et committer.'
    );
    process.exit(1);
  }
  console.log(`styles.css est à jour — ${(compile.length / 1024).toFixed(1)} ko.`);
} else {
  fs.writeFileSync(sortie, compile, 'utf8');
  console.log(`styles.css écrit — ${(compile.length / 1024).toFixed(1)} ko.`);
}
