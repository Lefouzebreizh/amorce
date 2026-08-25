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
