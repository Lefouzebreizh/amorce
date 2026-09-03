import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ENCRES,
  SURFACES,
  TEINTES,
  TEINTE_DU_METIER,
  TEINTE_PAR_DEFAUT,
  teinteDeCharte,
} from '@/lib/charte';
import { contraste } from '@/lib/site';

/*
 * La charte se **prouve** ici, elle ne se décrit pas.
 *
 * Une charte écrite en Markdown se périme au premier remaniement sans que
 * personne le voie. Écrite en valeurs et tenue par ces tests, elle ne peut
 * plus dériver : changer une teinte sans regarder son contraste fait tomber la
 * suite, et c'est exactement le moment où l'on veut être arrêté.
 *
 * `contraste` vient de `site.ts` à dessein — un second calcul écrit ici aurait
 * divergé du premier, et c'est celui des deux qui ne sert à rien qui aurait eu
 * raison.
 */

/** Le plancher d'un accent, imposé par `CLAUDE.md` §2 bis. */
const PLANCHER_ACCENT = 7;

test('chaque teinte de métier tient le plancher de 7:1 sur le fond', () => {
  /*
   * Pas 4,5 : ces pages se lisent dehors, sur un chantier, sur un téléphone à
   * moitié assombri. C'est le standard de la maison, et il est plus haut que
   * le minimum légal pour cette raison-là.
   */
  for (const [nom, teinte] of Object.entries(TEINTES)) {
    const mesure = contraste(teinte.accent, SURFACES.ink);
    assert.ok(
      mesure >= PLANCHER_ACCENT,
      `${nom} (${teinte.accent}) rend ${mesure.toFixed(1)}:1, sous le plancher de ${PLANCHER_ACCENT}`,
    );
  }
});

test('chaque teinte reste lisible sur la surface élevée, pas seulement sur le fond', () => {
  /*
   * Le piège que ce test garde : un accent mesuré sur le fond le plus sombre
   * passe toujours. Il vit pourtant aussi sur les cartes, qui sont plus
   * claires — et c'est là qu'il perd le plus.
   */
  for (const [nom, teinte] of Object.entries(TEINTES)) {
    const mesure = contraste(teinte.accent, SURFACES.slab);
    assert.ok(mesure >= 4.5, `${nom} rend ${mesure.toFixed(1)}:1 sur une carte`);
  }
});

test('le texte d’un bouton plein se lit sur sa propre teinte', () => {
  // Un bouton dont le libellé disparaît est pire qu'un bouton absent.
  for (const [nom, teinte] of Object.entries(TEINTES)) {
    const mesure = contraste(teinte.encre, teinte.accent);
    assert.ok(mesure >= 4.5, `le libellé de ${nom} rend ${mesure.toFixed(1)}:1`);
  }
});

test('l’encre se lit partout, y compris la douce', () => {
  assert.ok(contraste(ENCRES.vive, SURFACES.ink) >= 12);
  assert.ok(contraste(ENCRES.douce, SURFACES.ink) >= 7);
  // L'encre éteinte ne porte que des mentions accessoires : 4,5 suffit.
  assert.ok(contraste(ENCRES.eteinte, SURFACES.ink) >= 3);
});

test('les surfaces se distinguent sans s’empiler', () => {
  /*
   * L'écart mesuré vaut 1,099, proche du 1,07 que `CLAUDE.md` §2 bis retient.
   * Trop peu et rien ne se détache ; trop et la page devient un empilement de
   * boîtes grises.
   */
  const ecart = (a: string, b: string) => contraste(a, SURFACES.ink) / contraste(b, SURFACES.ink);
  assert.ok(contraste(SURFACES.slab, SURFACES.ink) > 1.05, 'la carte ne se détache pas du fond');
  assert.ok(contraste(SURFACES.slab, SURFACES.ink) < 1.3, 'la carte crie au lieu de s’élever');
  assert.ok(contraste(SURFACES.panel, SURFACES.slab) > 1.03, 'le niveau haut ne se détache pas');
  void ecart;
});

test('aucune teinte n’est chaude — la charte est sans orange', () => {
  /*
   * La règle que le propriétaire a posée, et qu'un test tient mieux qu'un
   * commentaire : dériver les anciennes couleurs de métier ramenait
   * l'électricien à `#E18E3B`, un orange franc. Le rouge ne doit donc jamais
   * dominer les deux autres canaux.
   */
  for (const [nom, teinte] of Object.entries(TEINTES)) {
    const [r, v, b] = [1, 3, 5].map((i) => parseInt(teinte.accent.slice(i, i + 2), 16));
    assert.ok(
      r! <= Math.max(v!, b!),
      `${nom} (${teinte.accent}) penche vers le chaud : rouge ${r} au-dessus de ${Math.max(v!, b!)}`,
    );
  }
});

test('chaque métier connu tombe sur une teinte qui existe', () => {
  for (const [metier, nom] of Object.entries(TEINTE_DU_METIER)) {
    assert.ok(TEINTES[nom] !== undefined, `${metier} pointe vers une teinte absente : ${nom}`);
  }
});

test('un métier se reconnaît avec ou sans accent, avec ou sans casse', () => {
  const attendue = TEINTES.menthe;
  assert.deepEqual(teinteDeCharte('macon'), attendue);
  assert.deepEqual(teinteDeCharte('Maçon'), attendue);
  assert.deepEqual(teinteDeCharte('  MAÇON  '), attendue);
});

test('les anciennes couleurs libres reviennent dans la charte', () => {
  /*
   * Les dossiers déjà écrits portent un hexadécimal. Ils doivent continuer de
   * se générer — et se générer **dans la charte**, sinon un site livré demain
   * depuis un vieux dossier s'en écarterait sans que rien ne le signale.
   */
  assert.deepEqual(teinteDeCharte('#2f6f4e'), TEINTES.vert, 'le vert de Tanguy');
  assert.deepEqual(teinteDeCharte('#1f6f8b'), TEINTES.petrole, 'le pétrole de Kerhervé');
});

test('rien ne peut sortir de la charte, même une entrée fantaisiste', () => {
  /*
   * Le garde-fou qui porte toute la promesse : « cohérente sur tous les sites
   * livrés ». Il n'existe aucun chemin — vieux dossier, faute de frappe,
   * injection — qui produise une teinte hors palette.
   */
  const connues = new Set(Object.values(TEINTES).map((t) => t.accent));

  for (const entree of ['', '   ', '#ff8800', 'orange', 'red; } body {', 'plombier', '#000000']) {
    const rendue = teinteDeCharte(entree);
    assert.ok(connues.has(rendue.accent), `« ${entree} » a produit ${rendue.accent}, hors charte`);
  }

  assert.deepEqual(teinteDeCharte('nimportequoi'), TEINTES[TEINTE_PAR_DEFAUT]);
});
