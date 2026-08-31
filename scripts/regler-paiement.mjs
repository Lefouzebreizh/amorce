#!/usr/bin/env node
/**
 * Pose les liens de paiement, et dit lesquels manquent vraiment.
 *
 * Trois produits demandent de l'argent dans ce dépôt, et « brancher Stripe »
 * ne veut pas dire la même chose pour les trois. Les confondre fait chercher
 * un réglage là où il faut un serveur, et perdre une soirée.
 *
 *   node scripts/regler-paiement.mjs --etat
 *   node scripts/regler-paiement.mjs solo https://buy.stripe.com/xxx
 *   node scripts/regler-paiement.mjs trio https://buy.stripe.com/yyy
 *   node scripts/regler-paiement.mjs artisan https://buy.stripe.com/zzz
 *
 * `solo` et `trio` s'écrivent dans le code, donc l'outil les pose.
 * `artisan` vit dans une variable d'environnement servie par Vercel : l'outil
 * ne peut pas l'écrire, il rend la ligne exacte à coller. Prétendre l'avoir
 * réglée serait pire que ne rien faire.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* La sonde vit dans `annuaire-ia/` parce que c'est là qu'elle est née. Deux
   copies de la même sonde, c'est une des deux qui devient fausse — on importe
   donc au travers des projets plutôt que de la recopier ici. Elle ne dépend
   que de la bibliothèque standard. */
import { auditerAdresses } from '../annuaire-ia/sonde-dns.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENU = path.join(racine, 'src/app/montage-titan/contenu.ts');
const ENV_ARTISAN = path.join(racine, 'artisan-express/.env.example');

const args = process.argv.slice(2);

/* `#` est la valeur d'attente choisie par la page : `lienDAchat` la traite
   comme « pas de lien », et retombe sur WhatsApp. Vide vaut pareil. */
const enAttente = (v) => v === '' || v === '#';

const CIBLES = {
  solo: { champ: 'paiementSolo', ou: 'code', libelle: 'Montage Titan — formule solo' },
  trio: { champ: 'paiementTrio', ou: 'code', libelle: 'Montage Titan — formule trio' },
  artisan: { champ: 'NEXT_PUBLIC_LIEN_STRIPE', ou: 'env', libelle: 'Site artisan — 300 €' },
};

const lireContenu = () => fs.readFileSync(CONTENU, 'utf8');

function valeurCode(champ) {
  const m = lireContenu().match(new RegExp(`${champ}:\\s*'([^']*)'`));
  return m ? m[1] : null;
}

function valeurEnv() {
  const m = fs.readFileSync(ENV_ARTISAN, 'utf8').match(/^NEXT_PUBLIC_LIEN_STRIPE=(.*)$/m);
  return m ? m[1].trim() : null;
}

function whatsappRegle() {
  const m = lireContenu().match(/whatsapp:\s*'([^']*)'/);
  return m ? !enAttente(m[1]) : false;
}

/**
 * Un lien de paiement se contrôle sur ce qui casse vraiment : le protocole, et
 * l'hôte. Le chemin, lui, ne se devine pas — une référence Stripe erronée rend
 * une page « ce lien a expiré », et aucune vérification locale ne le dira.
 */
function verifier(brut) {
  const valeur = String(brut).trim();
  if (!/^https:\/\//.test(valeur)) return { erreur: `doit commencer par https:// — reçu : ${valeur}` };
  let url;
  try { url = new URL(valeur); } catch { return { erreur: `adresse illisible : ${valeur}` }; }
  if (enAttente(valeur)) return { erreur: 'c’est la valeur d’attente, pas un lien' };
  /* Avertissement et non refus : un lien de paiement peut vivre sur un domaine
     à soi, et refuser rendrait l'outil inutilisable le jour où ça arrive. */
  const suspect = !/(^|\.)stripe\.com$/.test(url.hostname);
  return { url: url.href, suspect, hote: url.hostname };
}

async function etat() {
  console.log('── Par où l’argent peut entrer\n');

  const solo = valeurCode('paiementSolo');
  const trio = valeurCode('paiementTrio');
  const artisan = valeurEnv();
  const wa = whatsappRegle();

  const ligne = (libelle, valeur, note) =>
    console.log(`  ${libelle.padEnd(30)} ${(enAttente(valeur ?? '') ? '—' : valeur).padEnd(34)} ${note}`);

  ligne('Montage Titan — solo', solo, wa ? 'commande ouverte par WhatsApp' : 'AUCUN chemin');
  ligne('Montage Titan — trio', trio, wa ? 'commande ouverte par WhatsApp' : 'AUCUN chemin');
  ligne('Site artisan — 300 €', artisan, 'repli : formulaire et téléphone');
  ligne('Licence Amorce — 49 €', '', 'demande un SERVEUR, pas un lien');

  console.log(`
  Ce que Stripe change, et ce qu'il ne change pas :

  · Titan prend déjà des commandes — « Commander sur WhatsApp ». Stripe
    automatise l'encaissement, il n'ouvre pas la vente.
  · L'artisan encaisse déjà : la page tombe sur le formulaire et le téléphone,
    et la méthode de PROSPECTION.md fait payer après livraison.
  · La licence à 49 € est la seule vraiment bloquée, et pas par un lien :
    NEXT_PUBLIC_LICENCE_URL demande un serveur qui vérifie qu'une clé a été
    payée. Coller un lien Stripe n'y suffirait pas.

  Poser un lien :  node scripts/regler-paiement.mjs <solo|trio|artisan> <adresse>`);
}

function poserDansLeCode(champ, url) {
  const avant = lireContenu();
  const motif = new RegExp(`(${champ}:\\s*')([^']*)(')`);
  if (!motif.test(avant)) throw new Error(`champ introuvable dans contenu.ts : ${champ}`);
  fs.writeFileSync(CONTENU, avant.replace(motif, `$1${url}$3`), 'utf8');
}

async function poser(cle, adresse) {
  const cible = CIBLES[cle];
  if (!cible) {
    throw new Error(`cible inconnue : « ${cle} ». Connues : ${Object.keys(CIBLES).join(', ')}`);
  }
  const c = verifier(adresse);
  if (c.erreur) throw new Error(`${cible.libelle} — ${c.erreur}`);

  const audit = await auditerAdresses([c.url]);
  if (!audit.disponible) {
    console.warn('⚠ Pas de résolveur DNS joignable : l’hôte n’a pas pu être vérifié.\n');
  } else if (audit.morts.length) {
    throw new Error(
      `${audit.morts.join(', ')} ne résout pas.\n` +
      '  Un lien de paiement mort perd un client déjà décidé — le seul défaut\n' +
      '  d’une page de vente qui coûte de l’argent comptant.'
    );
  }
  if (c.suspect) {
    console.warn(`⚠ ${c.hote} n’est pas un domaine Stripe. Volontaire ? On continue.\n`);
  }

  if (cible.ou === 'env') {
    /* On n'écrit pas : la valeur servie vient du tableau de bord Vercel, pas du
       dépôt. Écrire dans .env.example donnerait l'illusion du réglage. */
    console.log(`${cible.libelle} — à coller dans Vercel, pas dans le dépôt :\n`);
    console.log(`    ${cible.champ}=${c.url}\n`);
    console.log('  Vercel → Settings → Environment Variables, puis un redéploiement.');
    console.log('  Tant que ce n’est pas fait, la page tombe sur le formulaire : rien n’est cassé.');
    return;
  }

  poserDansLeCode(cible.champ, c.url);
  console.log(`  ${cible.libelle}\n    ${c.url}\n`);
  console.log('· Écrit dans src/app/montage-titan/contenu.ts — à committer.');
  console.log('· Contrôler : npm run typecheck && npm test');
}

async function main() {
  if (args.length === 0 || args.includes('--etat')) return etat();
  const [cle, adresse] = args;
  if (!cle || !adresse) {
    console.error('Usage : node scripts/regler-paiement.mjs <solo|trio|artisan> <adresse>   ou   --etat');
    process.exit(1);
  }
  return poser(cle, adresse);
}

try {
  await main();
} catch (erreur) {
  console.error('✗ ' + erreur.message);
  process.exit(1);
}
