import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONFIRMATIONS,
  VITESSE_LENTE,
  VITESSE_RAPIDE,
  ZONE_MORTE,
  centreA,
  decalage,
  largeurVisible,
  trajectoire,
  type Visee,
} from '../cadrage.ts';
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from '../types.ts';

/** Le cas réel : un rush 16:9 ramené en 9:16. */
const PAYSAGE = { largeurSource: 1920, hauteurSource: 1080 };

function suivre(visees: Visee[], images: number, coupes?: number[]) {
  return trajectoire(visees, { ...PAYSAGE, images, coupes });
}

test('un rush 16:9 ne garde que 607,5 px de large sur 1920', () => {
  assert.equal(largeurVisible(1920, 1080), (1080 / 1920) * 1080);
  assert.ok(Math.abs(largeurVisible(1920, 1080) - 607.5) < 0.01);
});

test('une source déjà verticale n’a aucun côté à perdre', () => {
  // Le recouvrement vaut 1 : tout est visible, il n'y a rien à recadrer.
  assert.equal(largeurVisible(OUTPUT_WIDTH, OUTPUT_HEIGHT), OUTPUT_WIDTH);
});

/*
 * Le comportement d'avant doit survivre à ce module. Un rush sans détection
 * reste centré — sans quoi ajouter le cadrage changerait l'aspect de tous les
 * montages déjà faits.
 */
test('sans aucune visée, la trajectoire est le centre, image après image', () => {
  const piste = suivre([], 5);
  assert.deepEqual(piste, [960, 960, 960, 960, 960]);
  assert.equal(decalage(960, 1920, 1080), 0);
});

test('la première visée d’un plan est prise sans être amortie', () => {
  // Sinon le premier plan démarre au centre et rejoint le sujet en glissant :
  // c'est le torse sans tête pendant une seconde et demie.
  const piste = suivre([{ image: 0, centre: 600 }], 3);
  assert.equal(piste[0], 600, 'coupée, pas rejointe');
  assert.equal(piste[1], 600);
});

/*
 * Le trépied, éprouvé sur une distance **fixe** et non déduite de la constante.
 *
 * Premier jet de ce test : la sonde valait `visible * ZONE_MORTE * 0.9`. Mise
 * à zéro, la constante emmenait la sonde avec elle — la sonde tombait à zéro,
 * la caméra ne bougeait pas, et le test restait vert en ayant perdu ce qu'il
 * gardait. Vérifié en mettant ZONE_MORTE à 0 : 13 tests sur 13 au vert.
 *
 * 30 px sur une fenêtre visible de 607,5 en font 4,9 % : dedans quel que soit
 * un réglage raisonnable, dehors dès que la zone morte disparaît.
 */
test('un sujet qui bouge de 30 px ne fait pas bouger la caméra du tout', () => {
  const piste = suivre(
    [{ image: 0, centre: 960 }, { image: 1, centre: 990 }, { image: 2, centre: 990 }],
    4,
  );
  assert.deepEqual(piste, [960, 960, 960, 960], 'le trépied tient');
});

/*
 * Et son symétrique : la zone morte doit valoir *quelque chose*. Sans lui, on
 * pourrait la réduire à un cheveu et garder le test ci-dessus au vert.
 */
test('la zone morte couvre au moins un dixième de la fenêtre visible', () => {
  assert.ok(ZONE_MORTE >= 0.1, `zone morte à ${ZONE_MORTE} : le trépied ne tient plus`);
  const visible = largeurVisible(1920, 1080);
  // Un sujet à un dixième de la fenêtre reste dans la zone : mesure directe,
  // sans passer par la constante.
  const piste = suivre(
    [{ image: 0, centre: 960 }, { image: 1, centre: 960 + visible * 0.1 }, { image: 2, centre: 960 + visible * 0.1 }],
    4,
  );
  assert.deepEqual(piste, [960, 960, 960, 960]);
});

/*
 * Le réglage qui décide, et le test qui l'éprouve.
 *
 * Une seule mesure aberrante — un second visage, une boîte qui accroche autre
 * chose — ne doit pas déplacer le cadre. Chez OpenShorts, 22 % des mises à
 * jour de cible sautaient plus loin que toute la zone morte, et presque toutes
 * étaient fausses.
 */
test('un saut isolé ne déplace rien, le même saut répété trois fois déplace', () => {
  const isole = suivre(
    [{ image: 0, centre: 960 }, { image: 1, centre: 300 }, { image: 2, centre: 960 }],
    4,
  );
  assert.deepEqual(isole, [960, 960, 960, 960], 'une aberration ne bouge pas le cadre');

  const repete = suivre(
    [
      { image: 0, centre: 960 },
      ...Array.from({ length: CONFIRMATIONS }, (_, i) => ({ image: i + 1, centre: 300 })),
    ],
    6,
  );
  assert.ok(repete[5] < 960, 'un vrai déplacement finit par être suivi');
});

test('deux aberrations contradictoires ne se confirment pas l’une l’autre', () => {
  // Gauche, droite, gauche : trois grands sauts, aucun cohérent avec le
  // précédent. Le compteur repart à chaque fois.
  const piste = suivre(
    [
      { image: 0, centre: 960 },
      { image: 1, centre: 200 },
      { image: 2, centre: 1700 },
      { image: 3, centre: 200 },
    ],
    5,
  );
  assert.deepEqual(piste, [960, 960, 960, 960, 960]);
});

test('la caméra rattrape vite un écart de plus d’un demi-cadre, lentement sinon', () => {
  const visible = largeurVisible(1920, 1080);
  const loin = 960 - visible; // bien au-delà d'un demi-cadre
  const piste = suivre(
    [
      { image: 0, centre: 960 },
      ...Array.from({ length: CONFIRMATIONS }, (_, i) => ({ image: i + 1, centre: loin })),
    ],
    8,
  );
  const pas = piste.map((v, i) => (i === 0 ? 0 : Math.abs(v - piste[i - 1]))).filter((p) => p > 0);
  assert.ok(pas.length > 0, 'la caméra a bougé');
  assert.ok(
    pas.some((p) => p === VITESSE_RAPIDE),
    `un grand écart se rattrape à ${VITESSE_RAPIDE} px/image`,
  );
  assert.ok(pas.every((p) => p <= VITESSE_RAPIDE), 'jamais plus vite que le rattrapage');
});

test('la caméra ne dépasse jamais sa cible', () => {
  const visible = largeurVisible(1920, 1080);
  const cible = 960 - visible * ZONE_MORTE - VITESSE_LENTE * 1.5;
  const piste = suivre(
    [
      { image: 0, centre: 960 },
      ...Array.from({ length: CONFIRMATIONS }, (_, i) => ({ image: i + 1, centre: cible })),
    ],
    30,
  );
  assert.ok(piste.every((v) => v >= cible - 0.001), 'aucune image au-delà de la cible');
});

/*
 * La borne qui empêche une bande vide. Sans elle, un sujet collé au bord ferait
 * sortir le cadre de la source et le rendu montrerait du fond noir sur le côté
 * — exactement ce que le recouvrement existe pour éviter.
 */
test('le cadre ne sort jamais de la source, même sur un sujet au bord', () => {
  const visible = largeurVisible(1920, 1080);
  const demi = visible / 2;
  const piste = suivre(
    [
      { image: 0, centre: 0 },
      { image: 1, centre: 1920 },
      { image: 2, centre: 1920 },
      { image: 3, centre: 1920 },
      { image: 4, centre: 1920 },
    ],
    40,
  );
  for (const centre of piste) {
    assert.ok(centre >= demi - 0.001, `${centre} déborde à gauche`);
    assert.ok(centre <= 1920 - demi + 0.001, `${centre} déborde à droite`);
  }
});

test('une coupe cadre le nouveau plan tout de suite, sans le rejoindre', () => {
  const piste = suivre(
    [{ image: 0, centre: 1500 }, { image: 3, centre: 400 }],
    5,
    [3],
  );
  assert.equal(piste[0], 1500);
  assert.equal(piste[2], 1500, 'avant la coupe, rien ne bouge');
  assert.equal(piste[3], 400, 'à la coupe, on cadre net');
});

test('le décalage place le point visé au milieu du cadre', () => {
  const recouvrement = Math.max(OUTPUT_WIDTH / 1920, OUTPUT_HEIGHT / 1080);
  // Reproduit le calcul de `renderer.ts` : x = (OW - vw*c)/2 + dx, et le point
  // `centre` de la source est dessiné en x + centre*c.
  for (const centre of [304, 700, 960, 1300, 1616]) {
    const dx = decalage(centre, 1920, 1080);
    const x = (OUTPUT_WIDTH - 1920 * recouvrement) / 2 + dx;
    const ou = x + centre * recouvrement;
    assert.ok(Math.abs(ou - OUTPUT_WIDTH / 2) < 0.001, `${centre} n'atterrit pas au milieu`);
  }
});

/*
 * Le déterminisme, qui est la raison d'être de la trajectoire calculée
 * d'avance. Le rendu la lit dans le désordre — on recule la tête de lecture,
 * l'export encode image par image hors ligne — et doit obtenir la même image.
 */
test('la trajectoire ne dépend pas de l’ordre dans lequel on la lit', () => {
  const visees = [
    { image: 0, centre: 900 },
    { image: 4, centre: 400 },
    { image: 5, centre: 400 },
    { image: 6, centre: 400 },
    { image: 20, centre: 1500 },
    { image: 21, centre: 1500 },
    { image: 22, centre: 1500 },
  ];
  const piste = suivre(visees, 60);
  const rejouee = suivre([...visees].reverse(), 60);
  assert.deepEqual(rejouee, piste, 'l’ordre des visées données ne change rien');
  // Et deux calculs successifs rendent le même tableau, sans état résiduel.
  assert.deepEqual(suivre(visees, 60), piste);
});

test('le décalage suit l’échelle du moment', () => {
  const recouvrement = Math.max(OUTPUT_WIDTH / 1920, OUTPUT_HEIGHT / 1080);
  // Un zoom de 18 % : le point visé doit rester au milieu, pas glisser.
  for (const echelle of [1, 1.06, 1.12, 1.18]) {
    const dx = decalage(500, 1920, 1080, echelle);
    const cover = recouvrement * echelle;
    const x = (OUTPUT_WIDTH - 1920 * cover) / 2 + dx;
    assert.ok(
      Math.abs(x + 500 * cover - OUTPUT_WIDTH / 2) < 0.001,
      `à l’échelle ${echelle}, le sujet glisse`,
    );
  }
});

test('un rush sans trajectoire est lu au milieu, comme avant', () => {
  assert.equal(centreA(undefined, 3, 1920), 960);
  assert.equal(centreA({ parSeconde: 10, centres: [] }, 3, 1920), 960);
  assert.equal(centreA({ parSeconde: 0, centres: [700] }, 3, 1920), 960);
});

test('la lecture prend l’échantillon le plus proche et ne sort jamais du tableau', () => {
  const cadrage = { parSeconde: 10, centres: [100, 200, 300, 400, 500] };
  assert.equal(centreA(cadrage, 0, 1920), 100);
  assert.equal(centreA(cadrage, 0.2, 1920), 300);
  assert.equal(centreA(cadrage, 0.24, 1920), 300, 'au plus proche');
  assert.equal(centreA(cadrage, 0.26, 1920), 400);
  assert.equal(centreA(cadrage, 99, 1920), 500, 'au-delà de la fin, la dernière');
  assert.equal(centreA(cadrage, -5, 1920), 100, 'avant le début, la première');
});
