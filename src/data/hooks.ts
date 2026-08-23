import type { HookPattern, OpeningPreset } from '../types'

/**
 * Bibliothèque d'accroches (cahier §3.5). Chaque patron associe une structure
 * de phrase, un rythme de montage conseillé (points de coupe en secondes) et un
 * score estimé. Ces scores sont des repères issus des signaux que mesure
 * `lib/hookScore.ts`, pas une garantie de performance.
 */
export const hookPatterns: HookPattern[] = [
  {
    id: 'hk-what-if',
    name: { fr: 'Et si…', en: 'What if…' },
    template: {
      fr: 'Et si {situation} n’était pas du tout ce que tu crois ?',
      en: 'What if {situation} isn’t at all what you think?',
    },
    rationale: {
      fr: 'Ouvre une boucle mentale : le spectateur reste pour la refermer.',
      en: 'Opens a mental loop the viewer stays to close.',
    },
    pace: 'moyen',
    cuts: [1.1, 2.4],
    transitionId: 'tr-fade',
    estimatedScore: 74,
  },
  {
    id: 'hk-underestimated',
    name: { fr: 'Ils l’ont sous-estimé', en: 'They underestimated it' },
    template: {
      fr: 'Tout le monde a sous-estimé {sujet}. Voilà ce qui s’est passé.',
      en: 'Everyone underestimated {subject}. Here’s what happened.',
    },
    rationale: {
      fr: 'Promesse de retournement : l’enjeu est posé dès la première seconde.',
      en: 'Promise of a reversal: the stake is set in the first second.',
    },
    pace: 'rapide',
    cuts: [0.6, 1.3, 2.1],
    transitionId: 'tr-cut-flash',
    estimatedScore: 86,
  },
  {
    id: 'hk-delayed-reveal',
    name: { fr: 'Révélation différée', en: 'Delayed reveal' },
    template: {
      fr: 'Je ne montre {objet} qu’à la fin — mais regarde déjà ça.',
      en: 'I only show {object} at the end — but look at this first.',
    },
    rationale: {
      fr: 'Le report de la récompense soutient la rétention jusqu’au bout.',
      en: 'Delaying the payoff sustains retention to the end.',
    },
    pace: 'moyen',
    cuts: [0.9, 2.0],
    transitionId: 'tr-zoom-punch',
    estimatedScore: 81,
  },
  {
    id: 'hk-mistake',
    name: { fr: 'L’erreur que tout le monde fait', en: 'The mistake everyone makes' },
    template: {
      fr: '99 % des gens font cette erreur avec {sujet}.',
      en: '99% of people make this mistake with {subject}.',
    },
    rationale: {
      fr: 'Menace implicite sur la compétence du spectateur : il se sent concerné.',
      en: 'Implicit threat to the viewer’s competence: they feel targeted.',
    },
    pace: 'rapide',
    cuts: [0.5, 1.1, 1.8, 2.5],
    transitionId: 'tr-glitch',
    estimatedScore: 89,
  },
  {
    id: 'hk-countdown',
    name: { fr: 'Compte à rebours', en: 'Countdown' },
    template: {
      fr: '3 choses à savoir sur {sujet} — la troisième change tout.',
      en: '3 things to know about {subject} — the third changes everything.',
    },
    rationale: {
      fr: 'Structure annoncée : le spectateur sait combien de temps investir.',
      en: 'Announced structure: the viewer knows how long to invest.',
    },
    pace: 'rapide',
    cuts: [0.7, 1.4, 2.2],
    transitionId: 'tr-slice-h',
    estimatedScore: 83,
  },
  {
    id: 'hk-in-media-res',
    name: { fr: 'En plein milieu', en: 'In media res' },
    template: {
      fr: '…et c’est là que {événement}. Je reprends depuis le début.',
      en: '…and that’s when {event}. Let me start over.',
    },
    rationale: {
      fr: 'Démarrage au pic d’action : aucune seconde d’installation perdue.',
      en: 'Starts at the action peak: no setup seconds wasted.',
    },
    pace: 'rapide',
    cuts: [0.4, 1.0, 1.7],
    transitionId: 'tr-cut-black',
    estimatedScore: 92,
  },
  {
    id: 'hk-confession',
    name: { fr: 'Aveu personnel', en: 'Personal confession' },
    template: {
      fr: 'J’ai perdu {chose} à cause de {raison}. Voilà ce que j’en retiens.',
      en: 'I lost {thing} because of {reason}. Here’s what I learned.',
    },
    rationale: {
      fr: 'Vulnérabilité assumée : crée une proximité immédiate.',
      en: 'Owned vulnerability: creates immediate closeness.',
    },
    pace: 'lent',
    cuts: [1.6],
    transitionId: 'tr-dissolve',
    estimatedScore: 68,
  },
  {
    id: 'hk-contrast',
    name: { fr: 'Avant / après', en: 'Before / after' },
    template: {
      fr: 'Voilà {sujet} avant. Et voilà après {durée}.',
      en: 'Here’s {subject} before. And here it is after {duration}.',
    },
    rationale: {
      fr: 'Preuve visuelle immédiate : le bénéfice est montré, pas raconté.',
      en: 'Immediate visual proof: the benefit is shown, not told.',
    },
    pace: 'moyen',
    cuts: [1.0, 2.0],
    transitionId: 'tr-slide-left',
    estimatedScore: 79,
  },
]

/**
 * Styles d'ouverture de la maquette validée (cahier §3.4). Les scores affichés
 * restent ceux de la maquette et sont présentés comme des références : le score
 * réellement mesuré sur la vidéo est calculé séparément.
 */
export const openingPresets: OpeningPreset[] = [
  {
    id: 'op-choc',
    name: { fr: 'Choc direct', en: 'Direct shock' },
    description: {
      fr: 'Action immédiate, coupes serrées, aucune installation.',
      en: 'Immediate action, tight cuts, no setup.',
    },
    referenceScore: 91,
    pace: 'rapide',
    cuts: [0.5, 1.1, 1.7],
    transitionId: 'tr-cut-flash',
  },
  {
    id: 'op-teasing',
    name: { fr: 'Teasing', en: 'Teasing' },
    description: {
      fr: 'Promesse posée, révélation retenue quelques secondes.',
      en: 'Promise set, reveal held back a few seconds.',
    },
    referenceScore: 78,
    pace: 'moyen',
    cuts: [0.9, 2.0],
    transitionId: 'tr-zoom-punch',
  },
  {
    id: 'op-narratif',
    name: { fr: 'Narratif lent', en: 'Slow narrative' },
    description: {
      fr: 'Mise en contexte posée, montage aéré.',
      en: 'Calm context setting, roomy editing.',
    },
    referenceScore: 52,
    pace: 'lent',
    cuts: [1.8],
    transitionId: 'tr-fade',
  },
]

export const hookById = new Map(hookPatterns.map((h) => [h.id, h]))
