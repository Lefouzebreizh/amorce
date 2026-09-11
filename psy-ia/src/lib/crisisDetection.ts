// Couche 1 de l'architecture de sécurité de Psy IA : détection de crise
// déterministe, hors LLM. Tourne AVANT toute génération et intercepte la
// conversation elle-même — un modèle qu'on convaincrait de répondre « quand
// même » n'a jamais l'occasion de le faire, puisque ce filtre n'invoque
// aucun modèle et ne peut donc pas être « discuté ». Voir SECURITY.md.
//
// La liste de motifs ci-dessous est un POINT DE DÉPART, pas une liste
// validée cliniquement : elle reprend telle quelle la note d'initialisation
// du projet (voir TODO.md, couche 4). Elle doit être enrichie et validée par
// un professionnel de santé mentale avant toute mise en ligne, même en
// bêta. Principe directeur, explicitement posé dans cette même note : en cas
// de doute, on déclenche — un faux positif est gênant, un faux négatif est
// inacceptable.

export type NiveauCrise = 'aucun' | 'modere' | 'fort';

export interface ResultatDetectionCrise {
  niveau: NiveauCrise;
  /** Motifs qui ont déclenché, pour le journal d'audit — jamais montré à la personne. */
  motifs: string[];
}

/**
 * Normalise un message pour la détection : accents retirés, minuscules,
 * lettres répétées ramenées à une seule occurrence ("mourrrir" → "mourir"), quelques
 * contractions phonétiques citées dans la note d'initialisation ("jve",
 * "jeveu"), puis toute ponctuation ramenée à une espace. Un professionnel
 * pourra enrichir ce dictionnaire de contractions ; la structure ne change
 * pas.
 */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/\bjeveu(x)?\b/g, 'je veux')
    .replace(/\bjve\b/g, 'je veux')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Motif {
  motif: string;
  regex: RegExp;
}

// --- Niveau fort : tournures explicites autour du suicide et de la mort
// volontaire (déclenchement systématique). ---
const MOTIFS_FORTS: Motif[] = [
  { motif: 'veut mourir', regex: /\bveu[xt]\s+mourir\b/ },
  { motif: 'envie de mourir', regex: /\benvie\s+de\s+mourir\b/ },
  { motif: 'veut en finir', regex: /\bveu[xt]\s+en\s+finir\b/ },
  { motif: 'plus envie de vivre', regex: /\bplus\s+envie\s+de\s+vivre\b/ },
  { motif: 'veut plus vivre', regex: /\bveu[xt]\s+plus\s+vivre\b/ },
  { motif: 'va se suicider', regex: /\bvais\s+me\s+suicider\b/ },
  { motif: 'va se tuer', regex: /\bvais\s+me\s+tuer\b/ },
  { motif: 'pense au suicide', regex: /\bpense\s+au\s+suicide\b/ },
  { motif: 'veut disparaitre', regex: /\bveu[xt]\s+disparaitre\b/ },
  { motif: 'veut partir pour de bon', regex: /\bveu[xt]\s+partir\s+pour\s+de\s+bon\b/ },
];

// Mention d'un plan concret ou d'un moyen — niveau fort lui aussi.
const MOTIFS_PLAN: Motif[] = [
  { motif: 'moyen médicamenteux préparé', regex: /\bmedicaments\s+qu\s+il\s+faut\b/ },
  { motif: 'tout préparé', regex: /\btout\s+prepare\b/ },
  { motif: 'moment choisi', regex: /\bce\s+soir\s+c\s+est\s+le\s+bon\s+moment\b/ },
];

// Moyens précis mentionnés isolément — la note dit « toute mention d'un
// moyen précis ». Liste non exhaustive et volontairement resserrée : au-delà
// de ces termes très explicites, le risque de faux positif mal calibré est
// trop élevé sans validation professionnelle (voir TODO.md).
const MOTIFS_MOYENS: RegExp[] = [
  /\bpendaison\b/,
  /\bme\s+pendre\b/,
  /\bsauter\s+du\s+(pont|toit|imeuble)\b/,
  /\bme\s+jeter\s+sous\s+(un|le)\s+train\b/,
  /\barme\s+a\s+feu\b/,
  /\bavaler\s+(tous|toutes)?\s*(les|des)\s+(cachets|comprimes|medicaments)\b/,
  /\bfaire\s+une\s+overdose\b/,
  /\bme\s+couper\s+les\s+veines\b/,
];

// --- Niveau modéré : désespoir profond et sentiment de fardeau (bascule au
// moindre doute, dès une seule occurrence). ---
const MOTIFS_MODERES: Motif[] = [
  { motif: 'sert à rien', regex: /\bje\s+sers?\s+a\s+rien\b/ },
  { motif: "tout le monde irait mieux sans moi", regex: /\btout\s+le\s+monde\s+irait\s+mieux\s+sans\s+moi\b/ },
  { motif: 'poids pour tout le monde', regex: /\bpoids\s+pour\s+tout\s+le\s+monde\b/ },
  { motif: "ça ne s'arrangera jamais", regex: /\bca\s+(ne\s+)?s\s+arangera\s+jamais\b/ },
  { motif: "n'en peut plus", regex: /\ben\s+peux\s+plus\b/ },
  { motif: 'ne voit pas comment continuer', regex: /\bvois\s+pas\s+coment\s+continuer\b/ },
  // Négation inversée — ajoutée le 11/09/2026 suite à une relecture externe
  // de la note de cadrage. « Je veux mourir » (négation directe absente) est
  // déjà couvert en niveau fort ; « je ne veux plus vivre » (négation
  // directe) l'est déjà via le motif « veut plus vivre » ci-dessus, puisque
  // « ne » n'empêche pas le sous-texte de matcher. Ce qui manquait était la
  // forme inversée : une personne qui dit craindre ou refuser la mort peut
  // signaler la même détresse par ambivalence — l'hésitation entre vouloir
  // vivre et vouloir mourir est un marqueur documenté, pas un non-signal.
  // Posé en niveau MODÉRÉ et non FORT : contrairement aux tournures
  // ci-dessus, la phrase peut aussi être parfaitement anodine (« je veux pas
  // mourir bête », tournure familière sans rapport avec le suicide) — le
  // niveau modéré déclenche déjà le même message figé au moindre doute
  // (principe directeur de la couche 1), sans sur-classer un motif plus
  // ambigu que les autres.
  { motif: 'négation inversée (peur de mourir)', regex: /\bveu[xt]\s+pas\s+mourir\b/ },
];

// Épuisement extrême : ne déclenche que s'il est exprimé de façon RÉPÉTÉE
// dans la conversation — au moins deux messages distincts — comme demandé
// explicitement par la note d'initialisation. Un seul « je suis épuisé·e »
// isolé ne suffit pas à lui seul.
const MOTIFS_EPUISEMENT: RegExp[] = [
  /\bepuise/,
  /\ba\s+bout\b/,
  /\bvide[e]?\s+de\s+toute\s+energie\b/,
  /\bplus\s+(aucune|de)\s+force\b/,
];

function chercherMotifs(texteNormalise: string, table: Motif[]): string[] {
  return table.filter(({ regex }) => regex.test(texteNormalise)).map(({ motif }) => motif);
}

/**
 * Détecte un signal de crise sur l'ENSEMBLE de la conversation, pas
 * seulement le dernier message : le signal peut se construire
 * progressivement (note d'initialisation, couche 1). `messagesUtilisateur`
 * doit porter tous les messages de la personne depuis le début de la
 * session, dans l'ordre — jamais seulement le dernier.
 */
export function detecterCrise(messagesUtilisateur: string[]): ResultatDetectionCrise {
  const normalises = messagesUtilisateur.map(normaliser);
  const motifsTrouves = new Set<string>();
  let niveau: NiveauCrise = 'aucun';

  for (const texte of normalises) {
    chercherMotifs(texte, MOTIFS_FORTS).forEach((m) => motifsTrouves.add(m));
    chercherMotifs(texte, MOTIFS_PLAN).forEach((m) => motifsTrouves.add(m));
    if (MOTIFS_MOYENS.some((regex) => regex.test(texte))) {
      motifsTrouves.add("mention d'un moyen précis");
    }
  }
  if (motifsTrouves.size > 0) niveau = 'fort';

  if (niveau !== 'fort') {
    for (const texte of normalises) {
      chercherMotifs(texte, MOTIFS_MODERES).forEach((m) => motifsTrouves.add(m));
    }
    const messagesAvecEpuisement = normalises.filter((texte) =>
      MOTIFS_EPUISEMENT.some((regex) => regex.test(texte)),
    ).length;
    if (messagesAvecEpuisement >= 2) {
      motifsTrouves.add('épuisement extrême répété');
    }
    if (motifsTrouves.size > 0) niveau = 'modere';
  }

  return { niveau, motifs: Array.from(motifsTrouves) };
}
