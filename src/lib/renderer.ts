'use client';

import { captionsAt, drawCaption, type FontSet } from './captions.ts';
import { getLook, GradePipeline } from './grade.ts';
import { layoutClips, sliceAt, type ActiveLayer, type PlacedClip } from './timeline.ts';
import { applyTransition, type LayerDrawer, type LayerTransform } from './transitions.ts';
import { OUTPUT_HEIGHT, OUTPUT_WIDTH, type Clip, type MediaAsset, type Project } from './types.ts';

/**
 * Compositeur vidéo.
 *
 * `renderFrame` est le seul endroit qui sait à quoi ressemble une image du
 * montage. La prévisualisation et l'export l'appellent tous les deux, à des
 * cadences différentes : ce qui est affiché à l'écran est donc, par
 * construction, exactement ce qui sera enregistré dans le fichier final.
 */

/**
 * Un élément <video> par clip — et non par média source.
 *
 * Deux clips peuvent découper le même fichier, y compris en se chevauchant
 * pendant une transition. Un élément partagé ne pourrait pas être à deux
 * positions de lecture à la fois : le fondu enchaîné d'un rush sur lui-même
 * serait impossible. Un élément par clip lève la contrainte pour un coût
 * mémoire négligeable, le navigateur mutualisant le décodage d'une même URL.
 */
export class ClipVideoPool {
  private elements = new Map<string, HTMLVideoElement>();

  /** Aligne le pool sur les clips du projet, en créant et libérant au besoin. */
  sync(clips: Clip[], assets: MediaAsset[]): void {
    const wanted = new Set(clips.map((c) => c.id));

    for (const [clipId, element] of this.elements) {
      if (wanted.has(clipId)) continue;
      element.pause();
      element.removeAttribute('src');
      element.load();
      this.elements.delete(clipId);
    }

    for (const clip of clips) {
      if (this.elements.has(clip.id)) continue;
      const asset = assets.find((a) => a.id === clip.assetId);
      if (!asset) continue;

      const video = document.createElement('video');
      video.src = asset.url;
      video.preload = 'auto';
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      // Le son des clips passe par le graphe Web Audio, jamais par l'élément :
      // c'est ce qui permet de le mixer avec les bruitages et la musique.
      video.muted = true;
      video.load();
      this.elements.set(clip.id, video);
    }
  }

  get(clipId: string): HTMLVideoElement | undefined {
    return this.elements.get(clipId);
  }

  all(): HTMLVideoElement[] {
    return [...this.elements.values()];
  }

  pauseAll(): void {
    for (const element of this.elements.values()) element.pause();
  }

  dispose(): void {
    for (const element of this.elements.values()) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    this.elements.clear();
  }
}

/** Écart de synchronisation au-delà duquel on repositionne la lecture. */
const DRIFT_TOLERANCE = 0.25;

/** Avance à laquelle un clip est préchargé avant d'entrer à l'écran. */
const PREROLL = 0.6;

/**
 * Aligne les éléments vidéo sur la position de la tête de lecture.
 *
 * Les clips hors champ sont mis en pause, ceux qui approchent sont
 * pré-positionnés pour éviter l'image noire à l'entrée, et ceux à l'écran sont
 * recalés dès que leur dérive dépasse le seuil toléré.
 */
export function syncPlayback(
  placed: PlacedClip[],
  pool: ClipVideoPool,
  time: number,
  playing: boolean,
): void {
  for (const item of placed) {
    const video = pool.get(item.clip.id);
    if (!video) continue;

    const visible = time >= item.start && time < item.end;
    const approaching = !visible && time >= item.start - PREROLL && time < item.start;

    if (!visible && !approaching) {
      if (!video.paused) video.pause();
      continue;
    }

    const target = visible
      ? item.clip.inPoint + (time - item.start) * item.clip.speed
      : item.clip.inPoint;

    if (!Number.isFinite(video.duration) || video.readyState === 0) continue;

    const bounded = Math.max(0, Math.min(target, video.duration - 0.05));
    if (Math.abs(video.currentTime - bounded) > DRIFT_TOLERANCE) {
      video.currentTime = bounded;
    }

    video.playbackRate = Math.max(0.1, Math.min(8, item.clip.speed));

    if (visible && playing) {
      if (video.paused) void video.play().catch(() => undefined);
    } else if (!video.paused) {
      video.pause();
    }
  }
}

/** Déplacement et échelle induits par le mouvement appliqué à un clip. */
function motionTransform(clip: Clip, progress: number, timeInClip: number): LayerTransform {
  const p = Math.min(1, Math.max(0, progress));

  switch (clip.motion) {
    case 'zoomIn':
      return { alpha: 1, dx: 0, dy: 0, scale: 1 + 0.18 * p };
    case 'zoomOut':
      return { alpha: 1, dx: 0, dy: 0, scale: 1.18 - 0.18 * p };
    case 'panLeft':
      // Le sur-cadrage est indispensable : sans lui, le balayage ferait
      // apparaître du vide sur le bord vers lequel on se déplace.
      return { alpha: 1, dx: OUTPUT_WIDTH * (0.055 - 0.11 * p), dy: 0, scale: 1.12 };
    case 'panRight':
      return { alpha: 1, dx: OUTPUT_WIDTH * (-0.055 + 0.11 * p), dy: 0, scale: 1.12 };
    case 'shake':
      return {
        alpha: 1,
        dx: Math.sin(timeInClip * 41) * 9,
        dy: Math.cos(timeInClip * 33) * 7,
        scale: 1.06,
      };
    default:
      return { alpha: 1, dx: 0, dy: 0, scale: 1 };
  }
}

/** Dessine une image vidéo en remplissant le cadre 9:16, sans déformation. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  transform: LayerTransform,
  filter: string,
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  // On recouvre plutôt que d'ajuster : des bandes noires en 9:16 gâcheraient
  // la surface d'écran, qui est la seule chose que le format vertical apporte.
  const cover = Math.max(OUTPUT_WIDTH / vw, OUTPUT_HEIGHT / vh) * transform.scale;
  const width = vw * cover;
  const height = vh * cover;
  const x = (OUTPUT_WIDTH - width) / 2 + transform.dx;
  const y = (OUTPUT_HEIGHT - height) / 2 + transform.dy;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, transform.alpha));
  // Le filtre ne vaut que pour l'image vidéo : le flash blanc d'une transition
  // ou les bandes d'un glitch ne doivent pas être étalonnés avec elle.
  if (filter !== 'none') ctx.filter = filter;
  try {
    ctx.drawImage(video, x, y, width, height);
  } catch {
    // Une image pas encore décodée fait échouer drawImage : on saute le tracé
    // plutôt que d'interrompre toute la boucle de rendu.
  }
  ctx.restore();
}

/** Fabrique la fonction de dessin d'une couche, mouvement du clip compris. */
function layerDrawer(
  ctx: CanvasRenderingContext2D,
  layer: ActiveLayer,
  pool: ClipVideoPool,
  filter: string,
): LayerDrawer | null {
  const video = pool.get(layer.placed.clip.id);
  if (!video) return null;

  const progress = layer.placed.duration > 0 ? layer.localTime / layer.placed.duration : 0;
  const motion = motionTransform(layer.placed.clip, progress, layer.localTime);

  return (transform: LayerTransform) => {
    drawCover(
      ctx,
      video,
      {
        alpha: transform.alpha,
        dx: transform.dx + motion.dx,
        dy: transform.dy + motion.dy,
        scale: transform.scale * motion.scale,
      },
      filter,
    );
  };
}

/** Réglages ponctuels du tracé d'une image. */
export type RenderOptions = {
  /** Disposition déjà calculée, pour éviter de la recalculer à chaque image. */
  placed?: PlacedClip[];
  /** Post-traitement cinéma. Sans lui, l'image sort brute. */
  grade?: GradePipeline;
  /** Numéro d'image, qui fait vivre le grain. */
  frame?: number;
  /**
   * Facteur appliqué à la définition de sortie.
   *
   * Le dessin reste écrit en coordonnées 1080 × 1920 : seule une transformation
   * est posée sur le contexte. Un téléphone peut ainsi remplir quatre fois
   * moins de pixels sans qu'une seule ligne de composition change, et l'export
   * repasse à 1 pour retrouver la pleine définition.
   */
  scale?: number;
  /** Halo sur les hautes lumières. Coupé sur les appareils lents. */
  bloom?: boolean;
};

/**
 * Dessine une image complète du montage à l'instant `time`.
 *
 * L'ordre est délibéré : la vidéo est étalonnée, puis le post-traitement cinéma
 * s'applique, et les sous-titres arrivent en dernier — donc ni grainés, ni
 * vignettés, ni assombris. En format court, la lisibilité du texte passe avant
 * la cohérence esthétique.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  time: number,
  pool: ClipVideoPool,
  fonts: FontSet,
  options: RenderOptions = {},
): void {
  const scale = options.scale ?? 1;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  ctx.restore();

  const placed = options.placed ?? layoutClips(project.clips);
  const slice = sliceAt(placed, time);
  const look = getLook(project.cinema.look);
  const filter = options.grade ? options.grade.baseFilter(look, project.cinema.intensity) : 'none';

  if (slice) {
    const drawTo = layerDrawer(ctx, slice.to, pool, filter);
    const drawFrom = slice.from ? layerDrawer(ctx, slice.from, pool, filter) : null;
    if (drawTo) {
      applyTransition(slice.to.placed.clip.transition, slice.progress, ctx, drawFrom, drawTo);
    }
  }

  options.grade?.apply(ctx, look, {
    intensity: project.cinema.intensity,
    frame: options.frame ?? 0,
    bars: project.cinema.bars,
    bloom: options.bloom ?? true,
  });

  for (const caption of captionsAt(project.captions, time)) {
    drawCaption(ctx, caption, time, fonts);
  }
}

/**
 * Force le chargement des polices utilisées par les sous-titres.
 *
 * Le canvas ne déclenche pas le chargement d'une police : si elle n'est pas
 * déjà résolue au moment du tracé, le navigateur substitue silencieusement une
 * police système et le rendu part de travers.
 */
export async function preloadCaptionFonts(fonts: FontSet): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const requests = [
    `900 104px ${fonts.display}`,
    `700 62px ${fonts.body}`,
    `600 56px ${fonts.body}`,
  ];
  await Promise.all(requests.map((request) => document.fonts.load(request).catch(() => undefined)));
  await document.fonts.ready;
}
