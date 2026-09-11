import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detecterCrise } from './crisisDetection';

// Ces tests couvrent la liste de motifs telle qu'écrite dans la note
// d'initialisation du projet — ils prouvent que le code fait ce que la note
// demande, pas que la liste est cliniquement juste ou complète. Cette
// deuxième chose ne se mesure pas par des tests unitaires : elle demande un
// professionnel de santé mentale (voir TODO.md, couche 4).

test("un message anodin ne déclenche rien", () => {
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
    const resultat = detecterCrise([exemple]);
    assert.equal(resultat.niveau, 'fort', `"${exemple}" aurait dû déclencher le niveau fort`);
  }
});

test('la mention d\'un plan ou d\'un moyen déclenche le niveau fort', () => {
  const exemples = [
    "j'ai les médicaments qu'il faut",
    "j'ai tout préparé",
    'ce soir c\'est le bon moment',
    'je vais me pendre',
  ];
  for (const exemple of exemples) {
    const resultat = detecterCrise([exemple]);
    assert.equal(resultat.niveau, 'fort', `"${exemple}" aurait dû déclencher le niveau fort`);
  }
});

test('les motifs contenant des doubles lettres survivent au ramenage à une seule occurrence', () => {
  // Régression : la normalisation ramène "immeuble" à "imeuble" et
  // "arrangera" à "arangera" avant comparaison — les motifs eux-mêmes
  // doivent être écrits sous leur forme déjà ramenée, sans quoi ils ne
  // matchent plus jamais leur propre texte normalisé.
  assert.equal(detecterCrise(['je vais sauter du immeuble']).niveau, 'fort');
  assert.equal(detecterCrise(["ça ne s'arrangera jamais"]).niveau, 'modere');
});

test('les variantes phonétiques données en exemple déclenchent aussi', () => {
  assert.equal(detecterCrise(['jve mourir']).niveau, 'fort');
  assert.equal(detecterCrise(['jeveu plus vivre']).niveau, 'fort');
});

test('les fautes de frappe par lettres répétées ne cassent pas la détection', () => {
  assert.equal(detecterCrise(['je veux mourrrrir']).niveau, 'fort');
});

test('le signal peut apparaître dans un message antérieur, pas seulement le dernier', () => {
  const conversation = [
    'je voulais juste dire bonjour',
    'je pense au suicide depuis ce matin',
    "et sinon aujourd'hui il fait beau",
  ];
  const resultat = detecterCrise(conversation);
  assert.equal(resultat.niveau, 'fort');
});

test('la négation directe ("je ne veux plus vivre") déclenche', () => {
  const resultat = detecterCrise(['je ne veux plus vivre']);
  assert.equal(resultat.niveau, 'fort');
});

test('la négation inversée ("je ne veux pas mourir") déclenche aussi, en modéré', () => {
  const resultat = detecterCrise(['je ne veux pas mourir']);
  assert.equal(resultat.niveau, 'modere');
  assert.ok(resultat.motifs.includes('négation inversée (peur de mourir)'));
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

test('les six tournures de désespoir/fardeau déclenchent le niveau modéré', () => {
  const exemples = [
    'je sers à rien',
    'tout le monde irait mieux sans moi',
    'je suis un poids pour tout le monde',
    "ça ne s'arrangera jamais",
    "je n'en peux plus",
    'je vois pas comment continuer',
  ];
  for (const exemple of exemples) {
    const resultat = detecterCrise([exemple]);
    assert.equal(resultat.niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});

test("l'épuisement isolé (une seule fois) ne déclenche rien", () => {
  const resultat = detecterCrise(['je suis épuisée en ce moment']);
  assert.equal(resultat.niveau, 'aucun');
});

test("l'épuisement répété (deux fois dans la conversation) déclenche le niveau modéré", () => {
  const resultat = detecterCrise([
    'je suis épuisée en ce moment',
    "aujourd'hui ça va un peu mieux",
    'je suis épuisée, encore',
  ]);
  assert.equal(resultat.niveau, 'modere');
});

test('le niveau fort prime sur un signal modéré présent dans la même conversation', () => {
  const resultat = detecterCrise(["je sers à rien", 'je veux en finir']);
  assert.equal(resultat.niveau, 'fort');
});

test('les motifs déclencheurs sont rendus pour le journal, sans texte brut de la personne', () => {
  const resultat = detecterCrise(['je veux mourir']);
  assert.ok(resultat.motifs.includes('veut mourir'));
});
