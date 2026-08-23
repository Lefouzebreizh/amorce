import { uid } from './id.ts';
import { totalDuration } from './timeline.ts';
import {
  DEFAULT_CLIP,
  type Caption,
  type Clip,
  type MediaAsset,
  type Project,
  type SoundCue,
  type TransitionKind,
} from './types.ts';

/**
 * Montage express.
 *
 * Assemble un projet complet à partir des seuls rushes importés, sans rien
 * demander. L'objectif n'est pas de produire le meilleur montage possible —
 * c'est de faire passer quelqu'un qui n'a jamais monté d'une pile de fichiers à
 * un résultat regardable, qu'il pourra ensuite retoucher plan par plan.
 *
 * Les choix appliqués sont ceux que l'analyse récompense : plans courts,
 * ouverture qui bouge, transitions ponctuées de bruitages, rendu cinéma dosé.
 */

/** Durée visée pour un plan. Au-delà de 3 s sans évènement, l'attention lâche. */
const TARGET_SHOT = 2.1;

/** En dessous, un plan n'a pas le temps d'être lu. */
const MIN_SHOT = 0.9;

/** Transitions alternées, pour éviter la monotonie d'un effet répété. */
const TRANSITION_CYCLE: TransitionKind[] = ['zoomPunch', 'whipPan', 'fade', 'slideUp', 'flash'];

/** Texte d'accroche déposé par défaut, explicitement à remplacer. */
export const PLACEHOLDER_HOOK = 'Attends la fin 👀';

/** Découpe un rush en un plan de durée utile. */
function cutFromAsset(asset: MediaAsset, index: number): Clip | null {
  if (asset.duration <= 0.2) return null;

  // On entre après le tout début : les premières images d'un rendu IA sont
  // souvent noires ou instables, le temps que la scène s'établisse.
  const lead = Math.min(asset.duration * 0.08, 0.4);
  const available = asset.duration - lead;
  const length = Math.max(MIN_SHOT, Math.min(TARGET_SHOT, available));

  if (length < 0.3) return null;

  return {
    ...DEFAULT_CLIP,
    id: uid('clip'),
    assetId: asset.id,
    inPoint: lead,
    outPoint: Math.min(asset.duration, lead + length),
    // Le premier plan doit démarrer sec : une transition sur du vide ne veut
    // rien dire, et ferait perdre les précieuses premières images.
    transition: index === 0 ? 'cut' : TRANSITION_CYCLE[(index - 1) % TRANSITION_CYCLE.length],
    transitionDuration: 0.3,
    // Une ouverture qui avance vaut mieux qu'un plan fixe ; on alterne ensuite
    // pour que le mouvement reste une ponctuation et non un tic.
    motion: index === 0 ? 'zoomIn' : index % 3 === 1 ? 'none' : index % 3 === 2 ? 'zoomOut' : 'panRight',
  };
}

export type AutoEditResult = {
  clips: Clip[];
  captions: Caption[];
  cues: SoundCue[];
};

/** Construit un montage complet à partir des rushes. */
export function buildAutoEdit(assets: MediaAsset[]): AutoEditResult {
  const clips = assets
    .map((asset, index) => cutFromAsset(asset, index))
    .filter((clip): clip is Clip => clip !== null)
    // Le premier plan retenu doit porter les réglages d'ouverture, même si des
    // rushes trop courts ont été écartés en amont.
    .map((clip, index) => (index === 0 ? { ...clip, transition: 'cut' as const, motion: 'zoomIn' as const } : clip));

  if (clips.length === 0) return { clips: [], captions: [], cues: [] };

  const duration = totalDuration(clips);

  const captions: Caption[] = [
    {
      id: uid('cap'),
      text: PLACEHOLDER_HOOK,
      start: 0,
      end: Math.min(2.4, duration),
      style: 'punch',
      y: 0.28,
    },
  ];

  const cues: SoundCue[] = [];
  let cursor = 0;

  clips.forEach((clip, index) => {
    const clipLength = (clip.outPoint - clip.inPoint) / clip.speed;
    if (index > 0) {
      cursor -= clip.transitionDuration;
      // Un souffle sur chaque raccord : c'est ce qui transforme une succession
      // de plans en un rythme perçu.
      cues.push({ id: uid('sfx'), sfx: index === 1 ? 'boom' : 'whoosh', time: Math.max(0, cursor), gain: 0.7 });
    }
    cursor += clipLength;
  });

  // Une note finale signale que c'est terminé et appelle la boucle suivante.
  if (duration > 1.5) {
    cues.push({ id: uid('sfx'), sfx: 'ding', time: Math.max(0, duration - 0.45), gain: 0.6 });
  }

  return { clips, captions, cues };
}

/** Applique le montage express à un projet, en conservant les rushes. */
export function applyAutoEdit(project: Project): Project {
  const { clips, captions, cues } = buildAutoEdit(project.assets);
  return {
    ...project,
    clips,
    captions,
    cues,
    cinema: { ...project.cinema, look: project.cinema.look === 'naturel' ? 'cinema' : project.cinema.look },
  };
}
