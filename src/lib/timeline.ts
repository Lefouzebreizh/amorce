import { DEFAULT_CINEMA, DEFAULT_MIX, type Clip, type Project } from './types.ts';

/**
 * Calcul des positions sur la timeline.
 *
 * Une transition consomme du temps : le clip qui arrive démarre AVANT la fin du
 * précédent, et les deux se chevauchent pendant la durée de la transition. La
 * durée totale du montage est donc plus courte que la somme des clips.
 *
 * Invariant garanti ici : une transition ne dépasse jamais 45 % du plus court
 * des deux clips qu'elle relie. Conséquence — deux transitions consécutives
 * occupent au maximum 90 % du clip qui les sépare, donc **au plus deux clips
 * sont visibles simultanément**. Le moteur de rendu s'appuie sur cette garantie
 * pour ne jamais avoir à composer plus de deux couches vidéo.
 */

/** Part maximale du plus court des deux clips qu'une transition peut occuper. */
const MAX_TRANSITION_RATIO = 0.45;

/** Durée d'un clip une fois posé sur la timeline (vitesse comprise). */
export function clipDuration(clip: Clip): number {
  const raw = Math.max(0, clip.outPoint - clip.inPoint);
  return raw / Math.max(0.1, clip.speed);
}

/** Durée de transition réellement applicable entre deux clips voisins. */
export function effectiveTransition(prev: Clip | undefined, clip: Clip): number {
  if (!prev || clip.transition === 'cut') return 0;
  const limit = MAX_TRANSITION_RATIO * Math.min(clipDuration(prev), clipDuration(clip));
  return Math.max(0, Math.min(clip.transitionDuration, limit));
}

/** Un clip résolu, avec sa place exacte sur la timeline. */
export type PlacedClip = {
  clip: Clip;
  index: number;
  /** Début sur la timeline, en secondes. */
  start: number;
  /** Fin sur la timeline, en secondes. */
  end: number;
  duration: number;
  /** Durée de la transition entrante, après application des limites. */
  transitionIn: number;
};

/** Positionne tous les clips bout à bout, chevauchements de transitions inclus. */
export function layoutClips(clips: Clip[]): PlacedClip[] {
  const placed: PlacedClip[] = [];
  let cursor = 0;

  clips.forEach((clip, index) => {
    const duration = clipDuration(clip);
    const transitionIn = effectiveTransition(clips[index - 1], clip);
    const start = index === 0 ? 0 : cursor - transitionIn;
    cursor = start + duration;
    placed.push({ clip, index, start, end: cursor, duration, transitionIn });
  });

  return placed;
}

/** Durée totale du montage, en secondes. */
export function totalDuration(clips: Clip[]): number {
  const placed = layoutClips(clips);
  return placed.length === 0 ? 0 : placed[placed.length - 1].end;
}

/**
 * Où poser des fichiers audio importés.
 *
 * Les déposer tous au même instant n'a aucun sens : quand on choisit plusieurs
 * fichiers d'un coup, c'est qu'ils se répartissent sur le montage. Et les mettre
 * bout à bout depuis la tête de lecture donne un enchaînement qui ne tombe sur
 * rien — la parole démarre au milieu d'un plan, le bruitage arrive après la
 * coupe qu'il devait annoncer.
 *
 * On les pose donc **sur les coupes**, qui sont les seuls instants où quelque
 * chose se produit déjà à l'image. C'est là qu'un son a une raison d'être.
 */
export function shotStarts(clips: Clip[], from = 0): number[] {
  return layoutClips(clips)
    .map((p) => Math.max(0, p.start))
    .filter((start) => start >= from - 1e-6);
}

/**
 * Instants de dépôt pour une suite de fichiers qui ne doivent pas se recouvrir.
 *
 * C'est le cas de la voix : deux répliques qui se chevauchent sont
 * inaudibles. Chacune prend donc la première coupe qui vient après la fin de la
 * précédente ; à court de coupes, elles s'enchaînent bout à bout.
 */
export function placeWithoutOverlap(starts: number[], durations: number[], from = 0): number[] {
  const times: number[] = [];
  let earliest = from;

  for (const duration of durations) {
    const cut = starts.find((start) => start >= earliest - 1e-6);
    const at = cut ?? earliest;
    times.push(at);
    earliest = at + duration;
  }

  return times;
}

/**
 * Instants de dépôt pour des fichiers qui peuvent se superposer.
 *
 * C'est le cas des bruitages : rien n'interdit qu'un impact et un souffle
 * sonnent ensemble. Chacun prend une coupe distincte tant qu'il en reste, pour
 * ne pas empiler trois sons sur le même raccord.
 */
export function placeOnCuts(starts: number[], count: number, from = 0): number[] {
  const available = starts.filter((start) => start >= from - 1e-6);
  const times: number[] = [];

  for (let i = 0; i < count; i++) {
    const previous = times[times.length - 1];
    // À court de coupes, on espace d'une seconde plutôt que de tout empiler —
    // mais le tout premier tombe bien là où on l'a demandé.
    times.push(available[i] ?? (previous === undefined ? from : previous + 1));
  }

  return times;
}

/**
 * Découpe un plan en morceaux d'environ `target` secondes.
 *
 * Renvoie le plan seul s'il est trop court pour être coupé en deux. Le premier
 * morceau hérite de la transition d'origine ; les suivants s'enchaînent sec,
 * sans quoi le découpage perdrait la nervosité qui le justifie.
 */
export function chopped(clip: Clip, target: number, makeId: () => string): Clip[] {
  const sourceSpan = clip.outPoint - clip.inPoint;
  const shown = sourceSpan / Math.max(0.1, clip.speed);
  const pieces = Math.floor(shown / Math.max(0.5, target));
  if (pieces < 2) return [clip];

  const step = sourceSpan / pieces;
  return Array.from({ length: pieces }, (_, piece) => ({
    ...clip,
    id: makeId(),
    inPoint: clip.inPoint + piece * step,
    outPoint: clip.inPoint + (piece + 1) * step,
    transition: piece === 0 ? clip.transition : ('cut' as const),
    transitionDuration: piece === 0 ? clip.transitionDuration : 0,
  }));
}

/** Une couche vidéo à dessiner pour une image donnée. */
export type ActiveLayer = {
  placed: PlacedClip;
  /** Temps écoulé depuis le début du clip, en secondes de timeline. */
  localTime: number;
  /** Position dans le média source, en secondes. */
  sourceTime: number;
};

/**
 * Couches visibles à l'instant `t`.
 *
 * Retourne un ou deux éléments, jamais plus (voir l'invariant en tête de
 * fichier). Quand il y en a deux, `from` est le clip sortant et `to` le clip
 * entrant, et `progress` va de 0 à 1 sur la durée de la transition.
 */
export type FrameSlice = {
  from: ActiveLayer | null;
  to: ActiveLayer;
  progress: number;
};

function toLayer(placed: PlacedClip, t: number): ActiveLayer {
  const localTime = t - placed.start;
  const { clip } = placed;
  return {
    placed,
    localTime,
    sourceTime: clip.inPoint + localTime * clip.speed,
  };
}

/** Détermine quoi dessiner à l'instant `t` de la timeline. */
export function sliceAt(placed: PlacedClip[], t: number): FrameSlice | null {
  if (placed.length === 0) return null;

  // Le clip le plus tardif dont la fenêtre contient `t` est celui du dessus.
  let top = -1;
  for (let i = 0; i < placed.length; i++) {
    if (t >= placed[i].start && t < placed[i].end) top = i;
  }

  // Après la dernière image, on fige sur la fin du dernier clip.
  if (top === -1) {
    const last = placed[placed.length - 1];
    if (t >= last.end) return { from: null, to: toLayer(last, last.end - 1e-3), progress: 1 };
    return { from: null, to: toLayer(placed[0], placed[0].start), progress: 1 };
  }

  const current = placed[top];
  const inTransition = current.transitionIn > 0 && t < current.start + current.transitionIn;

  if (inTransition && top > 0) {
    const previous = placed[top - 1];
    return {
      from: toLayer(previous, t),
      to: toLayer(current, t),
      progress: (t - current.start) / current.transitionIn,
    };
  }

  return { from: null, to: toLayer(current, t), progress: 1 };
}

/** Projet vide, point de départ de l'application. */
export function emptyProject(): Project {
  return {
    name: 'Nouveau montage',
    assets: [],
    clips: [],
    captions: [],
    cues: [],
    samples: [],
    voices: [],
    music: null,
    cinema: { ...DEFAULT_CINEMA },
    mix: { ...DEFAULT_MIX },
  };
}
