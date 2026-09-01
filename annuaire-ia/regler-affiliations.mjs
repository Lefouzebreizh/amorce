#!/usr/bin/env node
/**
 * Pose les vrais liens d'affiliation à la place des liens de démonstration.
 *
 * Tant que les 73 liens restent en `exemple-affiliation.com`, le réseau
 * publie, se référence et **ne rapporte rien** : c'est le dernier maillon entre
 * une soirée d'inscriptions et le premier euro. `AFFILIATION.md` a fait la
 * recherche — quels programmes ouvrir, dans quel ordre, lesquels sont fermés.
 * Ce script fait le geste qui suit, et que ce document décrivait comme
 * « remplacer `lien_affiliation` dans `niches/<niche>.json` », à la main, dans
 * onze fichiers.
 *
 * Onze retouches manuelles, c'est onze occasions d'en oublier une, et surtout
 * de coller un lien dans la mauvaise fiche — un lien d'affiliation posé sur le
 * mauvais outil ne casse rien, ne se voit pas, et paie quelqu'un d'autre.
 *
 *   node regler-affiliations.mjs --etat
 *   node regler-affiliations.mjs gamma https://gamma.app/?via=erwann
 *   node regler-affiliations.mjs --depuis mes-liens.txt
 *
 * Le fichier de `--depuis` est volontairement grossier : une ligne par outil,
 * l'identifiant puis l'adresse, séparés par un espace, une tabulation, une
 * virgule ou un point-virgule. C'est ce qu'on obtient en recopiant un tableau
 * ou ses notes, et exiger mieux ferait retomber dans la saisie à la main.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditerAdresses } from './sonde-dns.mjs';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierNiches = path.join(racine, 'niches');

/* Le même marqueur que `valider.js` : deux définitions de « lien pas encore
   posé », c'est un compteur d'avancement qui contredit l'autre. */
const DEMO = /exemple-affiliation\.com/;
/* Et le même critère qu'à la validation pour « ne rapportera jamais rien ». */
const SUR_DEVIS = /sur devis/i;

const args = process.argv.slice(2);
const aDrapeau = (nom) => args.includes(nom);
const valeurDe = (nom) => {
  const i = args.indexOf(nom);
  return i === -1 ? null : (args[i + 1] ?? '');
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

const ecrire = (chemin, base) =>
  fs.writeFileSync(chemin, JSON.stringify(base, null, 2) + '\n', 'utf8');

/** Tous les outils du réseau, à plat, avec de quoi les réécrire. */
function inventaire() {
  const plat = [];
  for (const { chemin, base } of bases()) {
    for (const outil of base.outils ?? []) {
      plat.push({ chemin, base, outil, niche: base.niche.id });
    }
  }
  return plat;
}

const estDemo = (outil) => DEMO.test(String(outil.lien_affiliation ?? ''));
const estSurDevis = (outil) => SUR_DEVIS.test(String(outil.prix ?? ''));
/*
 * `sans_programme` porte une recherche déjà faite : l'éditeur ne rémunère pas
 * l'apport, ou son programme est fermé aux nouveaux candidats. C'est écrit dans
 * les données et non dans ce script, parce que c'est une propriété de l'outil —
 * un script qui embarquerait la liste la verrait dériver dès la première fiche
 * ajoutée par l'auto-pilote. Le pourquoi de chaque cas reste dans AFFILIATION.md.
 */
const sansProgramme = (outil) => Boolean(outil.sans_programme);

/*
 * On retrouve un outil par son identifiant, mais aussi par son nom : on recopie
 * « Togal.AI » depuis le tableau d'un programme, pas « togal-ai ». La
 * comparaison écrase casse, accents et ponctuation — sinon « Photoroom » ne
 * retrouve pas « photo-room » et on croit l'outil absent du réseau.
 */
const aplatir = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

function trouver(plat, cle) {
  const c = aplatir(cle);
  return plat.filter(({ outil }) => aplatir(outil.id) === c || aplatir(outil.nom) === c);
}

/** Ce qui ressemble à la clé, pour proposer plutôt que de juste refuser. */
function voisins(plat, cle) {
  const c = aplatir(cle);
  return plat
    .filter(({ outil }) => {
      const a = aplatir(outil.id), b = aplatir(outil.nom);
      return a.includes(c) || c.includes(a) || b.includes(c) || c.includes(b);
    })
    .map(({ outil }) => `${outil.id} (${outil.nom})`)
    .slice(0, 6);
}

/**
 * Contrôle une adresse avant de la poser. Les trois refus correspondent à trois
 * façons réelles de perdre l'argent sans que rien ne l'annonce : le lien qui
 * n'est pas de l'affiliation, celui qu'on a oublié de remplacer, et celui dont
 * l'hôte n'existe pas.
 */
function verifierAdresse(brut) {
  const valeur = String(brut).trim();
  if (!/^https:\/\//.test(valeur)) {
    return { erreur: `doit commencer par https:// — reçu : ${valeur}` };
  }
  let url;
  try { url = new URL(valeur); } catch { return { erreur: `adresse illisible : ${valeur}` }; }
  if (DEMO.test(valeur)) {
    return { erreur: 'c’est encore l’adresse de démonstration' };
  }
  return { url: url.href };
}

async function etat() {
  const plat = inventaire();
  const restants = plat.filter(({ outil }) => estDemo(outil));
  const poses = plat.length - restants.length;

  console.log('── Liens d’affiliation du réseau\n');
  console.log(`  ${poses} posé(s) sur ${plat.length} — ${restants.length} encore en démonstration\n`);

  /* Le compte brut décourage sans informer. Sur les 73, deux parts ne pourront
     jamais rapporter : celle qui se vend par cycle commercial long — aucun
     programme derrière — et celle dont l'éditeur ne rémunère pas l'apport ou a
     fermé son programme, déjà tranchée dans AFFILIATION.md. Les compter comme
     du travail restant fait paraître la soirée deux fois plus longue qu'elle
     n'est, et c'est ce qui la fait repousser. */
  const monnayables = restants.filter(({ outil }) => !estSurDevis(outil) && !sansProgramme(outil));
  const surDevis = restants.filter(({ outil }) => estSurDevis(outil)).length;
  const tranches = restants.filter(({ outil }) => sansProgramme(outil) && !estSurDevis(outil)).length;

  const parNiche = new Map();
  for (const { niche, outil } of monnayables) {
    if (!parNiche.has(niche)) parNiche.set(niche, []);
    parNiche.get(niche).push(outil.id);
  }

  for (const [niche, ids] of [...parNiche].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${niche.padEnd(14)} ${String(ids.length).padStart(2)} à poser  ${ids.join(', ')}`);
  }

  console.log(
    `\n  ${monnayables.length} lien(s) valent une inscription.` +
    `\n  ${surDevis} « sur devis » — vente par cycle long, aucun programme derrière.` +
    `\n  ${tranches} sans programme — éditeur qui ne rémunère pas, ou programme fermé.` +
    '\n  Ces deux dernières colonnes ne sont pas du retard : elles sont réglées.'
  );
  console.log('\n  Quels programmes ouvrir et dans quel ordre : AFFILIATION.md');
  console.log('  Puis : node regler-affiliations.mjs <outil> <adresse>   ou   --depuis <fichier>');
}

/** Lit le fichier grossier de `--depuis` : « identifiant <séparateur> adresse ». */
function lireCouples(fichier) {
  const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
  const couples = [];
  lignes.forEach((ligne, i) => {
    const net = ligne.trim();
    if (net === '' || net.startsWith('#')) return;
    const m = net.match(/^(.+?)[\s,;]+(https?:\/\/\S+)$/);
    if (!m) {
      throw new Error(`ligne ${i + 1} illisible : « ${net} »\n  Attendu : <identifiant> <adresse https>`);
    }
    couples.push({ cle: m[1].trim(), adresse: m[2].trim() });
  });
  if (couples.length === 0) throw new Error(`${fichier} ne contient aucune ligne exploitable.`);
  return couples;
}

async function poser(couples) {
  const plat = inventaire();
  const retenus = [];

  /* Tout est contrôlé avant qu'une seule ligne ne soit écrite : un lot à moitié
     posé sur une erreur de frappe laisse le dépôt dans un état que personne ne
     sait décrire, et qu'on répare à la main — exactement ce qu'on voulait
     éviter. */
  for (const { cle, adresse } of couples) {
    const cibles = trouver(plat, cle);
    if (cibles.length === 0) {
      const proches = voisins(plat, cle);
      throw new Error(
        `outil inconnu : « ${cle} »` +
        (proches.length ? `\n  Vouliez-vous : ${proches.join(', ')} ?` : '\n  `--etat` liste les identifiants.')
      );
    }
    /* Aucun outil n'est aujourd'hui dans deux niches, mais rien ne l'interdit :
       on pose partout plutôt que de choisir au hasard. */
    const controle = verifierAdresse(adresse);
    if (controle.erreur) throw new Error(`« ${cle} » — ${controle.erreur}`);
    retenus.push({ cle, url: controle.url, cibles });
  }

  const audit = await auditerAdresses(retenus.map((r) => r.url));
  if (!audit.disponible) {
    console.warn('⚠ Pas de résolveur DNS joignable : les hôtes n’ont pas pu être vérifiés.\n');
  } else if (audit.morts.length) {
    throw new Error(
      `${audit.morts.join(', ')} ne résout pas.\n` +
      '  Un lien d’affiliation vers un hôte qui n’existe pas perd la commission\n' +
      '  sans que rien ne le signale : la carte s’affiche, le visiteur clique,\n' +
      '  et il tombe sur une erreur. Vérifier l’adresse copiée depuis le programme.'
    );
  }

  const fichiersTouches = new Map();
  let poses = 0;
  for (const { url, cibles } of retenus) {
    for (const { chemin, base, outil } of cibles) {
      outil.lien_affiliation = url;
      /* Un vrai lien contredit le marqueur : le programme a rouvert, ou la
         recherche s'est trompée. On le retire plutôt que de laisser coexister
         une adresse qui paie et une note qui dit qu'elle ne paie pas. */
      const marqueurLeve = sansProgramme(outil);
      if (marqueurLeve) delete outil.sans_programme;
      fichiersTouches.set(chemin, base);
      poses += 1;
      console.log(`  ${outil.id.padEnd(24)} ${url}` + (marqueurLeve ? '   (marqué « sans programme » — marqueur levé)' : ''));
    }
  }
  for (const [chemin, base] of fichiersTouches) ecrire(chemin, base);

  const restants = inventaire().filter(({ outil }) => estDemo(outil)).length;
  console.log(`\n${poses} lien(s) posé(s) dans ${fichiersTouches.size} fichier(s). ${restants} encore en démonstration.`);
  console.log('· Contrôler : npm run valider');
}

async function main() {
  if (args.length === 0 || aDrapeau('--etat')) return etat();

  const fichier = valeurDe('--depuis');
  if (fichier !== null) {
    if (fichier === '') throw new Error('Usage : --depuis <fichier>');
    return poser(lireCouples(fichier));
  }

  const [cle, adresse] = args;
  if (!cle || !adresse) {
    console.error('Usage : node regler-affiliations.mjs <outil> <adresse>   ou   --depuis <fichier>   ou   --etat');
    process.exit(1);
  }
  return poser([{ cle, adresse }]);
}

try {
  await main();
} catch (erreur) {
  console.error('✗ ' + erreur.message);
  process.exit(1);
}
