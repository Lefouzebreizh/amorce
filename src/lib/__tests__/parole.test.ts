import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEPARATION,
  correlation,
  energieParFenetre,
  sonAligne,
  suivrePistes,
  sujetQuiParle,
  type Mesure,
} from '../parole.ts';

const mesure = (centre: number, bouche: number, largeur = 60): Mesure => ({ centre, largeur, bouche });

/* ------------------------------------------------------------------ corrélation */

test('deux séries qui montent ensemble corrèlent à 1', () => {
  assert.ok(Math.abs(correlation([1, 2, 3, 4], [2, 4, 6, 8])! - 1) < 1e-9);
});

test('deux séries opposées corrèlent à −1', () => {
  assert.ok(Math.abs(correlation([1, 2, 3, 4], [8, 6, 4, 2])! + 1) < 1e-9);
});

test('une série constante ne corrèle avec rien, et le dit', () => {
  // `null` et non zéro : un son plat ou un visage immobile ne portent aucune
  // information, et rendre zéro les ferait passer pour mesurés.
  assert.equal(correlation([1, 1, 1, 1], [1, 2, 3, 4]), null);
  assert.equal(correlation([1, 2, 3, 4], [5, 5, 5, 5]), null);
  assert.equal(correlation([3], [4]), null, 'un seul point ne fait pas une série');
});

/* ------------------------------------------------------------ qui parle */

/** Le son : deux syllabes séparées par un silence. */
const SON = [0, 0.8, 0.9, 0, 0, 0.7, 0.85, 0];

test('le visage qui remue pendant le son est choisi, pas le plus grand', () => {
  // C'est le défaut que la planche a montré : la plus grande boîte gagnait.
  // Ici, `sujetQuiParle` ne connaît même pas les tailles — il ne regarde que
  // le rapport au son, et c'est tout l'objet du module.
  const parle = { centre: 300, remuement: [0, 0.9, 0.8, 0, 0, 0.85, 0.9, 0] };
  const immobile = { centre: 900, remuement: [0, 0, 0, 0, 0, 0, 0, 0] };
  assert.equal(sujetQuiParle([parle, immobile], SON), 300);
});

test('un visage qui remue tout le temps n’est pas un locuteur', () => {
  // Quelqu'un qui marche au fond du plan : il bouge autant pendant les
  // silences, donc il ne corrèle pas — et c'est exactement ce qui le sépare
  // d'une bouche.
  const marche = { centre: 900, remuement: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8] };
  assert.equal(sujetQuiParle([marche], SON), null);
});

test('deux visages qui corrèlent autant ne se départagent pas', () => {
  const un = { centre: 200, remuement: [0, 0.9, 0.8, 0, 0, 0.85, 0.9, 0] };
  const deux = { centre: 800, remuement: [0, 0.88, 0.82, 0, 0, 0.84, 0.88, 0] };
  assert.equal(sujetQuiParle([un, deux], SON), null, 'on préfère dire qu’on ne sait pas');
});

test('un seul candidat positif l’emporte sans avoir à dépasser personne', () => {
  const seul = { centre: 640, remuement: [0, 0.9, 0.8, 0, 0, 0.85, 0.9, 0] };
  const contre = { centre: 100, remuement: [0.9, 0, 0, 0.9, 0.9, 0, 0, 0.9] };
  // `contre` remue pendant les silences : corrélation négative, donc écarté —
  // ce n'est pas un candidat faible, c'est un indice contre lui.
  assert.equal(sujetQuiParle([seul, contre], SON), 640);
});

test('sans le moindre son mesurable, personne n’est déclaré locuteur', () => {
  const parle = { centre: 300, remuement: [0, 0.9, 0.8, 0, 0, 0.85, 0.9, 0] };
  assert.equal(sujetQuiParle([parle], [0, 0, 0, 0, 0, 0, 0, 0]), null);
});

test('la marge de départage vaut quelque chose', () => {
  // Sans elle, deux corrélations à un millième près se départageraient, et le
  // cadrage partirait au hasard d'un plan à l'autre.
  assert.ok(SEPARATION > 1.2, `séparation à ${SEPARATION} : le départage ne tient plus`);
});

/* -------------------------------------------------------------- les pistes */

test('un visage qui bouge peu reste la même piste', () => {
  const { pistes } = suivrePistes(
    [
      [mesure(300, 100)],
      [mesure(310, 140)],
      [mesure(322, 105)],
      [mesure(330, 150)],
      [mesure(341, 100)],
    ],
    20,
  );
  assert.equal(pistes.length, 1);
  assert.equal(pistes[0].centre, 300, 'la piste garde sa position de départ');
  assert.deepEqual(pistes[0].remuement, [40, 35, 45, 50]);
});

test('un visage qui saute plus loin que sa largeur rompt sa piste', () => {
  /*
   * Ce n'est plus le même visage : une piste qui continuerait porterait le
   * remuement de deux personnes et corrélerait avec n'importe quoi.
   *
   * La suite est **longue après le saut**, et c'est ce qui rend ce test
   * capable de rougir. Premier jet : trois échantillons puis un saut. La borne
   * retirée, la piste continuait — mais s'arrêtait quand même à trois écarts,
   * sous le plancher de quatre, donc écartée pareil. Le test rendait le même
   * résultat avec et sans la borne, c'est-à-dire rien. Vérifié en supprimant
   * la comparaison à `largeur` : zéro échec.
   */
  const { pistes } = suivrePistes(
    [
      [mesure(300, 100, 60)],
      [mesure(310, 120)],
      [mesure(320, 130)],
      [mesure(900, 140)],
      [mesure(905, 150)],
      [mesure(910, 160)],
      [mesure(915, 170)],
      [mesure(920, 180)],
    ],
    20,
  );
  assert.equal(pistes.length, 0, 'la piste meurt au saut, et ce qui suit est un autre visage');
});

test('deux pistes qui visent la même boîte ne la prennent pas toutes les deux', () => {
  /*
   * Sans appariement exclusif, les deux pistes se collent au même visage et
   * portent le **même** remuement : elles corrèlent alors identiquement, et le
   * départage de `sujetQuiParle` n'a plus rien à départager.
   *
   * Il faut une vraie collision pour l'éprouver, et le premier jet n'en créait
   * aucune : deux visages écartés de quarante pixels gardent chacun leur plus
   * proche, exclusivité ou non — le test rendait le même résultat dans les deux
   * cas. Vérifié en retirant l'exclusivité : zéro échec.
   *
   * Ici les deux pistes partent à trente pixels l'une de l'autre et il ne reste
   * qu'**une** boîte atteignable au deuxième échantillon. Avec exclusivité, la
   * première la prend et la seconde meurt faute de candidat ; sans, les deux la
   * prennent et survivent avec le même remuement.
   */
  const { pistes } = suivrePistes(
    [
      [mesure(300, 100), mesure(330, 200)],
      [mesure(325, 140), mesure(1500, 200)],
      [mesure(330, 100), mesure(1505, 200)],
      [mesure(335, 150), mesure(1510, 200)],
      [mesure(340, 100), mesure(1515, 200)],
      [mesure(345, 160), mesure(1520, 200)],
    ],
    20,
  );

  /*
   * On compte les survivantes, et non l'égalité des remuements : deux pistes
   * collées au même visage partent de luminances différentes, donc leur
   * **premier** écart diffère quand même — comparer les tableaux entiers ne
   * séparait pas les deux cas. Deuxième sonde verte sur le défaut dans ce même
   * fichier, et la même cause à chaque fois : elle mesurait une grandeur qui ne
   * bougeait pas entre les deux mondes.
   */
  assert.equal(pistes.length, 1, 'la seconde meurt faute de boîte libre');
  assert.equal(pistes[0].centre, 300, 'c’est la première qui a pris la boîte');
});

test('une piste trop courte est écartée plutôt que mal mesurée', () => {
  const { pistes } = suivrePistes([[mesure(300, 100)], [mesure(305, 120)]], 20);
  assert.deepEqual(pistes, [], 'deux points ne font pas une corrélation');
});

test('le suivi ne dépasse pas sa fenêtre', () => {
  const longs = Array.from({ length: 40 }, (_, i) => [mesure(300 + i, 100 + (i % 2) * 30)]);
  const { pistes } = suivrePistes(longs, 10);
  assert.equal(pistes[0].remuement.length, 9, 'dix échantillons, neuf écarts');
});

test('un plan sans aucun visage ne rend aucune piste', () => {
  assert.deepEqual(suivrePistes([[], [], []], 20).pistes, []);
});

/* --------------------------------------------------------------- l’énergie */

test('l’énergie suit le niveau du signal, fenêtre par fenêtre', () => {
  // Deux secondes à 100 Hz, dix fenêtres par seconde : dix échantillons par
  // fenêtre. La première moitié est forte, la seconde muette.
  const canal = new Float32Array(200);
  for (let i = 0; i < 100; i++) canal[i] = 0.5;
  const energie = energieParFenetre(canal, 100, 10, 20);

  assert.equal(energie.length, 20);
  assert.ok(Math.abs(energie[0] - 0.5) < 1e-6, 'fenêtre pleine');
  assert.equal(energie[15], 0, 'fenêtre muette');
});

test('une piste sonore plus courte que l’image rend du silence, pas une erreur', () => {
  const energie = energieParFenetre(new Float32Array(50), 100, 10, 20);
  assert.equal(energie.length, 20);
  assert.ok(energie.every((v) => v === 0));
});


/* ------------------------------------------------------------ l’alignement */

/*
 * Le décalage qui ne lève rien.
 *
 * Un plan peut commencer sans personne dans le champ. Le suivi démarre alors
 * plus loin, et le son doit être pris **au même endroit**. Aligné sur le début
 * du plan, on compare une bouche au son d'un autre instant : la corrélation
 * s'effondre, personne n'est déclaré locuteur, et le pis-aller reprend la main
 * sans qu'aucune erreur n'apparaisse nulle part. C'est le pire genre de défaut
 * — celui qui se contente de rendre la mesure muette.
 */
test('le son se prend là où le suivi commence, pas au début du plan', () => {
  // Personne pendant trois échantillons, puis un visage qui remue au rythme
  // du son. Le son, lui, court depuis le début du plan.
  const vide: Mesure[] = [];
  const bouches = [
    vide,
    vide,
    vide,
    [mesure(400, 100)],
    [mesure(402, 160)],
    [mesure(404, 100)],
    [mesure(406, 165)],
    [mesure(408, 100)],
    [mesure(410, 170)],
  ];
  //            0    1    2    3    4     5    6     7    8
  const son = [0.9, 0.9, 0.9, 0, 0.8, 0.05, 0.85, 0.05, 0.9];

  const suivi = suivrePistes(bouches, 20);
  assert.equal(suivi.depart, 3, 'le suivi commence au premier visage');

  const aligne = sonAligne(son, suivi.depart, 20);
  assert.deepEqual(aligne, [0.8, 0.05, 0.85, 0.05, 0.9], 'le son suit le visage');
  assert.equal(sujetQuiParle(suivi.pistes, aligne), 400);

  // Et la preuve que l'alignement décide : pris depuis le début du plan, le
  // même visage cesse d'être reconnu comme locuteur.
  const decale = son.slice(0, suivi.pistes[0].remuement.length);
  assert.equal(sujetQuiParle(suivi.pistes, decale), null, 'décalé, on ne reconnaît plus personne');
});
