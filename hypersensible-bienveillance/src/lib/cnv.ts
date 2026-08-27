/**
 * Moteur de reformulation en Communication Non Violente.
 *
 * Ce que fait ce fichier : il prend un message piquant *reçu* et écrit ce que
 * son auteur aurait pu dire s'il avait su le dire. Quatre blocs, dans l'ordre
 * de Rosenberg — observation, sentiment, besoin, demande — plus une ligne
 * d'humour, parce qu'un message parfaitement bienveillant et parfaitement
 * sérieux, personne ne l'envoie jamais.
 *
 * Pourquoi une table de signaux plutôt qu'un modèle de langage : le résultat
 * doit être **le même** d'un jour sur l'autre pour un même message. La
 * « Lumière 3 » de 19 h 00 publie chaque soir un message du jour reformulé
 * devant 48 000 personnes ; si l'outil rendait deux textes différents pour la
 * même phrase, il n'y aurait rien à montrer. Et un moteur déterministe se
 * teste, ce qu'aucun appel distant ne permet.
 *
 * La deuxième raison est éthique et elle pèse davantage : aucun texte soumis
 * ne quitte le Worker. Rien n'est envoyé à un tiers, rien n'est écrit en base.
 * Ce que quelqu'un colle ici est souvent la phrase qui l'a tenu éveillé.
 *
 * Module pur, sans dépendance : il tourne aussi bien dans un Worker que sous
 * `node --test`.
 */

/** Ce que l'analyse a repéré dans le message, et ce qu'il faut en faire. */
export interface Signal {
  /** Identifiant du procédé blessant repéré. */
  readonly cle: string;
  /** Nom lisible, affiché à l'écran sous forme d'étiquette. */
  readonly etiquette: string;
  /** Poids dans le calcul d'intensité. Un mépris pèse plus qu'un « toujours ». */
  readonly poids: number;
  /** Ce que l'auteur ressentait probablement, écrit à la première personne. */
  readonly sentiment: string;
  /** Le besoin que le procédé recouvrait. */
  readonly besoin: string;
  /** Une demande concrète et négociable, jamais un ordre déguisé. */
  readonly demande: string;
  /** Repli quand le message n'offre aucun fait à citer. */
  readonly observationParDefaut: string;
}

export interface Reformulation {
  readonly observation: string;
  readonly sentiment: string;
  readonly besoin: string;
  readonly demande: string;
  readonly humour: string;
  /** Les quatre blocs assemblés, prêts à être copiés et envoyés. */
  readonly message: string;
  /** 0 à 100. Ce n'est pas une gravité, c'est une densité de procédés. */
  readonly intensite: number;
  /** Étiquettes des procédés repérés, du plus lourd au plus léger. */
  readonly signaux: readonly string[];
}

/**
 * Les huit façons de faire mal en une phrase.
 *
 * L'ordre compte : à poids égal, c'est le premier de cette liste qui donne le
 * ton de la reformulation. Le mépris et la minimisation passent devant
 * l'insulte franche parce qu'ils sont plus difficiles à nommer pour celui qui
 * les reçoit — une insulte, au moins, on sait qu'on l'a reçue.
 */
const SIGNAUX: readonly Signal[] = [
  {
    cle: 'minimisation',
    etiquette: 'Minimisation du ressenti',
    poids: 30,
    sentiment: "je me sens démuni face à ce que tu traverses",
    besoin: "j'ai besoin de comprendre ce qui se passe pour toi au lieu de le balayer",
    demande: "Est-ce que tu peux me raconter ce qui t'a touché, même si je ne le vois pas encore ?",
    observationParDefaut: "Quand j'ai répondu que ce n'était pas si grave",
  },
  {
    cle: 'mepris',
    etiquette: 'Mépris',
    poids: 28,
    sentiment: 'je me sens agacé et je le fais mal passer',
    besoin: "j'ai besoin d'être pris au sérieux sans avoir à hausser le ton",
    demande: 'Est-ce qu’on peut reprendre cette discussion à froid, chacun son tour ?',
    observationParDefaut: 'Quand je relis le ton que j’ai employé',
  },
  {
    cle: 'insulte',
    etiquette: 'Jugement sur la personne',
    poids: 26,
    sentiment: 'je suis en colère et je vise la personne au lieu du fait',
    besoin: "j'ai besoin de respect, et de le donner avant de le demander",
    demande: "Est-ce que je peux te redire la même chose demain, sans t'attaquer cette fois ?",
    observationParDefaut: 'Quand quelque chose ne va pas entre nous',
  },
  {
    cle: 'menace',
    etiquette: 'Ultimatum',
    poids: 24,
    sentiment: 'j’ai peur de ne pas être entendu autrement',
    besoin: "j'ai besoin de sentir que ce que je dis compte sans avoir à menacer",
    demande: 'Est-ce que tu peux me dire ce qui est possible pour toi, sans que je pose un ultimatum ?',
    observationParDefaut: 'Quand j’ai l’impression de ne pas être écouté',
  },
  {
    cle: 'injonction',
    etiquette: 'Injonction',
    poids: 20,
    sentiment: 'je me sens impuissant devant ce que je ne peux pas régler pour toi',
    besoin: "j'ai besoin de t'aider autrement qu'en te disant quoi ressentir",
    demande: 'Est-ce que tu préfères que je t’écoute, ou que je cherche une solution avec toi ?',
    observationParDefaut: 'Quand je t’ai dit quoi faire au lieu de te demander',
  },
  {
    cle: 'accusation',
    etiquette: 'Accusation',
    poids: 18,
    sentiment: 'je me sens seul dans cette histoire',
    besoin: "j'ai besoin qu'on la porte à deux plutôt que de chercher un responsable",
    demande: 'Est-ce qu’on peut regarder ensemble ce qui a coincé, sans désigner de coupable ?',
    observationParDefaut: 'Quand les choses ne se passent pas comme prévu',
  },
  {
    cle: 'generalisation',
    etiquette: 'Généralisation',
    poids: 14,
    sentiment: 'je me sens découragé parce que ça revient souvent',
    besoin: "j'ai besoin de parler de cette fois-ci, précisément, et pas de toutes les autres",
    demande: 'Est-ce qu’on peut s’en tenir à ce qui s’est passé aujourd’hui ?',
    observationParDefaut: 'Quand la même chose se répète',
  },
  {
    cle: 'cri',
    etiquette: 'Cri',
    poids: 12,
    sentiment: 'je suis débordé et ça sort trop fort',
    besoin: "j'ai besoin d'un moment plus calme pour dire ça correctement",
    demande: 'Est-ce qu’on peut en reparler tout à l’heure, à voix normale ?',
    observationParDefaut: 'Quand j’ai écrit ça sur le moment',
  },
];

/** Repli quand rien n'est repéré : le message est sec, pas nécessairement méchant. */
const SIGNAL_NEUTRE: Signal = {
  cle: 'flou',
  etiquette: 'Message sec, sans reproche nommé',
  poids: 0,
  sentiment: 'je me sens mal à l’aise sans arriver à dire pourquoi',
  besoin: "j'ai besoin de clarifier ce que je voulais vraiment dire",
  demande: 'Est-ce que tu peux me dire comment tu as reçu ce message ?',
  observationParDefaut: 'Quand je relis ce que je t’ai envoyé',
};

/**
 * Marqueurs de chaque procédé, en texte normalisé (minuscules, sans accents,
 * apostrophe droite). Une expression régulière écrite à la main par entrée
 * aurait été plus courte et illisible ; ici on ajoute un tour de phrase entendu
 * dans les commentaires du groupe sans avoir à relire quoi que ce soit.
 *
 * Ils sont comparés **en frontières de mots**, jamais en simple sous-chaîne.
 * La première version cherchait `plat.includes(marqueur)` : « annuler »
 * contient « nul », et « si tu continues à annuler nos rendez-vous » ressortait
 * étiqueté « jugement sur la personne ». Une étiquette fausse sur un écran qui
 * prétend nommer ce qui blesse, c'est exactement ce qu'il ne faut pas faire.
 */
const MARQUEURS: Readonly<Record<string, readonly string[]>> = {
  minimisation: [
    "c'est pas grave", "ce n'est pas grave", "c'est rien", 'tu exageres',
    'tu dramatises', 'tu te fais des films', "c'est dans ta tete", 'tu prends tout mal',
    'trop sensible', 'trop susceptible', 'tu te vexes pour rien', 'fais pas ta',
    'y a pire', 'il y a pire', 'arrete ton cinema', 'chochotte', 'passe a autre chose',
  ],
  mepris: [
    'franchement', 'serieusement', 'serieux', "n'importe quoi", 'nimporte quoi',
    'tu te rends compte', 'pff', 'mdr', 'ptdr', 'lol', 'grandis un peu', 'pathetique',
    'ridicule', 'tu me fatigues', 'tu me soules',
  ],
  insulte: [
    'nul', 'nulle', 'debile', 'idiot', 'idiote', 'imbecile', 'incapable', 'bon a rien',
    'minable', 'egoiste', 'immature', 'gamin', 'gamine', 'chiant', 'chiante', 'penible',
    'insupportable', 'relou', 'con', 'conne', 'lourd', 'lourde', 'toxique',
  ],
  menace: [
    'sinon', 'si tu continues', 'ne compte plus sur moi', 'compte plus sur moi',
    "c'est la derniere fois", 'la prochaine fois je', "j'arrete tout", 'tant pis pour toi',
    'debrouille toi', 'debrouille-toi',
  ],
  injonction: [
    'arrete de', 'il faut que tu', 'tu dois', 'fais un effort', 'calme toi', 'calme-toi',
    'detends toi', 'detends-toi', 'relativise', 'prends sur toi', 'secoue toi',
    "y a qu'a", 'yaka', "t'as qu'a", "tu n'as qu'a", 'sois pas',
  ],
  accusation: [
    'a cause de toi', 'de ta faute', "c'est toi qui", "tu m'as", 'tu me fais',
    'tu fais jamais', 'tu ne fais jamais', 'tu ne veux jamais', "c'est toujours moi qui",
  ],
  generalisation: [
    'toujours', 'jamais', 'tout le temps', 'systematiquement', "comme d'habitude",
    'a chaque fois', 'chaque fois', 'encore une fois', 'tout le monde', 'personne ne',
  ],
  cri: [],
};

/**
 * Les marqueurs compilés une fois pour toutes. Un Worker démarre à froid des
 * milliers de fois par jour ; recompiler cent expressions régulières à chaque
 * requête se paie en temps processeur facturé, pour un résultat identique.
 */
const MARQUEURS_COMPILES: Readonly<Record<string, readonly RegExp[]>> = Object.fromEntries(
  Object.entries(MARQUEURS).map(([cle, liste]) => [
    cle,
    liste.map((marqueur) => new RegExp(`(?<![\\p{L}'])${echapper(marqueur)}(?![\\p{L}])`, 'u')),
  ]),
);

/**
 * Les adjectifs qui visent la personne plutôt que le fait. Le moteur les
 * connaît par leur nom parce qu'il doit les retirer du fait cité : garder
 * « tu es nul de ne pas avoir répondu » dans l'observation reviendrait à
 * republier l'insulte sous une étiquette bienveillante.
 */
const JUGEMENTS = [
  'nul', 'nulle', 'débile', 'idiot', 'idiote', 'imbécile', 'incapable', 'bon à rien',
  'minable', 'pathétique', 'ridicule', 'égoïste', 'immature', 'gamin', 'gamine',
  'chiant', 'chiante', 'pénible', 'insupportable', 'relou', 'con', 'conne', 'lourd',
  'lourde', 'fou', 'folle', 'hystérique', 'parano', 'susceptible', 'fragile',
  'chochotte', 'égocentrique', 'toxique',
].join('|');

/**
 * Réécritures appliquées au fait cité, avant tout retrait.
 *
 * Le tour de vis à ne pas rater : **« jamais » n'est pas supprimé, il est
 * remplacé par « pas »**. La première version de ce fichier l'effaçait comme
 * les autres généralisations, et « tu réponds jamais à mes messages »
 * ressortait en « quand tu réponds à mes messages » — le contraire exact de ce
 * que la personne avait écrit. Un outil qui fait dire l'inverse à quelqu'un
 * fait plus de dégâts que pas d'outil du tout. « Toujours » et « tout le
 * temps », eux, s'enlèvent sans rien inverser : ils exagèrent, ils ne nient pas.
 */
const REECRITURES: readonly (readonly [RegExp, string])[] = [
  [/\bplus jamais\b/giu, 'plus'],
  [/\bjamais\b/giu, 'pas'],
];

/** Fragments retirés du fait cité, dans cet ordre. */
const FRAGMENTS_A_RETIRER: readonly RegExp[] = [
  new RegExp(
    `\\b(?:tu es|t'es|t es|tu étais|vous etes|vous êtes)\\s+(?:vraiment\\s+|tellement\\s+|trop\\s+|carrément\\s+|complètement\\s+)*(?:un\\s+|une\\s+)?(?:${JUGEMENTS})\\b`,
    'giu',
  ),
  /\b(?:espèce|espece) d['’]\s*\p{L}+/giu,
  new RegExp(`\\b(?:${JUGEMENTS})\\b`, 'giu'),
  /\b(franchement|serieusement|sérieusement|serieux|sérieux|pff+|mdr|ptdr|lol|bref|hein)\b/giu,
  /\b(toujours|tout le temps|systematiquement|systématiquement|comme d['’]habitude|a chaque fois|à chaque fois|chaque fois|encore une fois)\b/giu,
  /\b(quand meme|quand même|carrement|carrément|vraiment|clairement|tellement)\b/giu,
];

/**
 * Débuts de clause qui ne citent aucun fait : ordres et minimisations. Écrits
 * en texte normalisé, comme les marqueurs, pour être comparés de la même façon.
 */
const DEBUTS_NON_FACTUELS: readonly string[] = [
  ...(MARQUEURS.injonction ?? []),
  ...(MARQUEURS.minimisation ?? []),
  'arrete', 'calme', 'detends', 'relativise', 'tais', 'oublie', 'laisse tomber',
];

/** Mots vides : un reste qui n'en contient que ne dit rien de factuel. */
const MOTS_VIDES = new Set([
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se',
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'ce', 'cet', 'cette', 'ces',
  'et', 'ou', 'mais', 'donc', 'car', 'que', 'qui', 'quoi', 'a', 'as', 'ai', 'est',
  'es', 'sont', 'ete', 'pas', 'ne', 'n', 'y', 'en', 'au', 'aux', 'ton', 'ta', 'tes',
  'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'plus', 'moins', 'tout', 'tous', 'toute',
  'si', 'ça', 'ca', 'cela', 'là', 'la', 'pour', 'avec', 'sur', 'dans', 'par',
]);

/** Trois répliques par procédé. L'autodérision d'abord, la leçon jamais. */
const HUMOURS: Readonly<Record<string, readonly string[]>> = {
  minimisation: [
    "(Et si je te dis « c'est pas grave » une fois de plus, tu as le droit de me couper le son.)",
    "(J'ai voulu éteindre l'incendie en fermant les yeux. Ça marche moyennement.)",
    "(Promis, j'arrête de relativiser ta journée depuis mon canapé.)",
  ],
  mepris: [
    "(Le ton était pourri. Le fond tient encore debout, lui, à peu près.)",
    "(J'ai écrit ça avec l'élégance d'un klaxon dans un tunnel. Désolé.)",
    "(Si mes mots étaient un créneau, j'aurais touché les deux voitures.)",
  ],
  insulte: [
    "(J'ai visé la personne au lieu du problème. Beau tir, mauvaise cible.)",
    "(J'ai roulé sur toi alors que je voulais juste doubler. Ça arrive, ça ne s'excuse pas tout seul.)",
    "(Rien de ce que j'ai dit sur toi n'était vrai. Sur moi énervé, si.)",
  ],
  menace: [
    "(Menacer, c'est le clignotant de quelqu'un qui a déjà tourné. J'aurais dû parler avant.)",
    "(Ultimatum retiré. Il ne me servait qu'à cacher que j'avais peur.)",
    "(J'ai sorti la grosse artillerie pour demander un verre d'eau.)",
  ],
  injonction: [
    "(Je t'ai donné la solution avant même d'avoir écouté le problème. Réflexe de dépanneur.)",
    "(« Calme-toi » n'a jamais calmé personne, moi le premier.)",
    "(J'ai voulu réparer. Tu voulais peut-être juste être accompagné.)",
  ],
  accusation: [
    "(J'ai cherché un coupable, j'ai trouvé un ami. Mauvaise pioche.)",
    "(Le doigt pointé, c'est confortable : ça évite de regarder le tableau de bord.)",
    "(Deux dans la même galère, et j'ai passé mon temps à désigner le rameur.)",
  ],
  generalisation: [
    "(« Toujours » et « jamais » sont deux mots qui n'ont jamais aidé personne. Toujours.)",
    "(J'ai fait le bilan de dix ans pour parler de mardi dernier.)",
    "(Un fait suffisait. J'ai livré le camion complet.)",
  ],
  cri: [
    "(Les majuscules, c'était pas contre toi. C'était la pression qui sortait par où elle pouvait.)",
    "(J'ai crié en silence sur un clavier. Le voisinage n'a rien entendu, toi si.)",
    "(Trop fort, trop vite. Comme d'habitude quand je freine trop tard.)",
  ],
  flou: [
    "(Message envoyé à 23 h 47. Ça se voit, hein.)",
    "(J'ai relu, j'ai pas compris ce que je voulais dire non plus.)",
    "(Il manquait le mode d'emploi. Je le joins avec un jour de retard.)",
  ],
};

/** Longueur au-delà de laquelle on refuse d'analyser — voir `analyser`. */
export const LONGUEUR_MAX = 2000;

/** Neutralise les caractères qu'une expression régulière interpréterait. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Minuscules, sans accents, apostrophes uniformisées. */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'");
}

/**
 * Empreinte stable d'un texte. Sert uniquement à choisir la réplique
 * humoristique : deux visites sur le même message doivent rendre la même page,
 * sinon la capture d'écran publiée le soir ne correspond plus à l'outil.
 */
function empreinte(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Un message en capitales ou saturé de points d'exclamation est un cri. */
function crie(texte: string): boolean {
  const lettres = texte.replace(/[^\p{L}]/gu, '');
  if (lettres.length >= 8) {
    const majuscules = texte.replace(/[^\p{Lu}]/gu, '').length;
    if (majuscules / lettres.length > 0.5) return true;
  }
  return /!{2,}|\?{3,}/.test(texte);
}

/** Repère les procédés présents, du plus lourd au plus léger. */
export function reperer(texte: string): readonly Signal[] {
  const plat = normaliser(texte);
  const trouves = SIGNAUX.filter((signal) => {
    if (signal.cle === 'cri') return crie(texte);
    return (MARQUEURS_COMPILES[signal.cle] ?? []).some((motif) => motif.test(plat));
  });
  // Tri par poids décroissant, et à poids égal par l'ordre de SIGNAUX, qui
  // encode déjà la hiérarchie voulue.
  return [...trouves].sort((a, b) => b.poids - a.poids);
}

/**
 * Tire du message le fait concret dont il parle, débarrassé des jugements.
 *
 * Rend `null` quand il ne reste rien d'assez consistant : mieux vaut une
 * observation générique honnête qu'un fragment de phrase recollé de travers,
 * qui ferait dire à l'outil quelque chose que personne n'a écrit.
 */
export function extraireFait(texte: string): string | null {
  // Découpage aux virgules autant qu'aux points : dans « t'es nulle, tu
  // réponds pas, c'est pas grave », le fait tient dans la clause du milieu.
  // Une phrase entière recollée traînerait les deux autres avec elle.
  const clauses = texte.split(/[.!?\n;,]+/).map((c) => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    // Un ordre n'est pas un fait. « Calme-toi un peu » recollé derrière
    // « Quand » donne « Quand calme-toi un peu » : une phrase que personne n'a
    // écrite, dans un français que personne ne parle. Ces clauses-là sont
    // sautées, et l'observation par défaut du procédé dominant prend le relais.
    if (DEBUTS_NON_FACTUELS.some((debut) => normaliser(clause).startsWith(debut))) continue;
    // Une clause hurlée se rend en minuscules avant d'être citée : la reprendre
    // en capitales rendrait le cri à la personne qui vient de le recevoir.
    let reste = crie(clause) ? clause.toLowerCase() : clause;
    for (const [motif, remplacement] of REECRITURES) reste = reste.replace(motif, remplacement);
    for (const motif of FRAGMENTS_A_RETIRER) reste = reste.replace(motif, ' ');
    reste = reste
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, '')
      .replace(/^(que|qu['’]|mais|et|donc|car|alors|si)\s+/i, '')
      .trim();
    const mots = normaliser(reste).split(/[^\p{L}']+/u).filter(Boolean);
    const utiles = mots.filter((mot) => !MOTS_VIDES.has(mot) && mot.length > 1);
    if (mots.length >= 3 && utiles.length >= 2) {
      return `Quand ${reste.charAt(0).toLowerCase()}${reste.slice(1)}`;
    }
  }
  return null;
}

/**
 * Reformule un message piquant. Fonction pure : même entrée, même sortie.
 *
 * Elle n'échoue pas et ne rend jamais de champ vide — un écran d'erreur devant
 * quelqu'un qui vient de coller la phrase qui l'a blessé serait la pire des
 * réponses possibles.
 */
export function reformuler(texte: string): Reformulation {
  const propre = texte.trim();
  const repere = reperer(propre);
  const dominant = repere[0] ?? SIGNAL_NEUTRE;

  const observation = extraireFait(propre) ?? dominant.observationParDefaut;

  // L'intensité additionne les procédés au lieu de ne retenir que le plus
  // lourd : une phrase qui insulte, généralise et menace en douze mots fait
  // plus mal que trois phrases n'en portant qu'un chacune.
  const brute = repere.reduce((somme, signal) => somme + signal.poids, 0);
  const intensite = Math.min(100, Math.round(brute));

  const repliques = HUMOURS[dominant.cle] ?? HUMOURS.flou!;
  const humour = repliques[empreinte(propre) % repliques.length]!;

  const message = `${observation}, ${dominant.sentiment}, ${dominant.besoin}.\n\n${dominant.demande}\n\n${humour}`;

  return {
    observation,
    sentiment: dominant.sentiment,
    besoin: dominant.besoin,
    demande: dominant.demande,
    humour,
    message,
    intensite,
    signaux: repere.length > 0 ? repere.map((s) => s.etiquette) : [SIGNAL_NEUTRE.etiquette],
  };
}

/** Ce qui peut clocher dans une saisie, dit en français plutôt qu'en code. */
export type Refus = { readonly ok: false; readonly raison: string };
export type Accord = { readonly ok: true; readonly texte: string };

/**
 * Vérifie la saisie avant analyse. La borne haute n'est pas décorative : un
 * Worker facture le temps processeur, et personne n'a jamais reçu un message
 * piquant de trois pages — au-delà, c'est un copier-coller de conversation
 * entière, qui ne se reformule pas en quatre blocs de toute façon.
 */
export function valider(entree: unknown): Accord | Refus {
  if (typeof entree !== 'string') {
    return { ok: false, raison: 'Il manque le message à reformuler.' };
  }
  const texte = entree.trim();
  if (texte.length < 3) {
    return { ok: false, raison: 'Colle le message en entier, même court — trois mots suffisent.' };
  }
  if (texte.length > LONGUEUR_MAX) {
    return {
      ok: false,
      raison: `Ce message fait ${texte.length} caractères. Garde le passage qui pique, pas toute la conversation.`,
    };
  }
  return { ok: true, texte };
}
