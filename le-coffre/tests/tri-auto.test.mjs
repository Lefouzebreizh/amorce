import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

// Exécuter la fonction réellement utilisée par le bouton, avec stockage
// simulé. Le tri publié est volontairement local : le banc vérifie qu'aucun
// ancien appel d'analyse ne revient par accident.
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
  let bilan = null;
  const contexte = vm.createContext({
    utilisateur: { id: 'test-local' }, cle: {},
    index: { objets },
    triAutoDejaAffines: { current: new Set() },
    triAutoTentatives: { current: new Map() },
    TENTATIVES_TRI_AUTO_MAX: 3,
    File,
    categorieInstantanee: type => {
      if (type === 'application/pdf') return 'Papiers';
      if (type.startsWith('image/')) return 'Images';
      if (type.startsWith('video/')) return 'Vidéos';
      if (type.startsWith('audio/')) return 'Audio';
      return 'Autre';
    },
    affinableParIA: (categorie, type) => (categorie === 'Images' && type === 'image/jpeg') || (categorie === 'Papiers' && type === 'application/pdf'),
    setTriAutoEnCours: valeur => { occupe = valeur; },
    setTriAutoProgres: valeur => { progression = typeof valeur === 'function' ? valeur(progression) : valeur; },
    setTriAutoBilan: valeur => { bilan = valeur; }, setTriAutoDetailOuvert() {},
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
  return { contexte, appels, sauvegardes, occupe: () => occupe, bilan: () => bilan, lancer: () => vm.runInContext('trierAutomatiquement()', contexte) };
}

test('une photo non classée reçoit sa catégorie locale sans appel IA', async () => {
  const b = banc({ photo: { nom: 'photo.jpg', type: 'image/jpeg', categorie: '' } });
  await b.lancer();
  assert.equal(b.appels.length, 0);
  assert.equal(b.contexte.index.objets.photo.categorie, 'Images');
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

test('un lot entier est classé localement en une seule sauvegarde', async () => {
  const b = banc({
    pdf: { nom: 'avis.pdf', type: 'application/pdf', categorie: '' },
    photo: { nom: 'photo.jpg', type: 'image/jpeg', categorie: '' },
    video: { nom: 'video.mp4', type: 'video/mp4', categorie: '' },
    audio: { nom: 'memo.mp3', type: 'audio/mpeg', categorie: '' },
    archive: { nom: 'archive.zip', type: 'application/zip', categorie: '' },
  });
  await b.lancer();
  assert.equal(b.appels.length, 0);
  assert.deepEqual(
    Object.values(b.contexte.index.objets).map((objet) => objet.categorie),
    ['Papiers', 'Images', 'Vidéos', 'Audio', 'Autre'],
  );
  assert.equal(b.sauvegardes.length, 1);
});

test('un SVG non classé reçoit sa catégorie locale sans appel IA', async () => {
  const b = banc({ dessin: { nom: 'dessin.svg', type: 'image/svg+xml', categorie: '' } });
  await b.lancer();
  assert.equal(b.contexte.index.objets.dessin.categorie, 'Images');
  assert.equal(b.appels.length, 0);
  assert.deepEqual(b.sauvegardes, [['dessin']]);
});

test('un échec de sauvegarde est signalé et libère le bouton', async () => {
  const b = banc({ photo: { nom: 'photo.jpg', type: 'image/jpeg', categorie: '' } });
  b.contexte.modifierPlusieursObjets = async () => { throw new Error('stockage indisponible'); };
  await b.lancer();
  assert.equal(b.appels.length, 0);
  assert.equal(b.occupe(), false);
  assert.equal(b.bilan().abandonnes.length, 0);
  assert.match(b.bilan().erreursTechniques[0], /stockage indisponible/);
});
