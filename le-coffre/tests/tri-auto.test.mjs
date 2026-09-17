import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

// Exécuter la fonction réellement utilisée par le bouton, avec stockage et IA
// simulés. Ce banc ne prétend pas couvrir React, le rendu ou le réseau réel.
const page = fs.readFileSync(new URL('../src/app/coffre/page.tsx', import.meta.url), 'utf8');
const debut = page.indexOf('  async function trierAutomatiquement()');
const fin = page.indexOf('  async function telecharger(', debut);
assert.ok(debut >= 0 && fin > debut, 'fonction de tri introuvable');
const code = stripTypeScriptTypes(page.slice(debut, fin));

function banc(objets, resultat = () => ({ lisible: true, categorie: 'Santé' })) {
  const appels = [];
  const sauvegardes = [];
  let occupe = false;
  let progression = null;
  const contexte = vm.createContext({
    utilisateur: { id: 'test-local' }, cle: {},
    index: { objets },
    triAutoDejaAffines: { current: new Set() },
    triAutoTentatives: { current: new Map() },
    TENTATIVES_TRI_AUTO_MAX: 3,
    File,
    categorieInstantanee: type => type.startsWith('image/') ? 'Images' : 'Papiers',
    affinableParIA: (categorie, type) => (categorie === 'Images' && type === 'image/jpeg') || (categorie === 'Papiers' && type === 'application/pdf'),
    setTriAutoEnCours: valeur => { occupe = valeur; },
    setTriAutoProgres: valeur => { progression = typeof valeur === 'function' ? valeur(progression) : valeur; },
    setTriAutoBilan() {}, setTriAutoDetailOuvert() {},
    setIndex: valeur => { contexte.index = valeur; },
    modifierPlusieursObjets: async (_user, _cle, champs, index) => {
      sauvegardes.push(Object.keys(champs));
      const objets = { ...index.objets };
      for (const [nom, patch] of Object.entries(champs)) objets[nom] = { ...objets[nom], ...patch };
      return { ...index, objets };
    },
    recupererFichier: async () => new Blob(['fichier fictif']),
    proposerClassement: async fichier => { appels.push(fichier.name); return resultat(); },
  });
  vm.runInContext(code, contexte);
  return { contexte, appels, sauvegardes, occupe: () => occupe, lancer: () => vm.runInContext('trierAutomatiquement()', contexte) };
}

test('réessayer une photo déjà classée après une erreur technique', async () => {
  let tentative = 0;
  const b = banc({ photo: { nom: 'photo.jpg', type: 'image/jpeg', categorie: 'Images' } },
    () => ++tentative === 1 ? { lisible: false, erreurTechnique: true } : { lisible: true, categorie: 'Santé' });
  await b.lancer();
  assert.equal(b.appels.length, 1);
  assert.equal(b.sauvegardes.length, 0, 'aucun classement initial à réécrire');
  await b.lancer();
  assert.equal(b.appels.length, 2);
  assert.equal(b.contexte.index.objets.photo.categorie, 'Santé');
  assert.deepEqual(b.sauvegardes, [['photo']]);
  assert.equal(b.occupe(), false);
});

test('une catégorie définitive ne déclenche ni IA ni sauvegarde', async () => {
  const b = banc({ facture: { nom: 'facture.pdf', type: 'application/pdf', categorie: 'Énergie' } });
  await b.lancer();
  assert.equal(b.appels.length, 0);
  assert.equal(b.sauvegardes.length, 0);
  assert.equal(b.occupe(), false);
});

test('le plafond de trois échecs empêche un quatrième appel', async () => {
  const b = banc({ photo: { nom: 'photo.jpg', type: 'image/jpeg', categorie: 'Images' } },
    () => ({ lisible: false, erreurTechnique: true }));
  for (let i = 0; i < 4; i++) await b.lancer();
  assert.equal(b.appels.length, 3);
  assert.equal(b.sauvegardes.length, 0);
  assert.equal(b.contexte.triAutoDejaAffines.current.has('photo'), true);
});

test('un SVG non classé reçoit sa catégorie locale sans appel IA', async () => {
  const b = banc({ dessin: { nom: 'dessin.svg', type: 'image/svg+xml', categorie: '' } });
  await b.lancer();
  assert.equal(b.contexte.index.objets.dessin.categorie, 'Images');
  assert.equal(b.appels.length, 0);
  assert.deepEqual(b.sauvegardes, [['dessin']]);
});

test('un verdict illisible évite de soumettre le fichier une seconde fois', async () => {
  const b = banc({ photo: { nom: 'photo.jpg', type: 'image/jpeg', categorie: 'Images' } },
    () => ({ lisible: false }));
  await b.lancer();
  await b.lancer();
  assert.equal(b.appels.length, 1);
  assert.equal(b.sauvegardes.length, 0);
});
