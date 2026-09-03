import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  INDEMNITE_RECOUVREMENT_EUROS,
  MENTION_TVA,
  dateFrancaise,
  euros,
  genererFacture,
  numeroSuivant,
  reproches,
  type Client,
  type Emetteur,
  type Facture,
} from '@/lib/facture';

/*
 * Ce fichier éprouve les deux choses qu'un contrôle regarde sur une facture :
 * la **numérotation** et les **mentions**. Le reste — la mise en page — se
 * juge à l'œil sur un fichier ouvert, pas ici.
 */

const EMETTEUR: Emetteur = {
  nom: 'Erwann Chevallier',
  forme: 'Entrepreneur individuel (EI)',
  adresse: '20A rue Clotilde Vautier, 35000 Rennes',
  siren: '109356972',
  courriel: 'erwannchevallier@gmail.com',
  telephone: '06 21 38 11 15',
  iban: 'FR76 0000 0000 0000 0000 0000 000',
  bic: 'AGRIFRPP',
};

const CLIENT: Client = {
  nom: 'LE GOFF TOITURES',
  adresse: '12 rue des Lilas, 35000 Rennes',
  siret: '12345678900012',
};

const FACTURE: Facture = {
  numero: '2026-001',
  emiseLe: '2026-09-03',
  realiseeLe: '2026-09-05',
  prestation: 'Création d’un site vitrine d’une page, livré et mis en ligne',
  montantEuros: 300,
};

test('la numérotation repart du plus grand émis, jamais du nombre de lignes', () => {
  /*
   * Le piège que ce test garde : compter les factures au lieu de lire leur
   * numéro. Une ligne effacée du registre ferait alors réémettre un numéro
   * déjà utilisé — deux factures portant `2026-003`, ce qui est bien pire
   * qu'un trou dans la suite.
   */
  assert.equal(numeroSuivant([], 2026), '2026-001');
  assert.equal(numeroSuivant(['2026-001'], 2026), '2026-002');
  assert.equal(numeroSuivant(['2026-001', '2026-002', '2026-003'], 2026), '2026-004');

  // Le trou reste un trou, et le compteur ne recule pas.
  assert.equal(numeroSuivant(['2026-001', '2026-003'], 2026), '2026-004');
});

test('chaque année repart à 001 sans se mélanger à la précédente', () => {
  assert.equal(numeroSuivant(['2025-001', '2025-002'], 2026), '2026-001');
  assert.equal(numeroSuivant(['2025-009', '2026-001'], 2026), '2026-002');
});

test('une facture sans IBAN est refusée', () => {
  /*
   * La raison d'être de ce refus : ce dépôt facture **par virement** en
   * premier. Une facture sans coordonnées bancaires est lisible, conforme au
   * regard des mentions, et impayable — le pire des trois états, parce que
   * rien ne le signale avant que le client cherche où virer.
   */
  const manques = reproches({ ...EMETTEUR, iban: '' }, CLIENT);

  assert.equal(manques.length, 1);
  assert.match(manques[0] ?? '', /IBAN/);
});

test('une facture complète ne se fait rien reprocher', () => {
  assert.deepEqual(reproches(EMETTEUR, CLIENT), []);
});

test('le client sans nom est refusé, l’adresse et le SIRET restent facultatifs', () => {
  // Un artisan sur deux n'a pas son SIRET sous la main au moment de dire oui.
  assert.deepEqual(reproches(EMETTEUR, { nom: 'X', adresse: '', siret: '' }), []);
  assert.equal(reproches(EMETTEUR, { nom: '', adresse: '', siret: '' }).length, 1);
});

test('les montants s’écrivent en typographie française', () => {
  // `\u00a0` : une espace **insécable** avant l'euro, comme le veut la
  // typographie française — un montant ne se coupe pas en fin de ligne.
  assert.equal(euros(300), '300,00\u00a0€');
  assert.equal(euros(49), '49,00\u00a0€');
  assert.equal(euros(1234.5), '1234,50\u00a0€');
});

test('la facture porte toutes les mentions obligatoires', () => {
  const html = genererFacture(EMETTEUR, CLIENT, FACTURE);

  const attendues: readonly (readonly [string, string])[] = [
    ['le numéro', '2026-001'],
    ['la date d’émission', '03/09/2026'],
    ['la date de prestation', '05/09/2026'],
    ['le nom de l’émetteur', 'Erwann Chevallier'],
    ['la mention EI', 'Entrepreneur individuel (EI)'],
    ['le SIREN', '109356972'],
    ['le nom du client', 'LE GOFF TOITURES'],
    ['la désignation', 'site vitrine'],
    ['le total', '300,00\u00a0€'],
    ['la mention de TVA', MENTION_TVA],
    ['l’IBAN', 'FR76 0000 0000 0000 0000 0000 000'],
    ['l’indemnité de recouvrement', '40,00\u00a0€'],
  ];

  for (const [quoi, motif] of attendues) {
    assert.ok(html.includes(motif), `il manque ${quoi} : ${motif}`);
  }
});

test('les dates s’écrivent à la française, pas en ISO', () => {
  /*
   * Défaut trouvé en lisant une facture produite, jamais en la mesurant : elle
   * portait `2026-09-03`, le format d'un nom de fichier. Neuf tests verts la
   * disaient conforme — et elle l'était. La conformité ne dit rien de la
   * convention, et c'est le client qui lit.
   */
  assert.equal(dateFrancaise('2026-09-03'), '03/09/2026');
  assert.equal(dateFrancaise('2025-12-31'), '31/12/2025');

  // Une entrée qui n'est pas une date ISO ressort telle quelle plutôt que
  // découpée n'importe comment.
  assert.equal(dateFrancaise('bientôt'), 'bientôt');
});

test('la mention de TVA est celle d’après le 01/09/2026', () => {
  /*
   * Elle a changé deux jours avant que ce dépôt émette sa première facture.
   * L'ancienne formule reste tolérée jusqu'au 30/06/2028 — mais la recopier
   * aujourd'hui n'aurait aucune raison, et ce test empêche qu'un modèle plus
   * vieux revienne par un copier-coller.
   */
  assert.match(MENTION_TVA, /art\. L\. 233-1/);
  assert.doesNotMatch(MENTION_TVA, /293 B/);
});

test('le numéro sert de référence de virement', () => {
  /*
   * Sans référence, un virement arrive sans qu'on sache lequel il solde. Avec
   * un seul client ça se devine ; au dixième, non.
   */
  const html = genererFacture(EMETTEUR, CLIENT, FACTURE);
  const bloc = html.slice(html.indexOf('Règlement par virement'));

  assert.match(bloc, /Référence à indiquer\s*:\s*<strong>2026-001<\/strong>/);
});

test('un nom de client ne peut pas injecter de balise', () => {
  /*
   * Le nom vient de la ligne de commande, donc d'un copier-coller depuis une
   * conversation. Un chevron mal placé casserait la page sans rien dire.
   */
  const html = genererFacture(EMETTEUR, { ...CLIENT, nom: '<script>x</script>' }, FACTURE);

  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('l’indemnité de recouvrement est celle du code de commerce', () => {
  assert.equal(INDEMNITE_RECOUVREMENT_EUROS, 40);
});
