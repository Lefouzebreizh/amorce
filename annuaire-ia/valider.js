#!/usr/bin/env node
/**
 * Le filet du réseau : rien ne part en ligne sans passer par ici.
 *
 * Onze sites lisent onze fichiers JSON qu'aucun compilateur ne relit. Une
 * virgule en trop, un champ oublié, un identifiant en double — et le site
 * concerné affiche une page d'erreur jusqu'à ce que quelqu'un s'en aperçoive.
 * Comme l'auto-pilote pousse sur `main` sans relecture humaine, ce quelqu'un
 * peut mettre des jours à passer. D'où ce module, qui est **la seule
 * définition de ce qu'est une base valide** : l'auto-pilote l'importe avant
 * d'écrire, l'intégration continue l'exécute sur chaque poussée.
 *
 * Deux niveaux, et la distinction compte :
 *
 * - **Une erreur casse un site.** Champ manquant, JSON illisible, identifiant
 *   en double : le programme sort en échec et rien n'est publié.
 * - **Une alerte coûte du trafic, pas le site.** Titre trop long pour Google,
 *   avis sans ses quatre sections, lien d'affiliation resté en `exemple-`.
 *   Elle s'affiche et laisse passer : bloquer une publication sur une longueur
 *   de balise reviendrait à préférer un site figé à un site imparfait.
 *
 * Usage :
 *   node valider.js            valide les onze bases et la réserve
 *   node valider.js --strict   les alertes deviennent bloquantes
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierNiches = path.join(racine, 'niches');

const CHAMPS_OUTIL = [
  'id', 'nom', 'categorie', 'prix',
  'description_courte', 'description_longue',
  'lien_affiliation', 'score_avis',
];
const CHAMPS_NICHE = [
  'id', 'nom', 'domaine', 'h1_accent', 'h1_suite', 'slogan',
  'meta_titre', 'meta_description', 'theme', 'note_transparence',
];
const SECTIONS_AVIS = ['## Notre verdict', '## Points forts', '## Points faibles', '## Idéal pour'];

const IDENTIFIANT = /^[a-z0-9-]{1,40}$/;
const COULEUR = /^#[0-9a-fA-F]{6}$/;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Recueille erreurs et alertes plutôt que de s'arrêter à la première : voir
 *  d'un coup tout ce qui cloche évite trois allers-retours. */
export function creerReleve() {
  return { erreurs: [], alertes: [] };
}

/** Une alerte porte un genre, parce qu'elles arrivent par familles : tant que
 *  les liens d'affiliation ne sont pas posés, la même remarque sort quatre-vingts
 *  fois et noie les deux qui comptent. Le compte rendu les regroupe. */
const alerter = (releve, genre, texte) => releve.alertes.push({ genre, texte });

function validerOutil(outil, ou, releve, { dateRequise }) {
  const nom = outil?.nom || outil?.id || '(sans nom)';
  const dire = (m) => `${ou} — ${nom} : ${m}`;

  for (const champ of CHAMPS_OUTIL) {
    if (outil?.[champ] === undefined || outil?.[champ] === '') {
      releve.erreurs.push(dire(`champ « ${champ} » manquant`));
    }
  }
  if (outil?.id && !IDENTIFIANT.test(outil.id)) {
    releve.erreurs.push(dire(`identifiant « ${outil.id} » : minuscules, chiffres et tirets seulement`));
  }
  if (typeof outil?.score_avis !== 'number' || outil.score_avis < 0 || outil.score_avis > 5) {
    releve.erreurs.push(dire('score_avis doit être un nombre entre 0 et 5'));
  }
  if (dateRequise) {
    if (!DATE_ISO.test(String(outil?.date_ajout ?? ''))) {
      releve.erreurs.push(dire('date_ajout absente ou mal formée (attendu AAAA-MM-JJ)'));
    } else if (!Number.isFinite(Date.parse(outil.date_ajout))) {
      releve.erreurs.push(dire(`date_ajout impossible : ${outil.date_ajout}`));
    }
  }
  if (outil?.lien_affiliation && !/^https:\/\//.test(outil.lien_affiliation)) {
    releve.erreurs.push(dire('le lien d’affiliation doit être en https'));
  }

  /* Ce qui suit ne casse rien mais coûte du trafic ou de la crédibilité. */
  if (typeof outil?.description_longue === 'string') {
    const manquantes = SECTIONS_AVIS.filter((s) => !outil.description_longue.includes(s));
    if (manquantes.length) {
      alerter(releve, 'avis-incomplet', dire(`avis incomplet, sections absentes : ${manquantes.join(', ')}`));
    }
  }
  if (/exemple-affiliation\.com/.test(outil?.lien_affiliation ?? '')) {
    alerter(releve, 'lien-demonstration', dire('lien d’affiliation encore sur l’adresse de démonstration'));
  }
  if (typeof outil?.description_courte === 'string' && outil.description_courte.length > 200) {
    alerter(releve, 'description-longue', dire(`description_courte de ${outil.description_courte.length} caractères : la carte va déborder`));
  }
}

/** Valide une base complète. C'est cette fonction qu'appelle l'auto-pilote
 *  avant et après écriture — d'où le fait qu'elle rende un relevé plutôt que
 *  d'écrire sur la sortie. */
export function validerBase(base, nomFichier, releve = creerReleve()) {
  const ou = nomFichier;

  for (const champ of CHAMPS_NICHE) {
    if (base?.niche?.[champ] === undefined || base?.niche?.[champ] === '') {
      releve.erreurs.push(`${ou} — bloc niche : champ « ${champ} » manquant`);
    }
  }
  const attendu = path.basename(nomFichier, '.json');
  if (base?.niche?.id && base.niche.id !== attendu) {
    releve.erreurs.push(
      `${ou} — l’identifiant « ${base.niche.id} » ne correspond pas au nom du fichier : ` +
      'la page charge `niches/<id>.json`, les deux doivent coïncider'
    );
  }
  if (base?.niche?.domaine) {
    try {
      const url = new URL(base.niche.domaine);
      if (url.protocol !== 'https:') alerter(releve, 'domaine-non-https', `${ou} — domaine servi en ${url.protocol}`);
    } catch {
      releve.erreurs.push(`${ou} — domaine invalide : ${base.niche.domaine}`);
    }
  }
  for (const ton of ['primaire', 'secondaire']) {
    const valeur = base?.niche?.theme?.[ton];
    if (!COULEUR.test(String(valeur ?? ''))) {
      releve.erreurs.push(`${ou} — theme.${ton} doit être une couleur hexadécimale à six chiffres (reçu : ${valeur})`);
    }
  }
  /* Google tronque au-delà : ce n'est pas une panne, c'est un titre coupé au
     milieu dans les résultats de recherche. */
  if (typeof base?.niche?.meta_titre === 'string' && base.niche.meta_titre.length > 70) {
    alerter(releve, 'titre-tronque', `${ou} — meta_titre de ${base.niche.meta_titre.length} caractères, tronqué au-delà de ~70`);
  }
  if (typeof base?.niche?.meta_description === 'string') {
    const n = base.niche.meta_description.length;
    if (n < 110 || n > 165) alerter(releve, 'description-hors-cible', `${ou} — meta_description de ${n} caractères, viser 110 à 165`);
  }

  if (!Array.isArray(base?.outils)) {
    releve.erreurs.push(`${ou} — champ « outils » absent ou n’est pas une liste`);
    return releve;
  }
  /* Une niche fraîchement dégrossie n'a pas encore d'outils. Ce n'est pas une
     panne — aucun domaine ne pointe encore dessus — mais il faut que ça se
     voie, sinon un site vide traîne des semaines dans le dépôt. */
  if (base.outils.length === 0) {
    alerter(releve, 'niche-en-chantier', `${ou} — aucun outil : niche dégrossie, à remplir avant de lui acheter un domaine`);
    return releve;
  }

  const vus = new Set();
  for (const outil of base.outils) {
    validerOutil(outil, ou, releve, { dateRequise: true });
    if (outil?.id) {
      if (vus.has(outil.id)) releve.erreurs.push(`${ou} — identifiant en double : ${outil.id}`);
      vus.add(outil.id);
    }
  }
  return releve;
}

export function lireBases() {
  if (!fs.existsSync(dossierNiches)) throw new Error(`Dossier introuvable : ${dossierNiches}`);
  const fichiers = fs.readdirSync(dossierNiches).filter((f) => f.endsWith('.json')).sort();
  if (fichiers.length === 0) throw new Error('Aucune base de niche dans niches/.');
  return fichiers.map((f) => {
    const chemin = path.join(dossierNiches, f);
    let base;
    try {
      base = JSON.parse(fs.readFileSync(chemin, 'utf8'));
    } catch (erreur) {
      throw new Error(`${f} — JSON illisible : ${erreur.message}`);
    }
    return { fichier: f, chemin, base };
  });
}

/** Valide l'ensemble du réseau, réserve comprise. `backlog` est passé en
 *  paramètre plutôt qu'importé : ce module doit pouvoir être appelé depuis
 *  l'auto-pilote sans dépendance circulaire. */
export function validerReseau(backlog = null, releve = creerReleve()) {
  const bases = lireBases();

  const domaines = new Map();
  for (const { fichier, base } of bases) {
    validerBase(base, fichier, releve);

    const domaine = base?.niche?.domaine;
    if (domaine) {
      /* Deux niches sur le même domaine, c'est un sitemap qui écrase l'autre
         et deux sites que Google voit comme un seul, dupliqué. */
      if (domaines.has(domaine)) {
        releve.erreurs.push(`${fichier} — domaine déjà pris par ${domaines.get(domaine)} : ${domaine}`);
      }
      domaines.set(domaine, fichier);
    }
  }

  if (backlog) {
    const connues = new Set(bases.map(({ base }) => base?.niche?.id));
    for (const [niche, reserve] of Object.entries(backlog)) {
      if (!connues.has(niche)) {
        alerter(releve, 'reserve-orpheline', `réserve « ${niche} » : aucune base ne porte cet identifiant, elle ne sera jamais publiée`);
        continue;
      }
      const vus = new Set();
      for (const outil of reserve) {
        validerOutil(outil, `réserve ${niche}`, releve, { dateRequise: false });
        if (outil?.id) {
          if (vus.has(outil.id)) releve.erreurs.push(`réserve ${niche} — identifiant en double : ${outil.id}`);
          vus.add(outil.id);
        }
      }
    }
    for (const { fichier, base } of bases) {
      if (!backlog[base?.niche?.id]) {
        alerter(releve, 'sans-reserve', `${fichier} — aucune réserve : l’auto-pilote n’a rien à y publier`);
      }
    }
  }

  return { releve, bases };
}

/** Ce que l'auto-pilote et l'intégration continue affichent, au même format. */
export function rendreCompte(releve, { titre = 'Validation du réseau', exemples = 3 } = {}) {
  const familles = new Map();
  for (const { genre, texte } of releve.alertes) {
    if (!familles.has(genre)) familles.set(genre, []);
    familles.get(genre).push(texte);
  }
  for (const [genre, textes] of familles) {
    console.log(`  ! ${genre} — ${textes.length} cas`);
    for (const texte of textes.slice(0, exemples)) console.log(`      ${texte}`);
    if (textes.length > exemples) console.log(`      … et ${textes.length - exemples} autre(s)`);
  }
  for (const erreur of releve.erreurs) console.error(`  ✗ ${erreur}`);
  const bilan = `${titre} — ${releve.erreurs.length} erreur(s), ${releve.alertes.length} alerte(s)`;
  if (releve.erreurs.length) console.error(`\n${bilan}`);
  else console.log(`\n${bilan}`);
  return releve.erreurs.length === 0;
}

async function principal() {
  const strict = process.argv.includes('--strict');
  const { BACKLOG } = await import('./auto-pilot.js').catch(() => ({ BACKLOG: null }));
  const { releve, bases } = validerReseau(BACKLOG);

  console.log(`${bases.length} bases lues, ${bases.reduce((n, b) => n + b.base.outils.length, 0)} outils en ligne.`);
  const bon = rendreCompte(releve);

  if (!bon || (strict && releve.alertes.length)) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal().catch((erreur) => {
    console.error(erreur.message);
    process.exit(1);
  });
}
