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

  const { genererSite } = await import('../src/lib/site.ts');
  const html = genererSite(
    {
      couleur: '', slogan: '', presentation: '', services: '', options: [],
      ...commande,
    },
    photos,
    { domaine },
  );

  const sortie = path.join(dossier, 'index.html');
  await writeFile(sortie, html, 'utf8');

  console.log(`✅ ${sortie}`);
  console.log(`   ${commande.entreprise} — ${commande.ville}`);
  console.log(`   ${photos.length} photo(s), ${(html.length / 1024).toFixed(1)} Ko`);
  console.log(domaine === undefined
    ? '   ⚠ sans --domaine : pas d’adresse canonique ni d’image de partage'
    : `   fiche d’établissement et partage réglés sur ${domaine}`);
  console.log('');
  console.log('   Le dossier est le site : dépose-le tel quel, ou ouvre');
  console.log('   index.html pour le montrer au client avant de le publier.');
}

principal();
