#!/usr/bin/env node
/**
 * Dit s'il faut prévenir quelqu'un que la réserve s'épuise, et rédige le billet.
 *
 * La réserve de l'auto-pilote est finie par construction : cinq outils écrits
 * à la main par niche. Quand elle se vide, rien ne casse — et c'est bien le
 * problème. Le script continue de s'exécuter tous les deux jours, ne publie
 * plus rien, l'intégration continue reste verte, et le réseau se fige sans
 * qu'aucun signal n'existe. Le seul endroit où cela se verrait est le journal
 * d'un travail programmé que personne ne lit.
 *
 * D'où ce module, sorti du fichier de workflow parce qu'un billet rédigé en
 * `printf` dans du YAML est illisible et intestable. Il vit ici, se lance à la
 * main, et son texte se relit avant d'être publié.
 *
 * Code de sortie — c'est lui que lit le travail programmé :
 *   0  réserve suffisante, rien à faire
 *   1  il reste moins de deux passages : le billet est sur la sortie standard
 *
 * Usage :
 *   node alerte-reserve.js            état lisible
 *   node alerte-reserve.js --corps    le texte du billet, s'il y a lieu
 */

import { BACKLOG } from './auto-pilot.js';
import { lireBasesActives } from './valider.js';

const SEUIL = 2;
const CORPS = process.argv.includes('--corps');

/* Une niche en pause n'est pas publiée : sa réserve peut être à zéro sans que
   cela mérite d'alerter qui que ce soit. */
const bases = lireBasesActives();
const restant = {};
for (const { base } of bases) {
  const enLigne = new Set(base.outils.map((o) => o.id));
  restant[base.niche.id] = (BACKLOG[base.niche.id] ?? []).filter((o) => !enLigne.has(o.id)).length;
}

const valeurs = Object.values(restant);
const minimum = valeurs.length ? Math.min(...valeurs) : 0;
const asec = Object.keys(restant).filter((id) => restant[id] < SEUIL).sort();

if (minimum >= SEUIL) {
  if (!CORPS) console.log(`Réserve : ${minimum} passages d’avance, rien à signaler.`);
  process.exit(0);
}

const tableau = [
  '| Niche | Publications restantes |',
  '| --- | --- |',
  ...Object.entries(restant)
    .sort((a, b) => a[1] - b[1])
    .map(([id, n]) => `| \`${id}\` | ${n} |`),
].join('\n');

const billet = `L'auto-pilote ne tient plus que **${minimum} publication(s)** sur la niche la plus courte.

Quand une réserve est vide, rien ne casse : le travail programmé continue de s'exécuter, ne publie plus rien, et l'intégration continue reste verte. Le site cesse simplement de bouger — et un annuaire qui ne bouge plus cesse d'être exploré par Google. C'est le seul point de tout le réseau qui demande une main humaine.

${tableau}

À sec ou presque : ${asec.map((id) => `\`${id}\``).join(', ')}.

**Quoi faire** — ouvrir une session sur ce dépôt et demander de réalimenter \`BACKLOG\` dans \`annuaire-ia/auto-pilot.js\` : cinq outils réels par niche concernée, au format des entrées voisines, sans \`date_ajout\` (elle est posée à la publication). La compétence \`/reseau-annuaires\` décrit la forme attendue et les pièges.

_Billet ouvert automatiquement par le travail programmé._`;

console.log(CORPS ? billet : `Réserve basse — ${minimum} publication(s) restante(s) sur ${asec.join(', ')}.`);
process.exit(1);
