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
    // Trouvé le 11/09/2026 en confrontant la liste à une batterie de
    // formulations réalistes : « jv en finir » ne matchait pas, la
    // contraction n'ayant pas été anticipée à côté de « jve ».
    .replace(/\bjv\b/g, 'je veux')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Motif {
  /** La phrase telle qu'elle est écrite plus bas — c'est elle qui part au journal. */
  phrase: string;
  regex: RegExp;
}

// Mots que la tolérance d'un mot intercalé (ci-dessous) refuse d'avaler.
// Sans cette exclusion, « je veux mourir » matchait aussi « je NE veux PAS
// mourir » — deux négations, une de chaque côté du verbe, chacune passant
// pour le mot intercalé toléré d'un des deux intervalles du motif, et
// inversant complètement le sens de la phrase. Trouvé en écrivant le test de
// non-régression de la négation directe, qui passait au niveau FORT au lieu
// du MODÉRÉ attendu.
const PARTICULES_NEGATION_EXCLUES = ['ne', 'pas', 'plus', 'jamais', 'guere', 'point'];
const NEGATION_EXCLUE = PARTICULES_NEGATION_EXCLUES.join('|');

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
    // Un mot intercalé est toléré entre deux mots du motif — trouvé en
    // production le 11/09/2026 : « j'ai des idées très noires » ne
    // déclenchait pas, le motif « idées noires » exigeant une contiguïté
    // stricte qu'un simple intensificateur ("très", "vraiment", "un peu")
    // suffit à casser. Le principe du projet est qu'en cas de doute on
    // déclenche ; exiger l'énumération de chaque intensificateur possible
    // pour chaque motif serait l'inverse. Le mot toléré ne peut pas être une
    // négation (voir PARTICULES_NEGATION_EXCLUES ci-dessus) — sans quoi la
    // tolérance elle-même deviendrait le trou par lequel une négation se
    // glisse sans être vue. Le reste n'ajoute que des correspondances par
    // rapport à l'ancienne contiguïté stricte : un motif qui matchait avant
    // matche toujours.
    regex: new RegExp(
      `\\b${normaliser(phrase).replace(/ /g, `\\s+(?:(?!(?:${NEGATION_EXCLUE})\\b)\\S+\\s+)?`)}\\b`,
    ),
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
  // Ajoutées le 11/09/2026 : aussi directes que « je pense au suicide »,
  // et absentes jusqu'ici — un vrai trou, pas une nuance.
  'idées suicidaires',
  'pensées suicidaires',
  'envie de me suicider',
  // Trouvés le 11/09/2026 en confrontant la liste à une batterie de
  // formulations réalistes (pas seulement le cas signalé) : « je veux
  // disparaître » exige « veux », et ne matche donc pas « j'aimerais
  // disparaître pour de bon » — même tournure suffixée que « je veux partir
  // pour de bon » deux lignes plus haut, sans exiger de verbe précis avant.
  'disparaître pour de bon',
  // Euphémisme direct pour la mort volontaire, équivalent à « disparaître »
  // mais avec un verbe différent — absent jusqu'ici.
  'plus exister',
  // Recherche demandée par Erwann le 11/09/2026, après deux faux négatifs
  // réels de suite : « la plupart des gens en détresse ne le disent pas
  // explicitement, il faut couvrir toutes les formulations indirectes ».
  // Ce bloc rassemble des marqueurs établis dans la littérature sur la
  // prévention du suicide (signaux d'alerte, euphémismes de la mort
  // volontaire), pas seulement des cas remontés un par un.
  //
  // Adieux et annonce d'un départ définitif — signal d'alerte classique
  // (la personne « dit au revoir » avant un passage à l'acte).
  'je te dis adieu',
  'je vous dis adieu',
  "c'est un adieu",
  // Euphémisme très répandu en français : « faire une bêtise » désigne un
  // geste auto-destructeur, pas une maladresse, dans la bouche d'un adulte
  // qui décrit son propre état à un outil d'accompagnement — le contexte de
  // la conversation lève l'ambiguïté que le mot porterait ailleurs.
  'je vais faire une bêtise',
  'je vais faire une connerie',
  // Euphémisme direct pour la mort, au même titre que « disparaître » ou
  // « partir pour de bon ».
  'la fin est proche',
  "je veux que tout s'arrête",
  'je veux dormir et ne plus me réveiller',
  "j'aimerais m'endormir et ne plus me réveiller",
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
  // Même négation inversée, avec « jamais » plutôt que « pas » — trouvée en
  // écrivant un test de non-régression pour la tolérance ci-dessus, restée
  // absente jusqu'ici pour la même raison que « pas » avant elle.
  'veux jamais mourir',
  'veut jamais mourir',
  // Cas signalé par Erwann le 11/09/2026 : « j'ai des idées très noires »,
  // tapé en production, n'a rien déclenché — absent de toute liste. « idées
  // noires » est un euphémisme français établi pour les idées suicidaires,
  // mais reste plus polysémique que « je pense au suicide » (peut aussi
  // désigner des pensées sombres sans lien avec le suicide) : posé en
  // MODÉRÉ, au même niveau que « veux pas mourir » plus haut, pas en FORT.
  // Le message figé se déclenche de toute façon à l'identique aux deux
  // niveaux — seul le journal d'audit distingue les deux.
  'idées noires',
  'pensées noires',
  'idées sombres',
  'pensées sombres',
  // Trouvés le 11/09/2026 en confrontant la liste à une batterie de
  // formulations réalistes, distinctes de « je vois pas comment continuer »
  // déjà couvert (celui-ci exige « comment ») : trois tournures de
  // désespoir tout aussi courantes, absentes jusqu'ici.
  'aucune raison de continuer',
  'goût à rien',
  'à quoi bon continuer',
  // Recherche demandée par Erwann le 11/09/2026, après deux faux négatifs
  // réels de suite : « la plupart des gens ne le disent pas explicitement,
  // il faut couvrir toutes les formulations indirectes ». Regroupé par
  // thème plutôt qu'ajouté au coup par coup — chaque thème correspond à un
  // signal d'alerte documenté dans la prévention du suicide, même quand la
  // formulation elle-même reste ambiguë. Posé en MODÉRÉ, pas en FORT : ces
  // tournures peuvent aussi être de simples exclamations sans lien avec une
  // crise (voir « mourir bête » plus haut, faux positif déjà assumé) — le
  // niveau modéré déclenche déjà le même message figé au moindre doute.
  //
  // Exemples donnés tels quels par Erwann :
  'quelle vie de merde',
  'quel monde de merde',
  'ça va pas du tout',
  'je vais péter un câble',
  "pourquoi tout ça m'arrive à moi",
  // Sentiment d'être pris au piège, sans issue perçue — signal d'alerte
  // documenté, distinct du désespoir général déjà couvert plus haut.
  'pris au piège',
  "pas d'autre solution",
  'aucune autre solution',
  "pas d'autre issue",
  'aucune issue',
  'dans une impasse',
  // Vide intérieur, perte de sens — distinct de l'épuisement (qui exige une
  // répétition) : ici la personne ne dit pas qu'elle est fatiguée, elle dit
  // que plus rien ne compte.
  "plus rien n'a de sens",
  "rien n'a plus de sens",
  'je ne ressens plus rien',
  "vide à l'intérieur",
  // Obsession de la mort en général, sans forcément nommer son propre
  // passage à l'acte — signal à prendre au sérieux dans un outil qui
  // s'adresse à des personnes en détresse, même si la phrase reste
  // philosophique la plupart du temps ailleurs.
  'je pense tout le temps à la mort',
  "la mort m'obsède",
  // Auto-mutilation générale, sans moyen précis nommé (les moyens précis
  // sont déjà couverts en FORT, PHRASES_MOYENS) — geste réel mais non
  // circonstancié, donc plus ambigu.
  'je me fais du mal',
  "je m'inflige de la douleur",
  // Annonce indirecte, moins explicite que les adieux du niveau fort :
  // la formule est aussi utilisée avant un simple voyage, d'où le niveau
  // modéré plutôt que fort.
  "au cas où il m'arriverait quelque chose",
  'je ne serai plus là longtemps',
  'je ne serai plus un problème',
  // « à bout » était dans la liste d'épuisement ci-dessous, qui exige une
  // répétition sur deux messages distincts. Erwann a explicitement demandé
  // le 11/09/2026 qu'une seule occurrence suffise ici aussi : la sortir de
  // ce groupe et la faire déclencher comme les autres motifs modérés,
  // conformément au principe du projet (en cas de doute, on déclenche).
  // Le reste de la liste d'épuisement (« épuisé », « plus aucune force »,
  // « vidé de toute énergie ») garde l'exigence de répétition, faute d'une
  // demande explicite équivalente pour elles.
  'à bout',
];

// Épuisement extrême : ne déclenche que s'il est exprimé de façon RÉPÉTÉE
// dans la conversation — au moins deux messages distincts — comme demandé
// explicitement par la note d'initialisation. Un seul « je suis épuisé·e »
// isolé ne suffit pas à lui seul.
const PHRASES_EPUISEMENT = [
  'épuisé',
  'épuisée',
  'plus aucune force',
  'vidé de toute énergie',
];

// Signal par CO-OCCURRENCE, pas par phrase isolée — cas signalé par Erwann
// le 11/09/2026 : « j'ai des envies bizarres ce soir j'ai peur » n'a rien
// déclenché. Ni « peur » (l'immense majorité des messages anxieux le
// contiennent, sans rapport avec une crise) ni « envie bizarre » seuls ne
// peuvent être des motifs sans faire exploser les faux positifs — mais leur
// PRÉSENCE ENSEMBLE dans le même message est un marqueur reconnu : la peur
// de ses propres pulsions inhabituelles. Chaque mot reste inoffensif seul ;
// c'est la combinaison qui compte, et elle doit apparaître dans le MÊME
// message, pas seulement la même conversation.
const MOTS_PEUR = compiler(['peur']);
const MOTS_PULSION_INQUIETANTE = compiler([
  'envie bizarre',
  'envies bizarres',
  'pulsion bizarre',
  'pulsions bizarres',
  'envie étrange',
  'envies étranges',
  'envie inquiétante',
  'peur de mes pulsions',
  'peur de moi',
]);

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
  const messageAvecPeurEtPulsion = normalises.some(
    (texte) => chercher(texte, MOTS_PEUR).length > 0 && chercher(texte, MOTS_PULSION_INQUIETANTE).length > 0,
  );
  if (messageAvecPeurEtPulsion) {
    trouves.add('peur de ses propres pulsions inhabituelles');
  }

  return {
    niveau: trouves.size > 0 ? 'modere' : 'aucun',
    motifs: Array.from(trouves),
  };
}
