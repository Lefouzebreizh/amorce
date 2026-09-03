import { test } from 'node:test';
import assert from 'node:assert/strict';

import { creerReleve, lireBases, lireBasesActives, nicheActive, rendreCompte, validerBase } from '../valider.js';

/**
 * Ce que le filet du réseau doit tenir.
 *
 * `annuaire-ia/` était le dernier chantier du dépôt sans un seul test — et
 * c'est celui dont l'auto-pilote **pousse sur `main` tous les deux jours sans
 * relecture humaine**. `valider.js` s'annonce comme « la seule définition de
 * ce qu'est une base valide » : onze sites en dépendent, et rien ne
 * garantissait qu'elle dise vrai.
 *
 * Chaque cas ci-dessous a été relevé en exécutant le code, jamais déduit d'un
 * commentaire. Les bornes chiffrées (70 caractères, 110-165, la moitié « sur
 * devis ») sont épinglées : elles viennent de mesures et aucune formule ne les
 * redonne.
 */

const OUTIL = {
  id: 'outil-a', nom: 'Outil A', categorie: 'rédaction', prix: '19 €/mois',
  description_courte: 'Court.',
  description_longue: '## Notre verdict\n## Points forts\n## Points faibles\n## Idéal pour',
  lien_affiliation: 'https://programme.example/a', score_avis: 4.2,
  date_ajout: '2026-01-15',
};

const outil = (champs = {}) => ({ ...OUTIL, ...champs });

const base = ({ niche = {}, outils } = {}) => ({
  niche: {
    id: 'sante', nom: 'IA Santé', domaine: 'https://ia-sante.fr',
    h1_accent: 'Les outils', h1_suite: 'des soignants', slogan: 'Trier vite.',
    meta_titre: 'Outils IA pour soignants', meta_description: 'd'.repeat(130),
    theme: { primaire: '#1a7f6b', secondaire: '#0b3d34' },
    note_transparence: 'Liens affiliés.',
    ...niche,
  },
  outils: outils ?? [outil()],
});

const valider = (b, fichier = 'sante.json') => validerBase(b, fichier, creerReleve());
const genres = (releve) => releve.alertes.map((a) => a.genre);

test('une base saine ne produit ni erreur ni alerte', () => {
  const releve = valider(base());
  assert.deepEqual(releve.erreurs, []);
  assert.deepEqual(releve.alertes, []);
});

// ── La distinction qui gouverne tout le fichier ─────────────────────────────

test('une erreur casse un site, une alerte coûte seulement du trafic', () => {
  // Champ manquant : le site affiche une page d'erreur → erreur bloquante.
  const casse = valider(base({ niche: { slogan: '' } }));
  assert.equal(casse.erreurs.length, 1);
  assert.match(casse.erreurs[0], /slogan/);

  // meta_titre trop long : Google le tronque, le site marche → alerte seule.
  // Bloquer une publication sur une longueur de balise reviendrait à préférer
  // un site figé à un site imparfait.
  const imparfait = valider(base({ niche: { meta_titre: 'T'.repeat(80) } }));
  assert.deepEqual(imparfait.erreurs, []);
  assert.deepEqual(genres(imparfait), ['titre-tronque']);
});

test('la borne de 70 caractères est un seuil, pas une approximation', () => {
  assert.deepEqual(genres(valider(base({ niche: { meta_titre: 'T'.repeat(70) } }))), []);
  assert.deepEqual(genres(valider(base({ niche: { meta_titre: 'T'.repeat(71) } }))), ['titre-tronque']);
});

test('la meta_description vise 110 à 165 caractères, bornes comprises', () => {
  for (const n of [110, 165]) {
    assert.deepEqual(genres(valider(base({ niche: { meta_description: 'd'.repeat(n) } }))), [],
      `${n} caractères doit passer`);
  }
  for (const n of [109, 166]) {
    assert.deepEqual(genres(valider(base({ niche: { meta_description: 'd'.repeat(n) } }))),
      ['description-hors-cible'], `${n} caractères doit alerter`);
  }
});

// ── Ce qui casse un site pour de bon ────────────────────────────────────────

test('l’identifiant doit coïncider avec le nom du fichier', () => {
  // La page charge `niches/<id>.json` : les deux qui divergent, c'est un site
  // qui ne charge jamais sa base.
  const releve = valider(base(), 'immobilier.json');
  assert.equal(releve.erreurs.length, 1);
  assert.match(releve.erreurs[0], /ne correspond pas au nom du fichier/);
});

test('un identifiant d’outil en double est une erreur', () => {
  const releve = valider(base({ outils: [outil(), outil()] }));
  assert.equal(releve.erreurs.length, 1);
  assert.match(releve.erreurs[0], /identifiant en double : outil-a/);
});

test('un lien d’affiliation hors https est refusé', () => {
  const releve = valider(base({ outils: [outil({ lien_affiliation: 'http://programme.example/a' })] }));
  assert.equal(releve.erreurs.length, 1);
  assert.match(releve.erreurs[0], /doit être en https/);
});

test('un thème sans couleur hexadécimale à six chiffres est refusé', () => {
  const releve = valider(base({ niche: { theme: { primaire: 'rouge', secondaire: '#0b3d34' } } }));
  assert.equal(releve.erreurs.length, 1);
  assert.match(releve.erreurs[0], /theme\.primaire/);
});

test('un score d’avis hors de 0 à 5 est refusé', () => {
  for (const score of [-1, 5.1, '4']) {
    const releve = valider(base({ outils: [outil({ score_avis: score })] }));
    assert.equal(releve.erreurs.length, 1, `score ${score}`);
    assert.match(releve.erreurs[0], /score_avis/);
  }
});

test('les erreurs s’accumulent au lieu de s’arrêter à la première', () => {
  // « Voir d'un coup tout ce qui cloche évite trois allers-retours. »
  const releve = valider(base({
    niche: { slogan: '', theme: { primaire: 'rouge', secondaire: 'bleu' } },
    outils: [outil({ lien_affiliation: 'http://x.fr', score_avis: 9 })],
  }));
  assert.ok(releve.erreurs.length >= 5, `seulement ${releve.erreurs.length} erreur(s)`);
});

// ── Les alertes qui viennent d'un échec constaté ────────────────────────────

test('une niche sans outil se signale et n’est pas inspectée plus loin', () => {
  // Pas une panne — aucun domaine ne pointe encore dessus — mais il faut que
  // ça se voie, sinon un site vide traîne des semaines dans le dépôt.
  const releve = valider(base({ outils: [] }));
  assert.deepEqual(releve.erreurs, []);
  assert.deepEqual(genres(releve), ['niche-en-chantier']);
});

test('une niche à majorité « sur devis » ne peut presque rien rapporter', () => {
  /* Mesuré au lancement : juridique n'avait que ça, btp et rh trois sur
     quatre. Un outil sur devis se négocie six mois avec un commercial, donc
     aucun programme d'affiliation derrière. Le seuil est la MAJORITÉ STRICTE
     — la moitié pile ne déclenche rien, sinon toute niche équilibrée
     alerterait et l'alerte perdrait son sens. */
  const devis = (id) => outil({ id, prix: 'sur devis' });
  const payant = (id) => outil({ id });

  const moitie = valider(base({ outils: [devis('a'), devis('b'), payant('c'), payant('d')] }));
  assert.deepEqual(genres(moitie), [], 'deux sur quatre ne doit pas alerter');

  const majorite = valider(base({ outils: [devis('a'), outil({ id: 'b', prix: 'Sur Devis' }), devis('c'), payant('d')] }));
  assert.deepEqual(genres(majorite), ['niche-peu-monetisable'], 'la casse ne doit pas compter');

  // En dessous de trois outils, la proportion ne veut rien dire.
  const deuxOutils = valider(base({ outils: [devis('a'), devis('b')] }));
  assert.deepEqual(genres(deuxOutils), []);
});

test('un avis amputé d’une section se signale sans bloquer', () => {
  const releve = valider(base({
    outils: [outil({ description_longue: '## Notre verdict\n## Points forts' })],
  }));
  assert.deepEqual(releve.erreurs, []);
  assert.deepEqual(genres(releve), ['avis-incomplet']);
  assert.match(releve.alertes[0].texte, /Points faibles.*Idéal pour/);
});

test('un lien resté sur l’adresse de démonstration se signale', () => {
  const releve = valider(base({
    outils: [outil({ lien_affiliation: 'https://exemple-affiliation.com/outil-a' })],
  }));
  assert.deepEqual(releve.erreurs, []);
  assert.deepEqual(genres(releve), ['lien-demonstration']);
});

// ── Le compte rendu, et la ligne qui manquait ───────────────────────────────

const capturer = (travail) => {
  const lignes = [];
  const vrai = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  try { return { retour: travail(), lignes }; } finally { console.log = vrai; }
};

test('le bilan sépare les liens en ligne de ceux qui attendent en réserve', () => {
  /* « Confondre les deux triple le chiffre, donc décourage sur un travail qui
     n'est pas encore à faire. » Seuls les outils publiés peuvent rapporter
     aujourd'hui — et c'est la SEULE ligne qui dise si ce réseau sert à
     quelque chose : soixante-treize alertes se noyaient dans un total de 234,
     sous un verdict « 0 erreur » qui se lit comme « tout va bien ». */
  const releve = creerReleve();
  releve.alertes.push({ genre: 'lien-demonstration', texte: 'sante.json — A : démonstration' });
  releve.alertes.push({ genre: 'lien-demonstration', texte: 'sante.json — B : démonstration' });
  releve.alertes.push({ genre: 'lien-demonstration', texte: 'réserve sante — C : démonstration' });

  const { retour, lignes } = capturer(() => rendreCompte(releve, { titre: 'Essai' }));
  assert.equal(retour, true, 'aucune erreur : le compte rendu doit valoir bon');

  const bilan = lignes.find((l) => l.includes('💤'));
  assert.ok(bilan, 'la ligne du bilan monétisable doit exister');
  assert.match(bilan, /2 lien\(s\) en ligne/);
  assert.match(bilan, /\(1 autre\(s\) attendent en réserve\.\)/);
});

test('sans lien de démonstration en ligne, le bilan ne dit rien', () => {
  const releve = creerReleve();
  releve.alertes.push({ genre: 'lien-demonstration', texte: 'réserve sante — C : démonstration' });
  const { lignes } = capturer(() => rendreCompte(releve, { titre: 'Essai' }));
  assert.equal(lignes.find((l) => l.includes('💤')), undefined);
});

test('rendreCompte vaut faux dès qu’une erreur existe', () => {
  const releve = creerReleve();
  releve.erreurs.push('sante.json — champ manquant');
  const { retour } = capturer(() => rendreCompte(releve, { titre: 'Essai' }));
  assert.equal(retour, false);
});

// ── Les bases réelles du dépôt ──────────────────────────────────────────────

test('les onze bases versionnées passent leur propre validation', () => {
  // Le filet appliqué à ce qu'il protège : si une base du dépôt est fausse,
  // c'est un site en ligne qui est cassé maintenant, pas un cas d'école.
  const bases = lireBases();
  assert.ok(bases.length >= 11, `${bases.length} base(s) lue(s)`);
  const releve = creerReleve();
  for (const { fichier, base: b } of bases) validerBase(b, fichier, releve);
  assert.deepEqual(releve.erreurs, []);
});

// ── La mise en pause ────────────────────────────────────────────────────────
//
// Ces trois tests gardent une décision qui ne casse rien quand on l'enfreint :
// une niche remise en production par inadvertance se construit, s'indexe et
// consomme la réserve sans qu'aucune erreur n'apparaisse nulle part. C'est
// exactement le genre de régression qu'aucun autre test ne peut voir.

test('l’absence du champ vaut « active »', () => {
  // Toutes les bases écrites avant cette règle en dépendent : si l'absence
  // valait « en pause », le réseau entier disparaîtrait en silence.
  assert.equal(nicheActive({ niche: { id: 'x' } }), true);
  assert.equal(nicheActive({ niche: { id: 'x', actif: true } }), true);
  assert.equal(nicheActive({ niche: { id: 'x', actif: false } }), false);
});

test('un seul site est actif, et c’est la Boîte à Outils IA', () => {
  const actives = lireBasesActives();
  assert.deepEqual(actives.map(({ base: b }) => b.niche.id), ['generaliste']);
});

test('les niches en pause restent lisibles et valides', () => {
  // La pause n'est pas une suppression : les dix bases restent versionnées et
  // doivent pouvoir revenir en ligne d'un seul champ. Une base en pause qui se
  // dégrade sans être vue rendrait ce retour impossible.
  const toutes = lireBases();
  const enPause = toutes.filter(({ base: b }) => !nicheActive(b));
  assert.equal(enPause.length, 10, `${enPause.length} niche(s) en pause`);
  const releve = creerReleve();
  for (const { fichier, base: b } of enPause) validerBase(b, fichier, releve);
  assert.deepEqual(releve.erreurs, []);
});
