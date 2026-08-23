import { layoutClips, totalDuration, type PlacedClip } from './timeline.ts';
import type { Caption, Project } from './types.ts';

/**
 * Analyse de viralité.
 *
 * Ce moteur note la **structure du montage** — rythme des coupes, force du
 * hook, ponctuation sonore, couverture en texte, tenue de la tension. Il ne
 * regarde pas le contenu des images : il ne sait pas si le plan est beau ni si
 * la punchline est drôle. Ce qu'il sait faire, c'est repérer ce qui fait
 * décrocher mécaniquement — un début mou, un plan qui traîne, un trou de
 * plusieurs secondes sans rien pour relancer l'attention.
 *
 * Toutes les cibles ci-dessous visent le format vertical court.
 */

/** Fenêtre d'attention décisive : si c'est raté ici, le reste ne sera pas vu. */
export const HOOK_WINDOW = 3;

/** Fréquence d'échantillonnage de la courbe de tension, en Hz. */
const SAMPLE_RATE = 20;

/** En dessous de ce niveau, l'attention du spectateur retombe. */
const LOW_TENSION = 0.28;

/** Durée à partir de laquelle un passage mou devient un décrochage. */
const SLUMP_MIN_DURATION = 2.5;

export type CriterionId = 'hook' | 'rythme' | 'tension' | 'texte' | 'son' | 'format';

export type Criterion = {
  id: CriterionId;
  label: string;
  /** Note brute de 0 à 1. */
  score: number;
  /** Poids dans la note finale, en points sur 100. */
  weight: number;
  /** Ce que mesure le critère, en une phrase. */
  detail: string;
};

/** Un passage où la tension retombe trop longtemps. */
export type TensionSlump = {
  start: number;
  end: number;
  duration: number;
};

export type Advice = {
  /** Points de note récupérables en corrigeant ce point. */
  impact: number;
  message: string;
};

export type Analysis = {
  /** Note globale sur 100. */
  score: number;
  /** Appréciation courte associée à la note. */
  verdict: string;
  criteria: Criterion[];
  /** Courbe de tension échantillonnée, valeurs de 0 à 1. */
  curve: { time: number; value: number }[];
  slumps: TensionSlump[];
  advice: Advice[];
  duration: number;
  shotCount: number;
  /** Durée moyenne d'un plan, en secondes. */
  averageShot: number;
};

/**
 * Note une valeur selon une plage idéale.
 *
 * Renvoie 1 dans l'intervalle `[idealMin, idealMax]`, puis décroît linéairement
 * jusqu'à 0 aux bornes `hardMin` / `hardMax`.
 */
export function band(
  value: number,
  idealMin: number,
  idealMax: number,
  hardMin: number,
  hardMax: number,
): number {
  if (value >= idealMin && value <= idealMax) return 1;
  if (value < idealMin) {
    if (value <= hardMin) return 0;
    return (value - hardMin) / (idealMin - hardMin);
  }
  if (value >= hardMax) return 0;
  return (hardMax - value) / (hardMax - idealMax);
}

/** Impulsion qui retombe : pleine à l'instant du choc, nulle après `decay`. */
function pulse(elapsed: number, decay: number): number {
  if (elapsed < 0 || elapsed > decay) return 0;
  return 1 - elapsed / decay;
}

/** Part de la timeline couverte par au moins un sous-titre. */
export function captionCoverage(captions: Caption[], duration: number): number {
  if (duration <= 0 || captions.length === 0) return 0;

  const intervals = captions
    .map((c) => [Math.max(0, Math.min(c.start, c.end)), Math.min(duration, Math.max(c.start, c.end))] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let covered = 0;
  let cursorStart = -1;
  let cursorEnd = -1;

  for (const [start, end] of intervals) {
    if (start > cursorEnd) {
      if (cursorEnd > cursorStart) covered += cursorEnd - cursorStart;
      cursorStart = start;
      cursorEnd = end;
    } else {
      cursorEnd = Math.max(cursorEnd, end);
    }
  }
  if (cursorEnd > cursorStart) covered += cursorEnd - cursorStart;

  return covered / duration;
}

/**
 * Construit la courbe de tension.
 *
 * Chaque évènement de montage injecte de l'énergie qui retombe ensuite : une
 * coupe relance l'attention pendant environ une seconde, un bruitage un peu
 * moins, tandis qu'un sous-titre affiché ou un mouvement de caméra entretient
 * un niveau de fond tant qu'ils durent.
 */
export function tensionCurve(project: Project): { time: number; value: number }[] {
  const placed = layoutClips(project.clips);
  const duration = placed.length === 0 ? 0 : placed[placed.length - 1].end;
  if (duration <= 0) return [];

  // Une coupe au tout début ne compte pas : rien ne précède pour contraster.
  const cuts = placed.slice(1).map((p) => ({ time: p.start, strength: p.clip.transition === 'cut' ? 1 : 0.85 }));
  const samples: { time: number; value: number }[] = [];
  const step = 1 / SAMPLE_RATE;

  for (let time = 0; time <= duration; time += step) {
    let energy = 0.12; // Bruit de fond : une vidéo qui défile n'est jamais à zéro.

    for (const cut of cuts) energy += 0.75 * cut.strength * pulse(time - cut.time, 1.1);
    for (const cue of project.cues) energy += 0.55 * cue.gain * pulse(time - cue.time, 0.9);

    for (const caption of project.captions) {
      if (time < caption.start || time > caption.end) continue;
      // Un texte accroche fort à son apparition, puis devient du décor.
      energy += 0.2 + 0.35 * pulse(time - caption.start, 0.8);
    }

    const layer = placed.find((p) => time >= p.start && time < p.end) ?? placed[placed.length - 1];
    if (layer.clip.motion !== 'none') energy += 0.18;
    if (layer.clip.speed > 1.15) energy += 0.12;

    samples.push({ time, value: Math.min(1, energy) });
  }

  return samples;
}

/** Repère les passages où la tension reste trop longtemps au plancher. */
export function findSlumps(curve: { time: number; value: number }[]): TensionSlump[] {
  const slumps: TensionSlump[] = [];
  let start: number | null = null;

  for (const sample of curve) {
    if (sample.value < LOW_TENSION) {
      if (start === null) start = sample.time;
    } else if (start !== null) {
      if (sample.time - start >= SLUMP_MIN_DURATION) {
        slumps.push({ start, end: sample.time, duration: sample.time - start });
      }
      start = null;
    }
  }

  const last = curve[curve.length - 1];
  if (start !== null && last && last.time - start >= SLUMP_MIN_DURATION) {
    slumps.push({ start, end: last.time, duration: last.time - start });
  }

  return slumps;
}

/** Note les trois premières secondes, là où le spectateur décide de rester. */
function scoreHook(project: Project, placed: PlacedClip[], duration: number): number {
  if (placed.length === 0) return 0;

  let score = 0;

  // Un texte d'accroche très tôt : le levier le plus puissant du format court.
  const earlyCaption = project.captions.find((c) => c.start <= 1.2 && c.end > c.start);
  if (earlyCaption) score += earlyCaption.start <= 0.5 ? 0.4 : 0.3;

  // Une première coupe rapide prouve au spectateur qu'il va se passer quelque chose.
  const firstCut = placed[1]?.start ?? duration;
  score += 0.3 * band(firstCut, 0.6, 2.2, 0, HOOK_WINDOW + 1.5);

  // Une ponctuation sonore dans la première seconde ancre l'attention.
  if (project.cues.some((c) => c.time <= 1)) score += 0.15;

  // Un plan d'ouverture qui bouge vaut mieux qu'un plan fixe.
  if (placed[0].clip.motion !== 'none') score += 0.15;

  return Math.min(1, score);
}

/** Analyse complète du montage. */
export function analyzeProject(project: Project): Analysis {
  const placed = layoutClips(project.clips);
  const duration = totalDuration(project.clips);
  const shotCount = placed.length;

  if (shotCount === 0 || duration <= 0) {
    return {
      score: 0,
      verdict: 'Montage vide',
      criteria: [],
      curve: [],
      slumps: [],
      advice: [{ impact: 100, message: 'Ajoute un premier clip à la timeline pour lancer l’analyse.' }],
      duration: 0,
      shotCount: 0,
      averageShot: 0,
    };
  }

  const curve = tensionCurve(project);
  const slumps = findSlumps(curve);
  const averageShot = duration / shotCount;
  const coverage = captionCoverage(project.captions, duration);
  const cuesPer10s = (project.cues.length / duration) * 10;

  // Le plan le plus long donne le meilleur signal d'un montage qui s'endort.
  const longestShot = Math.max(...placed.map((p) => p.duration));
  const slumpRatio = slumps.reduce((sum, s) => sum + s.duration, 0) / duration;

  const hook = scoreHook(project, placed, duration);
  const rythme = 0.65 * band(averageShot, 1.1, 2.8, 0.25, 7) + 0.35 * band(longestShot, 0, 3.5, 0, 9);
  const tension = Math.max(0, 1 - slumpRatio * 2.2 - Math.min(0.35, slumps.length * 0.08));
  const texte = band(coverage, 0.55, 0.95, 0, 1.01);
  const son = Math.min(1, 0.75 * band(cuesPer10s, 1.2, 6, 0, 14) + (project.music ? 0.25 : 0));
  const format = 0.7 * band(duration, 7, 35, 2, 90) + 0.3 * verticalShare(project);

  const criteria: Criterion[] = [
    {
      id: 'hook',
      label: 'Hook',
      score: hook,
      weight: 30,
      detail: `Les ${HOOK_WINDOW} premières secondes : texte d’accroche, première coupe, impact sonore.`,
    },
    {
      id: 'rythme',
      label: 'Rythme',
      score: rythme,
      weight: 20,
      detail: `Cadence des coupes — ${averageShot.toFixed(1)} s par plan, le plus long fait ${longestShot.toFixed(1)} s.`,
    },
    {
      id: 'tension',
      label: 'Tension',
      score: tension,
      weight: 20,
      detail:
        slumps.length === 0
          ? 'Aucune retombée d’attention prolongée détectée.'
          : `${slumps.length} passage${slumps.length > 1 ? 's' : ''} où l’attention retombe trop longtemps.`,
    },
    {
      id: 'texte',
      label: 'Sous-titres',
      score: texte,
      weight: 15,
      detail: `${Math.round(coverage * 100)} % de la vidéo est couverte par du texte à l’écran.`,
    },
    {
      id: 'son',
      label: 'Son',
      score: son,
      weight: 10,
      detail: `${cuesPer10s.toFixed(1)} bruitage${cuesPer10s >= 2 ? 's' : ''} pour 10 s${project.music ? ', musique de fond active' : ', pas de musique de fond'}.`,
    },
    {
      id: 'format',
      label: 'Format',
      score: format,
      weight: 5,
      detail: `Durée totale de ${duration.toFixed(1)} s et cadrage des sources.`,
    },
  ];

  const score = Math.round(criteria.reduce((sum, c) => sum + c.score * c.weight, 0));

  return {
    score,
    verdict: verdictFor(score),
    criteria,
    curve,
    slumps,
    advice: buildAdvice(criteria, slumps, project, { averageShot, longestShot, coverage, duration }),
    duration,
    shotCount,
    averageShot,
  };
}

/** Part des clips dont la source est déjà verticale ou carrée. */
function verticalShare(project: Project): number {
  if (project.clips.length === 0) return 0;
  const vertical = project.clips.filter((clip) => {
    const asset = project.assets.find((a) => a.id === clip.assetId);
    return asset ? asset.height >= asset.width : false;
  }).length;
  return vertical / project.clips.length;
}

function verdictFor(score: number): string {
  if (score >= 85) return 'Potentiel viral';
  if (score >= 70) return 'Prêt à poster';
  if (score >= 50) return 'Correct, mais ça décroche';
  if (score >= 30) return 'À retravailler';
  return 'Le spectateur ne restera pas';
}

/** Conseils concrets, triés par nombre de points récupérables. */
function buildAdvice(
  criteria: Criterion[],
  slumps: TensionSlump[],
  project: Project,
  stats: { averageShot: number; longestShot: number; coverage: number; duration: number },
): Advice[] {
  const advice: Advice[] = [];
  const lost = (id: CriterionId) => {
    const c = criteria.find((x) => x.id === id)!;
    return Math.round((1 - c.score) * c.weight);
  };

  const hookLoss = lost('hook');
  if (hookLoss > 2) {
    if (!project.captions.some((c) => c.start <= 1.2)) {
      advice.push({
        impact: hookLoss,
        message: 'Aucune accroche texte dans la première seconde. Pose une phrase qui crée une question dès l’image 1.',
      });
    } else {
      advice.push({
        impact: hookLoss,
        message: 'Le hook manque d’impact : coupe plus tôt, ajoute un bruitage sur la première seconde ou anime le plan d’ouverture.',
      });
    }
  }

  for (const slump of slumps.slice(0, 3)) {
    advice.push({
      impact: Math.round(Math.min(20, slump.duration * 3)),
      message: `Descente de tension de ${slump.duration.toFixed(1)} s à partir de ${slump.start.toFixed(1)} s : coupe dedans, ajoute un bruitage ou fais apparaître du texte.`,
    });
  }

  if (stats.longestShot > 3.5) {
    advice.push({
      impact: lost('rythme'),
      message: `Ton plan le plus long dure ${stats.longestShot.toFixed(1)} s. Au-delà de 3 s sans évènement, le pouce repart.`,
    });
  }

  const texteLoss = lost('texte');
  if (texteLoss > 2) {
    advice.push({
      impact: texteLoss,
      message:
        stats.coverage < 0.55
          ? `Seulement ${Math.round(stats.coverage * 100)} % de la vidéo est sous-titrée. Vise 70 % : la majorité regarde sans le son.`
          : 'Le texte est présent en continu et sature l’image. Laisse respirer entre deux phrases.',
    });
  }

  const sonLoss = lost('son');
  if (sonLoss > 2) {
    advice.push({
      impact: sonLoss,
      message: project.cues.length === 0
        ? 'Aucun bruitage. Un whoosh sur les transitions et un impact sur les moments clés changent radicalement la perception du rythme.'
        : 'Ponctue davantage les coupes avec des bruitages, et ajoute une musique de fond.',
    });
  }

  if (stats.duration > 45) {
    advice.push({
      impact: lost('format'),
      message: `${stats.duration.toFixed(0)} s, c’est long pour ce format. Sous 35 s, le taux de complétion grimpe nettement.`,
    });
  } else if (stats.duration < 7) {
    advice.push({
      impact: lost('format'),
      message: 'Moins de 7 s : trop court pour installer quoi que ce soit. Ajoute un plan ou deux.',
    });
  }

  return advice.sort((a, b) => b.impact - a.impact);
}
