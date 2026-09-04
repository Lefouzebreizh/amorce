import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  composer,
  contraste,
  lireJetons,
  oklchVersSrgb,
  type Oklch,
  type Theme,
} from '@/lib/contraste';

/*
 * Le contraste de la charte, mesuré sur la feuille de style elle-même.
 *
 * Ce test existe parce que `globals.css` invite un client à réécrire ses
 * couleurs dans un seul bloc : c'est le geste le plus courant d'un projet qui
 * naît du socle, et c'était jusqu'ici le seul qui pouvait rendre l'application
 * illisible sans qu'aucune vérification ne bronche. `eslint-config-next` porte
 * les règles jsx-a11y, qui lisent le balisage ; aucune ne regarde une couleur.
 *
 * Deux seuils, tirés des WCAG 2.1 :
 *   — 4,5:1 pour du texte courant (critère 1.4.3) ;
 *   — 3:1 pour le contour d'un élément d'interface qu'on ne reconnaît qu'à lui
 *     (critère 1.4.11) — un champ de saisie vide n'a rien d'autre à montrer.
 *
 * Chaque couple est écrit avec le composant qui l'affiche : quand le test
 * casse, il désigne un écran, pas un nom de variable.
 */

const css = readFileSync(
  fileURLToPath(new URL('../../app/globals.css', import.meta.url)),
  'utf8',
);
const jetons = lireJetons(css);

const THEMES: Theme[] = ['clair', 'sombre'];

function jeton(theme: Theme, nom: string): Oklch {
  const valeur = jetons[theme].get(nom);

  assert.ok(valeur, `Le jeton --${nom} est absent du thème ${theme}.`);

  return valeur;
}

/** Une couche à `opacite` sur `fond`, ou `fond` seul si l'opacité est pleine. */
function surface(theme: Theme, fond: string, couche?: { nom: string; opacite: number }) {
  const base = oklchVersSrgb(jeton(theme, fond));

  return couche
    ? composer(oklchVersSrgb(jeton(theme, couche.nom)), couche.opacite, base)
    : base;
}

type Couple = {
  encre: string;
  fond: string;
  aplat?: { nom: string; opacite: number };
  seuil: number;
  ou: string;
};

const COUPLES: Couple[] = [
  // Texte courant — critère 1.4.3.
  { encre: 'foreground', fond: 'background', seuil: 4.5, ou: 'le corps de page' },
  { encre: 'card-foreground', fond: 'card', seuil: 4.5, ou: 'le texte d’une carte' },
  {
    encre: 'muted-foreground',
    fond: 'background',
    seuil: 4.5,
    ou: 'la phrase d’aide sous un champ (Champ)',
  },
  {
    encre: 'muted-foreground',
    fond: 'card',
    seuil: 4.5,
    ou: 'le détail d’identité de la barre latérale',
  },
  {
    encre: 'muted-foreground',
    fond: 'muted',
    seuil: 4.5,
    ou: 'la pastille de statut « brouillon » (Badge, variante neutre)',
  },
  {
    encre: 'primary-foreground',
    fond: 'primary',
    seuil: 4.5,
    ou: 'le bouton d’envoi principal',
  },
  {
    encre: 'secondary-foreground',
    fond: 'secondary',
    seuil: 4.5,
    ou: 'le bouton secondaire',
  },
  {
    encre: 'accent-foreground',
    fond: 'accent',
    seuil: 4.5,
    ou: 'l’onglet actif et la pastille « en cours »',
  },
  {
    encre: 'destructive-foreground',
    fond: 'destructive',
    seuil: 4.5,
    ou: 'le bouton de suppression',
  },
  {
    encre: 'destructive',
    fond: 'card',
    seuil: 4.5,
    ou: 'le message d’erreur d’un champ (Champ, role="alert")',
  },
  {
    encre: 'primary',
    fond: 'card',
    seuil: 4.5,
    ou: 'l’onglet actif de la navigation du bas',
  },
  // Encre sur un aplat de sa propre teinte — les pastilles de statut. L'aplat
  // se compose : mesurer la couleur pleine surestimerait largement l'écart.
  {
    encre: 'success',
    fond: 'card',
    aplat: { nom: 'success', opacite: 0.15 },
    seuil: 4.5,
    ou: 'la pastille « terminé » posée sur une carte (Badge, variante succes)',
  },
  {
    encre: 'success',
    fond: 'background',
    aplat: { nom: 'success', opacite: 0.15 },
    seuil: 4.5,
    ou: 'la pastille « terminé » posée sur le fond de page',
  },
  {
    encre: 'warning-foreground',
    fond: 'card',
    aplat: { nom: 'warning', opacite: 0.2 },
    seuil: 4.5,
    ou: 'la pastille d’avertissement (Badge, variante attention)',
  },
  // Contour d'élément d'interface — critère 1.4.11.
  {
    encre: 'input',
    fond: 'card',
    seuil: 3,
    ou: 'le contour d’un champ vide (Input, Textarea, Select)',
  },
  {
    encre: 'ring',
    fond: 'card',
    seuil: 3,
    ou: 'l’anneau de focus clavier sur un champ',
  },
  {
    encre: 'ring',
    fond: 'background',
    seuil: 3,
    ou: 'l’anneau de focus clavier sur le fond de page',
  },
];

for (const theme of THEMES) {
  test(`contraste de la charte — thème ${theme}`, () => {
    for (const { encre, fond, aplat, seuil, ou } of COUPLES) {
      const mesure = contraste(oklchVersSrgb(jeton(theme, encre)), surface(theme, fond, aplat));

      assert.ok(
        mesure >= seuil,
        `${ou} : --${encre} sur --${fond}${aplat ? ` (aplat ${aplat.opacite * 100} %)` : ''} ` +
          `rend ${mesure.toFixed(2)}:1, il en faut ${seuil}:1 (thème ${theme}).`,
      );
    }
  });
}

/*
 * Les deux réglages qui ont réellement été corrigés par cette mesure. Sans ces
 * bornes, une charte qui remonterait la clarté du vert ou réalignerait `--input`
 * sur `--border` repasserait tout juste au-dessus du seuil sur certains couples
 * et sous le seuil sur d'autres : on veut que la régression se voie au premier
 * couple, pas au dernier.
 */
test('le contour de champ se distingue du filet décoratif', () => {
  for (const theme of THEMES) {
    const contour = jeton(theme, 'input');
    const filet = jeton(theme, 'border');

    assert.notDeepEqual(
      contour,
      filet,
      `Thème ${theme} : --input a repris la valeur de --border. Le contour d’un champ ` +
        'vide est le seul indice de sa présence ; le filet d’une carte est décoratif. ' +
        'Les aligner rend les formulaires invisibles à qui voit mal.',
    );
  }
});

test('la feuille de style déclare bien les deux thèmes', () => {
  // Garde-fou du test lui-même : si l'extraction cassait, tous les couples
  // ci-dessus passeraient en lisant deux fois le même thème.
  assert.notDeepEqual(
    jeton('clair', 'background'),
    jeton('sombre', 'background'),
    'Les deux thèmes rendent le même fond : l’extraction des jetons ne sépare plus rien.',
  );
});
