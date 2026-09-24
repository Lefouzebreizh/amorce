import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/*
 * Ce que ces tests gardent : la page ne fabrique aucune réduction.
 *
 * Un tarif de lancement « 300 € au lieu de 400 » a été proposé, puis écarté.
 * Un prix de référence barré doit être un prix réellement pratiqué ; personne
 * n'a jamais payé 400 € ici, donc le barré serait une fausse réduction — une
 * pratique commerciale trompeuse, et surtout le seul élément de cette page
 * qu'un visiteur pourrait prendre en défaut.
 *
 * La décision est écrite en tête d'`Offre.tsx`. Ce test existe parce qu'une
 * décision commentée ne survit pas à la pression : « mets un prix barré, ça
 * convertit » est la remarque la plus banale du monde, et six mois plus tard
 * personne ne se souvient pourquoi on avait dit non. Le commentaire explique,
 * le test refuse.
 *
 * On relit la source plutôt que de rendre du JSX : ce qu'on vérifie est la
 * **présence ou l'absence d'une affirmation**, pas une mise en page.
 */

const FICHIER = readFileSync(new URL('../src/components/Offre.tsx', import.meta.url), 'utf8');

/*
 * On lit ce fichier **sans ses commentaires**, et ce n'est pas un détail.
 *
 * La première version de ces tests lisait tout et échouait sur deux d'entre
 * eux — en attrapant le bloc d'en-tête qui *explique* pourquoi le prix barré
 * a été refusé. Ce bloc cite le montant écarté et le décompte de places pour
 * dire qu'on n'en veut pas : un garde qui lit sa propre justification condamne
 * exactement ce qu'elle défend.
 *
 * La parade n'est pas de réécrire le commentaire jusqu'à ce que le test passe
 * — ce serait perdre la raison, qui vaut plus que le code dans ce dépôt. C'est
 * de mesurer au bon endroit : ce que la **page affiche**, jamais ce que le
 * fichier raconte.
 */
const SOURCE = FICHIER.replace(/\/\*[\s\S]*?\*\//g, '');

/*
 * Ce que « prix barré » veut dire en HTML, et pourquoi la liste est celle-ci.
 *
 * `<s>` et `<del>` barrent nativement ; `line-through` est la classe Tailwind
 * qui fait la même chose sans balise. Les trois se valent à l'écran, et une
 * seule interdiction sur `<s>` laisserait passer les deux autres.
 */
const FACONS_DE_BARRER: readonly (readonly [string, RegExp])[] = [
  ['la balise <s>', /<s[\s>]/],
  ['la balise <del>', /<del[\s>]/],
  ['la classe line-through', /line-through/],
];

test('aucun prix n’est barré sur la page d’offre', () => {
  for (const [quoi, motif] of FACONS_DE_BARRER) {
    assert.doesNotMatch(
      SOURCE,
      motif,
      `${quoi} apparaît dans Offre.tsx : un prix de référence jamais pratiqué est une fausse réduction`,
    );
  }
});

/* Les prix résident dans une seule source afin que les trois parcours restent cohérents. */
test('les trois montants réels sont affichés, sans prix de référence', () => {
  const montants = [...SOURCE.matchAll(/(\d+)(?:&nbsp;| )?€/g)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
  assert.deepEqual(
    [...new Set(montants)],
    [],
    'les montants vivent dans src/lib/offres.ts pour que la page et le formulaire restent synchronisés',
  );
});

const OFFRES = readFileSync(new URL('../src/lib/offres.ts', import.meta.url), 'utf8');

test('les trois formules approuvées sont proposées', () => {
  for (const montant of ['300\\u00a0€', '690\\u00a0€', '1\\u202f290\\u00a0€']) {
    assert.ok(OFFRES.includes(montant), `montant absent de la grille : ${montant}`);
  }
});

/*
 * La rareté affichée doit être une contrainte de travail, pas un décompte.
 *
 * Un « il reste trois places ce mois-ci » se périme tout seul : figé six
 * semaines, il se repère en une seconde et coûte la crédibilité qu'il
 * cherchait. Le nombre de places **simultanées**, lui, n'a rien à tenir à
 * jour — c'est une règle, pas un état.
 */
test('la page n’affiche aucun compteur de places restantes', () => {
  assert.doesNotMatch(
    SOURCE,
    /restante?s?\b/i,
    'un décompte de places est apparu : il se périmera sans que personne le voie',
  );
});
