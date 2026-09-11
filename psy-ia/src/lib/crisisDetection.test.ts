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

// Régression du 11/09/2026 : ce message exact, tapé en production, n'avait
// rien déclenché. Deux causes cumulées — voir crisisDetection.ts et
// second-brain/lecons/ pour le détail : « idées noires » absent de toute
// liste, et un motif à deux mots exige une contiguïté stricte qu'un simple
// intensificateur suffit à casser.
test('"j\'ai des idées très noires", le message exact resté sans détection en production, déclenche désormais', () => {
  const resultat = detecterCrise(["j'ai des idées très noires"]);
  assert.equal(resultat.niveau, 'modere');
  assert.ok(resultat.motifs.includes('idées noires'));
});

test('les variantes directes autour de « idées noires » déclenchent aussi', () => {
  const exemples = ['des idées noires', 'plein de pensées noires', "j'ai des idées sombres", 'des pensées sombres'];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});

test('« idées suicidaires » et « pensées suicidaires » déclenchent le niveau fort, sans intensificateur ou avec', () => {
  const exemples = ['des idées suicidaires', "j'ai des pensées suicidaires", "j'ai vraiment des idées suicidaires"];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'fort', `"${exemple}" aurait dû déclencher le niveau fort`);
  }
});

test('un seul mot intercalé entre deux mots d\'un motif ne casse plus la détection', () => {
  // Le motif exact "je veux mourir" reste contigu ici, mais on vérifie le
  // mécanisme général sur un autre motif à deux mots.
  assert.equal(detecterCrise(['je veux vraiment en finir']).niveau, 'fort');
  // "plus envie de vivre" avec "aucune" intercalé entre "plus" et "envie" —
  // sans la tolérance, cette tournure très courante ("plus aucune envie de
  // vivre") ne matcherait pas.
  assert.equal(detecterCrise(["j'ai plus aucune envie de vivre"]).niveau, 'fort');
});

test('deux mots ou plus intercalés ne déclenchent toujours pas — la tolérance reste bornée à un seul mot', () => {
  const resultat = detecterCrise(['des idées un peu tristes et noires parfois']);
  assert.equal(resultat.niveau, 'aucun');
});

// Piège trouvé en écrivant la tolérance ci-dessus, avant même la fusion :
// sans exclusion, « je veux mourir » (FORT) matchait aussi « je ne veux pas
// mourir » (négation directe, MODÉRÉ) — « ne » et « pas » passaient chacun
// pour le mot intercalé toléré d'un des deux intervalles du motif FORT,
// inversant le sens de la phrase. Couvert aussi par le test de négation
// directe plus haut ; celui-ci documente explicitement pourquoi.
test('la tolérance à un mot intercalé ne doit jamais avaler une négation', () => {
  assert.equal(detecterCrise(['je ne veux pas mourir']).niveau, 'modere');
  assert.equal(detecterCrise(['je ne veux jamais mourir']).niveau, 'modere');
});

// Six cas trouvés le 11/09/2026 en confrontant la liste à une batterie de
// vingt formulations réalistes (directes, indirectes, avec fautes, avec
// intensificateurs) — demandée par Erwann après le bug signalé, pour ne pas
// se contenter d'un seul cas corrigé. Chacun documente un trou distinct.
test('« disparaître pour de bon » déclenche sans exiger le verbe « veux »', () => {
  assert.equal(detecterCrise(["j'aimerais disparaître pour de bon"]).niveau, 'fort');
});

test('« ne plus exister » déclenche, comme équivalent de « disparaître »', () => {
  assert.equal(detecterCrise(['je voudrais juste ne plus exister']).niveau, 'fort');
});

test('trois tournures de désespoir supplémentaires déclenchent le niveau modéré', () => {
  const exemples = [
    'je vois plus aucune raison de continuer',
    "j'ai plus goût à rien",
    'à quoi bon continuer comme ça',
  ];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});

test('la contraction phonétique « jv » (comme « jve ») est reconnue', () => {
  assert.equal(detecterCrise(['jv en finir ce soir']).niveau, 'fort');
});

// Second cas signalé par Erwann, testé en direct sur l'app après la fusion
// du premier correctif : « j'ai des envies bizarres ce soir j'ai peur »
// n'avait rien déclenché. Différent du premier bug (une expression connue
// absente d'une liste) : ici aucun mot seul n'est assez spécifique pour un
// motif, la peur ordinaire étant extrêmement fréquente. Le signal tient à
// la CO-OCCURRENCE de « peur » et d'une pulsion qualifiée de bizarre/
// étrange, dans le même message.
test('« peur » et « envie bizarre » ensemble dans le même message déclenchent le niveau modéré', () => {
  assert.equal(detecterCrise(["j'ai des envies bizarres ce soir j'ai peur"]).niveau, 'modere');
  assert.equal(detecterCrise(["j'ai peur, j'ai une pulsion bizarre"]).niveau, 'modere');
});

test('« peur » seul, sans pulsion inquiétante, ne déclenche rien — trop fréquent pour être un motif', () => {
  assert.equal(detecterCrise(["j'ai peur de l'examen de demain"]).niveau, 'aucun');
  assert.equal(detecterCrise(["j'ai peur des araignées"]).niveau, 'aucun');
});

test('« envie bizarre » seule, sans peur exprimée, ne déclenche rien', () => {
  assert.equal(detecterCrise(["j'ai eu une envie bizarre de manger une pizza à trois heures du matin"]).niveau, 'aucun');
});

test('la co-occurrence doit être dans le MÊME message, pas seulement la même conversation', () => {
  const resultat = detecterCrise(["j'ai peur de l'examen", "et sinon j'ai eu une drôle d'envie bizarre hier"]);
  assert.equal(resultat.niveau, 'aucun');
});

// Recherche demandée par Erwann le 11/09/2026 : couvrir systématiquement
// les formulations indirectes, pas seulement les cas remontés un par un.
// Les huit premiers exemples viennent de lui, textuellement.
test('les formulations indirectes données par Erwann déclenchent', () => {
  const exemples: Array<[string, 'fort' | 'modere']> = [
    ['quelle vie de merde', 'modere'],
    ['je vais faire une bêtise', 'fort'],
    ['je vais péter un câble', 'modere'],
    ['ça va pas du tout', 'modere'],
    ['la fin est proche', 'fort'],
    ['quel monde de merde', 'modere'],
    ["pourquoi tout ça m'arrive à moi", 'modere'],
  ];
  for (const [exemple, niveauAttendu] of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, niveauAttendu, `"${exemple}" aurait dû déclencher le niveau ${niveauAttendu}`);
  }
});

test('les adieux explicites déclenchent le niveau fort', () => {
  const exemples = ['je te dis adieu', "c'est un adieu", 'je vais faire une connerie'];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'fort', `"${exemple}" aurait dû déclencher le niveau fort`);
  }
});

test("« je veux que tout s'arrête » et « dormir et ne plus me réveiller » déclenchent le niveau fort", () => {
  assert.equal(detecterCrise(["je veux que tout s'arrête"]).niveau, 'fort');
  assert.equal(detecterCrise(['je veux dormir et ne plus me réveiller']).niveau, 'fort');
});

test("le sentiment d'être pris au piège, sans issue perçue, déclenche le niveau modéré", () => {
  const exemples = ['je me sens pris au piège', "il n'y a pas d'autre solution", 'je suis dans une impasse'];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});

test('le vide intérieur et la perte de sens déclenchent le niveau modéré', () => {
  const exemples = ["plus rien n'a de sens", 'je ne ressens plus rien', "je me sens vide à l'intérieur"];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});

test("l'obsession de la mort et l'auto-mutilation générale déclenchent le niveau modéré", () => {
  const exemples = ['je pense tout le temps à la mort', 'je me fais du mal'];
  for (const exemple of exemples) {
    assert.equal(detecterCrise([exemple]).niveau, 'modere', `"${exemple}" aurait dû déclencher le niveau modéré`);
  }
});
