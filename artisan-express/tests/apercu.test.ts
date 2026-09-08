import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/*
 * Ce que ces tests gardent : l'aperçu d'un site livré reste **le site livré**.
 *
 * La page de vente montre six modèles, et la tentation permanente est de les
 * remplacer par des images — c'est plus rapide à afficher, ça ne dépend de
 * rien, et ça se dégrade sans bruit. Une capture se périme au premier
 * changement de charte : la page continue alors de montrer un site que
 * personne ne livre plus, et le prospect découvre l'écart à la livraison.
 *
 * Le dépôt interdit déjà tout binaire versionné, ce qui rend l'image
 * impossible à commiter — mais rien n'empêcherait de pointer vers une image
 * hébergée ailleurs. Ces tests-là ferment la porte du côté du code.
 */

const COMPOSANTS = new URL('../src/components/', import.meta.url);

function lire(nom: string): string {
  return readFileSync(new URL(nom, COMPOSANTS), 'utf8');
}

/* Comme pour `offre.test.ts` : on mesure ce que la page **fait**, jamais ce que
   le fichier raconte de ses choix. Un garde qui lit sa propre justification
   condamne exactement ce qu'il défend. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const APERCU = sansCommentaires(lire('ApercuSite.tsx'));

test('l’aperçu est un cadre inerte, et il le reste', () => {
  /*
   * Les quatre attributs qui rendent ce cadre sans danger et sans coût, et ce
   * que coûterait chacun s'il partait :
   *
   * - `sandbox=""` : sans lui, un document imbriqué peut exécuter du script et
   *   naviguer la page qui le porte. Ces modèles n'ont aucun JavaScript
   *   aujourd'hui ; ils sont engendrés, et rien ne garantit qu'ils n'en auront
   *   jamais.
   * - `pointer-events-none` : c'est la **carte** qui est le lien. Un cadre qui
   *   attrape le doigt fait un trou au milieu de la cible tactile, et sur un
   *   téléphone c'est toute la carte qui cesse de répondre.
   * - `tabIndex={-1}` : un document imbriqué dans l'ordre de tabulation piège
   *   la navigation au clavier sans rien apporter — ce qu'il montre est déjà
   *   écrit à côté.
   * - `loading` : six documents au premier écran retardent l'affichage de la
   *   seule chose qui vend, qui est le texte du haut.
   */
  for (const attendu of ['sandbox=""', 'pointer-events-none', 'tabIndex={-1}', 'loading=']) {
    assert.ok(
      APERCU.includes(attendu),
      `\`${attendu}\` a disparu d'ApercuSite : le cadre n'est plus inerte`,
    );
  }
});

test('aucun composant ne remplace un aperçu par une image', () => {
  const fichiers = readdirSync(COMPOSANTS).filter((nom) => nom.endsWith('.tsx'));
  assert.ok(fichiers.length > 0, 'aucun composant lu : le chemin est faux');

  for (const nom of fichiers) {
    const source = sansCommentaires(lire(nom));
    assert.doesNotMatch(
      source,
      /\.(png|jpe?g|webp|avif|gif)\b/i,
      `${nom} référence une image matricielle : un aperçu de site doit être la page elle-même, jamais une capture qui se périme en silence`,
    );
  }
});

test('chaque aperçu montre une page qui existe vraiment', () => {
  const disponibles = new Set(
    readdirSync(new URL('../public/modeles/', import.meta.url)).map((nom) => `/modeles/${nom}`),
  );
  assert.ok(disponibles.size > 0, 'aucun modèle sur le disque : le chemin est faux');

  /*
   * Les chemins écrits en dur dans les composants — celui du téléphone du
   * haut de page, par exemple. Ceux de la galerie viennent de sa table de
   * modèles et sont déjà gardés par `galerie.test.ts` ; ici on attrape ce qui
   * s'écrit à la main, qui est précisément ce qu'un renommage oublie.
   */
  for (const nom of readdirSync(COMPOSANTS).filter((f) => f.endsWith('.tsx'))) {
    const source = sansCommentaires(lire(nom));
    for (const trouve of source.matchAll(/["'](\/modeles\/[^"']+)["']/g)) {
      const chemin = trouve[1];
      assert.ok(
        chemin !== undefined && disponibles.has(chemin),
        `${nom} pointe vers ${chemin}, qui n'est pas dans public/modeles/`,
      );
    }
  }
});
