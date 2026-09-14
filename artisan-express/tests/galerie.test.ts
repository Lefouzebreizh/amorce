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
 * La galerie doit annoncer ses entreprises fictives, même en l’absence
 * de témoignages clients ailleurs sur la page.
 */
test('la galerie dit que ses entreprises n’existent pas', () => {
  assert.match(
    SOURCE,
    /ces six entreprises n’existent pas/,
    'la mention qui empêche la galerie de passer pour une liste de clients a disparu',
  );
});


/*
 * Trois couvreurs fictifs, trois noms. Et la comparaison se fait sur les mots.
 *
 * La page de vente nomme des entreprises inventées à trois endroits : la
 * vignette « après » d'`AvantApres`, la démonstration `exemple.html` que le
 * bouton « Voir un site fini » ouvre, et les six cartes de la galerie. Deux
 * d'entre elles portant le même nom, la page se contredit à voix haute : son
 * argument est « six métiers, six sites ».
 *
 * C'est arrivé deux fois. Le modèle couvreur s'appelait d'abord « Couverture
 * Tanguy », comme `exemple.html` ; renommé « Toitures Le Goff », il est tombé
 * sur la vignette d'`AvantApres`, qui affiche « LE GOFF TOITURES ». La version
 * précédente de ce test n'a rien vu — elle ne regardait qu'`exemple.html`, et
 * elle comparait des chaînes.
 *
 * D'où les deux corrections : on relève **toutes** les entreprises de la page,
 * et on les compare sur l'ensemble de leurs mots significatifs. Pour un
 * lecteur, « LE GOFF TOITURES » et « Toitures Le Goff » sont la même
 * entreprise ; pour `===`, ce sont deux chaînes différentes. C'est le lecteur
 * qui a raison.
 *
 * **La vignette d'`AvantApres` n'invente plus d'entreprise du tout**, et elle
 * est donc sortie de cette liste : elle charge une page de la galerie au lieu
 * de dessiner une septième couverture. Le test qui suit celui-ci garde cette
 * propriété-là — car « il n'y a plus de nom à comparer » est une conclusion
 * qui doit se vérifier, jamais se supposer. Sans lui, redessiner une vignette
 * à la main passerait sans un mot.
 */
const AVANT_APRES = readFileSync(new URL('../src/components/AvantApres.tsx', import.meta.url), 'utf8');

function motsSignifiants(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 2)
    .sort()
    .join(' ');
}

test('aucun modèle ne reprend une entreprise déjà nommée sur la page', () => {
  const demonstration = readFileSync(new URL('../public/exemple.html', import.meta.url), 'utf8');
  const ailleurs: readonly (readonly [string, string | undefined])[] = [
    ['exemple.html', /<title>([^<—]+)/.exec(demonstration)?.[1]?.trim()],
  ];

  const dansLaGalerie = [...SOURCE.matchAll(/entreprise: '([^']+)'/g)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
  assert.equal(dansLaGalerie.length, 6, 'six entreprises attendues dans la galerie');

  for (const [ou, nom] of ailleurs) {
    assert.ok(nom, `impossible de relever l’entreprise de ${ou} — le repère a bougé`);
    const empreinte = motsSignifiants(nom);
    for (const candidate of dansLaGalerie) {
      assert.notEqual(
        motsSignifiants(candidate),
        empreinte,
        `« ${candidate} » et « ${nom} » (${ou}) sont la même entreprise pour un lecteur : deux blocs de la page mèneraient au même artisan`,
      );
    }
  }
});

test('les six entreprises de la galerie sont six entreprises distinctes', () => {
  const noms = [...SOURCE.matchAll(/entreprise: '([^']+)'/g)].flatMap((m) =>
    m[1] === undefined ? [] : [motsSignifiants(m[1])],
  );
  assert.equal(new Set(noms).size, 6, 'deux cartes de la galerie portent la même entreprise');
});

/*
 * Ce que ce test garde, et pourquoi il vaut mieux qu'une comparaison de noms.
 *
 * Le panneau « après » d'`AvantApres` a longtemps dessiné à la main une
 * miniature de site livré. Un dessin diverge du livrable sans que personne le
 * voie, et celui-là mettait des carrés gris à la place des photos de chantier
 * — ce qu'un artisan veut précisément voir avant de payer. Il porte désormais
 * un `ApercuSite`, donc la page elle-même.
 *
 * Le garde ne vérifie pas que le dessin a disparu — un dessin peut revenir
 * sous n'importe quelle forme et aucun motif ne les attrape tous. Il vérifie
 * l'affirmation utile : **la page montrée dans ce panneau est l'un des six
 * modèles de la galerie**, donc une entreprise déjà nommée et déjà gardée par
 * le test du dessus, jamais une septième inventée en douce.
 */
test('le panneau « après » montre un modèle de la galerie, pas une septième entreprise', () => {
  const montre = [...AVANT_APRES.matchAll(/fichier="(\/modeles\/[^"]+)"/g)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
  assert.equal(montre.length, 1, 'le panneau « après » doit montrer exactement un modèle');

  const fichiersDeLaGalerie = new Set(
    [...SOURCE.matchAll(/fichier: '([^']+)'/g)].flatMap((m) => (m[1] === undefined ? [] : [m[1]])),
  );
  assert.ok(
    montre[0] !== undefined && fichiersDeLaGalerie.has(montre[0]),
    `AvantApres montre ${montre[0]}, qui n’est pas l’un des six modèles de la galerie`,
  );
});
