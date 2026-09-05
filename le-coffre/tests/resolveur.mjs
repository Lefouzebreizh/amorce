/*
 * Fait comprendre à Node les imports relatifs sans extension.
 *
 * Les tests s'exécutent directement avec `node --test`, sans compilation ni
 * dépendance ajoutée. Node résout les modules comme le fait un navigateur : il
 * ne lit pas `tsconfig.json` et n'invente pas d'extension, là où `src/lib`
 * écrit `./crypto` comme partout ailleurs dans le projet.
 *
 * L'extension est rétablie ici plutôt que dans le code source : l'inverse
 * rendrait ces fichiers différents de tout ce que Next.js compile, pour la
 * seule commodité du banc d'essai.
 *
 * `registerHooks` s'applique à toute résolution du process, y compris les
 * `require()` internes d'une dépendance CommonJS (pdf-lib, notamment) qui
 * utilise elle-même des chemins relatifs sans extension dans son propre
 * bundle. Rajouter `.ts` à l'aveugle casse alors CETTE résolution-là, qui
 * n'a rien à voir avec le code source du projet. On tente donc d'abord la
 * résolution normale, et on ne retombe sur `.ts` qu'en cas d'échec — jamais
 * l'inverse, sans quoi on ne saurait plus dire laquelle des deux a réellement
 * résolu le module.
 */
import { registerHooks } from 'node:module';
import path from 'node:path';

registerHooks({
  resolve(specificateur, contexte, suivant) {
    const relatif = specificateur.startsWith('./') || specificateur.startsWith('../');
    if (!relatif || path.extname(specificateur) !== '') {
      return suivant(specificateur, contexte);
    }
    try {
      return suivant(specificateur, contexte);
    } catch {
      return suivant(`${specificateur}.ts`, contexte);
    }
  },
});
