import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANDE_SURE, HAUTEURS_LIBRES, Y_PAR_DEFAUT, dansLaBandeSure, boxContains, CAPTION_STYLES, pulseScale, readableOn } from '../captions.ts';
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

test('le texte du surlignage se déduit du contraste, pas d’un réglage', () => {
  // Jaune vif et cyan : clairs, ils appellent du texte noir.
  assert.equal(readableOn('#ffe14d'), '#0a0a0a');
  assert.equal(readableOn('#48d2ff'), '#0a0a0a');
  assert.equal(readableOn('#ffffff'), '#0a0a0a');

  // Rouge et noir : sombres, ils appellent du texte blanc.
  assert.equal(readableOn('#ff5c68'), '#ffffff');
  assert.equal(readableOn('#0a0a0a'), '#ffffff');
});

test('la luminance perçue n’est pas la moyenne des composantes', () => {
  /*
   * Jaune et bleu ont des moyennes proches et des luminances opposées : c'est
   * le cas qui condamne un calcul naïf. Du texte noir sur ce bleu serait
   * illisible.
   */
  assert.equal(readableOn('#ffff00'), '#0a0a0a');
  assert.equal(readableOn('#0000ff'), '#ffffff');
});

test('la pulsation reste discrète et ne s’annule jamais', () => {
  // Échantillonné sur trois périodes : le texte ne doit ni disparaître ni
  // déborder de la largeur calculée sur sa taille au repos.
  for (let t = 0; t < 2.1; t += 0.01) {
    const scale = pulseScale(t);
    assert.ok(scale >= 0.94 && scale <= 1.06, `échelle hors bornes à ${t.toFixed(2)} s : ${scale}`);
  }
});

test('la pulsation part de la taille au repos et ne dépend que du temps de montage', () => {
  assert.equal(pulseScale(0), 1);
  // Avant l'apparition, rien ne bat.
  assert.equal(pulseScale(-1), 1);
  // Même instant, même image : c'est ce qui garantit que l'export reproduit
  // exactement la prévisualisation.
  assert.equal(pulseScale(0.3), pulseScale(0.3));
  // Un aller-retour complet ramène à la taille de départ.
  assert.ok(Math.abs(pulseScale(0.7) - 1) < 1e-9);
});

// ------------------------------------------------ Zones sûres des plateformes

test('la bande sûre correspond à ce qui a été mesuré sur les trois plateformes', () => {
  /*
   * Ce test n'éprouve pas un calcul : il empêche qu'on déplace en passant des
   * valeurs relevées sur des captures réelles. Instagram ferme le bas dès 63 %,
   * TikTok occupe sa colonne de droite à partir de 72 %, Facebook passe sa
   * barre système sous 12 %. C'est l'intersection qui décide.
   */
  assert.equal(BANDE_SURE.haut, 0.12);
  assert.equal(BANDE_SURE.bas, 0.45);
  assert.ok(Y_PAR_DEFAUT > BANDE_SURE.haut && Y_PAR_DEFAUT < BANDE_SURE.bas);
});

test('une hauteur hors bande est ramenée dedans', () => {
  assert.equal(dansLaBandeSure(0.72), 0.45, '72 % tombe dans la colonne de TikTok');
  assert.equal(dansLaBandeSure(0.02), 0.12, '2 % passe sous la barre de Facebook');
  assert.equal(dansLaBandeSure(0.3), 0.3, 'une hauteur déjà sûre ne bouge pas');
});

test('tous les paliers de sous-titre tiennent dans la bande sûre', () => {
  /*
   * Le chemin le plus emprunté est « + Ajouter » — c'est celui que le guide
   * recommande quand la couverture texte est faible. Ses paliers étaient
   * `[0.5, 0.32, 0.66, 0.2, 0.78]` : trois d'entre eux, dont celui par défaut,
   * posaient le texte sous l'habillage des plateformes.
   *
   * Le déplacement des sous-titres dans la bande avait touché la voix off et
   * les gabarits, et manqué celui-ci. Ce test le tient.
   */
  for (const y of HAUTEURS_LIBRES) {
    assert.ok(y >= BANDE_SURE.haut, `palier à ${y} : sous la barre système de Facebook`);
    assert.ok(y <= BANDE_SURE.bas, `palier à ${y} : dans la colonne de TikTok`);
  }
  assert.equal(HAUTEURS_LIBRES[0], Y_PAR_DEFAUT, 'le premier palier est la hauteur par défaut');
  // Deux paliers plus proches que 0,08 ne seraient jamais retenus tous les
  // deux : la recherche de place les considérerait comme le même.
  for (let i = 1; i < HAUTEURS_LIBRES.length; i += 1) {
    assert.ok(
      Math.abs(HAUTEURS_LIBRES[i] - HAUTEURS_LIBRES[i - 1]) >= 0.079,
      `paliers ${HAUTEURS_LIBRES[i - 1]} et ${HAUTEURS_LIBRES[i]} trop proches`,
    );
  }
});
