#!/usr/bin/env node
/*
 * Une facture, en une commande, au moment où le client vient de dire oui.
 *
 *   npm run facture -- --client "LE GOFF TOITURES" --ville Rennes
 *
 * Ce script ne décide rien : tout ce qui compte — la numérotation, les
 * mentions, le texte — vit dans `src/lib/facture.ts`, qui est pur et éprouvé.
 * Ici il n'y a que la lecture du registre, l'écriture du fichier, et les refus
 * qui évitent d'émettre une facture impayable.
 *
 * Deux choses n'entrent jamais dans Git, et `factures/` est ignoré pour ça :
 * l'IBAN de l'émetteur, et le nom des clients avec les montants. Le dépôt est
 * public — c'est la leçon de `prospects.md`, payée une fois.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const { genererFacture, numeroSuivant, reproches } = await import('../src/lib/facture.ts');

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(RACINE, 'factures');
const REGISTRE = path.join(DOSSIER, 'registre.json');
const EMETTEUR = path.join(DOSSIER, 'emetteur.json');

/*
 * L'émetteur, écrit une fois dans un fichier que Git ignore.
 *
 * Le SIREN et l'adresse sont déjà publics — ils sont dans les mentions légales
 * du site. L'IBAN ne l'est pas, et c'est lui qui justifie que ce fichier reste
 * hors du dépôt.
 */
const MODELE_EMETTEUR = {
  nom: 'Erwann Chevallier',
  forme: 'Entrepreneur individuel (EI)',
  adresse: '20A rue Clotilde Vautier, 35000 Rennes',
  siren: '109356972',
  courriel: 'erwannchevallier@gmail.com',
  telephone: '06 21 38 11 15',
  iban: '',
  bic: '',
};

function lireArguments() {
  const brut = process.argv.slice(2);
  const lu = {};

  for (let i = 0; i < brut.length; i += 1) {
    const morceau = brut[i];
    if (!morceau.startsWith('--')) continue;

    const egal = morceau.indexOf('=');
    if (egal !== -1) {
      lu[morceau.slice(2, egal)] = morceau.slice(egal + 1);
      continue;
    }

    const suivant = brut[i + 1];
    if (suivant !== undefined && !suivant.startsWith('--')) {
      lu[morceau.slice(2)] = suivant;
      i += 1;
    }
  }

  return lu;
}

async function lireJson(chemin, defaut) {
  try {
    return JSON.parse(await readFile(chemin, 'utf8'));
  } catch {
    return defaut;
  }
}

/** `2026-09-03` — la forme que lisent les deux dates de la facture. */
function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function sansAccent(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function principal() {
  const options = lireArguments();
  await mkdir(DOSSIER, { recursive: true });

  const emetteur = await lireJson(EMETTEUR, null);

  if (emetteur === null) {
    await writeFile(EMETTEUR, `${JSON.stringify(MODELE_EMETTEUR, null, 2)}\n`, 'utf8');
    console.error('\n📄 Premier passage : le fichier de l’émetteur vient d’être écrit.\n');
    console.error(`   ${EMETTEUR}\n`);
    console.error('   Ouvre-le et remplis **l’IBAN** (et le BIC si tu l’as).');
    console.error('   Tout le reste est déjà prérempli, et ce fichier n’entre pas dans Git.\n');
    console.error('   Puis relance la même commande.\n');
    process.exit(1);
  }

  const client = {
    nom: options.client ?? '',
    adresse: options.adresse ?? '',
    siret: options.siret ?? '',
  };

  const manques = reproches(emetteur, client);

  if (manques.length > 0) {
    console.error('\n❌ Il manque de quoi émettre la facture :\n');
    for (const manque of manques) console.error(`   — ${manque}`);
    console.error('\n   L’émetteur se règle dans :');
    console.error(`   ${EMETTEUR}\n`);
    console.error('   Le client se donne en argument :');
    console.error('   npm run facture -- --client "LE GOFF TOITURES" \\');
    console.error('     --adresse "12 rue des Lilas, 35000 Rennes" --siret 12345678900012\n');
    process.exit(1);
  }

  /*
   * Le registre décide du numéro, et il ne se recompte pas : `numeroSuivant`
   * repart du plus grand déjà émis. Une ligne effacée par accident laisse donc
   * un trou — visible — plutôt que de faire réémettre un numéro déjà utilisé,
   * qui serait bien pire.
   */
  const registre = await lireJson(REGISTRE, []);
  const jour = options.date ?? aujourdhui();
  const numero = numeroSuivant(registre.map((ligne) => ligne.numero), Number(jour.slice(0, 4)));

  const facture = {
    numero,
    emiseLe: jour,
    realiseeLe: options.livre ?? jour,
    prestation:
      options.prestation ?? 'Création d’un site vitrine d’une page, livré et mis en ligne',
    montantEuros: Number(options.montant ?? 300),
  };

  if (!Number.isFinite(facture.montantEuros) || facture.montantEuros <= 0) {
    console.error(`\n❌ Montant illisible : ${options.montant}\n`);
    process.exit(1);
  }

  const html = genererFacture(emetteur, client, facture);
  const fichier = path.join(DOSSIER, `${numero}-${sansAccent(client.nom)}.html`);

  await writeFile(fichier, html, 'utf8');
  await writeFile(
    REGISTRE,
    `${JSON.stringify(
      [...registre, { numero, date: jour, client: client.nom, montant: facture.montantEuros }],
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log('');
  console.log(`   ${fichier}`);
  console.log('');
  console.log(`   Facture ${numero} — ${client.nom} — ${facture.montantEuros} €`);
  console.log('   Ouvre-la, imprime en PDF depuis le navigateur, et envoie le PDF.');
  console.log('');
}

await principal();
