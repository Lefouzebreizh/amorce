#!/usr/bin/env node
/*
 * D'une conversation à un site, sans écrire de JSON.
 *
 * Le formulaire en ligne suppose que le client vient sur la plateforme. Dans la
 * vraie vente, il dit oui sur Messenger et donne ses informations en trois
 * messages : c'est le vendeur qui les a sous les yeux, dans un fil de
 * discussion. Sans ce script, il devait composer un `commande.json` à la main
 * — au moment précis où il ne faut pas flotter, parce qu'un client qui vient de
 * dire oui se refroidit vite.
 *
 * Les questions posées ici sont **exactement** les champs du formulaire, et la
 * validation est **exactement** `reproches()`. Une seconde règle écrite pour le
 * terminal aurait dérivé de celle du web sans que rien ne le signale, et on
 * aurait fabriqué des dossiers qu'un autre chemin refuse.
 *
 * Le script s'arrête après avoir écrit le dossier et la page : les photos se
 * déposent ensuite dedans, et `npm run generer <dossier>` les reprend. Séparer
 * les deux évite d'attendre un transfert de photos pendant que le client est
 * encore en ligne.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const { MODELES, OPTIONS, nomDossier, prixTotal, reproches } =
  await import('../src/lib/commande.ts');
const { genererSite } = await import('../src/lib/site.ts');

/*
 * Deux façons de lire les réponses, et la seconde existe pour que ce script
 * soit vérifiable.
 *
 * En interactif, `readline` pose les questions. Mais avec une entrée
 * redirigée — un test, un fichier de réponses — `rl.question` ne se résout
 * plus une fois le flux terminé : le script reste suspendu sans rien dire, et
 * Node se contente d'un « unsettled top-level await ». Un outil de livraison
 * qu'on ne peut pas éprouver hors d'un terminal n'est pas éprouvé.
 *
 * Hors terminal, on lit donc tout d'un coup et on distribue ligne par ligne.
 */
const interactif = process.stdin.isTTY === true;
let lignes = [];
let rl;

if (interactif) {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
} else {
  const morceaux = [];
  for await (const bloc of process.stdin) morceaux.push(bloc);
  lignes = morceaux.join('').split('\n');
}

async function demander(question, defaut = '') {
  const invite = defaut === '' ? `${question} ` : `${question} [${defaut}] `;
  let reponse;
  if (interactif) {
    reponse = await rl.question(invite);
  } else {
    reponse = lignes.shift() ?? '';
    process.stdout.write(`${invite}${reponse}\n`);
  }
  reponse = reponse.trim();
  return reponse === '' ? defaut : reponse;
}

async function principal() {
  console.log('\n── Nouveau client ─────────────────────────────────');
  console.log('   Entrée pour passer un champ facultatif.\n');

  console.log('   Modèles :', MODELES.map((m) => m.id).join(', '));
  const modele = await demander('Modèle ?', 'btp');

  const commande = {
    modele,
    entreprise: await demander('Nom de l’entreprise ?'),
    telephone: await demander('Téléphone ?'),
    ville: await demander('Ville ?'),
    slogan: await demander('Slogan — une phrase, facultatif :'),
    presentation: await demander('Présentation — facultatif :'),
    services: await demander('Services, séparés par des points-virgules :'),
    couleur: await demander('Couleur #rrggbb — facultatif :'),
    options: [],
  };

  console.log('\n   Options :', OPTIONS.map((o) => o.id).join(', '));
  const choisies = await demander('Lesquelles ? séparées par des espaces :', 'appel whatsapp');
  commande.options = choisies.split(/\s+/).filter((o) => o !== '');

  /*
   * La même validation que la route d'API, pas une seconde écrite pour le
   * terminal. Refuser ici ce que le web accepte — ou l'inverse — fabriquerait
   * des dossiers qu'un autre chemin rejette.
   */
  const fautes = reproches(commande);
  if (fautes.length > 0) {
    console.error('\n❌ ' + fautes.join('\n❌ '));
    rl.close();
    process.exit(1);
  }

  const jour = new Date().toISOString().slice(0, 10);
  const reference = nomDossier(commande.entreprise, jour);
  const chemin = path.join(process.argv[2] ?? 'dossiers', reference);
  await mkdir(chemin, { recursive: true });

  await writeFile(
    path.join(chemin, 'commande.json'),
    `${JSON.stringify({ reference, recue_le: new Date().toISOString(),
      prix_total_euros: prixTotal(commande.options), commande, photos: [] }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(chemin, 'index.html'), genererSite(commande, []), 'utf8');

  console.log(`\n✅ ${chemin}`);
  console.log(`   ${commande.entreprise} — ${commande.ville} — ${prixTotal(commande.options)} €`);
  console.log('');
  console.log('   Ouvre index.html pour le montrer au client.');
  console.log('   Dépose ses photos dans le dossier, puis :');
  console.log(`   npm run generer ${chemin}`);
  rl?.close();
}

await principal();
