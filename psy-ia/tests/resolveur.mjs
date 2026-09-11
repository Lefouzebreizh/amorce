/*
 * Fait comprendre à Node les imports relatifs sans extension.
 *
 * Les tests s'exécutent directement avec `node --test`, sans compilation ni
 * dépendance ajoutée. Node résout les modules comme le fait un navigateur :
 * il ne lit pas `tsconfig.json` et n'invente pas d'extension, là où
 * `src/lib` écrit `./crisisDetection` comme partout ailleurs dans le
 * projet. Repris tel quel du même fichier dans `le-coffre/tests/`.
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
