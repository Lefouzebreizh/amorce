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
// bêta.
//
// PRINCIPE DE DÉCISION, reformulé par Erwann le 11/09/2026 après plusieurs
// faux négatifs corrigés cas par cas (ce qui ne finit jamais — il y aura
// toujours une formulation à laquelle on n'a pas pensé) : la question n'est
// plus « ce message est-il probablement une crise ? » mais « existe-t-il une
// interprétation plausible et raisonnable de ce message qui indique une
// détresse — même si ce n'est pas la lecture la plus probable, même si
// d'autres lectures plus anodines existent ? ». Si oui, la couche 1
// déclenche, sans attendre de répétition ni de confirmation. Test mental :
// si un professionnel de santé mentale examinait ce message après coup et
// qu'un vrai signal était passé inaperçu, pourrait-il reprocher à l'outil
// de ne pas avoir réagi ? Si oui, même partiellement, on déclenche.
// Conséquence assumée et voulue : plus de faux positifs (des messages
// anodins recevront le message de sécurité) contre moins de faux négatifs.
// C'est un compromis explicitement choisi, pas un défaut à corriger.
//
// Cette reformulation a une limite structurelle qu'il faut dire, pas taire :
// un moteur à motifs, aussi large soit son lexique, ne reconnaît que les
// formulations qu'on lui a explicitement données — il ne « comprend » rien
// à une tournure vraiment inédite, ce qu'un LLM ferait. Le principe
// fondateur du projet (SECURITY.md : « la sécurité ne repose jamais sur le
// LLM seul ») interdit d'y répondre en faisant juger ce message par le LLM
// conversationnel lui-même. Élargir malgré cette limite, en couvrant des
// FAMILLES de signaux plutôt que des cas isolés, est donc la meilleure
// approximation déterministe du principe ci-dessus — pas son accomplissement
// complet. Voir SECURITY.md pour la suite (l'option d'un second verrou,
// distinct du LLM conversationnel, reste une décision de produit non prise).
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
 * "jeveu") ou trouvées en production ("jen" → "j en"), puis toute
 * ponctuation ramenée à une espace.
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
    // « œ » et « æ » ne sont pas décomposés par NFD (ce ne sont pas des
    // lettres accentuées mais des ligatures) : sans cette ligne, ils
    // tombent dans le nettoyage non-alphanumérique plus bas et laissent un
    // trou (« cœur » → « c ur »). Trouvé le 11/09/2026 en écrivant
    // « j'ai le cœur brisé » dans la liste de motifs.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/(.)\1+/g, '$1')
    .replace(/\bjeveux?\b/g, 'je veux')
    .replace(/\bjve\b/g, 'je veux')
    // Trouvé le 11/09/2026 en confrontant la liste à une batterie de
    // formulations réalistes : « jv en finir » ne matchait pas, la
    // contraction n'ayant pas été anticipée à côté de « jve ».
    .replace(/\bjv\b/g, 'je veux')
    // Retest personnel d'Erwann le 12/09/2026 en production : « jen peux
    // plus » (contraction orale très courante de « j'en peux plus », sans
    // apostrophe et les deux lettres collées) n'a rien déclenché. Le motif
    // « j'en peux plus » se normalise en "j en peux plus" — deux mots
    // distincts — mais le message tapé "jen peux plus" ne contient nulle
    // part le mot isolé "j" : `\bj\b` ne matche jamais à l'intérieur de
    // "jen". Même famille de contraction que « jve »/« jv » ci-dessus, donc
    // même parade : on la déplie AVANT la compilation, des deux côtés.
    .replace(/\bjen\b/g, 'j en')
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
    // Jusqu'à deux mots intercalés sont tolérés entre deux mots du motif.
    // Un seul suffisait jusqu'au 11/09/2026 — trouvé en production ce
    // jour-là : « j'ai des idées très noires » ne déclenchait pas, le motif
    // « idées noires » exigeant une contiguïté stricte qu'un simple
    // intensificateur ("très", "vraiment", "un peu") suffit à casser.
    // Le passage à deux mots, le même jour, vient d'un second cas réel :
    // « je suis chafoinje vais faire une bétise » (un mot-valise de frappe,
    // "chafoin" + "je" collés sans espace) ne déclenchait pas non plus,
    // alors que "je vais faire une bêtise" y est bien présent — mais entre
    // le "je" repérable (celui de "je suis") et "vais" s'intercalaient DEUX
    // mots, "suis" et "chafoinje", pas un seul. Le principe du projet est
    // qu'en cas de doute on déclenche ; exiger l'énumération de chaque
    // intensificateur ou de chaque accident de frappe possible pour chaque
    // motif serait l'inverse. Aucun des mots tolérés ne peut être une
    // négation (voir PARTICULES_NEGATION_EXCLUES ci-dessus) — sans quoi la
    // tolérance elle-même deviendrait le trou par lequel une négation se
    // glisse sans être vue ; c'est vrai quel que soit le nombre de mots
    // tolérés, chacun étant vérifié individuellement. Le reste n'ajoute que
    // des correspondances par rapport à l'ancienne contiguïté stricte : un
    // motif qui matchait avant matche toujours.
    regex: new RegExp(
      `\\b${normaliser(phrase).replace(/ /g, `\\s+(?:(?!(?:${NEGATION_EXCLUE})\\b)\\S+\\s+){0,2}`)}\\b`,
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
  // Trouvés en testant en production juste après la fusion du motif
  // « fardeau » : deux formulations tout aussi courantes et absentes,
  // proches de motifs déjà couverts mais avec un verbe différent.
  'je pèse sur tout le monde',
  'peser sur tout le monde',
  "ça ne s'arrangera jamais",
  "ça s'arrangera jamais",
  "ça n'ira jamais mieux",
  'ça ira jamais mieux',
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
  // Revue du 11/09/2026 (audit des signaux ambigus/diffus, à la demande
  // d'Erwann) : « à quoi bon continuer » exige le mot « continuer », qui
  // manque souvent — la personne dit juste « à quoi bon », en soupir, sans
  // rien continuer à nommer. C'est une lecture de détresse raisonnable même
  // isolée ; posé en MODÉRÉ comme le reste de ce bloc.
  'à quoi bon',
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
  // Vide intérieur, perte de sens — distinct de l'épuisement (fatigue) :
  // ici la personne ne dit pas qu'elle est fatiguée, elle dit que plus rien
  // ne compte.
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
  // « à bout » était dans un groupe d'épuisement qui exigeait une répétition
  // sur deux messages distincts. Erwann a demandé le 11/09/2026 qu'une seule
  // occurrence suffise — et la reformulation du principe de décision, le
  // même jour, a supprimé l'idée même d'exiger une répétition ou une
  // confirmation pour N'IMPORTE QUEL motif modéré. Les autres membres de cet
  // ancien groupe (« épuisé », « plus aucune force », « vidé de toute
  // énergie ») rejoignent donc « à bout » ci-dessous, dans ce même bloc,
  // pour la même raison — pas seulement lui.
  'à bout',
  'épuisé',
  'épuisée',
  'plus aucune force',
  'vidé de toute énergie',
  // Revue du 11/09/2026 (audit des signaux ambigus/diffus, à la demande
  // d'Erwann) : « je suis fatigué de tout » n'était couvert par aucun motif
  // — seul « épuisé » l'était, un mot différent. Le qualificatif « de tout »
  // distingue cette lassitude totalisante d'une simple fatigue physique
  // passagère ("je suis fatigué, je vais me coucher") : sans lui, « fatigué »
  // seul ferait déclencher la quasi-totalité des messages du soir, bien
  // au-delà du compromis faux positifs/faux négatifs assumé par ce projet.
  'fatigué de tout',
  'fatiguée de tout',
  // Retest personnel d'Erwann le 12/09/2026 : « marre de tout » n'a rien
  // déclenché. Même famille et même garde-fou que « fatigué de tout »
  // juste au-dessus : c'est le qualificatif « de tout » qui distingue le
  // ras-le-bol général d'un agacement ponctuel et anodin ("j'en ai marre
  // de cette pluie") — « marre » seul ne doit pas devenir un motif.
  'marre de tout',
  //
  // Bloc ajouté le 11/09/2026 suite à la reformulation du principe de
  // décision : plutôt que de continuer à corriger cas par cas (ce qui ne
  // finit jamais), ce bloc couvre des FAMILLES de signaux — effondrement,
  // isolement, perte d'élan, perte de contrôle — chacune écrite en phrases
  // à la première personne pour rester ancrée sur l'état de la personne
  // elle-même, jamais sur un objet ou une situation extérieure. Le test
  // appliqué à chaque ajout : une lecture de détresse en est-elle une
  // interprétation raisonnable, même minoritaire ? Si oui, elle entre ici.
  //
  // Effondrement / craquage. Chaque état s'écrit sous les deux tournures
  // les plus courantes pour le dire à la première personne (« je suis X »
  // et « je me sens X ») — trouvé le 11/09/2026 en testant en production :
  // « je me sens complètement effondrée » ne déclenchait pas, seule la
  // forme « je suis effondrée » étant couverte.
  'je craque',
  "je m'effondre",
  'je suis effondré',
  'je suis effondrée',
  'je me sens effondré',
  'je me sens effondrée',
  'je suis anéanti',
  'je suis anéantie',
  'je me sens anéanti',
  'je me sens anéantie',
  'je suis brisé',
  'je suis brisée',
  'je me sens brisé',
  'je me sens brisée',
  "j'ai le cœur brisé",
  'je suis submergé',
  'je suis submergée',
  'je me sens submergé',
  'je me sens submergée',
  "je m'écroule",
  "je n'y arrive plus",
  "j'abandonne",
  // Perte de repère, très courante et absente jusqu'ici — distincte de
  // « je ne sais plus qui je suis » plus bas, qui est une forme plus forte.
  'je suis perdu',
  'je suis perdue',
  'je me sens perdu',
  'je me sens perdue',
  //
  // Isolement et sentiment de fardeau, au-delà de ce qui était déjà couvert.
  'personne ne me comprend',
  'je me sens seul au monde',
  'je me sens seule au monde',
  'je gêne tout le monde',
  'je dérange tout le monde',
  'je suis un boulet',
  'un boulet pour tout le monde',
  // « fardeau » manquait alors que c'est le mot le plus courant pour ce
  // signal — trouvé en testant en production juste après la fusion du bloc
  // ci-dessus : « j'ai l'impression d'être un fardeau pour ma famille » ne
  // déclenchait pas.
  'je suis un fardeau',
  'un fardeau pour ma famille',
  'un fardeau pour mes proches',
  'un fardeau pour tout le monde',
  'je ne compte pour personne',
  'je ne compte plus pour personne',
  "personne ne s'apercevrait de mon absence",
  'personne ne remarquerait mon absence',
  //
  // Perte d'élan, anhédonie — distinct du vide déjà couvert plus haut.
  'plus envie de rien',
  'envie de rien',
  'rien ne me fait plus envie',
  'je suis vide',
  'je me sens vide',
  'complètement vide',
  //
  // Perte de contrôle ou de repère sur soi-même.
  'je perds pied',
  "j'ai perdu pied",
  'je perds le contrôle',
  'je ne me reconnais plus',
  'je ne sais plus qui je suis',
  // Trouvé le 11/09/2026 dans le retest personnel d'Erwann : « pas bien ce
  // soir je ne sais plus quoi faire » n'a rien déclenché. Le motif s'écrit
  // sans « je » ni « ne » en tête, comme « veux plus vivre » plus haut dans
  // PHRASES_FORTES — ainsi il matche aussi bien la forme « je ne sais plus
  // quoi faire » que sa forme orale sans négation, « je sais plus quoi
  // faire », sans dépendre d'un mot que la personne peut très bien omettre.
  'sais plus quoi faire',
  //
  // Désespoir direct, ancré à la première personne pour éviter qu'un mot
  // isolé ("insupportable", "invivable") ne déclenche sur n'importe quel
  // objet ou situation extérieure sans rapport avec la personne elle-même.
  'je suis désespéré',
  'je suis désespérée',
  'je me sens désespéré',
  'je me sens désespérée',
  'ma vie est invivable',
  'ma vie est insupportable',
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
// Libellé SYNTHÉTIQUE ajouté au journal quand la co-occurrence ci-dessous
// déclenche : ce n'est jamais une phrase que la personne a prononcée, juste
// une description de la combinaison qui a fait déclencher. `crisisMessage.ts`
// porte SA PROPRE copie de cette chaîne (jamais un import de ce fichier :
// même raison que le duplicata Deno documenté dans orchestrer.ts — un fichier
// de couche 1 ne dépend d'aucun autre fichier de couche 1) pour ne JAMAIS le
// citer comme si la personne l'avait dit — les deux doivent rester identiques
// mot pour mot.
const MOTIF_NON_CITABLE = 'peur de ses propres pulsions inhabituelles';

const MOTS_PEUR = compiler(['peur', 'terreur', 'effroi']);
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
  // Élargi le 11/09/2026, même famille de signal : une pulsion, une pensée
  // ou une idée qualifiée d'étrange/bizarre reste gênante à nommer par un
  // mot précis, quel que soit le mot que la personne choisit pour la dire.
  'pulsion étrange',
  'pulsions étranges',
  'pensée bizarre',
  'pensées bizarres',
  'idée bizarre',
  'idées bizarres',
]);

const MOTIFS_FORTS = compiler(PHRASES_FORTES);
const MOTIFS_PLAN = compiler(PHRASES_PLAN);
const MOTIFS_MOYENS = compiler(PHRASES_MOYENS);
const MOTIFS_MODERES = compiler(PHRASES_MODEREES);

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
  const messageAvecPeurEtPulsion = normalises.some(
    (texte) => chercher(texte, MOTS_PEUR).length > 0 && chercher(texte, MOTS_PULSION_INQUIETANTE).length > 0,
  );
  if (messageAvecPeurEtPulsion) {
    trouves.add(MOTIF_NON_CITABLE);
  }

  return {
    niveau: trouves.size > 0 ? 'modere' : 'aucun',
    motifs: Array.from(trouves),
  };
}
