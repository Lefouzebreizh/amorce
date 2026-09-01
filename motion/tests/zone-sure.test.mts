import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONE, CARTON_LARGEUR_PCT, boiteCentree } from '../src/zone.ts';

/**
 * Ce que ces tests gardent.
 *
 * `motion/` n'avait aucun test. Son invariant — la zone sûre câblée dans le
 * code — est pourtant le seul qui soit adossé à un défaut RÉELLEMENT PUBLIÉ :
 * sur l'épisode 1, « THE SHADOW TITAN AWAKENS » avait été étiré de 9,8 % à
 * 94,7 % pour tenir sur une ligne, et Facebook en mangeait la gauche.
 *
 * Les valeurs ci-dessous ne se déduisent d'aucune charte : elles sont relevées
 * sur le Redmi Note 12 Plus. Un test qui les recalculerait ne garderait rien —
 * il faut qu'il les CONSTATE, pour qu'une retouche distraite se voie.
 */

test('les bornes sont celles relevées sur le terrain, au chiffre près', () => {
  assert.equal(ZONE.hautPct, 12, 'barre système Facebook');
  assert.equal(ZONE.basPct, 45, 'colonne de droite TikTok');
  assert.equal(ZONE.gauchePct, 22, 'boutons de gauche Facebook (14 à 22 %)');
  assert.equal(ZONE.droitePct, 88, 'bord droit, rogné par un écran arrondi');
});

test('la zone sûre n’est pas centrée sur le cadre — c’est le piège', () => {
  const centre = (ZONE.gauchePct + ZONE.droitePct) / 2;
  assert.equal(centre, 55);
  assert.notEqual(centre, 50);
  // Une boîte de même largeur mais centrée déborde à gauche de 5 points, et
  // atterrit dans la bande des boutons Facebook. C'est l'erreur qu'on fait
  // quand on lit « 66 % de large » sans lire « de 22 à 88 ».
  const centree = boiteCentree(ZONE.droitePct - ZONE.gauchePct);
  assert.equal(ZONE.gauchePct - centree.gauchePct, 5);
  assert.ok(centree.gauchePct < ZONE.gauchePct);
});

test('le défaut de l’épisode 1 tombe hors des bornes, des deux côtés', () => {
  const defaut = { gauchePct: 9.8, droitePct: 94.7 };
  assert.ok(defaut.gauchePct < ZONE.gauchePct, 'mangé à gauche par Facebook');
  assert.ok(defaut.droitePct > ZONE.droitePct, 'au ras du bord à droite');

  // Le titre voisin, à la même police, tenait : la parade n'est donc pas de
  // rapetisser la police, c'est de fixer la boîte.
  const tenait = { gauchePct: 26.9, droitePct: 70.3 };
  assert.ok(tenait.gauchePct >= ZONE.gauchePct);
  assert.ok(tenait.droitePct <= ZONE.droitePct);
});

test('la hauteur n’est jamais le facteur limitant — la largeur l’est toujours', () => {
  // `titre.tsx` : 82 px d'œil, interligne 1,12, sur un cadre de 1920.
  const CADRE_H = 1920;
  const ligne = 82 * 1.12;
  const dispoPct = ZONE.basPct - ZONE.hautPct;
  const lignes = Math.floor((dispoPct / 100) * CADRE_H / ligne);
  assert.equal(dispoPct, 33);
  // SIX lignes, mesuré — pas un seuil confortable posé au jugé. Un titre qui
  // passe à la ligne en demande deux, trois dans le pire des cas relevés.
  assert.equal(lignes, 6);
  assert.ok(lignes > 3, 'la marge en hauteur reste large devant le pire cas');
});

test('le carton de fin partage la largeur, jamais la position', () => {
  assert.equal(CARTON_LARGEUR_PCT, ZONE.droitePct - ZONE.gauchePct);

  const carton = boiteCentree(CARTON_LARGEUR_PCT);
  assert.equal(carton.gauchePct, 17);
  assert.equal(carton.droitePct, 83);

  // L'écart est CONSTATÉ, pas interdit : le carton est une carte de fin plein
  // écran, pas un titre posé sur un rush, et le centrer est un choix. Ce test
  // existe pour qu'on ne puisse plus le changer sans le décider.
  assert.equal(ZONE.gauchePct - carton.gauchePct, 5);
  assert.ok(carton.gauchePct < ZONE.gauchePct, 'entre dans la bande Facebook');
  assert.ok(carton.droitePct < ZONE.droitePct, 'et laisse 5 points inutilisés à droite');
});
