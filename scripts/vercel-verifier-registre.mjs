import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const manifeste = JSON.parse(readFileSync(resolve(racine, 'ops/vercel/projects.json'), 'utf8'));
const erreurs = [];
const noms = new Set();
const ids = new Set();
const racines = new Set();

for (const projet of manifeste.projects) {
  if (noms.has(projet.name)) erreurs.push(`Nom dupliqué : ${projet.name}`);
  noms.add(projet.name);
  if (racines.has(projet.root)) erreurs.push(`Racine dupliquée : ${projet.root}`);
  racines.add(projet.root);
  if (!existsSync(resolve(racine, projet.root))) erreurs.push(`Racine absente : ${projet.root}`);

  if (projet.projectId) {
    if (ids.has(projet.projectId)) erreurs.push(`Project ID dupliqué : ${projet.projectId}`);
    ids.add(projet.projectId);
  }
  if (projet.mode === 'git' && !projet.projectId) erreurs.push(`${projet.name} : projectId requis en mode git`);
  if (projet.mode === 'disabled-vercel' && !projet.reason) erreurs.push(`${projet.name} : raison requise`);

  const configuration = resolve(racine, projet.root, 'vercel.json');
  if (!existsSync(configuration)) erreurs.push(`${projet.name} : vercel.json absent dans ${projet.root}`);
  else {
    try {
      const json = JSON.parse(readFileSync(configuration, 'utf8'));
      if (!json.ignoreCommand) erreurs.push(`${projet.name} : ignoreCommand absent`);
      if (projet.mode === 'disabled-vercel' && json.ignoreCommand !== 'exit 0') {
        erreurs.push(`${projet.name} : coupe-circuit Vercel attendu`);
      }
    } catch (error) {
      erreurs.push(`${projet.name} : vercel.json invalide (${error.message})`);
    }
  }
}

if (erreurs.length) {
  console.error(erreurs.map((erreur) => `- ${erreur}`).join('\n'));
  process.exit(1);
}
console.log(`${manifeste.projects.length} projets Vercel vérifiés.`);
