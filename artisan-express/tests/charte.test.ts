import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Ce que ce fichier garde depuis le 08/09/2026 : les planchers, plus l'égalité.
 *
 * IL COMPARAIT DEUX FICHIERS. IL MESURE MAINTENANT CELUI-CI.
 *
 * `titan-builder/src/lib/charte.ts` porte la charte des sites **livrés** ;
 * `src/app/globals.css` porte celle de la page qui les **vend**. Les deux
 * étaient tenues identiques, et ce test refusait qu'elles s'écartent — parce
 * que deux palettes recopiées divergent au premier changement, et que c'est
 * toujours celle qu'on ne regarde pas qui part en vrille.
 *
 * Le propriétaire a arrêté une palette propre à la vitrine, et deux mesures
 * interdisent de la descendre chez les sites livrés : le turquoise est à 16°
 * du vert et 19° du pétrole quand la charte des métiers exige 28° d'écart, et
 * les cinq teintes métier tombent à 6,44–6,53:1 sur un `panel` dérivé des
 * nouvelles surfaces, sous le plancher de 7:1.
 *
 * **Relâcher une égalité sans la remplacer donne un test qui ne mesure plus
 * rien** — le défaut le plus discret du dépôt, un vert qui ne regarde plus.
 * Ce fichier a donc changé d'objet plutôt que de portée : il calcule les
 * contrastes de la palette d'ici contre les planchers du §2 bis, il verrouille
 * les deux valeurs que le propriétaire a arrêtées, et il refuse que le violet
 * quitte le décor. C'est plus fort qu'une égalité : une égalité ne dit rien de
 * la lisibilité, elle dit seulement que deux fichiers se ressemblent.
 *
 * Ce qui reste vérifié du côté voisin : que les teintes métier existent
 * toujours et gardent leur propre plancher — c'est `titan-builder` qui le
 * tient, dans ses propres tests, et ce n'est pas le travail d'ici.
 */

const STYLES = new URL('../src/app/globals.css', import.meta.url);

/** Le plancher de contraste d'un accent, §2 bis — pas 4,5 : ces pages se lisent dehors. */
const PLANCHER_ACCENT = 7;
/** Le plancher d'un élément non textuel : un trait, une bordure qui désigne. */
const PLANCHER_TRAIT = 3;

function canaux(hexa: string): readonly [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hexa.slice(i, i + 2), 16) / 255) as unknown as readonly [
    number,
    number,
    number,
  ];
}

function luminance(hexa: string): number {
  const [r, v, b] = canaux(hexa).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * v! + 0.0722 * b!;
}

/** Le rapport de contraste WCAG entre deux couleurs, dans l'ordre qu'on veut. */
function contraste(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (haut! + 0.05) / (bas! + 0.05);
}

/** Toutes les valeurs `--color-x: #rrggbb` de la feuille, en minuscules. */
function jetons(): Map<string, string> {
  const css = readFileSync(STYLES, 'utf8');
  const trouves = new Map<string, string>();
  for (const [, nom, valeur] of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    trouves.set(nom!, valeur!.toLowerCase());
  }
  return trouves;
}

test('les deux surfaces arrêtées par le propriétaire sont exactement celles-là', () => {
  /*
   * #0F1115 et #202430 ne sont pas dérivées, elles sont décidées. Les
   * verrouiller ici évite qu'une session les « harmonise » de trois points en
   * croyant rendre service — et le message dit la valeur attendue, pour qu'on
   * n'ait pas à la chercher.
   */
  const ici = jetons();
  assert.equal(ici.get('ink'), '#0f1115', 'le fond de page a bougé');
  assert.equal(ici.get('slab'), '#202430', 'le fond des cartes a bougé');
});

test('les quatre surfaces montent vraiment, du fond vers la carte la plus haute', () => {
  /*
   * L'ordre compte plus que les valeurs : une surface qui passe sous sa voisine
   * inverse la hiérarchie sans qu'aucun contraste ne baisse, et rien ne le
   * signale — une carte se met alors à creuser au lieu de se lever.
   */
  const ici = jetons();
  const montee = ['ink', 'slab', 'panel', 'edge'].map((nom) => {
    const valeur = ici.get(nom);
    assert.ok(valeur, `la surface « ${nom} » a disparu`);
    return { nom, clarte: luminance(valeur!) };
  });
  for (let i = 1; i < montee.length; i += 1) {
    assert.ok(
      montee[i]!.clarte > montee[i - 1]!.clarte,
      `« ${montee[i]!.nom} » n’est pas plus clair que « ${montee[i - 1]!.nom} »`,
    );
  }
});

test('l’accent tient le plancher sur la surface la plus claire', () => {
  /*
   * « Sur la surface la plus claire — c'est le pire cas, celui qui décide. »
   * C'est la moitié de la règle du §2 bis qui s'est déjà perdue deux fois dans
   * ce dépôt : mesurée sur le fond de page, une palette paraît conforme et rate
   * la barre sur les cartes. On mesure donc sur `panel`.
   */
  const ici = jetons();
  const accent = ici.get('accent');
  const panel = ici.get('panel');
  assert.ok(accent && panel, 'l’accent ou la surface la plus claire a disparu');

  const mesure = contraste(accent!, panel!);
  assert.ok(
    mesure >= PLANCHER_ACCENT,
    `l’accent ${accent} rend ${mesure.toFixed(2)}:1 sur ${panel}, sous le plancher de ${PLANCHER_ACCENT}`,
  );
});

test('ce qu’on écrit sur le bouton plein se lit', () => {
  /*
   * Le piège déjà payé ici : une opacité posée sur un aplat de couleur mange le
   * contraste sans qu'aucun jeton ne le montre. On mesure les deux valeurs
   * pleines, qui sont les seules que la page emploie.
   */
  const ici = jetons();
  const [accent, encre] = [ici.get('accent'), ici.get('accent-encre')];
  assert.ok(accent && encre, 'l’accent ou son encre a disparu');
  const mesure = contraste(encre!, accent!);
  assert.ok(
    mesure >= PLANCHER_ACCENT,
    `le libellé ${encre} sur l’accent ${accent} rend ${mesure.toFixed(2)}:1`,
  );
});

test('les deux encres de lecture tiennent le plancher partout où elles se posent', () => {
  const ici = jetons();
  const surfaces = ['ink', 'slab', 'panel'].map((nom) => [nom, ici.get(nom)] as const);
  for (const nomEncre of ['encre', 'ardoise']) {
    const valeur = ici.get(nomEncre);
    assert.ok(valeur, `l’encre « ${nomEncre} » a disparu`);
    for (const [nomSurface, surface] of surfaces) {
      assert.ok(surface, `la surface « ${nomSurface} » a disparu`);
      const mesure = contraste(valeur!, surface!);
      assert.ok(
        mesure >= PLANCHER_ACCENT,
        `« ${nomEncre} » rend ${mesure.toFixed(2)}:1 sur « ${nomSurface} », sous ${PLANCHER_ACCENT}`,
      );
    }
  }
});

test('le violet reste dans le décor, parce qu’il ne peut rien porter', () => {
  /*
   * `#7C3AED` rend 3,32:1 sur le fond, 2,72 sur une carte, 2,44 sur un encadré.
   * Sous le plancher d'un trait qui désigne quelque chose, et très loin de
   * celui d'un accent. Le dépôt le sait déjà pour TITAN Builder, où la même
   * valeur est notée « inutilisable comme accent ».
   *
   * Ce test ne mesure pas le violet — sa mesure ne changerait rien, il ne
   * passera jamais. Il garde la **conséquence** : aucun composant ne l'emploie
   * pour du texte, pour un fond de bouton, ni pour une bordure. Ce qui lui
   * reste est le dégradé et le halo, où il n'y a rien à lire.
   */
  const ici = jetons();
  const violet = ici.get('violet');
  assert.ok(violet, 'le violet a disparu');
  assert.ok(
    contraste(violet!, ici.get('slab')!) < PLANCHER_TRAIT,
    'le violet passe désormais le plancher d’un trait : cette garde peut être rouverte, mais elle se rouvre en connaissance de cause',
  );

  const composants = new URL('../src/components/', import.meta.url);
  for (const fichier of readdirSync(composants).filter((nom) => nom.endsWith('.tsx') || nom.endsWith('.ts'))) {
    const texte = readFileSync(new URL(fichier, composants), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const interdit of [/\btext-violet\b/, /\bbg-violet\b(?!-voile)/, /\bborder-violet\b/]) {
      assert.doesNotMatch(
        texte,
        interdit,
        `${fichier} fait porter au violet un texte, un fond de bouton ou une bordure — il rend 2,44:1 sur un encadré`,
      );
    }
  }
});

test('la barre d’adresse du téléphone porte le fond de la page', () => {
  /*
   * `themeColor` colore la barre d'adresse de Chrome Android. Elle était restée
   * sur l'ancien fond `#16151a` après le changement de palette : un liseré de
   * l'ancienne couleur au-dessus de la nouvelle, visible seulement sur un vrai
   * téléphone, et invisible à toute mesure de la page elle-même.
   *
   * Trouvé en relisant ce que la production **sert**, pas ce que le source dit
   * — c'est la même leçon que le cadre vide : une valeur écrite en dur à côté
   * d'un jeton ne suit pas le jeton.
   */
  const ici = jetons();
  const source = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const trouve = /themeColor:\s*'(#[0-9a-fA-F]{6})'/.exec(source);
  assert.ok(trouve, 'themeColor a disparu de layout.tsx');
  assert.equal(
    trouve![1]!.toLowerCase(),
    ici.get('ink'),
    'la barre d’adresse ne porte plus le fond de page',
  );
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
