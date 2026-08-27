/**
 * Lecture bienveillante d'une page de journal.
 *
 * Ce module ne part jamais sur le réseau. Il est importé par le script de page
 * et s'exécute **dans le navigateur**, ce qui est la seule raison pour laquelle
 * on peut écrire sans mentir « ton journal ne quitte pas ton téléphone » :
 * il n'y a pas de route à appeler, donc rien à intercepter, rien à journaliser,
 * rien à oublier de supprimer. Le bouton de libération efface pour de bon.
 *
 * Ce qu'il rend est volontairement pauvre : trois émotions au plus, et **une**
 * piste. Un tableau de bord de l'intériorité, avec ses douze jauges, donne le
 * sentiment d'être mesuré, pas celui d'être accueilli.
 */

export interface Emotion {
  readonly nom: string;
  readonly intensite: number;
}

export interface LectureJournal {
  readonly mots: number;
  readonly emotions: readonly Emotion[];
  readonly meteo: string;
  readonly accueil: string;
  readonly piste: string;
  /** Part des phrases retournées contre soi, de 0 à 100. */
  readonly autocritique: number;
}

interface Famille {
  readonly nom: string;
  readonly mots: readonly string[];
  readonly meteo: string;
  readonly accueil: string;
  readonly piste: string;
}

/**
 * Huit familles, pas trente. Une nomenclature fine se trompe avec assurance ;
 * une nomenclature large se trompe rarement. Sur un texte écrit à 23 h par
 * quelqu'un qui va mal, se tromper avec assurance est le pire des deux.
 */
const FAMILLES: readonly Famille[] = [
  {
    nom: 'Tristesse',
    mots: ['triste', 'tristesse', 'pleure', 'pleurer', 'chagrin', 'vide', 'seul', 'seule',
      'solitude', 'abandonne', 'abandonnee', 'perdu', 'perdue', 'manque', 'melancolie'],
    meteo: 'Pluie fine, ciel bas',
    accueil: 'Il y a du chagrin dans ces lignes, et il a le droit d’être là sans être expliqué.',
    piste: 'Relis une seule phrase, celle qui pèse le plus, et demande-toi de quoi elle a besoin — pas ce qu’elle veut dire.',
  },
  {
    nom: 'Colère',
    mots: ['colere', 'enerve', 'enervee', 'rage', 'furieux', 'furieuse', 'injuste', 'marre',
      'insupportable', 'agace', 'agacee', 'raz le bol', 'ras le bol', 'revolte'],
    meteo: 'Orage sec, air électrique',
    accueil: 'La colère est là, et elle protège toujours quelque chose. Elle n’est pas le problème.',
    piste: 'Écris la phrase « ce que je n’accepte pas, c’est… » et laisse-la se finir toute seule.',
  },
  {
    nom: 'Peur',
    mots: ['peur', 'angoisse', 'anxieux', 'anxieuse', 'stress', 'stresse', 'panique',
      'inquiet', 'inquiete', 'trac', 'terrifie', 'appréhension', 'apprehension', 'boule au ventre'],
    meteo: 'Brouillard, visibilité courte',
    accueil: 'La peur occupe beaucoup de place ici. Elle anticipe ; ce n’est pas la même chose que savoir.',
    piste: 'Note ce qui est vrai maintenant, à cette minute. Pas ce qui pourrait arriver.',
  },
  {
    nom: 'Culpabilité',
    mots: ['coupable', 'culpabilite', 'honte', 'honteux', 'honteuse', 'pardon', 'desole',
      'desolee', 'faute', 'nul', 'nulle', 'raté', 'rate', 'ratee', 'inutile'],
    meteo: 'Ciel lourd, plafond bas',
    accueil: 'Tu te tiens rigueur de beaucoup de choses dans ce texte. Beaucoup plus qu’à quelqu’un d’autre.',
    piste: 'Relis ce passage en remplaçant ton prénom par celui d’un ami. Est-ce que tu lui dirais ça ?',
  },
  {
    nom: 'Épuisement',
    mots: ['fatigue', 'fatiguee', 'epuise', 'epuisee', 'creve', 'crevee', 'vide', 'plus la force',
      'a bout', 'burn out', 'burnout', 'sature', 'saturee', 'trop plein', 'dors pas'],
    meteo: 'Nuit sans étoiles',
    accueil: 'Ce texte est écrit avec le peu d’énergie qui restait. Ça se sent, et ça compte.',
    piste: 'Une seule chose demain, pas trois. Choisis laquelle et laisse tomber le reste sans négocier.',
  },
  {
    nom: 'Surcharge sensorielle',
    mots: ['bruit', 'lumiere', 'monde', 'foule', 'trop de', 'sature', 'agression', 'odeur',
      'brouhaha', 'open space', 'notifications', 'ecran', 'ecrans'],
    meteo: 'Vent fort, rafales',
    accueil: 'Le dehors est entré trop fort aujourd’hui. Ce n’est pas une faiblesse, c’est un volume.',
    piste: 'Vingt minutes sans écran ni son, dans le noir si possible. Ce n’est pas du luxe, c’est de la récupération.',
  },
  {
    nom: 'Soulagement',
    mots: ['soulage', 'soulagee', 'mieux', 'apaise', 'apaisee', 'enfin', 'calme', 'respire',
      'leger', 'legere', 'tranquille', 'pose'],
    meteo: 'Éclaircie, air lavé',
    accueil: 'Quelque chose s’est desserré. Ça mérite d’être noté, on ne note jamais les bons jours.',
    piste: 'Écris ce qui a permis ça, en une ligne. Tu la reliras un jour où tu en auras besoin.',
  },
  {
    nom: 'Joie',
    mots: ['heureux', 'heureuse', 'joie', 'content', 'contente', 'fier', 'fiere', 'rire',
      'sourire', 'gratitude', 'merci', 'beau', 'belle', 'lumiere'],
    meteo: 'Grand soleil, vent portant',
    accueil: 'Il y a de la lumière dans ces lignes. Reste dedans une minute avant de passer à la suite.',
    piste: 'Dis-le à la personne concernée, si elle existe. Aujourd’hui, pas « un de ces jours ».',
  },
];

/** Tournures par lesquelles on se juge soi-même. */
const AUTOCRITIQUES: readonly string[] = [
  "j'aurais du", "je n'aurais pas du", "je naurais pas du", "c'est ma faute", "je m'en veux",
  'je devrais', 'je suis nul', 'je suis nulle', 'je suis pas capable', 'je ne suis pas capable',
  'je suis trop', 'je gere rien', 'je gere pas', "j'y arrive pas", "je n'y arrive pas",
  'comme toujours avec moi', 'encore une fois moi',
];

const REPLI: Famille = {
  nom: 'Rien de tranché',
  mots: [],
  meteo: 'Ciel variable',
  accueil: 'Ce texte ne penche pas d’un côté. C’est déjà une information : tout n’est pas à trier ce soir.',
  piste: 'Repose-le. Relis-le demain matin — le même texte ne dit jamais la même chose à deux moments.',
};

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'");
}

/** Compte les occurrences en frontières de mots, pour ne pas voir « seul » dans « seulement ». */
function occurrences(plat: string, terme: string): number {
  const motif = new RegExp(
    `(?<![\\p{L}'])${terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`,
    'gu',
  );
  return (plat.match(motif) ?? []).length;
}

/**
 * Lit une page de journal. Fonction pure : rien n'est écrit, rien n'est envoyé.
 */
export function lire(texte: string): LectureJournal {
  const plat = normaliser(texte);
  const mots = plat.split(/[^\p{L}']+/u).filter(Boolean).length;

  const comptes = FAMILLES.map((famille) => ({
    famille,
    score: famille.mots.reduce((somme, terme) => somme + occurrences(plat, terme), 0),
  })).filter((c) => c.score > 0);

  comptes.sort((a, b) => b.score - a.score);
  const total = comptes.reduce((somme, c) => somme + c.score, 0);

  const emotions = comptes.slice(0, 3).map((c) => ({
    nom: c.famille.nom,
    // Part relative, pas valeur absolue : « 60 % de colère » se comprend,
    // « 7 points de colère » ne veut rien dire pour personne.
    intensite: total === 0 ? 0 : Math.round((c.score / total) * 100),
  }));

  const dominante = comptes[0]?.famille ?? REPLI;

  const retours = AUTOCRITIQUES.reduce((somme, terme) => somme + occurrences(plat, terme), 0);
  const phrases = Math.max(1, texte.split(/[.!?\n]+/).filter((p) => p.trim().length > 0).length);
  const autocritique = Math.min(100, Math.round((retours / phrases) * 100));

  return {
    mots,
    emotions,
    meteo: dominante.meteo,
    // L'autocritique passe devant l'émotion dominante : quelqu'un qui se tape
    // dessus a d'abord besoin qu'on le lui dise, quelle que soit la couleur du
    // reste du texte.
    accueil: autocritique >= 25
      ? 'Tu te tiens rigueur de beaucoup de choses dans ce texte. Beaucoup plus qu’à quelqu’un d’autre.'
      : dominante.accueil,
    piste: autocritique >= 25
      ? 'Relis ce passage en remplaçant ton prénom par celui d’un ami. Est-ce que tu lui dirais ça ?'
      : dominante.piste,
    autocritique,
  };
}
