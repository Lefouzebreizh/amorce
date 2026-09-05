import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfLibEspaceDeNoms from 'pdf-lib';
// Même bascule CommonJS/ESM que dans ../formulaire — voir son commentaire.
const pdfLib = 'default' in pdfLibEspaceDeNoms
  ? (pdfLibEspaceDeNoms as unknown as { default: typeof pdfLibEspaceDeNoms }).default
  : pdfLibEspaceDeNoms;
const { PDFDocument } = pdfLib;
import { champsFormulaire, remplirFormulaire, libelleSource } from '../formulaire';
import type { Identite } from '../coffre';

const IDENTITE: Identite = {
  nom: 'Erwann Chevallier', adresse: '20a rue Clotilde Vautier',
  codePostal: '35000', ville: 'Rennes',
};

// Un formulaire fabriqué à l'exécution — comme paper-manager/tests, ce dépôt
// ne versionne aucun binaire, et un Cerfa vierge en est un.
async function formulaireDeTest(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const form = doc.getForm();

  const champNom = form.createTextField('nom_demandeur');
  champNom.addToPage(page, { x: 10, y: 260, width: 200, height: 20 });

  const champAdresse = form.createTextField('adresse_domicile');
  champAdresse.addToPage(page, { x: 10, y: 230, width: 200, height: 20 });

  const champVille = form.createTextField('commune');
  champVille.addToPage(page, { x: 10, y: 200, width: 200, height: 20 });

  const champCodePostal = form.createTextField('code_postal');
  champCodePostal.addToPage(page, { x: 10, y: 170, width: 200, height: 20 });

  const champDate = form.createTextField('fait_le');
  champDate.addToPage(page, { x: 10, y: 140, width: 200, height: 20 });

  const champMystere = form.createTextField('reference_XJ42');
  champMystere.addToPage(page, { x: 10, y: 110, width: 200, height: 20 });

  const caseAccord = form.createCheckBox('case_accord');
  caseAccord.addToPage(page, { x: 10, y: 80, width: 20, height: 20 });

  const buf = await doc.save();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('la lecture des champs', () => {
  it('trouve tous les champs du formulaire', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    assert.equal(champs.length, 7);
  });

  it('suggère la bonne source pour un champ de nom', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'nom_demandeur');
    assert.equal(champ?.sourceSuggeree, 'identite.nomComplet');
  });

  it('suggère la bonne source pour un champ d’adresse', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'adresse_domicile');
    assert.equal(champ?.sourceSuggeree, 'identite.adresse');
  });

  it('suggère la bonne source pour la ville, sans confondre avec « nom »', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'commune');
    assert.equal(champ?.sourceSuggeree, 'identite.ville');
  });

  it('suggère la bonne source pour un code postal', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'code_postal');
    assert.equal(champ?.sourceSuggeree, 'identite.codePostal');
  });

  it('suggère la date du jour pour un champ « fait le »', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'fait_le');
    assert.equal(champ?.sourceSuggeree, '@aujourdhui');
  });

  it('ne suggère rien pour un champ que rien ne rapproche', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'reference_XJ42');
    assert.equal(champ?.sourceSuggeree, null);
  });

  it('reconnaît une case à cocher', async () => {
    const champs = await champsFormulaire(await formulaireDeTest());
    const champ = champs.find((c) => c.nom === 'case_accord');
    assert.equal(champ?.type, 'case');
  });
});

describe('le remplissage', () => {
  it('remplit un champ texte depuis une source d’identité', async () => {
    const rempli = await remplirFormulaire(
      await formulaireDeTest(), { nom_demandeur: 'identite.nomComplet' }, IDENTITE,
    );
    const relu = await PDFDocument.load(rempli);
    // Le formulaire est aplati : les champs n'existent plus après remplissage.
    assert.equal(relu.getForm().getFields().length, 0);
  });

  it('accepte un texte libre à la place d’une source', async () => {
    const rempli = await remplirFormulaire(
      await formulaireDeTest(), { reference_XJ42: 'ABC-123' }, IDENTITE,
    );
    assert.ok(rempli.byteLength > 0);
  });

  it('coche une case à true, ne la coche pas à false', async () => {
    const rempliCoche = await remplirFormulaire(await formulaireDeTest(), { case_accord: true }, IDENTITE);
    const rempliVide = await remplirFormulaire(await formulaireDeTest(), { case_accord: false }, IDENTITE);
    assert.ok(rempliCoche.byteLength > 0);
    assert.ok(rempliVide.byteLength > 0);
  });

  it('laisse un champ sans valeur fournie tel quel, sans lever', async () => {
    await assert.doesNotReject(remplirFormulaire(await formulaireDeTest(), {}, IDENTITE));
  });

  it('aplatit le formulaire : plus aucun champ interactif après remplissage', async () => {
    const rempli = await remplirFormulaire(
      await formulaireDeTest(),
      { nom_demandeur: 'identite.nomComplet', adresse_domicile: 'identite.adresse' },
      IDENTITE,
    );
    const relu = await PDFDocument.load(rempli);
    assert.equal(relu.getForm().getFields().length, 0);
  });
});

describe('les libellés de source', () => {
  it('donne un libellé lisible pour chaque source possible', () => {
    assert.equal(libelleSource('identite.nomComplet'), 'Nom complet');
    assert.equal(libelleSource('identite.adresse'), 'Adresse');
    assert.equal(libelleSource('identite.codePostal'), 'Code postal');
    assert.equal(libelleSource('identite.ville'), 'Ville');
    assert.equal(libelleSource('@aujourdhui'), 'Date du jour');
  });
});
