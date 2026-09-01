'use client';

import { captionsAt, drawCaption, type CaptionBox, type FontSet } from './captions.ts';
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
 *
 * En revanche, le nombre d'éléments **chargés en même temps** est borné. Mesuré
 * sur les rushes de test : un montage express en réclame quatre, et douze
 * découpes sur les mêmes sept secondes et demie en portent le compte à treize —
 * un décodeur par plan, sans plafond. Un navigateur Android en accorde six à
 * huit ; au-delà, les plans supplémentaires ne produisent aucune image, et
 * l'export sort noir sans qu'une seule erreur soit levée.
 */
/**
 * Nombre d'éléments `<video>` gardés chargés en même temps.
 *
 * Six et non huit : c'est le plus bas des plafonds observés sur les navigateurs
 * Android, et dépasser ne prévient pas — les plans en trop ne décodent rien et
 * l'image sort noire. Six laisse la place aux deux couches d'une transition et
 * au préchargement des plans qui suivent.
 *
 * Ce plafond ne vaut que pour les rushes. Une image fixe ne mobilise aucun
 * décodeur vidéo : la compter ici ferait évincer des plans qui ne coûtent
 * rien, et un défilé d'illustrations — le cas d'usage même de l'image fixe —
 * rechargerait sans cesse les mêmes fichiers en clignotant.
 */
const DECODEURS_MAX = 6;

/**
 * Pénalité appliquée aux plans déjà passés dans le classement de proximité.
 *
 * À distance égale, on garde plutôt ce qui vient : revenir en arrière est un
 * geste délibéré qui supporte un temps de décodage, alors qu'un plan qui entre
 * doit être prêt.
 */
const RETARD = 1.5;

/** Élément porteur d'un plan : un décodeur pour un rush, une image sinon. */
export type ClipSource = HTMLVideoElement | HTMLImageElement;

/** Dimensions natives d'un porteur de plan, quel qu'il soit. */
export function sourceSize(source: ClipSource): { width: number; height: number } {
  return source instanceof HTMLVideoElement
    ? { width: source.videoWidth, height: source.videoHeight }
    : { width: source.naturalWidth, height: source.naturalHeight };
}

export class ClipVideoPool {
  private elements = new Map<string, ClipSource>();

  /**
   * Aligne le pool sur les plans proches de la tête de lecture.
   *
   * Renvoie les identifiants chargés, que l'appelant doit répercuter sur le
   * graphe audio : `attachClip` refuse de rebrancher un identifiant qu'il
   * connaît déjà, si bien qu'un plan dont l'élément a été libéré puis recréé
   * reviendrait muet tant que son ancien nœud n'a pas été purgé.
   */
  sync(placed: PlacedClip[], assets: MediaAsset[], time: number): Set<string> {
    const source = (item: PlacedClip) => assets.find((a) => a.id === item.clip.assetId);
    const fixes = placed.filter((item) => source(item)?.kind === 'image');
    const rushes = placed.filter((item) => source(item)?.kind !== 'image');

    const wanted = new Set([
      ...fixes.map((item) => item.clip.id),
      ...this.proches(rushes, time),
    ]);

    for (const [clipId, element] of this.elements) {
      if (wanted.has(clipId)) continue;
      this.release(element);
      this.elements.delete(clipId);
    }

    for (const item of placed) {
      const clip = item.clip;
      if (!wanted.has(clip.id) || this.elements.has(clip.id)) continue;
      const asset = source(item);
      if (!asset) continue;

      this.elements.set(clip.id, asset.kind === 'image' ? charger(asset) : chargerRush(asset));
    }

    return wanted;
  }

  /**
   * Les rushes à garder chargés, les plus proches de la tête de lecture d'abord.
   *
   * Un plan à l'écran est à distance nulle ; les autres sont classés par le
   * temps qui les sépare de la tête. Ceux qui viennent priment sur ceux qui
   * sont passés, à distance égale : c'est vers eux qu'on va.
   */
  private proches(placed: PlacedClip[], time: number): string[] {
    const distance = (item: PlacedClip): number => {
      if (time >= item.start && time < item.end) return 0;
      return time < item.start ? item.start - time : (time - item.end) * RETARD;
    };
    return [...placed]
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, DECODEURS_MAX)
      .map((item) => item.clip.id);
  }

  /** Libère un élément, en ne demandant à une image que ce qu'elle sait faire. */
  private release(element: ClipSource): void {
    if (element instanceof HTMLVideoElement) {
      element.pause();
      element.removeAttribute('src');
      element.load();
      return;
    }
    element.removeAttribute('src');
  }

  get(clipId: string): ClipSource | undefined {
    return this.elements.get(clipId);
  }

  /**
   * L'élément d'un plan, s'il porte un décodeur vidéo.
   *
   * Le graphe audio passe par ici et jamais par `get` : brancher une source
   * Web Audio sur une image lèverait une exception au premier plan fixe du
   * montage, et couperait le son de tout le reste avec elle.
   */
  getVideo(clipId: string): HTMLVideoElement | undefined {
    const element = this.elements.get(clipId);
    return element instanceof HTMLVideoElement ? element : undefined;
  }

  all(): ClipSource[] {
    return [...this.elements.values()];
  }

  pauseAll(): void {
    for (const element of this.elements.values()) {
      if (element instanceof HTMLVideoElement) element.pause();
    }
  }

  dispose(): void {
    for (const element of this.elements.values()) this.release(element);
    this.elements.clear();
  }
}

/** Prépare le décodeur d'un rush. */
function chargerRush(asset: MediaAsset): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = asset.url;
  video.preload = 'auto';
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  // Le son des clips passe par le graphe Web Audio, jamais par l'élément :
  // c'est ce qui permet de le mixer avec les bruitages et la musique.
  video.muted = true;
  video.load();
  return video;
}

/** Prépare l'élément d'une image fixe. */
function charger(asset: MediaAsset): HTMLImageElement {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = asset.url;
  return image;
}

/**
 * Vignettes, pour tenir l'écran pendant qu'une vidéo se cale.
 *
 * Déplacer la tête de lecture demande un repositionnement, et un
 * repositionnement coûte deux à trois cents millisecondes sur un téléphone.
 * Pendant ce temps l'aperçu n'a rien à montrer : on y voyait d'abord un aplat
 * marron, puis — une fois l'étalonnage retenu — un fond noir. Les deux disent
 * la même chose à l'utilisateur, « ça ne marche pas », alors qu'il cherche
 * simplement une image.
 *
 * Or chaque rush porte déjà sa vignette, décodée à l'import. La poser en
 * attendant montre **le bon plan**, à la bonne échelle, tout de suite : ce
 * n'est pas l'image exacte de l'instant visé, mais c'est le plan qu'on
 * cherche, et cela suffit pour viser.
 *
 * Le cache est un module et non un champ du vivier : une vignette pèse
 * quelques kilo-octets, elle survit à la fenêtre de chargement des vidéos, et
 * la recharger à chaque éviction annulerait tout le bénéfice.
 */
const vignettes = new Map<string, HTMLImageElement>();

function vignette(asset: MediaAsset | undefined): HTMLImageElement | null {
  if (!asset?.thumbnail) return null;
  const connue = vignettes.get(asset.id);
  if (connue) return connue.naturalWidth > 0 ? connue : null;

  const image = new Image();
  image.decoding = 'async';
  image.src = asset.thumbnail;
  vignettes.set(asset.id, image);
  return image.naturalWidth > 0 ? image : null;
}

/** Écart de synchronisation au-delà duquel on repositionne la lecture. */
const DRIFT_TOLERANCE = 0.25;

/*
 * À l'arrêt, la tolérance tombe à une image.
 *
 * Le quart de seconde ci-dessus se justifie **en lecture** : la vidéo avance
 * d'elle-même, et repositionner pour une broutille ferait sauter l'image à
 * chaque correction. À l'arrêt il n'y a aucune dérive à tolérer — rien
 * n'avance — et ces 0,25 s deviennent six images à 24 i/s pendant lesquelles
 * la jauge bouge sans que l'image change.
 *
 * C'est ce qui empêchait de choisir une image précise : on déplaçait la tête de
 * lecture pour tomber sur le plan qui porte un texte, l'aperçu ne suivait pas,
 * et le montage paraissait ne pas répondre. Une image de marge suffit à éviter
 * le repositionnement permanent quand la vidéo se cale à un cheveu près.
 */
const DRIFT_TOLERANCE_ARRET = 0.05;

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
    // Une image fixe n'a ni tête de lecture, ni cadence, ni dérive à corriger :
    // il n'y a rien à synchroniser, seulement à tracer.
    const video = pool.getVideo(item.clip.id);
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
    const tolerance = playing ? DRIFT_TOLERANCE : DRIFT_TOLERANCE_ARRET;
    if (Math.abs(video.currentTime - bounded) > tolerance) {
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

/** Dessine une image de plan en remplissant le cadre 9:16, sans déformation. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  source: ClipSource,
  transform: LayerTransform,
  filter: string,
): void {
  const { width: vw, height: vh } = sourceSize(source);
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
    ctx.drawImage(source, x, y, width, height);
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
  asset?: MediaAsset,
): LayerDrawer | null {
  const source = pool.get(layer.placed.clip.id) ?? vignette(asset);
  if (!source) return null;

  /*
   * Présent dans le vivier ne veut pas dire prêt à être tracé.
   *
   * Un élément vidéo existe dès qu'on lui donne une source, bien avant d'avoir
   * décodé quoi que ce soit. `drawCover` sortait déjà sur des dimensions nulles
   * — mais trop tard : le tracé était réputé fait, et l'étalonnage repartait sur
   * un cadre noir, qu'il virait au marron par sa teinte chaude.
   *
   * `readyState` doit valoir au moins `HAVE_CURRENT_DATA` : une vidéo peut
   * connaître ses dimensions dès les métadonnées, plusieurs centaines de
   * millisecondes avant d'avoir une image à donner.
   */
  let dessinable: ClipSource = source;
  const { width, height } = sourceSize(source);
  const prete = width > 0 && height > 0
    && !(source instanceof HTMLVideoElement && source.readyState < 2);
  if (!prete) {
    // La vidéo n'a rien à donner : la vignette du rush tient l'écran.
    const secours = vignette(asset);
    if (!secours) return null;
    dessinable = secours;
  }

  const progress = layer.placed.duration > 0 ? layer.localTime / layer.placed.duration : 0;
  const motion = motionTransform(layer.placed.clip, progress, layer.localTime);

  return (transform: LayerTransform) => {
    drawCover(
      ctx,
      dessinable,
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
  /**
   * Signature de l'offre libre, tracée en bas de l'image. Absente sans elle.
   *
   * Le moteur reçoit un texte, jamais un état d'abonnement : il ne connaît pas
   * le module de licence et ne doit pas le connaître — c'est la frontière que
   * `src/lib/__tests__/frontiere.test.ts` garde. Qui décide de la signature est
   * l'affaire de l'interface ; le moteur ne sait que la dessiner.
   */
  signature?: string;
  /**
   * Reçoit la position de chaque sous-titre tracé.
   *
   * Un texte dessiné dans un canvas n'est pas un élément du document : sans
   * cette trace, rien ne permettrait de savoir lequel se trouve sous le doigt.
   * La table est vidée puis remplie à chaque image.
   */
  captionBoxes?: Map<string, CaptionBox>;
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

  /*
   * Rien à composer : on s'arrête au fond noir.
   *
   * Poursuivre appliquerait tout le post-traitement — dont le halo, qui redessine
   * et floute une copie de l'image entière — à un cadre vide, pour un résultat
   * strictement identique. Ce gaspillage tombait au pire moment : pendant
   * l'import, où le décodage des rushes se dispute déjà le processeur, au point
   * qu'un téléphone modeste n'arrivait plus au bout de sa bibliothèque.
   */
  if (placed.length === 0) return;

  const slice = sliceAt(placed, time);
  const look = getLook(project.cinema.look);
  const filter = options.grade ? options.grade.baseFilter(look, project.cinema.intensity) : 'none';

  let dessine = false;
  if (slice) {
    const asset = (id: string) => project.assets.find((a) => a.id === id);
    const drawTo = layerDrawer(ctx, slice.to, pool, filter, asset(slice.to.placed.clip.assetId));
    const drawFrom = slice.from
      ? layerDrawer(ctx, slice.from, pool, filter, asset(slice.from.placed.clip.assetId))
      : null;
    if (drawTo) {
      applyTransition(slice.to.placed.clip.transition, slice.progress, ctx, drawFrom, drawTo);
      dessine = true;
    }
  }

  /*
   * Rien n'a pu être dessiné : on s'arrête au fond noir, ici aussi.
   *
   * Le cas de la frise vide était déjà traité plus haut, pour la même raison.
   * Celui-ci ne l'était pas : le plan existe, mais son élément vidéo n'est pas
   * encore dans le vivier — le navigateur ne garde qu'une poignée de décodeurs,
   * et un montage long en déborde. `drawTo` est alors nul, rien n'est tracé,
   * et l'étalonnage s'appliquait quand même à un cadre noir.
   *
   * Le résultat n'était pas noir mais **marron** : la teinte chaude des hautes
   * lumières monte le rouge et le vert sur du noir. Vu sur un montage de 37 s,
   * un aplat marron uni occupait l'aperçu pendant près de deux secondes — et
   * un aplat coloré se lit comme un plan voulu, alors qu'un fond noir se lit
   * comme une image qui arrive.
   *
   * Seul l'étalonnage est retenu. Les sous-titres, eux, continuent d'être
   * tracés : ils ne dépendent pas de la vidéo, ils portent le propos, et les
   * priver d'affichage parce qu'une image tarde reviendrait à effacer la seule
   * chose encore lisible. Leur table de positions doit d'ailleurs être vidée
   * puis remplie à chaque image, faute de quoi le doigt viserait des cadres qui
   * n'existent plus.
   */
  if (dessine) {
    options.grade?.apply(ctx, look, {
      intensity: project.cinema.intensity,
      frame: options.frame ?? 0,
      bars: project.cinema.bars,
      bloom: options.bloom ?? true,
    });
  }

  options.captionBoxes?.clear();
  for (const caption of captionsAt(project.captions, time)) {
    const box = drawCaption(ctx, caption, time, fonts);
    if (box) options.captionBoxes?.set(caption.id, box);
  }

  if (options.signature) drawSignature(ctx, options.signature, fonts);
}

/** Hauteur de la signature, en part de l'image. */
const SIGNATURE_Y = 0.94;
/** Marge au bord droit, en pixels de la composition 1080 × 1920. */
const SIGNATURE_MARGE = 34;

/**
 * La signature de l'offre libre.
 *
 * Elle est tracée **après les sous-titres**, jamais avant : un texte qui porte
 * le propos ne doit pas passer sous une marque commerciale. Et après
 * l'étalonnage, comme eux — la grainer la ferait scintiller d'une image à
 * l'autre, ce qui attire l'œil bien plus que la marque elle-même.
 *
 * À 94 % de la hauteur, elle est **sous la bande sûre** des sous-titres
 * (12–45 %) et sous la zone que l'habillage des plateformes occupe. C'est
 * délibéré : une signature ne doit gêner ni la lecture ni la composition, et
 * elle reste entière dans le fichier — c'est là qu'elle compte, puisque c'est
 * le fichier qu'on republie et qu'on partage.
 *
 * Discrète et non dissimulée. Une marque qu'on cacherait à moitié serait un
 * procédé : soit on l'assume, soit on ne la met pas.
 */
function drawSignature(ctx: CanvasRenderingContext2D, texte: string, fonts: FontSet): void {
  ctx.save();
  ctx.font = `600 30px ${fonts.body}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(texte, OUTPUT_WIDTH - SIGNATURE_MARGE, OUTPUT_HEIGHT * SIGNATURE_Y);
  ctx.restore();
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
