import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOMINANCE, cadrageDepuisBoites, centreDuSujet, type Boite } from '../detection.ts';

const boite = (x: number, taille: number): Boite => ({ x, y: 100, largeur: taille, hauteur: taille });

test('sans aucun visage, il n’y a pas de sujet', () => {
  assert.equal(centreDuSujet([]), null);
  assert.equal(centreDuSujet([], 300), null);
});

test('sans histoire, le plus grand visage l’emporte — faute de mieux', () => {
  // C'est la règle dont la planche a montré qu'elle se trompe sur un vrai
  // rush. Elle reste le premier choix parce qu'il n'y a rien d'autre à
  // regarder tant qu'on n'a pas mesuré qui parle : ce test fige l'état des
  // lieux, il ne le célèbre pas.
  assert.equal(centreDuSujet([boite(100, 40), boite(400, 90)]), 445);
});

/*
 * La continuité, qui est la moitié réparable sans écouter le son.
 *
 * Un visage d'arrière-plan légèrement plus grand ne doit pas voler le cadrage
 * en cours de plan : c'est ce qui fait balayer la caméra d'un sujet à l'autre
 * au milieu d'une phrase.
 */
test('un sujet suivi n’est pas volé par un visage à peine plus grand', () => {
  const suivi = boite(300, 80);
  const fond = boite(900, 100); // 1,56 fois la surface : pas assez
  assert.equal(centreDuSujet([suivi, fond], 340), 340);
});

test('un visage franchement plus grand reprend la main', () => {
  const suivi = boite(300, 80);
  const devant = boite(900, Math.ceil(80 * Math.sqrt(DOMINANCE)) + 1);
  const centre = centreDuSujet([suivi, devant], 340);
  assert.ok(centre !== null && centre > 900, 'le sujet au premier plan est pris');
});

test('le sujet suivi est repris même s’il a bougé', () => {
  // Trois visages, celui du milieu est le nôtre : on le retrouve à sa nouvelle
  // position plutôt que de sauter au plus grand.
  const centre = centreDuSujet([boite(50, 70), boite(420, 70), boite(1200, 75)], 400);
  assert.equal(centre, 455);
});

test('les boîtes sont ramenées aux pixels de la source', () => {
  // Analyse en 480 de large pour une source en 1920 : facteur 4.
  const cadrage = cadrageDepuisBoites(
    [[boite(100, 60)], [boite(100, 60)], [boite(100, 60)]],
    { largeurSource: 1920, hauteurSource: 1080, parSeconde: 10, echelle: 4 },
  );
  assert.equal(cadrage.parSeconde, 10);
  assert.equal(cadrage.centres.length, 3);
  // 100 + 30 = 130 dans l'image analysée, donc 520 dans la source.
  assert.equal(cadrage.centres[0], 520, 'la conversion d’échelle est appliquée');
  // Et 520 tient dans les bornes : la demi-fenêtre visible vaut 303,75, donc
  // rien n'est rogné ici. Le premier jet de ce test attendait 303,75 en croyant
  // que ça débordait — l'erreur était dans l'attente, pas dans le calcul.
  assert.notEqual(cadrage.centres[0], 607.5 / 2);
});

test('un échantillon sans visage n’efface pas le sujet, il le laisse tenir', () => {
  const avec = [boite(1400, 80)];
  const cadrage = cadrageDepuisBoites(
    [avec, [], [], avec, avec],
    { largeurSource: 1920, hauteurSource: 1080, parSeconde: 10, echelle: 1 },
  );
  // La trajectoire couvre bien les cinq échantillons, sans trou.
  assert.equal(cadrage.centres.length, 5);
  assert.ok(cadrage.centres.every((c) => Number.isFinite(c)));
});

test('aucun visage nulle part rend le centre, sans planter', () => {
  const cadrage = cadrageDepuisBoites(
    [[], [], []],
    { largeurSource: 1920, hauteurSource: 1080, parSeconde: 10, echelle: 4 },
  );
  assert.deepEqual(cadrage.centres, [960, 960, 960]);
});


/*
 * Le démarrage à froid, et c'est le défaut que la planche avait montré.
 *
 * Ces trois tests sont l'exact contraire de « sans histoire, le plus grand
 * visage l'emporte » plus haut : celui-là fige un pis-aller, ceux-ci vérifient
 * qu'on ne s'en contente plus quand la mesure sait dire mieux.
 */
test('au démarrage, celui qui parle passe devant le plus grand', () => {
  const petitQuiParle = boite(300, 40);
  const grandQuiSeTait = boite(900, 120);
  // Sans `parlant`, c'est le grand — la règle qu'un vrai rush a démentie.
  assert.equal(centreDuSujet([petitQuiParle, grandQuiSeTait]), 960);
  // Avec, c'est celui qui parle, et la dominance ne le lui reprend pas.
  assert.equal(centreDuSujet([petitQuiParle, grandQuiSeTait], undefined, 320), 320);
});

test('le locuteur désigné ne se fait pas voler par une boîte trois fois plus grande', () => {
  // La dominance gouverne la **suite** d'un plan, jamais son premier choix :
  // l'y appliquer rendrait tout le module inutile, puisque le défaut d'origine
  // est précisément qu'un visage plus grand emportait le morceau.
  const parle = boite(200, 30);
  const enorme = boite(800, 300);
  assert.equal(centreDuSujet([parle, enorme], undefined, 215), 215);
});

test('un locuteur désigné hors champ retombe sur le visage le plus proche', () => {
  // La position vient d'un échantillon antérieur : la personne a pu bouger.
  // On vise le plus proche plutôt que d'abandonner, sinon la mesure la plus
  // coûteuse du module serait jetée au premier pas de côté.
  assert.equal(centreDuSujet([boite(100, 50), boite(700, 50)], undefined, 680), 725);
});

test('la trajectoire porte le locuteur jusqu’au rendu', () => {
  // Le bout en bout de la partie calculable : deux visages, le petit parle,
  // et la trajectoire doit partir de lui — pas du gros.
  const petit = boite(200, 40);
  const gros = boite(1400, 160);
  const cadrage = cadrageDepuisBoites([[petit, gros], [petit, gros], [petit, gros]], {
    largeurSource: 1920,
    hauteurSource: 1080,
    parSeconde: 10,
    echelle: 1,
    parlant: 220,
  });
  assert.ok(
    cadrage.centres[0] < 700,
    `la caméra part à ${cadrage.centres[0]}, donc vers le gros visage`,
  );
});
