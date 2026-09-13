import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAutoEdit as assemble } from '../autoEdit.ts';
import { alerteSurDecoupage, captionCoverage } from '../analysis.ts';
import { layoutClips, totalDuration } from '../timeline.ts';
import { DEFAULT_CLIP, type Clip, type MediaAsset } from '../types.ts';

// Scénarios d'habillage sur demande ; ils ne valident pas la qualité perçue.
const buildAutoEdit = (assets: MediaAsset[]) => assemble(assets, {
  shorten: true, visualEffects: true, soundEffects: true, captionGuide: true,
});

/**
 * La deuxième famille de vérifications : le résultat perçu, pas la mécanique.
 *
 * Les suites existantes mesurent que les commandes répondent — un texte est
 * visible, un curseur bouge, un plan ne descend pas sous son plancher. Elles
 * étaient toutes vertes pendant que le montage express rendait une seule
 * phrase de texte sur trente secondes, des bruitages sans rapport avec ce
 * qu'on voit, et un découpage que rien n'arrêtait.
 *
 * Ces contrôles mesurent des propriétés du projet, pas sa qualité à regarder
 * ou à écouter. Les seuils viennent de `analysis.ts` : leur cohérence interne
 * ne constitue ni une validation artistique ni une mesure de rétention.
 */

function rush(id: string, duration: number, hasAudio = false): MediaAsset {
  return {
    id,
    name: `${id}.mp4`,
    kind: 'video',
    url: `blob:${id}`,
    duration,
    width: 1080,
    height: 1920,
    thumbnail: '',
    hasAudio,
  };
}

/** Un plan sec de `duree` secondes, sans transition qui rognerait la durée. */
function clipDe(duree: number): Clip {
  return { ...DEFAULT_CLIP, id: `c${duree}`, assetId: 'a', inPoint: 0, outPoint: duree, transition: 'cut', transitionDuration: 0 };
}

/** `duree` secondes découpées en `nombre` plans égaux. */
function morceaux(duree: number, nombre: number): Clip[] {
  return Array.from({ length: nombre }, (_, i) => ({ ...clipDe(duree / nombre), id: `m${i}` }));
}

/** Les instants de raccord du montage, hors première image. */
function raccords(clips: ReturnType<typeof buildAutoEdit>['clips']): number[] {
  return layoutClips(clips)
    .slice(1)
    .map((item) => Math.max(0, item.start));
}

// -- Le texte ---------------------------------------------------------------

/*
 * Le vert qui manquait le plus.
 *
 * `verify.mjs` vérifiait qu'une accroche est **visible**. Présence, jamais
 * couverture — et il passait précisément parce qu'il y avait *un* texte. Le
 * produit exige 55 % dans sa propre notation ; le montage express en rendait
 * 12,8 %, sur un tableau de sous-titres écrit en dur à un seul élément.
 */
test('le montage express couvre la durée en texte, pas seulement son début', () => {
  for (const nombre of [6, 12, 28]) {
    const assets = Array.from({ length: nombre }, (_, i) => rush(`a${i}`, 6 + i * 0.2));
    const { clips, captions } = buildAutoEdit(assets);
    const couverture = captionCoverage(captions, totalDuration(clips));

    assert.ok(
      couverture >= 0.55,
      `${nombre} rushes : ${(couverture * 100).toFixed(1)} % de couverture texte, ` +
        'sous le plancher de 55 % que le produit se donne dans analysis.ts',
    );
  }
});

// -- Les bruitages ----------------------------------------------------------

/*
 * « Des bruitages ridicules apparaissent sur les transitions entre plans —
 * plaqués automatiquement, sans rapport avec le contenu. »
 *
 * La pertinence d'un son ne se mesure pas dans un test. Sa **cause**, si : le
 * choix venait d'un compteur qui tourne, `RACCORD_CYCLE[(index - 1) % 6]`, et
 * ne consultait donc rien de ce qui est à l'écran ni de ce qu'on entend. Les
 * deux contrôles ci-dessous épinglent cette cause-là.
 */
test('aucun bruitage ne se pose sur une coupe qui entre dans un rush sonore', () => {
  // Douze rushes qui portent tous leur propre bande son : quelqu'un qui parle.
  const assets = Array.from({ length: 12 }, (_, i) => rush(`parle${i}`, 6, true));
  const { clips, cues } = buildAutoEdit(assets);

  for (const at of raccords(clips)) {
    const pose = cues.filter((cue) => Math.abs(cue.time - at) < 0.35);
    assert.deepEqual(
      pose.map((c) => c.sfx),
      [],
      `un souffle tombe à ${at.toFixed(2)} s, par-dessus une voix que le rush porte déjà`,
    );
  }
});

test('deux contenus différents ne reçoivent pas la même suite de bruitages', () => {
  const muets = Array.from({ length: 12 }, (_, i) => rush(`muet${i}`, 6, false));
  const sonores = Array.from({ length: 12 }, (_, i) => rush(`sonore${i}`, 6, true));

  const suite = (assets: MediaAsset[]) =>
    buildAutoEdit(assets)
      .cues.map((c) => c.sfx)
      .join(',');

  assert.notEqual(
    suite(muets),
    suite(sonores),
    'même suite de bruitages sur deux contenus opposés : le choix ne dépend que de la position du plan',
  );
});

// -- Le découpage manuel ----------------------------------------------------

/*
 * « Quand l'utilisateur clique plusieurs fois pour couper un plan, rien
 * n'indique quand s'arrêter. Résultat vécu : une vidéo de cinquante secondes
 * fractionnée en cinquante plans n'importe comment. »
 *
 * Le seul garde-fou existant était `MIN_CLIP_DURATION`, 0,3 s : il empêche un
 * fragment invisible, et rien de plus. Cinquante plans d'une seconde le
 * passent tous, alors que `analysis.ts` tient qu'un plan doit durer au moins
 * 1,1 s — il le dira plus tard, dans une note qu'il faut aller ouvrir.
 */
test('le sur-découpage lève une alerte, et elle dit quoi faire', () => {
  const long = clipDe(50);

  // Un seul plan de cinquante secondes : trop long, mais pas sur-découpé.
  assert.equal(alerteSurDecoupage([long]), null, 'un plan entier ne se signale pas');

  // Le même, coupé en morceaux de 2 s : dans la bande, rien à signaler.
  assert.equal(alerteSurDecoupage(morceaux(50, 25)), null, '2,0 s par plan tient la bande');

  // Le cas vécu : cinquante coupes sur cinquante secondes.
  const alerte = alerteSurDecoupage(morceaux(50, 50));
  assert.ok(alerte, 'cinquante plans d’une seconde ne lèvent rien');
  assert.match(alerte, /50/, 'l’alerte ne dit pas combien de plans il y a');
  assert.match(alerte, /1[,.]1/, 'l’alerte ne rappelle pas le seuil que le produit se donne');
});
