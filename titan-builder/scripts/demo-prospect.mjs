#!/usr/bin/env node
/*
 * La démonstration au nom du prospect, en une commande.
 *
 *   node scripts/demo-prospect.mjs \
 *     --entreprise "LE GOFF TOITURES" --metier couvreur --ville Rennes
 *
 * Pourquoi ce script existe, alors que `nouveau-client.mjs` sait déjà écrire un
 * dossier et `generer.mjs` sait déjà en faire une page : il ne refait ni l'un ni
 * l'autre — il les **enchaîne** et ajoute la seule chose qu'aucun des deux ne
 * peut poser tout seul, et qu'on oublierait à coup sûr sous la pression d'une
 * relance : **la mention qui empêche la page de passer pour le vrai site de
 * l'artisan.**
 *
 * Le reste du dépôt vend la même page à un client qui a dit oui. Ici on
 * s'adresse à quelqu'un qui n'a rien demandé, et dont on écrit le nom sur une
 * page web. La différence n'est pas commerciale, elle est morale : une page qui
 * porte « MAÇONNERIE DURAND » sans dire ce qu'elle est devient, pour n'importe
 * quel visiteur, le site de Maçonnerie Durand. Le dépôt interdit déjà le faux
 * témoignage ; usurper une enseigne serait pire, et c'est le seul risque que
 * cette approche fait courir.
 *
 * Trois garde-fous, tous les trois non négociables et posés ici plutôt que
 * laissés à la vigilance de celui qui prospecte à onze heures du soir :
 *
 * 1. **La mention est forcée** dans la présentation. Elle ne se désactive par
 *    aucun drapeau : il n'y a pas d'option pour l'enlever, parce qu'une option
 *    finit toujours par être utilisée.
 * 2. **`--demonstration` est toujours passé** au générateur, donc la page sort
 *    en `noindex, nofollow`. Elle ne peut pas se retrouver dans les résultats
 *    de recherche à la place du vrai artisan.
 * 3. **Le téléphone est obligatoire, et ce doit être le sien.** `reproches()`,
 *    la validation que partagent le formulaire web et le terminal, refuse une
 *    commande sans numéro : un site d'artisan sans téléphone n'est pas un site.
 *    Ce script ne contourne donc pas la règle — il exige le numéro et dit
 *    pourquoi.
 *
 *    Ce numéro-là se **recopie** depuis sa page ou sa fiche, jamais ne
 *    s'invente. C'est un numéro qu'il publie déjà lui-même ; le reprendre
 *    n'expose rien. En fabriquer un poserait un faux contact sous son enseigne,
 *    et ce serait le pire des deux mondes.
 *
 *    (Une première version de ce fichier annonçait l'inverse — « sans
 *    `--telephone`, le bouton disparaît ». C'était faux : la commande était
 *    refusée avant d'arriver à la page. La ligne est corrigée plutôt
 *    qu'effacée, parce que c'est le genre d'erreur qu'on refait.)
 *
 * La page produite est **un seul fichier autonome** : tout le CSS est en ligne
 * et les cadres photo sont des SVG embarqués. Elle s'envoie donc telle quelle
 * dans la conversation — Messenger et WhatsApp acceptent les pièces jointes, et
 * le téléphone l'ouvre dans son navigateur. Pas d'hébergement à monter, pas de
 * quota consommé, pas de lien mort trois semaines plus tard.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');

/*
 * Ce que chaque métier vend, écrit une fois.
 *
 * Ce ne sont pas des slogans : ce sont les prestations qu'un artisan de ce
 * métier reconnaît comme les siennes en une seconde. Un prospect qui lit une
 * liste juste comprend qu'on a compris son métier ; une liste approximative
 * fait exactement l'inverse, et c'est pire que pas de liste du tout.
 *
 * Elles se remplacent par `--services` dès qu'on a lu sa vraie page — et c'est
 * ce qu'il faut faire, parce que reprendre ses mots à lui vaut mieux que les
 * meilleurs mots génériques.
 */
const METIERS = {
  couvreur: {
    modele: 'btp',
    accroche: 'Couvreur zingueur',
    services: 'Toiture ardoise et tuile;Zinguerie et gouttières;Pose de Velux;Démoussage et entretien',
    couleur: '#2f6f4e',
  },
  macon: {
    modele: 'btp',
    accroche: 'Maçonnerie générale',
    services: 'Murs et clôtures;Terrasse et dallage;Ouverture dans un mur porteur;Rénovation de façade',
    couleur: '#8a5a2b',
  },
  plombier: {
    modele: 'btp',
    accroche: 'Plomberie et chauffage',
    services: 'Fuite et dépannage;Salle de bains complète;Chauffe-eau et chaudière;Recherche de fuite',
    couleur: '#1f5f8b',
  },
  electricien: {
    modele: 'btp',
    accroche: 'Électricité générale',
    services: 'Mise aux normes;Tableau électrique;Rénovation complète;Dépannage',
    couleur: '#a8611a',
  },
  menuisier: {
    modele: 'btp',
    accroche: 'Menuiserie',
    services: 'Fenêtres et portes;Parquet et escalier;Aménagement sur mesure;Volets et portail',
    couleur: '#6b4f2a',
  },
  peintre: {
    modele: 'btp',
    accroche: 'Peinture et décoration',
    services: 'Peinture intérieure;Ravalement de façade;Papier peint et enduits;Sols souples',
    couleur: '#3d5a80',
  },
};

function lireArguments() {
  const brut = process.argv.slice(2);
  const lu = {};

  for (const morceau of brut) {
    const egal = morceau.indexOf('=');
    if (!morceau.startsWith('--') || egal === -1) continue;
    lu[morceau.slice(2, egal)] = morceau.slice(egal + 1);
  }

  // La forme `--clef valeur` est celle qu'on tape naturellement : on l'accepte
  // aussi, sinon la première utilisation échoue sans qu'on comprenne pourquoi.
  for (let i = 0; i < brut.length; i += 1) {
    const morceau = brut[i];
    if (!morceau.startsWith('--') || morceau.includes('=')) continue;
    const suivant = brut[i + 1];
    if (suivant !== undefined && !suivant.startsWith('--')) {
      lu[morceau.slice(2)] = suivant;
      i += 1;
    }
  }

  return lu;
}

/*
 * La mention, et le soin qu'elle demande.
 *
 * Elle est écrite pour être lue par l'artisan lui-même, pas par un juriste :
 * s'il la trouve froide ou menaçante, il ferme la page et on a perdu. Elle dit
 * donc trois choses dans cet ordre — ce que c'est, qu'il ne s'est rien passé
 * dans son dos, et ce qu'il peut en faire.
 */
function mention(entreprise) {
  return (
    `Cette page est une proposition, préparée pour ${entreprise} — ` +
    `ce n’est pas votre site officiel, elle n’est en ligne nulle part et ` +
    `personne d’autre que vous ne l’a reçue. Les photos sont des emplacements, ` +
    `pas des chantiers. Si elle vous plaît, on la remplit avec vos vraies ` +
    `photos, vos mots et votre numéro.`
  );
}

function executer(commande, arguments_, entree) {
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(commande, arguments_, { cwd: RACINE, stdio: ['pipe', 'pipe', 'inherit'] });
    let sortie = '';

    enfant.stdout.on('data', (bloc) => {
      sortie += bloc;
    });
    enfant.on('error', rejeter);
    enfant.on('close', (code) => {
      if (code === 0) resoudre(sortie);
      else rejeter(new Error(`${commande} ${arguments_.join(' ')} → code ${code}`));
    });

    if (entree !== undefined) enfant.stdin.write(entree);
    enfant.stdin.end();
  });
}

async function principal() {
  const options = lireArguments();
  const entreprise = options.entreprise ?? '';
  const ville = options.ville ?? '';
  const metier = (options.metier ?? '').toLowerCase();

  const telephone = options.telephone ?? '';

  if (entreprise === '' || ville === '' || telephone === '' || !(metier in METIERS)) {
    console.error('\nIl manque de quoi écrire la page.\n');
    console.error('  node scripts/demo-prospect.mjs \\');
    console.error('    --entreprise "LE GOFF TOITURES" --metier couvreur \\');
    console.error('    --ville Rennes --telephone "02 99 00 00 00"\n');
    console.error(`  --metier au choix : ${Object.keys(METIERS).join(', ')}`);
    console.error('  --services, --couleur, --slogan, --modele : facultatifs\n');
    console.error('  --telephone est obligatoire : la validation partagée avec le');
    console.error('  formulaire web refuse un site d’artisan sans numéro. Recopie');
    console.error('  celui de sa page — ne l’invente jamais.\n');
    process.exit(1);
  }

  const metrage = METIERS[metier];

  /*
   * L'ordre des neuf lignes est celui des questions de `nouveau-client.mjs`,
   * et il n'y a pas d'autre façon de le savoir que de l'y lire. Si ce script-là
   * gagne ou perd une question, celui-ci écrit une commande décalée d'un cran
   * sans qu'aucune erreur ne le dise — d'où le contrôle qui suit l'exécution.
   */
  const reponses = [
    options.modele ?? metrage.modele,
    entreprise,
    telephone,
    ville,
    options.slogan ?? `${metrage.accroche} à ${ville} et alentours. Devis sous 48 h.`,
    mention(entreprise),
    options.services ?? metrage.services,
    options.couleur ?? metrage.couleur,
    'appel whatsapp',
    '',
  ].join('\n');

  const journal = await executer('node', ['scripts/nouveau-client.mjs', 'demos'], reponses);
  const dossier = journal.match(/✅ (demos\/\S+)/)?.[1];

  if (dossier === undefined) {
    console.error('\n❌ `nouveau-client.mjs` n’a pas rendu de chemin — il a sans doute refusé la');
    console.error('   commande. Sa sortie est au-dessus ; l’ordre des questions a peut-être changé.\n');
    process.exit(1);
  }

  // Deuxième passe : la première a écrit la page sans `noindex`, parce que
  // `nouveau-client.mjs` sert un vrai client. Ici on la réécrit en démonstration.
  await executer('node', ['scripts/generer.mjs', dossier, '--demonstration']);

  const page = path.join(RACINE, dossier, 'index.html');
  console.log('');
  console.log(`   ${page}`);
  console.log('');
  console.log('   Envoie ce fichier tel quel dans la conversation — un seul fichier,');
  console.log('   il s’ouvre sur son téléphone sans hébergement.');
  console.log('');
}

await principal();
