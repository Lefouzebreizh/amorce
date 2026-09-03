import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Les deux palettes ne peuvent pas diverger.
 *
 * `titan-builder/src/lib/charte.ts` porte la charte des sites **livrés** ;
 * `src/app/globals.css` porte celle de la page qui les **vend**. Ce sont deux
 * projets npm distincts — l'un ne peut pas importer l'autre, et le dépôt
 * interdit qu'une modification en touche deux à la fois.
 *
 * Les valeurs sont donc recopiées, et c'est exactement le défaut que ce fichier
 * existe pour rattraper : deux palettes tenues en parallèle divergent au
 * premier changement, et c'est toujours celle qu'on ne regarde pas qui part en
 * vrille. On relit donc le fichier voisin **en texte**, sans l'importer.
 *
 * Ce que ça coûte : ce test tombe si `charte.ts` est déplacé. C'est voulu — le
 * déplacer sans rien dire est précisément ce qu'il faut apprendre tout de
 * suite, pas le jour où la page de vente aura dérivé.
 */

const CHARTE = new URL('../../titan-builder/src/lib/charte.ts', import.meta.url);
const STYLES = new URL('../src/app/globals.css', import.meta.url);

/** Toutes les valeurs `--color-x: #rrggbb` de la feuille, en minuscules. */
function jetons(): Map<string, string> {
  const css = readFileSync(STYLES, 'utf8');
  const trouves = new Map<string, string>();
  for (const [, nom, valeur] of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    trouves.set(nom!, valeur!.toLowerCase());
  }
  return trouves;
}

/** La valeur d'une clé de la charte voisine, quel que soit le bloc qui la porte. */
function deLaCharte(cle: string): string {
  const source = readFileSync(CHARTE, 'utf8');
  const trouve = new RegExp(`\\b${cle}:\\s*'(#[0-9a-fA-F]{6})'`).exec(source);
  assert.ok(trouve, `« ${cle} » a disparu de titan-builder/src/lib/charte.ts`);
  return trouve![1]!.toLowerCase();
}

test('les surfaces de la page de vente sont celles des sites livrés', () => {
  const ici = jetons();
  for (const nom of ['ink', 'slab', 'panel', 'edge']) {
    assert.equal(ici.get(nom), deLaCharte(nom), `la surface « ${nom} » a dérivé`);
  }
});

test('les encres aussi, et sous les noms qu’elles ont toujours eus', () => {
  /*
   * `encre` et `ardoise` gardent leur nom là où les surfaces ont pris celui du
   * dépôt : ces deux-là ont toujours désigné du texte, et c'est resté vrai. Les
   * renommer aurait touché cent trente classes pour ne rien clarifier.
   */
  const ici = jetons();
  assert.equal(ici.get('encre'), deLaCharte('vive'));
  assert.equal(ici.get('ardoise'), deLaCharte('douce'));
  assert.equal(ici.get('eteinte'), deLaCharte('eteinte'));
});

test('l’accent de la page est le vert de la charte, et rien d’autre', () => {
  /*
   * Un produit, un accent — §2 bis. Celui-ci est la teinte par défaut de la
   * palette, celle que reçoit un couvreur : la vitrine porte la couleur de la
   * marchandise.
   */
  const ici = jetons();
  const source = readFileSync(CHARTE, 'utf8');
  const vert = /vert:\s*\{\s*accent:\s*'(#[0-9a-fA-F]{6})',\s*vif:\s*'(#[0-9a-fA-F]{6})',\s*encre:\s*'(#[0-9a-fA-F]{6})',\s*voile:\s*'(#[0-9a-fA-F]{6})'/
    .exec(source);
  assert.ok(vert, 'le vert a disparu de la charte, ou sa forme a changé');

  assert.equal(ici.get('accent'), vert![1]!.toLowerCase());
  assert.equal(ici.get('accent-vif'), vert![2]!.toLowerCase());
  assert.equal(ici.get('accent-encre'), vert![3]!.toLowerCase());
  assert.equal(ici.get('voile'), vert![4]!.toLowerCase());
});

test('aucun orange ne subsiste dans la page de vente', () => {
  /*
   * La règle posée par le propriétaire, et qu'un test tient mieux qu'un
   * commentaire. On mesure le rouge contre les deux autres canaux plutôt que
   * de chercher l'ancienne valeur `#c74e00` : c'est la famille qu'on refuse,
   * pas un hexadécimal précis — sans quoi un `#d05a10` reviendrait sans être vu.
   *
   * Le vert de WhatsApp est hors sujet : c'est la marque d'un tiers, montrée
   * telle qu'elle est, et elle n'est de toute façon pas chaude.
   *
   * **Et la garde ne porte que sur les accents.** Le premier jet la passait sur
   * tous les jetons, et elle a condamné `#f1efea` — le blanc cassé de l'encre,
   * chaud à dessein parce qu'un blanc pur vibre sur fond sombre. La source
   * était juste, le test était faux : c'est la couleur qui **désigne** qu'on
   * interdit de tirer vers l'orange, pas celle qui porte le texte.
   */
  const ici = jetons();
  for (const nom of ['accent', 'accent-vif', 'voile']) {
    const valeur = ici.get(nom);
    assert.ok(valeur, `le jeton « ${nom} » a disparu`);
    const [r, v, b] = [1, 3, 5].map((i) => parseInt(valeur!.slice(i, i + 2), 16));
    assert.ok(r! <= Math.max(v!, b!), `${nom} (${valeur}) penche vers le chaud`);
  }

  /*
   * Et l'ancienne valeur nommément — mais **déclarée**, pas citée.
   *
   * Le premier jet cherchait la chaîne `#c74e00` n'importe où, et il a condamné
   * le commentaire de `globals.css` qui explique justement pourquoi cet orange
   * a été retiré. Une garde qui interdit d'écrire sa propre raison finit par
   * faire supprimer la raison. On cherche donc une déclaration ou une classe,
   * jamais une occurrence de texte.
   */
  const css = readFileSync(STYLES, 'utf8');
  assert.doesNotMatch(css, /--color-[a-z-]+:\s*#c74e00/i, 'l’orange de chantier est redéclaré');
  for (const fichier of ['../src/components/ui.ts', '../src/components/BarreAction.tsx']) {
    const texte = readFileSync(new URL(fichier, import.meta.url), 'utf8');
    assert.doesNotMatch(texte, /\[#c74e00\]|\[#e35d00\]|\[#a33f00\]/i,
      `${fichier} repose un orange en dur`);
  }
});
