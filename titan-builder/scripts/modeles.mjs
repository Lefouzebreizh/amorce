#!/usr/bin/env node
/*
 * Les modèles de la galerie : six métiers, six entreprises qui n'existent pas.
 *
 *   node scripts/modeles.mjs
 *
 * POURQUOI ILS NE SONT PAS LES PAGES DES PROSPECTS.
 *
 * Le dépôt contient déjà dix-sept pages nominatives, préparées pour de vraies
 * entreprises qui n'ont rien demandé. Les mettre dans une galerie publique en
 * ferait des références — c'est-à-dire un mensonge sur la clientèle, et la
 * publication de données de tiers. C'est la raison pour laquelle ce dossier-là
 * reste hors dépôt, et elle ne s'annule pas parce qu'une galerie serait plus
 * fournie.
 *
 * Les six entreprises ci-dessous sont donc inventées, et chaque page le dit
 * dans sa propre présentation — pas en petits caractères en bas. Ce que la
 * galerie montre est vrai : « voilà ce que je produis », et non « voilà mes
 * clients ».
 *
 * ET LA COULEUR CHANGE À CHAQUE FOIS, PARCE QUE C'EST L'ARGUMENT.
 *
 * Six pages du même gris prouveraient qu'il existe un gabarit. Six pages qui
 * se ressemblent par la structure et diffèrent par la teinte prouvent qu'il
 * est remis au métier — ce que le prospect veut savoir avant de payer.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.resolve(RACINE, '../artisan-express/public/modeles');

/* Le numéro affiché sur toutes les pages de modèle.
 *
 * `02 97 00 00 00` : la tranche 02 97 00 00 xx est réservée à la fiction par
 * l'Arcep, comme le 555 américain. Un numéro plausible pris au hasard sonnerait
 * chez quelqu'un, et ce quelqu'un recevrait les appels d'artisans curieux. */
const TELEPHONE_FICTIF = '02 97 00 00 00';

const MENTION =
  'Cette page est un modèle : « %s » n’existe pas et le numéro ne sonne ' +
  'nulle part. Elle montre exactement ce qui est livré — avec vos textes, ' +
  'vos photos et votre numéro à la place de ceux-ci.';

const MODELES = [
  {
    /*
     * Ce nom a déjà changé deux fois, et la deuxième fois pour rien.
     *
     * Il ne peut pas être « Couverture Tanguy » : c'est l'entreprise
     * d'`exemple.html`, la démonstration que la page de vente montre déjà.
     * Il a donc été mis à « Toitures Le Goff » — qui était le nom de la
     * vignette « après » d'`AvantApres`, trois écrans plus haut sur cette
     * même page. On s'était décollé d'une collision pour tomber dans
     * l'autre, et le test ne l'a pas vu : il ne comparait qu'au titre
     * d'`exemple.html`.
     *
     * La page de vente nomme donc trois couvreurs fictifs — la vignette, la
     * démonstration, ce modèle — et les trois doivent porter trois noms.
     * `artisan-express/tests/galerie.test.ts` les compare maintenant tous,
     * sur l'ensemble de leurs mots significatifs : « LE GOFF TOITURES » et
     * « Toitures Le Goff » sont le même nom pour un lecteur, et une
     * comparaison de chaînes les aurait laissés passer une fois de plus.
     */
    fichier: 'couvreur',
    titre: 'Couvreur',
    entreprise: 'Toitures Riou',
    ville: 'Ploërmel',
    couleur: '#2f6f4e',
    slogan: 'Couvreur zingueur à Ploërmel. Devis sous 48 h.',
    metier: 'Je travaille seul, sur des toits que je connais. Ardoise, zinc, Velux. Je viens voir, je chiffre, et je dis non quand ce n’est pas mon métier.',
    services: 'Toiture ardoise et tuile\nZinguerie et gouttières\nPose de Velux\nDémoussage et entretien',
  },
  {
    fichier: 'electricien',
    titre: 'Électricien',
    entreprise: 'Le Bihan Électricité',
    ville: 'Vannes',
    couleur: '#1f5f8b',
    slogan: 'Électricien à Vannes. Mise aux normes et dépannage.',
    metier: 'Tableau, rénovation complète, panne un dimanche soir. Je donne un prix avant de commencer, et il ne bouge pas.',
    services: 'Mise aux normes\nTableau électrique\nRénovation complète\nDépannage',
  },
  {
    fichier: 'macon',
    titre: 'Maçon',
    entreprise: 'Maçonnerie Kervran',
    ville: 'Lorient',
    couleur: '#8a5a2b',
    slogan: 'Maçonnerie générale à Lorient et 30 km autour.',
    metier: 'Murs, terrasses, ouvertures dans du porteur. Vingt ans sur les chantiers du pays, et le même numéro depuis le début.',
    services: 'Murs et clôtures\nTerrasse et dallage\nOuverture dans un mur porteur\nRénovation de façade',
  },
  {
    fichier: 'serrurier',
    titre: 'Serrurier',
    entreprise: 'Clé Douce Serrurerie',
    ville: 'Quimper',
    couleur: '#7a3f6d',
    slogan: 'Serrurier à Quimper. Ouverture de porte, 7 j/7.',
    metier: 'Porte claquée, serrure forcée, blindage. J’annonce le prix au téléphone avant de me déplacer — personne n’aime les surprises à minuit.',
    services: 'Ouverture de porte\nChangement de serrure\nPorte blindée\nDépannage d’urgence',
  },
  {
    fichier: 'paysagiste',
    titre: 'Paysagiste',
    entreprise: 'Jardins du Scorff',
    ville: 'Pontivy',
    couleur: '#4d7c2f',
    slogan: 'Paysagiste à Pontivy. Création et entretien à l’année.',
    metier: 'Je dessine, je plante, je reviens. Un jardin se juge à trois ans, pas à la fin du chantier.',
    services: 'Création de jardin\nTerrasse et clôture\nÉlagage et taille de haie\nEntretien à l’année',
  },
  {
    fichier: 'plombier',
    titre: 'Plombier',
    entreprise: 'Guillou Plomberie',
    ville: 'Saint-Brieuc',
    couleur: '#2a6f7a',
    slogan: 'Plombier chauffagiste à Saint-Brieuc. Fuite traitée le jour même.',
    metier: 'Recherche de fuite, salle de bains complète, chauffe-eau. Je laisse le chantier propre, c’est la moitié du métier.',
    services: 'Fuite et dépannage\nSalle de bains complète\nChauffe-eau et chaudière\nRecherche de fuite',
  },
];

function ecrireDossier(m) {
  const dossier = path.join(RACINE, 'modeles', m.fichier);
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(
    path.join(dossier, 'commande.json'),
    JSON.stringify(
      {
        reference: `modele-${m.fichier}`,
        commande: {
          modele: 'btp',
          entreprise: m.entreprise,
          telephone: TELEPHONE_FICTIF,
          ville: m.ville,
          couleur: m.couleur,
          slogan: m.slogan,
          presentation: `${m.metier}\n\n${MENTION.replace('%s', m.entreprise)}`,
          services: m.services,
          options: ['appel', 'whatsapp'],
        },
        photos: [],
      },
      null,
      2,
    ) + '\n',
  );
  return dossier;
}

fs.mkdirSync(SORTIE, { recursive: true });
const fiche = [];
for (const m of MODELES) {
  const dossier = ecrireDossier(m);
  const r = spawnSync('node', [path.join(ICI, 'generer.mjs'), dossier, '--demonstration', `--motif=${m.fichier}`], {
    cwd: RACINE,
    encoding: 'utf-8',
  });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout || '');
    process.exit(1);
  }
  const html = fs.readFileSync(path.join(dossier, 'index.html'), 'utf-8');
  if (!html.includes('n’existe pas')) {
    console.error(`  ${m.fichier} : la mention de fiction n'est pas dans la page — arrêt`);
    process.exit(1);
  }
  if (!/noindex/.test(html)) {
    console.error(`  ${m.fichier} : la page n'est pas en noindex — arrêt`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(SORTIE, `${m.fichier}.html`), html);
  fiche.push({ ...m, poids: html.length });
  console.log(`  ${m.titre.padEnd(12)} ${m.entreprise.padEnd(24)} ${(html.length / 1024).toFixed(1)} ko`);
}
console.log(`\n  ${fiche.length} modèles écrits dans ${path.relative(process.cwd(), SORTIE)}`);
