#!/usr/bin/env node
/*
 * Du dossier de commande au site livrable, en une commande.
 *
 *   node scripts/generer.mjs dossiers/maconnerie-dupont-2026-08-29
 *
 * Lit le `commande.json` écrit par la route d'API, retrouve les photos posées à
 * côté, et écrit un `index.html` dans le même dossier. Le dossier devient alors
 * le site : on le dépose tel quel sur un hébergement, on le zippe, ou on
 * l'ouvre depuis le disque pour le montrer au client avant de le mettre en
 * ligne.
 *
 * Le script ne décide rien : toute la fabrication est dans `src/lib/site.ts`,
 * qui est pur et éprouvé. Ici il n'y a que la lecture, l'écriture, et les
 * refus qui évitent d'écrire un site faux.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const EXTENSIONS_IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

/*
 * Les cadres d'une démonstration sans photo.
 *
 * Un artisan décide sur des photos de chantier : une démonstration qui n'a pas
 * de galerie du tout ne montre pas *où* les siennes iront, et c'est justement
 * ce qu'il achète. On dessine donc des cadres — pas des photos.
 *
 * Rien n'est fabriqué qui puisse passer pour un vrai chantier : le dépôt
 * interdit le faux témoignage, et une image de synthèse présentée comme une
 * réalisation en serait un. Ces cadres disent ce qu'ils sont.
 *
 * En SVG embarqué plutôt qu'en fichiers : la page reste **un seul fichier**
 * autonome, qui s'ouvre depuis le disque comme depuis un hébergement.
 */
/*
 * Les cadres suivent la charte, et il a fallu les regarder pour le voir.
 *
 * Ils étaient en `#eef1f4` avec du texte `#16202b` : des cartons blancs sur
 * une page sombre, qui criaient plus fort que les photos qu'ils annoncent.
 * Aucun test ne l'a signalé, et le contrôleur de lisibilité non plus — il lit
 * le HTML, et ceux-ci sont des SVG encodés en base64. C'est la capture d'écran
 * qui l'a montré, en une seconde.
 *
 * Ils prennent donc la surface élevée de la charte et ses deux encres, comme
 * le reste de la page.
 */
function cadresDeDemonstration(teinte, surfaces, encres) {
  const legendes = ['Avant / après', 'Une finition', 'Le chantier fini'];
  const accent = teinte.accent;

  return legendes.map((legende, rang) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="${surfaces.slab}"/>
<rect x="8" y="8" width="384" height="284" rx="14" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="12 9"/>
<circle cx="200" cy="126" r="34" fill="none" stroke="${accent}" stroke-width="6"/>
<rect x="150" y="86" width="100" height="12" rx="6" fill="${accent}"/>
<text x="200" y="205" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="${encres.vive}">Votre photo ${rang + 1}</text>
<text x="200" y="238" text-anchor="middle" font-family="system-ui, sans-serif" font-size="19" fill="${encres.douce}">${legende}</text>
</svg>`;

    return {
      fichier: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
      legende: `Emplacement d\u2019une photo de chantier — ${legende}`,
    };
  });
}

async function principal() {
  const arguments_ = process.argv.slice(2);
  const dossier = arguments_.find((a) => !a.startsWith('--'));

  /*
   * Le domaine n'est pas dans la commande : le client ne l'a pas au moment de
   * commander, il est choisi au moment de publier. Sans lui la page reste
   * complète — elle perd seulement son adresse canonique et son image de
   * partage, plutôt que de les inventer.
   */
  const domaine = arguments_.find((a) => a.startsWith('--domaine='))?.slice('--domaine='.length);

  /*
   * `--demonstration` marque une page d'exemple : elle sort avec `noindex`,
   * parce qu'une entreprise fictive indexée se présente comme un vrai artisan.
   */
  const demonstration = arguments_.includes('--demonstration');

  if (dossier === undefined) {
    console.error('usage : node scripts/generer.mjs <dossier de commande> [--domaine=exemple.fr]');
    process.exit(2);
  }

  const cheminCommande = path.join(dossier, 'commande.json');
  let brut;
  try {
    brut = JSON.parse(await readFile(cheminCommande, 'utf8'));
  } catch (erreur) {
    console.error(`❌ ${cheminCommande} illisible — ${erreur.message}`);
    process.exit(1);
  }

  /*
   * `dossier.ts` enveloppe la commande sous une clé `commande`. On accepte les
   * deux formes : un `commande.json` recopié à la main n'a pas cette
   * enveloppe, et refuser ce cas obligerait à retoucher un fichier avant
   * chaque livraison.
   */
  const commande = brut.commande ?? brut;

  for (const champ of ['modele', 'entreprise', 'telephone', 'ville']) {
    if (typeof commande[champ] !== 'string' || commande[champ].trim() === '') {
      console.error(`❌ champ obligatoire manquant : ${champ}`);
      process.exit(1);
    }
  }

  // Les photos sont celles qui sont là, triées par nom — la route les préfixe
  // d'un rang, donc l'ordre du fichier est l'ordre voulu par le client.
  const entrees = await readdir(dossier, { withFileTypes: true });
  const photos = entrees
    .filter((e) => e.isFile() && EXTENSIONS_IMAGE.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort()
    .map((fichier) => ({ fichier }));

  const { genererSite, teinteRetenue } = await import('../src/lib/site.ts');
  const { SURFACES, ENCRES } = await import('../src/lib/charte.ts');
  const complete = {
    couleur: '', slogan: '', presentation: '', services: '', options: [],
    ...commande,
  };

  // Une démonstration sans photo montre des cadres : sans eux, le prospect ne
  // voit pas l'endroit où les siennes viendront.
  const aMontrer = demonstration && photos.length === 0
    ? cadresDeDemonstration(teinteRetenue(complete), SURFACES, ENCRES)
    : photos;

  const html = genererSite(complete, aMontrer, { domaine, demonstration });

  const sortie = path.join(dossier, 'index.html');
  await writeFile(sortie, html, 'utf8');

  console.log(`✅ ${sortie}`);
  console.log(`   ${commande.entreprise} — ${commande.ville}`);
  console.log(`   ${aMontrer.length} image(s)${photos.length === 0 && aMontrer.length > 0 ? ' (cadres de démonstration)' : ''}, ${(html.length / 1024).toFixed(1)} Ko`);
  if (demonstration) console.log('   démonstration : sortie en noindex');
  console.log(domaine === undefined
    ? '   ⚠ sans --domaine : pas d’adresse canonique ni d’image de partage'
    : `   fiche d’établissement et partage réglés sur ${domaine}`);
  console.log('');
  console.log('   Le dossier est le site : dépose-le tel quel, ou ouvre');
  console.log('   index.html pour le montrer au client avant de le publier.');
}

principal();
