import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxContains, CAPTION_STYLES } from '../captions.ts';
import { CAPTION_COLORS, CAPTION_SCALES, type CaptionStyleId } from '../types.ts';

test('la détection sous le doigt inclut les bords du rectangle', () => {
  const box = { x: 100, y: 200, width: 300, height: 80 };

  assert.ok(boxContains(box, 250, 240), 'le centre devrait répondre');
  assert.ok(boxContains(box, 100, 200), 'le coin haut-gauche fait partie de la zone');
  assert.ok(boxContains(box, 400, 280), 'le coin bas-droit aussi');

  assert.ok(!boxContains(box, 99, 240));
  assert.ok(!boxContains(box, 401, 240));
  assert.ok(!boxContains(box, 250, 199));
  assert.ok(!boxContains(box, 250, 281));
});

test('les couleurs proposées sont toutes franches', () => {
  /*
   * Ce n'est pas la clarté du remplissage qui rend un sous-titre lisible sur
   * une image quelconque — c'est son contour, garanti par le style. Ce qu'on
   * exige ici, c'est que la teinte soit franche : soit très vive, soit proche
   * du blanc ou du noir. Une couleur délavée serait le seul mauvais choix,
   * puisqu'elle se fondrait dans n'importe quelle image sans jamais trancher.
   */
  for (const { value, label } of CAPTION_COLORS) {
    assert.match(value, /^#[0-9a-f]{6}$/i, `${label} : format inattendu`);

    const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));

    assert.ok(
      saturation >= 0.6 || lightness > 0.9 || lightness < 0.1,
      `${label} : ni vive ni extrême (saturation ${saturation.toFixed(2)}, clarté ${lightness.toFixed(2)})`,
    );
  }
});

test('les tailles proposées encadrent la taille normale', () => {
  const values = CAPTION_SCALES.map((s) => s.value);
  assert.ok(values.includes(1), 'la taille du style doit rester atteignable');
  assert.ok(Math.min(...values) < 1 && Math.max(...values) > 1);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], 'tailles mal ordonnées');
});

test('chaque style de sous-titre reste lisible sur n’importe quelle image', () => {
  for (const id of Object.keys(CAPTION_STYLES) as CaptionStyleId[]) {
    const style = CAPTION_STYLES[id];
    // Un texte posé sur une vidéo a besoin d'un contour, d'une ombre ou d'un
    // cartouche : sans aucun des trois, il disparaît sur les zones claires.
    assert.ok(
      style.stroke || style.shadow || style.box,
      `${id} n’a aucun moyen de se détacher du fond`,
    );
    assert.ok(style.fontSize >= 50, `${id} : corps trop petit pour un écran de téléphone`);
  }
});
