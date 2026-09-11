import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detecterCrise } from './crisisDetection';

// Ces tests couvrent la liste de phrases telle qu'écrite dans la note
// d'initialisation du projet — ils prouvent que le code fait ce que la note
// demande, jamais que la liste est cliniquement juste ou complète. Cette
// deuxième chose ne se mesure pas par des tests unitaires : elle demande un
// professionnel de santé mentale (voir TODO.md, couche 4).

test('un message anodin ne déclenche rien', () => {
  const resultat = detecterCrise(["j'ai passé une journée difficile au travail"]);
  assert.equal(resultat.niveau, 'aucun');
  assert.deepEqual(resultat.motifs, []);
});

test('les neuf tournures explicites du niveau fort déclenchent', () => {
  const exemples = [
    'je veux mourir',
    "j'ai envie de mourir",
    'je veux en finir',
    "j'ai plus envie de vivre",
    'je vais me suicider',
    'je vais me tuer',
    'je pense au suicide',
    'je veux disparaître',
    'je veux partir pour de bon',
  ];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'fort', `"${exemple}" aurait dû déclencher le niveau fort`);
  }
});

test("la mention d'un plan ou d'un moyen déclenche le niveau fort", () => {
  const exemples = [
    "j'ai les médicaments qu'il faut",
    "j'ai tout préparé",
    "ce soir c'est le bon moment",
    'je vais me pendre',
    'je veux me couper les veines',
  ];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'fort', `"${exemple}" aurait dû déclencher le niveau fort`);
  }
});

test('les motifs contenant des doubles lettres survivent au repli des répétitions', () => {
  // Régression, et elle a changé de nature le 11/09/2026. La normalisation
  // ramène « immeuble » à « imeuble » et « arrangera » à « arangera » avant
  // comparaison. La première parade avait été d'écrire les motifs eux-mêmes
  // sous leur forme déjà repliée — ce qui marchait, mais laissait dans le
  // code des fautes apparentes (« imeuble », « arangera ») qu'un relecteur
  // « corrigerait » de bonne foi, cassant la détection en silence. Or ce
  // relecteur est justement le professionnel de santé mentale de la couche 4.
  //
  // La parade actuelle est structurelle : `compiler()` fait passer les motifs
  // par la MÊME normalisation que les messages, donc ils s'écrivent en
  // français correct et ne peuvent plus se désaccorder.
  assert.equal(detecterCrise(["ça ne s'arrangera jamais"]).niveau, 'modere');
  assert.equal(detecterCrise(['je vais sauter du immeuble']).niveau, 'fort');
  // La tournure correcte, qui ne matchait PAS la première version : son motif
  // exigeait « du ».
  assert.equal(detecterCrise(["je vais sauter de l'immeuble"]).niveau, 'fort');
});

test('les variantes phonétiques données en exemple déclenchent aussi', () => {
  assert.equal(detecterCrise(['jve mourir']).niveau, 'fort');
  assert.equal(detecterCrise(['jeveu plus vivre']).niveau, 'fort');
});

test('les fautes de frappe par lettres répétées ne cassent pas la détection', () => {
  assert.equal(detecterCrise(['je veux mourrrrir']).niveau, 'fort');
});

test('le signal peut apparaître dans un message antérieur, pas seulement le dernier', () => {
  const resultat = detecterCrise([
    'je voulais juste dire bonjour',
    'je pense au suicide depuis ce matin',
    "et sinon aujourd'hui il fait beau",
  ]);
  assert.equal(resultat.niveau, 'fort');
});

test('la négation directe ("je ne veux plus vivre") déclenche', () => {
  const resultat = detecterCrise(['je ne veux plus vivre']);
  assert.equal(resultat.niveau, 'fort');
});

test('la négation inversée ("je ne veux pas mourir") déclenche aussi, en modéré', () => {
  const resultat = detecterCrise(['je ne veux pas mourir']);
  assert.equal(resultat.niveau, 'modere');
  assert.ok(resultat.motifs.includes('veux pas mourir'));
});

test('faux positif connu et assumé : "mourir bête" (tournure familière sans rapport) déclenche aussi', () => {
  // Documenté plutôt que corrigé : la note d'initialisation pose « en cas de
  // doute, on déclenche — un faux positif est gênant, un faux négatif est
  // inacceptable ». Exclure cette tournure demanderait une liste
  // d'exceptions qui n'a pas sa place dans une liste de motifs non encore
  // validée par un professionnel (voir TODO.md).
  const resultat = detecterCrise(['je veux pas mourir bête, explique-moi comment ça marche']);
  assert.equal(resultat.niveau, 'modere');
});

test('les six tournures de désespoir ou de fardeau déclenchent le niveau modéré', () => {
  const exemples = [
    'je sers à rien',
    'tout le monde irait mieux sans moi',
    'je suis un poids pour tout le monde',
    "ça ne s'arrangera jamais",
    "je n'en peux plus",
    'je vois pas comment continuer',
  ];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});

test("l'épuisement isolé, une seule fois, ne déclenche rien", () => {
  assert.equal(detecterCrise(['je suis épuisée en ce moment']).niveau, 'aucun');
});

test("l'épuisement répété dans deux messages déclenche le niveau modéré", () => {
  const resultat = detecterCrise([
    'je suis épuisée en ce moment',
    "aujourd'hui ça va un peu mieux",
    'je suis épuisée, encore',
  ]);
  assert.equal(resultat.niveau, 'modere');
  assert.ok(resultat.motifs.includes('épuisement extrême répété'));
});

test('le niveau fort prime sur un signal modéré présent dans la même conversation', () => {
  assert.equal(detecterCrise(['je sers à rien', 'je veux en finir']).niveau, 'fort');
});

test('les motifs rendus sont les phrases de la liste, jamais le texte de la personne', () => {
  const resultat = detecterCrise(['je veux mourir, je suis désolée de te dire ça comme ça']);
  assert.deepEqual(resultat.motifs, ['je veux mourir']);
});
