#!/usr/bin/env node
/**
 * Fabrique un dossier prêt à déposer par domaine, dans `dist/<niche>/`.
 *
 * Le gabarit se configure au chargement, en JavaScript : c'est ce qui permet
 * à un seul fichier de servir onze sites, et c'est aussi la faiblesse de
 * l'affaire. Un moteur qui n'exécute pas le JavaScript — et il en reste, à
 * commencer par les aperçus de liens des réseaux sociaux et des messageries —
 * lit le gabarit brut : titre « Chargement… », description vide. Sur un réseau
 * de sites qui vit du référencement et du partage, c'est le genre de détail
 * qui coûte des mois.
 *
 * Ce script écrit donc, pour chaque domaine, un `index.html` dont la tête est
 * déjà remplie : titre, description, balises sociales, adresse canonique,
 * couleurs de la charte. Le JavaScript continue de faire son travail par
 * dessus — il pose exactement les mêmes valeurs, la page ne clignote pas.
 *
 * Chaque dossier ne contient **que la base de sa niche** : un domaine ne sert
 * pas les dix autres, et un `?niche=` inconnu y retombe sur la sienne.
 *
 * Usage :
 *   node construire-sites.js          les onze domaines
 *   node construire-sites.js btp      un seul, pour vérifier
 *   node construire-sites.js --sans-dns   domaine acheté, DNS pas encore propagé
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireBasesActives, validerBase, creerReleve, rendreCompte } from './valider.js';
import { entreesDeNiche, sitemap, robots } from './generate-sitemap.js';
import { auditerAdresses } from './sonde-dns.mjs';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierSortie = path.join(racine, 'dist');

const echapperAttribut = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function baseDomaine(brut) {
  const url = new URL(brut);
  return url.origin + url.pathname.replace(/\/*$/, '/');
}

/** Remplace une balise de la tête par sa version renseignée. On travaille par
 *  substitution sur le gabarit plutôt qu'en réécrivant un second modèle : deux
 *  gabarits à tenir à jour, c'est un gabarit faux sur deux. */
function remplir(gabarit, { niche, domaine }) {
  const canonique = new URL(`?niche=${niche.id}`, domaine).href;
  const remplacements = [
    [/<meta name="niche-par-defaut" content="[^"]*">/, `<meta name="niche-par-defaut" content="${niche.id}">`],
    [/<title>[^<]*<\/title>/, `<title>${echapperAttribut(niche.meta_titre)}</title>`],
    [/<meta name="description" content="[^"]*">/, `<meta name="description" content="${echapperAttribut(niche.meta_description)}">`],
    [/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${echapperAttribut(canonique)}">`],
    [/<meta property="og:site_name" content="[^"]*">/, `<meta property="og:site_name" content="${echapperAttribut(niche.nom)}">`],
    [/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${echapperAttribut(niche.meta_titre)}">`],
    [/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${echapperAttribut(niche.meta_description)}">`],
    [/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${echapperAttribut(canonique)}">`],
  ];

  let sortie = gabarit;
  for (const [motif, valeur] of remplacements) {
    if (!motif.test(sortie)) throw new Error(`Balise introuvable dans index.html : ${motif}`);
    sortie = sortie.replace(motif, valeur);
  }

  if (niche.emoji) {
    const favicon = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${niche.emoji}</text></svg>`
    )}`;
    sortie = sortie.replace(/<link rel="icon" href="[^"]*">/, `<link rel="icon" href="${favicon}">`);
  }

  /* Les couleurs posées avant le premier rendu : sans cela le visiteur voit
     un dixième de seconde de violet par défaut avant la charte de la niche. */
  sortie = sortie.replace(
    '<link rel="stylesheet" href="styles.css">',
    '<link rel="stylesheet" href="styles.css">\n' +
    `<style>:root{--teinte-1:${niche.theme.primaire};--teinte-2:${niche.theme.secondaire}}</style>`
  );

  return sortie;
}

async function main() {
  const args = process.argv.slice(2);
  const demandees = args.filter((a) => !a.startsWith('-'));
  const gabarit = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const feuille = path.join(racine, 'styles.css');
  if (!fs.existsSync(feuille)) {
    throw new Error('styles.css absent — lancer `npm run styles` avant de construire les sites.');
  }

  /* Les niches en pause ne sont pas construites : ni dossier, ni sitemap, ni
     adresse à faire résoudre par la sonde DNS juste en dessous — c'est ce
     dernier point qui compte, car un domaine en pause ferait échouer la
     construction du seul site qu'on met réellement en ligne. */
  const toutes = lireBasesActives();
  const bases = demandees.length ? toutes.filter(({ base }) => demandees.includes(base.niche.id)) : toutes;
  if (bases.length === 0) throw new Error(`Aucune niche ne correspond à : ${demandees.join(', ')}`);

  /* Rien ne part en ligne sans validation : c'est le dernier moment où une
     base cassée peut encore être arrêtée avant d'être déposée sur un hébergeur. */
  const releve = creerReleve();
  for (const { fichier, base } of bases) validerBase(base, fichier, releve);
  if (releve.erreurs.length) {
    rendreCompte(releve, { titre: 'Construction interrompue' });
    process.exit(1);
  }

  /*
   * Dernière barrière avant la mise en ligne, et la seule qui attrape ce
   * défaut-là : `valider.js` vérifie que `niche.domaine` est une URL https
   * unique — il ne peut pas savoir si quelqu'un sert cette adresse.
   *
   * Le 29/08/2026 les onze niches annonçaient `ma-panoplie-ia.com`, qui ne
   * résout pas. Construire et déposer dans cet état mettait onze sites en
   * ligne, parfaitement affichés, déclarant tous une version de référence
   * introuvable. `regler-domaines.mjs --etat` le disait déjà — encore
   * fallait-il le lancer. Ici, on ne peut plus l'oublier : c'est le chemin
   * que tout le monde emprunte.
   */
  const audit = await auditerAdresses(bases.map(({ base }) => base.niche.domaine));
  if (!audit.disponible) {
    console.warn(
      '⚠ Pas de résolveur DNS joignable : les adresses canoniques n’ont pas pu être vérifiées.\n' +
      '  On construit quand même — un témoin muet n’accuse personne.'
    );
  } else if (audit.morts.length && !args.includes('--sans-dns')) {
    console.error(
      `✗ Construction interrompue — ${audit.morts.join(', ')} ne résout pas.\n\n` +
      '  Les balises canoniques, les `og:url` et les sitemaps désigneraient une\n' +
      '  adresse que personne ne sert. Les sites s’afficheraient pourtant très\n' +
      '  bien, et tous les autres contrôles passeraient : c’est exactement ce qui\n' +
      '  rend ce défaut cher.\n\n' +
      '  Régler l’adresse d’abord, reconstruire ensuite. `ma-panoplie-ia.com`\n' +
      '  est enregistré — le registre le refuse à l’achat — mais ne pointe nulle\n' +
      '  part : il lui manque quatre `A` sur l’apex, vers 185.199.108.153,\n' +
      '  .109.153, .110.153 et .111.153, puis Settings → Pages → Source →\n' +
      '  GitHub Actions.\n\n' +
      '  Décidé le 02/09/2026 : on ne publie pas sur une adresse provisoire.\n' +
      '  Les onze bases déclarent déjà ce domaine ; publier ailleurs obligerait\n' +
      '  à faire indexer une adresse pour la remplacer ensuite, ce qui remet le\n' +
      '  référencement à zéro sur un projet qui ne vaut que par lui.\n\n' +
      '  Autre adresse malgré tout : node regler-domaines.mjs --base <adresse>\n' +
      '  puis npm run sites.\n\n' +
      '  Domaine acheté dont le DNS n’a pas fini de se propager : --sans-dns.'
    );
    process.exit(1);
  }

  fs.rmSync(dossierSortie, { recursive: true, force: true });

  let batis = 0;
  const construites = [];
  for (const { base } of bases) {
    const { niche, outils } = base;
    if (outils.length === 0) {
      console.log(`  (${niche.id}) niche vide, aucun site à construire`);
      continue;
    }
    const domaine = baseDomaine(niche.domaine);
    const dossier = path.join(dossierSortie, niche.id);
    fs.mkdirSync(path.join(dossier, 'niches'), { recursive: true });

    fs.writeFileSync(path.join(dossier, 'index.html'), remplir(gabarit, { niche, domaine }), 'utf8');
    fs.copyFileSync(feuille, path.join(dossier, 'styles.css'));
    fs.writeFileSync(path.join(dossier, 'niches', `${niche.id}.json`), JSON.stringify(base, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(dossier, 'sitemap.xml'), sitemap(entreesDeNiche(niche, outils, domaine)), 'utf8');
    fs.writeFileSync(path.join(dossier, 'robots.txt'), robots(domaine), 'utf8');

    batis += 1;
    construites.push({ id: niche.id, nom: niche.nom });
    console.log(`  dist/${niche.id.padEnd(14)} ${outils.length} outils — ${domaine}`);
  }

  /* Une page à la racine du dépôt Pages, et elle n'existait pas.
     `dist/` ne contient que des dossiers de niche, si bien que
     `lefouzebreizh.github.io/amorce/` rendait un 404 franc de GitHub —
     mesuré le 08/09/2026 depuis un vrai navigateur. C'est l'adresse la plus
     courte, donc celle qu'on tape de mémoire et celle que le journal des
     déploiements donne comme `environment_url` : elle ne peut pas rester
     morte.

     Elle redirige plutôt qu'elle ne choisit : la cible est `generaliste`
     quand elle est construite, sinon la première niche construite. Écrire
     `generaliste` en dur casserait le jour où cette niche passe en pause,
     et c'est exactement le genre de panne qu'aucun test ne voit.

     `noindex` n'est pas décoratif : le gabarit d'une niche écrit sa balise
     canonique depuis son propre domaine, et une page d'accueil indexée
     concurrencerait la niche vers laquelle elle envoie. Elle sert les
     humains, pas les moteurs. Et elle porte un vrai lien en plus des deux
     redirections : sans JavaScript, la balise `refresh` suffit ; sans elle,
     le lien reste cliquable. */
  if (construites.length) {
    const cible = construites.find((n) => n.id === 'generaliste') ?? construites[0];
    const liens = construites
      .map((n) => `<li><a href="${n.id}/">${n.nom}</a></li>`)
      .join('\n      ');
    fs.writeFileSync(
      path.join(dossierSortie, 'index.html'),
      `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=${cible.id}/">
<title>${cible.nom}</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
         background: #07070f; color: #c9c9e6; font: 18px/1.6 system-ui, sans-serif;
         padding: 24px; text-align: center; }
  a { color: #7fd68a; }
  ul { list-style: none; padding: 0; }
  li { margin: 12px 0; }
</style>
</head>
<body>
  <main>
    <p>Redirection vers <strong>${cible.nom}</strong>…</p>
    <ul>
      ${liens}
    </ul>
  </main>
  <script>location.replace('${cible.id}/');</script>
</body>
</html>
`,
      'utf8',
    );
    console.log(`  dist/index.html   redirige vers ${cible.id}/`);
  }

  console.log(`\n${batis} site(s) prêts dans dist/.`);
  console.log('Déposer le contenu de dist/<niche>/ à la racine du domaine correspondant : rien d’autre à faire.');
  if (releve.alertes.length) rendreCompte({ erreurs: [], alertes: releve.alertes }, { titre: 'À corriger avant la mise en ligne' });
}

try {
  await main();
} catch (erreur) {
  console.error(erreur.message);
  process.exit(1);
}
