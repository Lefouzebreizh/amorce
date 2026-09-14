import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// Ce sous-ensemble suffit au schéma versionné. Un nouveau mot-clé non pris en
// charge fait échouer la CI : il ne doit jamais être ignoré silencieusement.
const motsCles = new Set([
  '$schema', 'type', 'required', 'properties', 'enum', 'pattern',
  'minItems', 'items', 'minLength', 'additionalProperties',
]);
const estObjet = (valeur) => valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);

function verifierSchema(schema, chemin = '$') {
  if (!estObjet(schema)) throw new Error(`Schéma non pris en charge : ${chemin}`);
  for (const mot of Object.keys(schema)) {
    if (!motsCles.has(mot)) throw new Error(`Mot-clé de schéma non pris en charge : ${chemin}.${mot}`);
  }
  if (schema.$schema !== undefined && schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    throw new Error(`Dialecte de schéma non pris en charge : ${chemin}`);
  }
  if (schema.type !== undefined && !['object', 'array', 'string', 'boolean'].includes(schema.type)) {
    throw new Error(`Type de schéma non pris en charge : ${chemin}`);
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some((cle) => typeof cle !== 'string'))) {
    throw new Error(`required invalide : ${chemin}`);
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length || schema.enum.some((valeur) => typeof valeur !== 'string'))) {
    throw new Error(`enum non pris en charge : ${chemin}`);
  }
  for (const mot of ['minItems', 'minLength']) {
    if (schema[mot] !== undefined && (!Number.isInteger(schema[mot]) || schema[mot] < 0)) {
      throw new Error(`${mot} invalide : ${chemin}`);
    }
  }
  if (schema.pattern !== undefined) {
    if (typeof schema.pattern !== 'string') throw new Error(`pattern invalide : ${chemin}`);
    new RegExp(schema.pattern, 'u');
  }
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
    throw new Error(`additionalProperties non pris en charge : ${chemin}`);
  }
  if (schema.properties !== undefined) {
    if (!estObjet(schema.properties)) throw new Error(`properties invalide : ${chemin}`);
    for (const [cle, enfant] of Object.entries(schema.properties)) verifierSchema(enfant, `${chemin}.${cle}`);
  }
  if (schema.items !== undefined) verifierSchema(schema.items, `${chemin}[]`);
}

function valider(valeur, schema, erreurs, chemin = '$') {
  const type = valeur === null ? 'null' : Array.isArray(valeur) ? 'array' : typeof valeur;
  if (schema.type && type !== schema.type) {
    erreurs.push(`${chemin} : type ${schema.type} attendu`);
    return;
  }
  if (schema.enum && !schema.enum.includes(valeur)) erreurs.push(`${chemin} : valeur non autorisée`);
  if (typeof valeur === 'string') {
    if (schema.minLength !== undefined && [...valeur].length < schema.minLength) erreurs.push(`${chemin} : chaîne trop courte`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(valeur)) erreurs.push(`${chemin} : format invalide`);
  }
  if (Array.isArray(valeur)) {
    if (schema.minItems !== undefined && valeur.length < schema.minItems) erreurs.push(`${chemin} : tableau trop court`);
    if (schema.items) valeur.forEach((enfant, index) => valider(enfant, schema.items, erreurs, `${chemin}[${index}]`));
  }
  if (estObjet(valeur)) {
    for (const cle of schema.required ?? []) {
      if (!Object.hasOwn(valeur, cle)) erreurs.push(`${chemin}.${cle} : champ obligatoire absent`);
    }
    for (const [cle, enfant] of Object.entries(valeur)) {
      if (Object.hasOwn(schema.properties ?? {}, cle)) valider(enfant, schema.properties[cle], erreurs, `${chemin}.${cle}`);
      else if (schema.additionalProperties === false) erreurs.push(`${chemin}.${cle} : champ inconnu`);
    }
  }
}

const racine = realpathSync(resolve(import.meta.dirname, '..'));
const estDansDepot = (chemin) => {
  const trajet = relative(racine, chemin);
  return trajet !== '..' && !trajet.startsWith(`..${sep}`) && !isAbsolute(trajet);
};

function verifierRegistre() {
  const schema = JSON.parse(readFileSync(resolve(racine, 'ops/vercel/projects.schema.json'), 'utf8'));
  verifierSchema(schema);
  const manifeste = JSON.parse(readFileSync(resolve(racine, 'ops/vercel/projects.json'), 'utf8'));
  const erreurs = [];
  valider(manifeste, schema, erreurs);
  // Les contrôles métier ne lisent les chemins qu'après validation des types.
  if (erreurs.length) throw new Error(erreurs.join('\n'));
  const noms = new Set();
  const ids = new Set();
  const racines = new Set();

  for (const projet of manifeste.projects) {
    if (noms.has(projet.name)) erreurs.push(`Nom dupliqué : ${projet.name}`);
    noms.add(projet.name);
    if (projet.projectId) {
      if (ids.has(projet.projectId)) erreurs.push(`Project ID dupliqué : ${projet.projectId}`);
      ids.add(projet.projectId);
    }
    if (projet.mode === 'git' && !projet.projectId) erreurs.push(`${projet.name} : projectId requis en mode git`);
    if (projet.mode === 'disabled-vercel' && !projet.reason?.trim()) erreurs.push(`${projet.name} : raison requise`);

    if (isAbsolute(projet.root) || /[\\:\u0000-\u001f\u007f]/u.test(projet.root) ||
        (projet.root !== '.' && projet.root.split('/').some((segment) => ['', '.', '..'].includes(segment)))) {
      erreurs.push(`${projet.name} : racine relative sans traversée requise`);
      continue;
    }
    try {
      const dossier = realpathSync(resolve(racine, projet.root));
      if (!estDansDepot(dossier)) throw new Error('racine hors du dépôt');
      if (!statSync(dossier).isDirectory()) throw new Error('racine non répertoire');
      if (racines.has(dossier)) erreurs.push(`Racine dupliquée : ${projet.root}`);
      racines.add(dossier);
      const configuration = realpathSync(resolve(dossier, 'vercel.json'));
      if (!estDansDepot(configuration)) throw new Error('vercel.json hors du dépôt');
      const json = JSON.parse(readFileSync(configuration, 'utf8'));
      if (!estObjet(json) || typeof json.ignoreCommand !== 'string' || !json.ignoreCommand.trim()) {
        erreurs.push(`${projet.name} : ignoreCommand doit être une commande non vide`);
      }
      // Convention versionnée du dépôt : vérifier le préfixe littéral sans
      // exécuter une commande arbitraire fournie par une PR dans le validateur.
      const gardePreview = 'if [ "$VERCEL_ENV" != "preview" ]; then exit 0; fi; ';
      if (projet.mode === 'preview-only' &&
          (json.git?.deploymentEnabled?.main !== false ||
           typeof json.ignoreCommand !== 'string' || !json.ignoreCommand.startsWith(gardePreview))) {
        erreurs.push(`${projet.name} : protection preview-only requise (main exclue et garde VERCEL_ENV canonique)`);
      }
      if (projet.mode === 'disabled-vercel' && json.ignoreCommand !== 'exit 0') {
        erreurs.push(`${projet.name} : coupe-circuit Vercel attendu`);
      }
    } catch (erreur) {
      erreurs.push(`${projet.name} : configuration invalide (${erreur.message})`);
    }
  }
  if (erreurs.length) throw new Error(erreurs.join('\n'));
  console.log(`${manifeste.projects.length} projets Vercel vérifiés.`);
}

try {
  verifierRegistre();
} catch (erreur) {
  console.error(`Registre Vercel refusé :\n${erreur.message}`);
  process.exitCode = 1;
}
