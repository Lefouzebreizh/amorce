import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/*
 * Ce que ces tests gardent, et pourquoi ils lisent des fichiers.
 *
 * La galerie de la page d'accueil pointe vers six pages **statiques**, écrites
 * dans `public/modeles/` par un générateur qui vit dans un autre projet npm —
 * `titan-builder/scripts/modeles.mjs`. Rien dans la chaîne de construction de
 * Next.js ne relie les deux : renommer un fichier de sortie là-bas, ou changer
 * un chemin ici, laisse la page compiler, les types passer, le build réussir,
 * et six liens rendre 404 en production. C'est exactement le défaut qui a déjà
 * coûté trois jours sur ce projet — un vert qui ne dit rien de ce que voit un
 * visiteur.
 *
 * On relit donc la source du composant plutôt que de rendre du JSX : ce qu'on
 * vérifie est la **correspondance entre deux dossiers**, pas une mise en page.
 */

const SOURCE = readFileSync(new URL('../src/components/Galerie.tsx', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const DOSSIER = new URL('../public/modeles/', import.meta.url);

/*
 * `flatMap` et non `map` : `tsconfig` est en `noUncheckedIndexedAccess`, donc
 * `m[1]` est `string | undefined` même quand le groupe est obligatoire dans le
 * motif. Filtrer ici rend le reste du fichier lisible.
 */
const CHEMINS: readonly string[] = [
  ...SOURCE.matchAll(/fichier: '(\/modeles\/[a-z-]+\.html)'/g),
].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));

test('la galerie annonce six modèles', () => {
  assert.equal(CHEMINS.length, 6, `six cartes attendues, ${CHEMINS.length} trouvées`);
  assert.equal(new Set(CHEMINS).size, 6, 'deux cartes pointent vers le même fichier');
});

test('chaque carte pointe vers une page qui existe vraiment', () => {
  for (const chemin of CHEMINS) {
    const surDisque = new URL(chemin.replace('/modeles/', ''), DOSSIER);
    assert.ok(
      existsSync(surDisque),
      `${chemin} est annoncé par la galerie et absent de public/modeles/ — le lien rendra 404`,
    );
  }
});

test('aucune page de modèle n’est laissée hors de la galerie', () => {
  const surDisque = readdirSync(DOSSIER).filter((f) => f.endsWith('.html'));
  const annonces = new Set(CHEMINS.map((c) => c.replace('/modeles/', '')));
  for (const fichier of surDisque) {
    assert.ok(
      annonces.has(fichier),
      `public/modeles/${fichier} existe et n’est lié depuis nulle part — page morte`,
    );
  }
});

/*
 * Le fond du contrat, et il n'est pas technique.
 *
 * La galerie coexiste avec `Temoignage`, qui dit que la place du premier client
 * est vide. Si la galerie cessait de dire que ses six entreprises sont
 * inventées, la page se contredirait à trois écrans d'intervalle — et le dépôt
 * interdit le faux témoignage. Aucune relecture ne rattrape ça six mois plus
 * tard : c'est ce test qui le tient.
 */
test('la galerie dit que ses entreprises n’existent pas', () => {
  assert.match(
    SOURCE,
    /ces six entreprises n’existent pas/,
    'la mention qui empêche la galerie de passer pour une liste de clients a disparu',
  );
});

test('la galerie reste avant le témoignage', () => {
  const galerie = PAGE.indexOf('<Galerie />');
  const temoignage = PAGE.indexOf('<Temoignage />');
  assert.ok(galerie > 0, '<Galerie /> n’est plus dans la page');
  assert.ok(temoignage > 0, '<Temoignage /> n’est plus dans la page');
  assert.ok(
    galerie < temoignage,
    'la galerie passe après le témoignage : on lirait les six modèles comme des clients',
  );
});

/*
 * `exemple.html` porte une septième entreprise fictive, et c'est voulu : la
 * page de vente la montre déjà dans `AvantApres`. Deux entrées portant la même
 * entreprise contrediraient « six métiers, six sites » — c'est arrivé, le
 * modèle couvreur s'appelait « Couverture Tanguy » comme la démonstration.
 */
test('aucun modèle ne reprend l’entreprise de la page de démonstration', () => {
  const demonstration = readFileSync(new URL('../public/exemple.html', import.meta.url), 'utf8');
  const nom = /<title>([^<—]+)/.exec(demonstration)?.[1]?.trim();
  assert.ok(nom, 'impossible de lire le nom de l’entreprise de exemple.html');
  assert.doesNotMatch(
    SOURCE,
    new RegExp(`entreprise: '${nom}'`),
    `« ${nom} » est déjà l’entreprise de exemple.html : deux liens mèneraient au même artisan`,
  );
});
