// Couche 1 de l'architecture de sécurité de Psy IA : détection de crise
// déterministe, hors LLM. Tourne AVANT toute génération et intercepte la
// conversation elle-même — un modèle qu'on convaincrait de répondre « quand
// même » n'a jamais l'occasion de le faire, puisque ce filtre n'invoque
// aucun modèle et ne peut donc pas être « discuté ». Voir SECURITY.md.
//
// La liste de phrases ci-dessous est un POINT DE DÉPART, pas une liste
// validée cliniquement : elle reprend telle quelle la note d'initialisation
// du projet (voir TODO.md, couche 4). Elle doit être enrichie et validée par
// un professionnel de santé mentale avant toute mise en ligne, même en
// bêta. Principe directeur, explicitement posé dans cette même note : en cas
// de doute, on déclenche — un faux positif est gênant, un faux négatif est
// inacceptable.
//
// Les motifs s'écrivent en FRANÇAIS ORDINAIRE, jamais en expression
// régulière, et c'est une décision de fond : un psychologue doit pouvoir
// relire et compléter cette liste sans savoir lire du code. La machinerie
// (accents, fautes de frappe, apostrophes) est entièrement dans
// `normaliser` ci-dessous, appliquée des DEUX côtés — au message reçu comme
// au motif écrit ici.

export type NiveauCrise = 'aucun' | 'modere' | 'fort';

export interface ResultatDetectionCrise {
  niveau: NiveauCrise;
  /** Phrases qui ont déclenché, pour le journal d'audit — jamais montré à la personne. */
  motifs: string[];
}

/**
 * Normalise un texte pour la détection : accents retirés, minuscules,
 * lettres répétées ramenées à une seule ("mourrrir" → "mourir"), quelques
 * contractions phonétiques citées dans la note d'initialisation ("jve",
 * "jeveu"), puis toute ponctuation ramenée à une espace.
 *
 * Le repli des lettres répétées mange aussi les doubles lettres légitimes
 * ("arrangera" → "arangera"), et c'est sans conséquence à une condition :
 * que les motifs passent par cette même fonction. C'est ce que fait
 * `compiler` juste en dessous. Un motif écrit à la main en expression
 * régulière contournerait cette garantie et ne matcherait jamais — le défaut
 * a été mesuré sur « ça ne s'arrangera jamais », qui passait au travers.
 */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/\bjeveux?\b/g, 'je veux')
    .replace(/\bjve\b/g, 'je veux')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Motif {
  /** La phrase telle qu'elle est écrite plus bas — c'est elle qui part au journal. */
  phrase: string;
  regex: RegExp;
}

/**
 * Compile des phrases en motifs. La phrase subit exactement la même
 * normalisation que le message reçu, puis ses espaces deviennent « une ou
 * plusieurs espaces ». Après normalisation il ne reste que des lettres, des
 * chiffres et des espaces : aucun métacaractère d'expression régulière ne
 * peut donc survivre, et la construction est sûre.
 */
function compiler(phrases: string[]): Motif[] {
  return phrases.map((phrase) => ({
    phrase,
    regex: new RegExp(`\\b${normaliser(phrase).replace(/ /g, '\\s+')}\\b`),
  }));
}

// --- Niveau fort : tournures explicites autour du suicide et de la mort
// volontaire. Déclenchement systématique. ---
const PHRASES_FORTES = [
  'je veux mourir',
  'envie de mourir',
  'je veux en finir',
  'plus envie de vivre',
  // Sans "je" en tête, à dessein : "veux plus vivre" matche aussi bien "je
  // veux plus vivre" que sa forme niée "je ne veux plus vivre" — la négation
  // ne casse pas la contiguïté du fragment, alors qu'un préfixe "je veux"
  // figé l'aurait fait échouer sur la forme niée (voir le test de non-
  // régression sur la négation directe, plus bas).
  'veux plus vivre',
  'je vais me suicider',
  'je vais me tuer',
  'je pense au suicide',
  'je veux disparaître',
  'je veux partir pour de bon',
];

// Mention d'un plan concret ou d'un moyen — niveau fort lui aussi.
const PHRASES_PLAN = [
  "les médicaments qu'il faut",
  'tout préparé',
  "c'est le bon moment",
];

// Moyens précis mentionnés isolément — la note dit « toute mention d'un
// moyen précis ». Liste volontairement resserrée aux tournures les plus
// explicites : au-delà, le risque de faux positif mal calibré est trop élevé
// sans validation professionnelle (voir TODO.md).
const PHRASES_MOYENS = [
  'me pendre',
  'pendaison',
  'sauter du pont',
  'sauter du toit',
  "sauter de l'immeuble",
  // La tournure agrammaticale est listée à côté de la correcte, et c'est
  // volontaire : quelqu'un qui écrit à trois heures du matin ne relit pas sa
  // syntaxe, et le principe du projet est qu'en cas de doute on déclenche.
  'sauter du immeuble',
  'sauter par la fenêtre',
  'me jeter sous un train',
  'arme à feu',
  'avaler tous les cachets',
  'avaler tous mes médicaments',
  'faire une overdose',
  'me couper les veines',
];

// --- Niveau modéré : désespoir profond et sentiment de fardeau. Bascule au
// moindre doute, dès une seule occurrence. ---
const PHRASES_MODEREES = [
  'je sers à rien',
  'je ne sers à rien',
  'tout le monde irait mieux sans moi',
  'un poids pour tout le monde',
  "ça ne s'arrangera jamais",
  "ça s'arrangera jamais",
  "je n'en peux plus",
  "j'en peux plus",
  'je vois pas comment continuer',
  'je ne vois pas comment continuer',
  // Négation inversée — ajoutée le 11/09/2026 suite à une relecture externe
  // de la note de cadrage. La négation directe ("je ne veux plus vivre")
  // est déjà couverte plus haut ("je veux plus vivre" matche son sous-texte,
  // "ne" n'empêchant pas la phrase de matcher) ; ce qui manquait était la
  // forme inversée — une personne qui dit craindre ou refuser la mort peut
  // signaler la même détresse par ambivalence, un marqueur documenté. Posé
  // en MODÉRÉ et non FORT : la phrase peut aussi être parfaitement anodine
  // ("je veux pas mourir bête", tournure familière sans rapport avec le
  // suicide) — le niveau modéré déclenche déjà le même message figé au
  // moindre doute, sans sur-classer un motif plus ambigu que les autres.
  'veux pas mourir',
  'veut pas mourir',
];

// Épuisement extrême : ne déclenche que s'il est exprimé de façon RÉPÉTÉE
// dans la conversation — au moins deux messages distincts — comme demandé
// explicitement par la note d'initialisation. Un seul « je suis épuisé·e »
// isolé ne suffit pas à lui seul.
const PHRASES_EPUISEMENT = [
  'épuisé',
  'épuisée',
  'à bout',
  'plus aucune force',
  'vidé de toute énergie',
];

const MOTIFS_FORTS = compiler(PHRASES_FORTES);
const MOTIFS_PLAN = compiler(PHRASES_PLAN);
const MOTIFS_MOYENS = compiler(PHRASES_MOYENS);
const MOTIFS_MODERES = compiler(PHRASES_MODEREES);
const MOTIFS_EPUISEMENT = compiler(PHRASES_EPUISEMENT);

function chercher(texteNormalise: string, motifs: Motif[]): string[] {
  return motifs.filter(({ regex }) => regex.test(texteNormalise)).map(({ phrase }) => phrase);
}

/**
 * Détecte un signal de crise sur l'ENSEMBLE de la conversation, pas
 * seulement le dernier message : le signal peut se construire
 * progressivement (note d'initialisation, couche 1). `messagesPersonne`
 * doit porter tous les messages de la personne depuis le début de la
 * session, dans l'ordre — jamais seulement le dernier.
 */
export function detecterCrise(messagesPersonne: string[]): ResultatDetectionCrise {
  const normalises = messagesPersonne.map(normaliser);
  const trouves = new Set<string>();

  for (const texte of normalises) {
    for (const table of [MOTIFS_FORTS, MOTIFS_PLAN, MOTIFS_MOYENS]) {
      chercher(texte, table).forEach((phrase) => trouves.add(phrase));
    }
  }
  if (trouves.size > 0) {
    return { niveau: 'fort', motifs: Array.from(trouves) };
  }

  for (const texte of normalises) {
    chercher(texte, MOTIFS_MODERES).forEach((phrase) => trouves.add(phrase));
  }
  const messagesAvecEpuisement = normalises.filter(
    (texte) => chercher(texte, MOTIFS_EPUISEMENT).length > 0,
  ).length;
  if (messagesAvecEpuisement >= 2) {
    trouves.add('épuisement extrême répété');
  }

  return {
    niveau: trouves.size > 0 ? 'modere' : 'aucun',
    motifs: Array.from(trouves),
  };
}
