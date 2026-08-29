#!/usr/bin/env node
/**
 * Règle l'adresse publique de chaque site du réseau.
 *
 * `niche.domaine` n'est pas un champ décoratif : c'est lui qui fabrique la
 * balise canonique, l'adresse `og:url`, le sitemap et le `robots.txt`. Une
 * valeur fausse ne casse rien de visible — le site s'affiche parfaitement — et
 * dit pourtant à Google que la version de référence de la page se trouve
 * ailleurs. C'est le pire des deux mondes : invisible en test, coûteux en
 * ligne.
 *
 * D'où cet outil plutôt qu'une retouche à la main dans onze fichiers. Les
 * adresses changent au moins deux fois dans la vie du réseau — une fois pour
 * la mise en ligne de mesure, une fois par domaine acheté — et onze retouches
 * manuelles, c'est onze occasions d'en oublier une.
 *
 *   node regler-domaines.mjs --etat
 *   node regler-domaines.mjs --base https://annuaire-ia.pages.dev
 *   node regler-domaines.mjs btp https://ia-btp.fr
 *
 * Les sitemaps sont refabriqués dans la foulée : les laisser sur l'ancienne
 * adresse reviendrait à n'avoir rien changé.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promises as dns } from 'node:dns';

const lookup = (hote) => dns.lookup(hote);

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierNiches = path.join(racine, 'niches');

const args = process.argv.slice(2);
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? '';
};

function bases() {
  return fs.readdirSync(dossierNiches)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const chemin = path.join(dossierNiches, f);
      return { chemin, base: JSON.parse(fs.readFileSync(chemin, 'utf8')) };
    });
}

function ecrire(chemin, base) {
  fs.writeFileSync(chemin, JSON.stringify(base, null, 2) + '\n', 'utf8');
}

// Une adresse sans barre finale fait fabriquer « …/btp?niche=btp » au lieu de
// « …/btp/?niche=btp » : deux URL pour une page, ce que l'invariant 3 interdit.
function normaliser(brut) {
  let valeur = String(brut).trim();
  if (!/^https?:\/\//.test(valeur)) {
    throw new Error(`Adresse invalide (il manque https://) : ${brut}`);
  }
  const url = new URL(valeur);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/*$/, '/');
  return url.href;
}

/*
 * L'état ne se contente plus de recopier les adresses déclarées : il demande au
 * DNS si elles existent.
 *
 * Mesuré le 29/08/2026 : les onze niches annonçaient `ma-panoplie-ia.com`, qui
 * **ne résout pas**. Rien ne le disait — l'état affichait onze belles adresses,
 * les sitemaps les reprenaient, et le gabarit en faisait des balises canoniques.
 * Déployer dans cet état aurait mis onze sites en ligne déclarant tous que leur
 * version de référence se trouve à une adresse que personne ne sert : le pire
 * signal qu'on puisse envoyer à un moteur.
 *
 * La sonde est un `lookup` et pas une requête HTTP, et c'est délibéré : derrière
 * un mandataire filtrant, tout rend `000` — un domaine bloqué comme un domaine
 * inexistant. Le DNS, lui, sépare les deux, vérifié sur un témoin
 * (`api.binance.com` résout et reste injoignable).
 */
async function resout(hote) {
  try {
    await lookup(hote);
    return true;
  } catch {
    return false;
  }
}

async function etat() {
  console.log('── Adresses publiques du réseau\n');

  const hotes = new Map();
  const lignes = [];
  for (const { base } of bases()) {
    const domaine = base.niche.domaine ?? '';
    let hote = '';
    try { hote = new URL(domaine).hostname; } catch { hote = ''; }
    if (hote && !hotes.has(hote)) hotes.set(hote, await resout(hote));
    lignes.push({ id: base.niche.id, domaine, hote });
  }

  for (const { id, domaine, hote } of lignes) {
    const marque = hote === '' ? ' ⚠ adresse illisible' : hotes.get(hote) ? '' : ' ⚠ ne résout pas';
    console.log('  ' + id.padEnd(14) + domaine + marque);
  }

  const morts = [...hotes.entries()].filter(([, ok]) => !ok).map(([h]) => h);
  if (morts.length > 0) {
    console.log(
      `\n⚠ ${morts.join(', ')} ne résout pas. Les balises canoniques, les sitemaps et` +
        '\n  les `og:url` désignent donc une adresse que personne ne sert.' +
        '\n  Cloudflare Pages en donne une gratuite : `--base https://annuaire-ia.pages.dev`.' +
        '\n  Le domaine acheté se branchera plus tard, par la même commande.',
    );
  }

  console.log('\nRègle-les avec --base <adresse> (tout le réseau) ou <niche> <adresse> (un seul).');
}

function rafraichirSitemaps() {
  const r = spawnSync(process.execPath, [path.join(racine, 'generate-sitemap.js')], {
    encoding: 'utf8', cwd: racine
  });
  if (r.status !== 0) {
    throw new Error('Sitemaps non refabriqués : ' + ((r.stderr || '') + (r.stdout || '')).trim());
  }
  console.log('· Sitemaps et robots.txt refabriqués sur les nouvelles adresses.');
}

async function main() {
  if (args.length === 0 || args.includes('--etat')) { return etat(); }

  const socle = drapeau('--base');
  let touchees = 0;

  if (socle !== null) {
    // Un seul hébergement sert les onze sites, chacun dans son sous-dossier :
    // c'est exactement ce que produit `construire-sites.js` avec dist/<niche>/.
    const base = normaliser(socle);
    for (const { chemin, base: b } of bases()) {
      b.niche.domaine = new URL(b.niche.id + '/', base).href;
      ecrire(chemin, b);
      console.log('  ' + b.niche.id.padEnd(14) + b.niche.domaine);
      touchees += 1;
    }
  } else {
    const [id, adresse] = args;
    if (!id || !adresse) {
      console.error('Usage : node regler-domaines.mjs <niche> <adresse>   ou   --base <adresse>   ou   --etat');
      process.exit(1);
    }
    const cible = bases().find(({ base }) => base.niche.id === id);
    if (!cible) {
      console.error(`Niche inconnue : ${id}. Connues : ${bases().map((b) => b.base.niche.id).join(', ')}`);
      process.exit(1);
    }
    cible.base.niche.domaine = normaliser(adresse);
    ecrire(cible.chemin, cible.base);
    console.log('  ' + id.padEnd(14) + cible.base.niche.domaine);
    touchees = 1;
  }

  console.log(`\n${touchees} adresse(s) réglée(s).`);
  rafraichirSitemaps();
  console.log('· Reste à reconstruire les sites : npm run sites');
}

/*
 * `await` et non un simple appel : `--etat` interroge le DNS, donc rend une
 * promesse. Sans l'attendre, un refus de résolution partirait en rejet non
 * capturé — le `catch` ci-dessous ne verrait rien, et le script sortirait en 0
 * après avoir échoué.
 */
try {
  await main();
} catch (erreur) {
  console.error('✗ ' + erreur.message);
  process.exit(1);
}
