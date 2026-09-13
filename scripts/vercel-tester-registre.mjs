import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const depotSource = resolve(import.meta.dirname, '..');
const schemaSource = JSON.parse(readFileSync(join(depotSource, 'ops/vercel/projects.schema.json'), 'utf8'));

// Chaque essai lance le vrai programme sur des fichiers isolés, sans modifier
// le registre du dépôt. Le cas positif empêche qu'un refus systématique passe.
function verifier(modifier = () => {}) {
  const temporaire = mkdtempSync(join(tmpdir(), 'vercel-registre-'));
  try {
    const depot = join(temporaire, 'depot');
    const exterieur = join(temporaire, 'exterieur');
    mkdirSync(join(depot, 'ops/vercel'), { recursive: true });
    mkdirSync(join(depot, 'scripts'));
    mkdirSync(join(depot, 'app'));
    mkdirSync(exterieur);
    const configuration = { ignoreCommand: 'exit 1' };
    writeFileSync(join(depot, 'app/vercel.json'), JSON.stringify(configuration));
    writeFileSync(join(exterieur, 'vercel.json'), JSON.stringify(configuration));
    const manifeste = {
      $schema: './projects.schema.json', teamId: 'team_Test123', repository: 'example/repo',
      projects: [{ name: 'app', projectId: 'prj_Test123', root: 'app', mode: 'git', protectedPreview: true, criticalPaths: ['/'] }],
    };
    const schema = structuredClone(schemaSource);
    modifier({ manifeste, schema, depot, exterieur });
    writeFileSync(join(depot, 'ops/vercel/projects.json'), JSON.stringify(manifeste));
    writeFileSync(join(depot, 'ops/vercel/projects.schema.json'), JSON.stringify(schema));
    copyFileSync(join(depotSource, 'scripts/vercel-verifier-registre.mjs'), join(depot, 'scripts/vercel-verifier-registre.mjs'));
    const resultat = spawnSync(process.execPath, [join(depot, 'scripts/vercel-verifier-registre.mjs')], { encoding: 'utf8', timeout: 5000 });
    assert.equal(resultat.error, undefined);
    return resultat;
  } finally {
    rmSync(temporaire, { recursive: true, force: true });
  }
}

test('un registre conforme est accepté', () => {
  const resultat = verifier();
  assert.equal(resultat.status, 0, resultat.stderr);
  assert.match(resultat.stdout, /1 projets Vercel vérifiés/);
});

const refus = [
  ['champ obligatoire absent', ({ manifeste }) => { delete manifeste.teamId; }, /teamId.*obligatoire/],
  ['champ obligatoire du projet absent', ({ manifeste }) => { delete manifeste.projects[0].root; }, /root.*obligatoire/],
  ['type de collection incorrect', ({ manifeste }) => { manifeste.projects = {}; }, /projects.*type array/],
  ['collection vide', ({ manifeste }) => { manifeste.projects = []; }, /tableau trop court/],
  ['projet nul', ({ manifeste }) => { manifeste.projects = [null]; }, /type object/],
  ['type booléen incorrect', ({ manifeste }) => { manifeste.projects[0].protectedPreview = 'true'; }, /protectedPreview.*type boolean/],
  ['nom vide', ({ manifeste }) => { manifeste.projects[0].name = ''; }, /name.*chaîne trop courte/],
  ['mode inconnu', ({ manifeste }) => { manifeste.projects[0].mode = 'production'; }, /mode.*valeur non autorisée/],
  ['identifiant équipe invalide', ({ manifeste }) => { manifeste.teamId = 'wrong'; }, /teamId.*format invalide/],
  ['identifiant projet invalide', ({ manifeste }) => { manifeste.projects[0].projectId = 'wrong'; }, /projectId.*format invalide/],
  ['identifiant Git absent', ({ manifeste }) => { delete manifeste.projects[0].projectId; }, /projectId requis/],
  ['champ racine inconnu', ({ manifeste }) => { manifeste.surveillance = true; }, /surveillance.*champ inconnu/],
  ['champ projet inconnu', ({ manifeste }) => { manifeste.projects[0].enabled = true; }, /enabled.*champ inconnu/],
  ['chemin HTTP incorrect', ({ manifeste }) => { manifeste.projects[0].criticalPaths = ['index.html']; }, /criticalPaths.*format invalide/],
  ['nom dupliqué', ({ manifeste }) => { manifeste.projects.push({ ...manifeste.projects[0] }); }, /Nom dupliqué/],
  ['identifiant dupliqué', ({ manifeste }) => { manifeste.projects.push({ ...manifeste.projects[0], name: 'second' }); }, /Project ID dupliqué/],
  ['racine dupliquée', ({ manifeste }) => { manifeste.projects.push({ ...manifeste.projects[0], name: 'second', projectId: 'prj_Second123' }); }, /Racine dupliquée/],
  ['raison de désactivation absente', ({ manifeste }) => { manifeste.projects[0].mode = 'disabled-vercel'; }, /raison requise/],
  ['coupe-circuit désactivé absent', ({ manifeste }) => { Object.assign(manifeste.projects[0], { mode: 'disabled-vercel', reason: 'Retiré' }); }, /coupe-circuit Vercel attendu/],
  ['traversée vers extérieur', ({ manifeste }) => { manifeste.projects[0].root = '../exterieur'; }, /sans traversée/],
  ['chemin absolu extérieur', ({ manifeste, exterieur }) => { manifeste.projects[0].root = exterieur; }, /sans traversée/],
  ['chemin Windows', ({ manifeste }) => { manifeste.projects[0].root = 'C:\\exterieur'; }, /sans traversée/],
  ['lien de dossier extérieur', ({ manifeste, depot, exterieur }) => { symlinkSync(exterieur, join(depot, 'lien')); manifeste.projects[0].root = 'lien'; }, /racine hors du dépôt/],
  ['lien de configuration extérieur', ({ depot, exterieur }) => { rmSync(join(depot, 'app/vercel.json')); symlinkSync(join(exterieur, 'vercel.json'), join(depot, 'app/vercel.json')); }, /vercel.json hors du dépôt/],
  ['configuration invalide', ({ depot }) => { writeFileSync(join(depot, 'app/vercel.json'), '{'); }, /configuration invalide/],
  ['commande vide', ({ depot }) => { writeFileSync(join(depot, 'app/vercel.json'), JSON.stringify({ ignoreCommand: '   ' })); }, /commande non vide/],
  ['mot-clé schéma non implémenté', ({ schema }) => { schema.properties.projects.items.properties.name.maxLength = 10; }, /Mot-clé de schéma non pris en charge.*maxLength/],
];

for (const [nom, modifier, message] of refus) {
  test(`refus : ${nom}`, () => {
    const resultat = verifier(modifier);
    assert.equal(resultat.status, 1, resultat.stdout + resultat.stderr);
    assert.match(resultat.stderr, message);
  });
}
