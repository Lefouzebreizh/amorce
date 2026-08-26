/*
 * Fait comprendre l'alias `@/…` à Node, le temps des tests.
 *
 * Les tests s'exécutent directement avec `node --test`, sans compilation ni
 * dépendance ajoutée. Node résout les modules comme le fait un navigateur : il
 * ne lit pas `tsconfig.json`, donc ni les alias, ni l'extension sous-entendue.
 *
 * Les deux sont rétablis ici plutôt que dans le code source. L'inverse —
 * écrire des chemins relatifs avec `.ts` explicite dans `src/lib` — rendrait
 * ces fichiers différents de tout le reste du projet, et l'alias resterait à
 * réparer le jour où un composant importe le même module.
 */
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

registerHooks({
  resolve(specificateur, contexte, suivant) {
    if (!specificateur.startsWith('@/')) {
      return suivant(specificateur, contexte);
    }

    const cible = path.join(SOURCE, specificateur.slice(2));
    const complet = path.extname(cible) === '' ? `${cible}.ts` : cible;

    return suivant(pathToFileURL(complet).href, contexte);
  },
});
