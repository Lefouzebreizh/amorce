import { analyzeProject, PLAFOND_BLOQUE, type Analysis } from './analysis.ts';
import type { StepId } from './steps.ts';
import { clipDuration, MORCEAUX_MAX } from './timeline.ts';
import type { Project } from './types.ts';

/**
 * Le guide.
 *
 * Il ne donne jamais qu'**une seule** consigne à la fois. C'est le point
 * essentiel : le panneau d'analyse énumère tout ce qui pourrait être amélioré,
 * ce qui suppose de savoir par quoi commencer. Quelqu'un qui n'a jamais monté
 * ne le sait pas, et une liste de six critères le laisse aussi immobile qu'une
 * page blanche.
 *
 * L'ordre suit ce qui bloque le plus : on ne suggère pas de soigner
 * l'étalonnage à quelqu'un dont la vidéo dure deux secondes.
 */

/** Ce que le guide propose de faire, sans que l'utilisateur ait à décider. */
export type GuideAction =
  | { kind: 'goto'; step: StepId }
  | { kind: 'autoEdit' }
  | { kind: 'duplicateLongest' }
  | { kind: 'chopLongest' }
  | { kind: 'soundsOnCuts' };

export type GuideStep = {
  /** L'ordre à donner, à l'impératif. */
  title: string;
  /** La raison, en une phrase. Sans elle, la consigne devient un dogme. */
  why: string;
  actionLabel: string;
  action: GuideAction;
  /** Vrai quand il n'y a plus rien de bloquant à corriger. */
  done: boolean;
};

/** Durée en deçà de laquelle une vidéo n'a pas le temps d'exister. */
const TOO_SHORT = 7;

/** Durée au-delà de laquelle le taux de complétion s'effondre. */
const TOO_LONG = 45;

/** Au-delà, un plan s'étire et l'attention retombe. */
const LONG_SHOT = 3.5;

/** En deçà, la vidéo est trop peu sous-titrée pour être suivie sans le son. */
const MIN_COVERAGE = 0.55;

/** Prochaine chose à faire, une seule. */
export function nextStep(project: Project, analysis: Analysis = analyzeProject(project)): GuideStep {
  if (project.assets.length === 0) {
    return {
      title: 'Importe tes vidéos',
      why: 'Rien ne peut commencer sans rushes. Trois ou quatre suffisent.',
      actionLabel: 'Aller à l’import',
      action: { kind: 'goto', step: 'import' },
      done: false,
    };
  }

  if (project.clips.length === 0) {
    return {
      title: 'Lance le montage express',
      why: 'Il assemble tout d’un coup : plans courts, transitions, bruitages, rendu cinéma. Tu retoucheras ensuite.',
      actionLabel: 'Monter automatiquement',
      action: { kind: 'autoEdit' },
      done: false,
    };
  }

  if (analysis.duration < TOO_SHORT) {
    return {
      title: `Ta vidéo ne dure que ${analysis.duration.toFixed(1)} s`,
      why: 'Trop court pour installer quoi que ce soit. Vise 15 à 30 s. Duplique un plan et modifie la copie.',
      actionLabel: 'Dupliquer un plan',
      action: { kind: 'duplicateLongest' },
      done: false,
    };
  }

  /*
   * Un rush unique et long passe **avant** l'accroche, alors que la découpe
   * vient après elle dans le cas général. Ce n'est pas une exception de
   * confort : une accroche écrite sur un plan de vingt secondes sans coupe
   * devra être replacée dès qu'on le découpera, et le découpage change à ce
   * point la vidéo qu'il rend le travail précédent caduc.
   *
   * Mesuré : après l'import d'une seule vidéo de 19,5 s, le bouton de découpe
   * n'était atteignable qu'en passant à l'étape 2 puis en touchant le plan sur
   * la timeline — deux gestes de plus, sur un téléphone, pour l'action qui
   * apporte le plus.
   */
  /*
   * Trop long **avant** de proposer la découpe.
   *
   * La règle des quarante-cinq secondes existait déjà, mais elle venait après.
   * Un rush de cinquante-six secondes recevait donc d'abord « découper en
   * vingt-huit plans de 2 s » — et vingt-huit morceaux de la même prise ne font
   * pas un montage, ils font la même prise coupée vingt-huit fois. Rapporté
   * ainsi : « il m'a mis la vidéo en cinquante secondes, il a ajouté des plans
   * partout, il a tout découpé ».
   *
   * L'ordre juste est l'inverse : on raccourcit, puis on découpe ce qui reste.
   * Découper d'abord multiplie le travail de raccourcissement par vingt-huit.
   */
  const single = project.clips.length === 1 ? clipDuration(project.clips[0]) : 0;
  if (single > TOO_LONG) {
    return {
      title: `Ton rush fait ${single.toFixed(0)} s`,
      why: 'Trop long pour un format court, et le découper d’abord donnerait des dizaines de '
        + 'morceaux d’une même prise. Garde le meilleur passage — vingt secondes suffisent — '
        + 'puis on découpera.',
      actionLabel: 'Raccourcir le plan',
      action: { kind: 'goto', step: 'montage' },
      done: false,
    };
  }

  if (single > LONG_SHOT * 2) {
    const pieces = Math.min(MORCEAUX_MAX, Math.floor(single / 2));
    return {
      title: `Un seul plan de ${single.toFixed(1)} s`,
      why: 'Une vidéo sans coupe se regarde comme un plan fixe, quel que soit son contenu. '
        + 'Découpe d\u2019abord : l\u2019accroche et les bruitages se poseront sur les raccords.',
      actionLabel: `Découper en ${pieces} plans`,
      action: { kind: 'chopLongest' },
      done: false,
    };
  }

  const hasHook = project.captions.some((c) => c.start <= 1.2 && c.end > c.start && c.text.trim().length > 0);
  if (!hasHook) {
    return {
      title: 'Écris ton accroche',
      why: 'Le spectateur ne choisit pas de regarder, il choisit de ne pas passer. Un texte dès la première image change tout.',
      actionLabel: 'Choisir une accroche',
      action: { kind: 'goto', step: 'texte' },
      done: false,
    };
  }

  const longest = Math.max(...project.clips.map(clipDuration));
  if (longest > LONG_SHOT) {
    return {
      title: `Découpe ton plan de ${longest.toFixed(1)} s`,
      why: 'Au-delà de 3 secondes sans qu’il se passe rien, le pouce repart. Des plans courts relancent l’attention.',
      actionLabel: 'Découper en plans de 2 s',
      action: { kind: 'chopLongest' },
      done: false,
    };
  }

  // Bruitages de synthèse et fichiers déposés comptent ensemble : l'oreille ne
  // les distingue pas, et réclamer des whooshs à quelqu'un qui a déposé ses
  // propres impacts serait absurde.
  if (project.cues.length + project.samples.length < Math.max(2, Math.floor(analysis.duration / 8))) {
    return {
      title: 'Ponctue tes coupes',
      why: 'Un bruitage sur chaque raccord transforme une suite de plans en rythme. C’est ce qui s’entend le plus.',
      actionLabel: 'Poser les bruitages',
      action: { kind: 'soundsOnCuts' },
      done: false,
    };
  }

  const coverage = analysis.criteria.find((c) => c.id === 'texte')?.score ?? 1;
  if (coverage < MIN_COVERAGE) {
    return {
      title: 'Ajoute des sous-titres',
      why: 'La majorité regarde sans le son. Sans texte, ton message ne passe pas.',
      actionLabel: 'Aller aux textes',
      action: { kind: 'goto', step: 'texte' },
      done: false,
    };
  }

  if (analysis.duration > TOO_LONG) {
    return {
      title: `${analysis.duration.toFixed(0)} s, c’est long`,
      why: 'Sous 35 s, la part de spectateurs qui vont au bout grimpe nettement — et c’est ce taux qui décide de ta diffusion.',
      actionLabel: 'Raccourcir des plans',
      action: { kind: 'goto', step: 'montage' },
      done: false,
    };
  }

  if (project.cinema.look === 'naturel') {
    return {
      title: 'Choisis un rendu',
      why: 'Un étalonnage bien dosé sépare une vidéo amateur d’une vidéo tenue. Ça prend dix secondes.',
      actionLabel: 'Voir les rendus',
      action: { kind: 'goto', step: 'cinema' },
      done: false,
    };
  }

  /*
   * Un défaut bloquant passe avant le feu vert.
   *
   * Le guide annonçait « ton montage tient la route » sur un film dont les
   * quatre textes affichaient encore « [Ce qui menace] » — et la note, elle,
   * était plafonnée à quarante. Deux voix qui se contredisent dans la même
   * interface valent moins qu'une seule qui dit non : l'utilisateur suit celle
   * qui l'arrange, publie, et découvre ses crochets sur la plateforme.
   *
   * On reprend le premier bloquant tel qu'il est écrit dans l'analyse plutôt
   * que de le reformuler ici : deux formulations du même défaut dériveraient,
   * et c'est l'analyse qui mesure.
   */
  const bloquant = analysis.bloquants[0];
  if (bloquant) {
    return {
      title: bloquant.probleme,
      why: `${bloquant.remede} Tant que ça reste, la note ne dépassera pas ${PLAFOND_BLOQUE}.`,
      actionLabel: 'Voir ce qui bloque',
      action: { kind: 'goto', step: 'analyse' },
      done: false,
    };
  }

  return {
    title: 'Ton montage tient la route',
    why: `Note de ${analysis.score} sur 100. Tu peux exporter, ou continuer à peaufiner dans l’analyse.`,
    actionLabel: 'Exporter la vidéo',
    action: { kind: 'goto', step: 'export' },
    done: true,
  };
}
