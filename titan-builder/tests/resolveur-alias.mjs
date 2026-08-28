/*
 * Fait comprendre l'alias `@/…` à Node, le temps des tests.
 *
 * Les tests tournent directement sur les sources TypeScript, sans compilation
 * ni dépendance ajoutée. Node résout les modules comme un navigateur : il ne
 * lit pas `tsconfig.json`, donc ni l'alias, ni l'extension sous-entendue.
 *
 * `registerHooks` et non un simple export : un module chargé par `--import` qui
 * exporte `resolve` n'enregistre rien du tout, et l'échec ressemble à une
 * dépendance manquante — « Cannot find package '@/lib' » — plutôt qu'à un
 * crochet oublié. Même mécanisme que dans `artisan-express/tests/`.
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
