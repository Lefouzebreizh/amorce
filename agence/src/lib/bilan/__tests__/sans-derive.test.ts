import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

/*
 * Le garde-fou qui manquait à la copie du lot 1.
 *
 * `src/lib/bilan/` est une copie de `bilan-patrimoine/src/`, et son README
 * décrivait une resynchronisation **à la main**. Cette procédure a échoué dès
 * son premier usage, en silence : la copie a perdu l'espace insécable de
 * `INSECABLE`, remplacée par une espace ordinaire. La constante ne faisait donc
 * plus rien — or elle sert de séparateur de milliers *et* de liant avant le
 * symbole. « 40 000 € » pouvait se couper en « 40 » puis « 000 € », sur un
 * téléphone de 393 px, dans l'affichage des montants.
 *
 * Aucun test ne pouvait le voir : les deux fichiers compilent, les deux rendent
 * une chaîne, et la différence tient à un caractère invisible.
 *
 * Ce test relit donc le voisin **en texte** et refuse que les deux s'écartent —
 * le motif éprouvé par `artisan-express/tests/charte.test.ts`, qui garde une
 * charte partagée entre deux projets npm que rien ne peut faire s'importer.
 */

/*
 * Les cinq fichiers copiés ne sont pas dans le même état, et les confondre
 * rendrait ce garde-fou intenable — il crierait sur des écarts voulus, et on
 * finirait par ne plus le lire.
 *
 * **Figés** : recopiés tels quels, à l'adaptation d'import près. Toute
 * différence de code y est une dérive.
 *
 * **Adaptés** : leur logique a réellement changé pour le web. `constats.ts` a
 * perdu une variable morte ; `redaction.ts` expose `premierGesteTexte` là où le
 * lot 1 garde `premierGeste` interne, sa table de gestes hissée au module et un
 * `null` au lieu d'une chaîne vide. Ce qui se garde chez eux, ce sont les
 * **nombres** : un seuil qui s'écarte fait diverger deux bilans qui devraient
 * dire la même chose.
 */
const FIGES = ['modeles', 'baremes', 'valorisation'] as const;
const ADAPTES = ['constats', 'redaction'] as const;

const ICI = path.join(import.meta.dirname, '..');
const VOISIN = path.join(import.meta.dirname, '..', '..', '..', '..', '..', 'bilan-patrimoine', 'src');

/*
 * On compare le **code**, pas la mise en forme : les commentaires diffèrent
 * volontairement — ceux de la copie disent qu'elle en est une — et les imports
 * internes ont perdu leur suffixe `.ts`, seule adaptation que le README
 * autorise. Tout le reste doit être identique au caractère près, espaces
 * invisibles compris : c'est précisément là que la dérive s'est logée.
 */
function codeSeul(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((ligne) => ligne.replace(/(^|\s)\/\/.*$/, ''))
    .map((ligne) => ligne.replace(/(\.\/[\w-]+)\.ts(['"])/g, '$1$2'))
    .filter((ligne) => ligne.trim() !== '')
    .join('\n');
}

/** Les constantes exportées portant un nombre, dans l'ordre du fichier. */
function nombresExportes(source: string): string[] {
  return [...source.matchAll(/^export const ([A-Z_][A-Z0-9_]*) = (-?[\d_.]+)$/gm)].map(
    (trouve) => `${trouve[1]} = ${trouve[2]}`,
  );
}

/*
 * Le socle `agence/` se recopie pour fabriquer un projet client, et le voisin
 * n'y sera pas. On saute alors **en le disant** : un test qui passe au vert sans
 * avoir rien comparé est le défaut que ce dépôt traque le plus.
 */
function lireVoisin(fichier: string): string | null {
  const chemin = path.join(VOISIN, `${fichier}.ts`);
  return existsSync(chemin) ? readFileSync(chemin, 'utf8') : null;
}

for (const fichier of FIGES) {
  test(`${fichier}.ts ne s'écarte pas du lot 1`, (t) => {
    const original = lireVoisin(fichier);
    if (original === null) {
      t.skip(`bilan-patrimoine/src/${fichier}.ts absent — copie non comparée`);
      return;
    }

    assert.equal(
      codeSeul(readFileSync(path.join(ICI, `${fichier}.ts`), 'utf8')),
      codeSeul(original),
      `${fichier}.ts a dérivé de bilan-patrimoine/src/${fichier}.ts.\n` +
        'Reporter le changement du lot 1 ici, ou le déclarer adapté dans README.md.',
    );
  });
}

for (const fichier of ADAPTES) {
  test(`${fichier}.ts garde les nombres du lot 1`, (t) => {
    const original = lireVoisin(fichier);
    if (original === null) {
      t.skip(`bilan-patrimoine/src/${fichier}.ts absent — nombres non comparés`);
      return;
    }

    assert.deepEqual(
      nombresExportes(readFileSync(path.join(ICI, `${fichier}.ts`), 'utf8')),
      nombresExportes(original),
      `Un seuil de ${fichier}.ts s'écarte du lot 1 : deux bilans qui devraient ` +
        'dire la même chose diraient deux choses.',
    );
  });
}

test('la constante de liaison est bien insécable', () => {
  /*
   * Le défaut réel, gardé pour lui-même : la comparaison ci-dessus le rattrape
   * déjà, mais seulement tant que le voisin existe. Dans un projet client
   * recopié du socle, ce test-ci reste le dernier à tenir.
   */
  const trouve = /INSECABLE = '(.)'/.exec(readFileSync(path.join(ICI, 'valorisation.ts'), 'utf8'));
  const caractere = trouve?.[1];

  assert.ok(caractere, 'INSECABLE introuvable');
  assert.equal(
    caractere.codePointAt(0),
    0x00a0,
    'INSECABLE doit être U+00A0 : une espace ordinaire laisse « 40 000 € » se couper.',
  );
});
