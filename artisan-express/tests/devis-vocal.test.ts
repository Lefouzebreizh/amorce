import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  erreursDevis, EXEMPLE_DEVIS_VOCAL, montantEnCentimes, quantiteEnMilliemes,
  structurerDictee, totalDevisCentimes, totalLigneCentimes, type BrouillonDevisVocal,
} from '@/lib/devis-vocal';
import { creerPdfDevis } from '@/lib/devis-pdf';

const date = new Date('2026-10-20T12:00:00Z');
const devis: BrouillonDevisVocal = {
  client: 'M. Dupont',
  lignes: [
    { id: 1, designation: 'Pose d’un chauffe-eau 200 L', quantite: '1', unite: 'forfait', prixUnitaire: '650,50' },
    { id: 2, designation: 'Main-d’œuvre', quantite: '3', unite: 'h', prixUnitaire: '59,90' },
  ],
};

test('la dictée distingue une capacité de ballon, des heures et des prix absents', () => {
  const resultat = structurerDictee(EXEMPLE_DEVIS_VOCAL);
  assert.equal(resultat.client, 'M. Dupont');
  assert.equal(resultat.lignes.length, 2);
  assert.match(resultat.lignes[0]!.designation, /200 L/);
  assert.equal(resultat.lignes[0]!.prixUnitaire, '');
  assert.equal(resultat.lignes[1]!.quantite, '3');
  assert.equal(resultat.lignes[1]!.unite, 'h');
  assert.equal(resultat.lignes[1]!.prixUnitaire, '');
  assert.equal(totalDevisCentimes(resultat), null);
});

test('la simulation conserve une prestation inconnue sans inventer de client ni de prix', () => {
  const resultat = structurerDictee('Réparation de portail et vérification des fixations');
  assert.equal(resultat.client, '');
  assert.equal(resultat.lignes[0]!.designation, 'Réparation de portail et vérification des fixations');
  assert.equal(resultat.lignes[0]!.prixUnitaire, '');
});

test('un tarif est repris seulement quand une devise est explicitement dictée', () => {
  const resultat = structurerDictee('Devis pour Mme Le Guen, main d’œuvre 2h à 65 euros');
  assert.equal(resultat.lignes[0]!.quantite, '2');
  assert.equal(resultat.lignes[0]!.prixUnitaire, '65');
  assert.equal(totalDevisCentimes(resultat), 13000);
});

test('les calculs monétaires sont exacts en centimes et refusent les saisies ambiguës', () => {
  assert.equal(montantEnCentimes('0,10'), 10);
  assert.equal(montantEnCentimes('1 234,56'), 123456);
  assert.equal(totalLigneCentimes({ ...devis.lignes[0]!, quantite: '3', prixUnitaire: '0,10' }), 30);
  assert.equal(totalLigneCentimes({ ...devis.lignes[0]!, quantite: '1,5', prixUnitaire: '59,90' }), 8985);
  assert.equal(totalDevisCentimes(devis), 83020);
  for (const saisie of ['', '-10', 'NaN', '1e3', '10,001', '1000001']) assert.equal(montantEnCentimes(saisie), null, saisie);
  for (const saisie of ['0', '-1', '10001', '1.0001', '1e2']) assert.equal(quantiteEnMilliemes(saisie), null, saisie);
});

test('un brouillon peut garder ses prix à compléter sans prendre une saisie invalide pour zéro', () => {
  const incomplet = structurerDictee(EXEMPLE_DEVIS_VOCAL);
  assert.equal(erreursDevis(incomplet, true).length, 0);
  assert.ok(erreursDevis(incomplet).length > 0);
  incomplet.lignes[0]!.prixUnitaire = '-10';
  assert.ok(erreursDevis(incomplet, true).length > 0);
  assert.throws(() => creerPdfDevis(incomplet, date));
});

test('le PDF est un document natif avec xref juste, caractères français et mention non contractuelle', () => {
  const source = new TextDecoder().decode(creerPdfDevis(devis, date));
  assert.ok(source.startsWith('%PDF-1.4'));
  assert.match(source, /\/BaseFont \/ArtisanDevis \/Encoding \/WinAnsiEncoding/);
  assert.match(source, /Document non contractuel/);
  assert.match(source, /830,20/);
  assert.match(source, /\\200/); // Euro WinAnsi
  assert.match(source, /\\234/); // œ WinAnsi
  const positionXref = Number(source.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(source.slice(positionXref, positionXref + 4), 'xref');
  const table = source.match(/xref\n0 \d+\n0000000000 65535 f \n([\s\S]+?)trailer/)?.[1];
  assert.ok(table);
  table.trim().split('\n').forEach((ligne, index) => {
    assert.ok(source.slice(Number(ligne.slice(0, 10))).startsWith(`${index + 1} 0 obj`));
  });
});

test('le PDF garde explicitement les montants manquants à compléter', () => {
  const source = new TextDecoder().decode(creerPdfDevis(structurerDictee(EXEMPLE_DEVIS_VOCAL), date));
  assert.match(source, /TOTAL INDICATIF HT : \\300 compl/);
  assert.doesNotMatch(source, /TOTAL INDICATIF HT : 0/);
});

test('les longues descriptions sont paginées et le texte ne peut injecter des commandes PDF', () => {
  const long: BrouillonDevisVocal = {
    client: 'Test ) Tj ET /JS (intrusion',
    lignes: Array.from({ length: 12 }, (_, index) => ({
      id: index, designation: 'x'.repeat(240), quantite: '1', unite: 'forfait', prixUnitaire: '10',
    })),
  };
  const source = new TextDecoder().decode(creerPdfDevis(long, date));
  const count = Number(source.match(/\/Type \/Pages[^\n]*\/Count (\d+)/)?.[1]);
  assert.ok(count >= 2);
  assert.match(source, /Client : Test \\\) Tj ET \/JS \\\(/);
  assert.match(source, /page 2\//);
});

test('les virgules décimales ne coupent ni les quantités ni les prix', () => {
  const brouillon = structurerDictee('Devis pour Mme André, main d’œuvre 2,5h à 65,50 euros');
  assert.equal(brouillon.lignes.length, 1);
  assert.equal(brouillon.lignes[0]!.quantite, '2.5');
  assert.equal(brouillon.lignes[0]!.prixUnitaire, '65.50');
  assert.equal(totalDevisCentimes(brouillon), 16375);
});
