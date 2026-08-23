'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AudioEngine } from '@/lib/audio';
import type { FontSet } from '@/lib/captions';
import { GradePipeline } from '@/lib/grade';
import { guessTier, PanicDetector, QualityGovernor, QUALITY_TIERS, tierById } from '@/lib/quality';
import { ClipVideoPool, preloadCaptionFonts, renderFrame, syncPlayback } from '@/lib/renderer';
import { useStudio } from '@/lib/store';
import { layoutClips } from '@/lib/timeline';
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from '@/lib/types';

/**
 * Boucle de lecture.
 *
 * Une seule `requestAnimationFrame` pilote tout : elle avance la tête de
 * lecture, recale les éléments vidéo, programme les bruitages et trace l'image.
 * La boucle tourne aussi à l'arrêt — c'est ce qui permet de voir immédiatement
 * l'effet d'un réglage sans avoir à relancer la lecture.
 *
 * L'état vivant est lu par `getState()` plutôt que capturé dans la portée du
 * `useEffect` : sans cela, chaque modification du projet obligerait à détruire
 * et recréer la boucle, avec une coupure visible à chaque frappe au clavier.
 */
export type PlaybackEngine = {
  /**
   * Déclare le canvas sur lequel dessiner.
   *
   * C'est le composant d'affichage qui détient son canvas et l'enregistre ici
   * depuis un effet, plutôt que le moteur qui exposerait une ref. L'inverse
   * ferait transiter une ref par les props, ce que React déconseille.
   */
  setCanvas: (canvas: HTMLCanvasElement | null) => void;
  /** Canvas courant, à n'appeler que depuis un gestionnaire ou un effet. */
  getCanvas: () => HTMLCanvasElement | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  /** Ressources internes, dont l'export a besoin. */
  resources: () => { pool: ClipVideoPool; grade: GradePipeline; audio: AudioEngine | null };
  /** Prépare le mixage audio ; nécessite un geste utilisateur préalable. */
  ensureAudio: () => Promise<AudioEngine>;
  /**
   * Repasse en pleine définition et attend que le canvas soit redimensionné.
   *
   * L'export capture le flux du canvas : sa taille doit être définitive avant
   * que l'enregistrement ne commence, sinon le fichier sortirait à la
   * définition réduite de la prévisualisation.
   */
  beginExport: (scale?: number) => Promise<void>;
  /** Rend la main à la surveillance de qualité. */
  endExport: () => void;
};

/**
 * Contexte de dessin du canvas courant, mis en cache.
 *
 * La taille du canvas suit le palier de qualité, pas la définition de sortie :
 * un téléphone dessine moins de pixels, tandis que la composition reste écrite
 * en coordonnées 1080 × 1920. L'affichage à l'écran reste affaire de CSS.
 */
function resolveContext(
  canvas: HTMLCanvasElement | null,
  cache: React.RefObject<ContextCache | null>,
  scale: number,
): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  if (cache.current?.canvas === canvas && cache.current.scale === scale) return cache.current.ctx;

  // Redimensionner un canvas vide son contenu et réinitialise son contexte :
  // on ne le fait donc qu'au changement réel d'échelle, pas à chaque image.
  canvas.width = Math.round(OUTPUT_WIDTH * scale);
  canvas.height = Math.round(OUTPUT_HEIGHT * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  cache.current = { canvas, ctx, scale };
  return ctx;
}

type ContextCache = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number };

export function usePlayback(fonts: FontSet): PlaybackEngine {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<ContextCache | null>(null);
  const governorRef = useRef<QualityGovernor | null>(null);
  const panicRef = useRef<PanicDetector | null>(null);
  /**
   * Échelle imposée pendant un export, ou null hors export.
   *
   * La définition de sortie prime alors sur la fluidité — c'est le fichier
   * livré, il ne se rejoue pas.
   */
  const exportingRef = useRef<number | null>(null);
  const poolRef = useRef<ClipVideoPool | null>(null);
  const gradeRef = useRef<GradePipeline | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const frameRef = useRef(0);

  if (poolRef.current === null) poolRef.current = new ClipVideoPool();
  if (gradeRef.current === null) gradeRef.current = new GradePipeline();
  if (governorRef.current === null) governorRef.current = new QualityGovernor(guessTier());
  if (panicRef.current === null) panicRef.current = new PanicDetector();

  // Les polices doivent être résolues avant le premier tracé : le canvas ne
  // déclenche aucun chargement et substituerait silencieusement une autre police.
  useEffect(() => {
    void preloadCaptionFonts(fonts);
  }, [fonts]);

  // Le pool suit la composition du projet, sans passer par la boucle de rendu.
  useEffect(
    () =>
      useStudio.subscribe((state) => {
        poolRef.current?.sync(state.project.clips, state.project.assets);
      }),
    [],
  );

  useEffect(() => {
    const pool = poolRef.current;
    const grade = gradeRef.current;
    if (!pool || !grade) return;

    const state = useStudio.getState();
    pool.sync(state.project.clips, state.project.assets);

    let raf = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const exporting = exportingRef.current !== null;

      /*
       * Le temps écoulé est borné pour absorber les longues interruptions —
       * onglet passé en arrière-plan, machine en veille — qui feraient sinon
       * bondir la tête de lecture de plusieurs secondes.
       *
       * Pendant un export, cette borne devient nuisible : sur un appareil lent,
       * une image peut prendre plus longtemps qu'elle, et la tête de lecture
       * avance alors moins vite que le temps réel. Le fichier produit s'allonge
       * — vingt secondes mesurées pour un montage de sept — pendant que le son,
       * lui, continue en temps réel : l'image et l'audio se désynchronisent.
       *
       * Sans borne, un appareil lent perd des images mais conserve la bonne
       * durée et la bonne synchronisation, ce qui vaut infiniment mieux.
       */
      const delta = exporting ? (now - previous) / 1000 : Math.min(0.25, (now - previous) / 1000);
      previous = now;

      const governor = governorRef.current!;
      const choice = useStudio.getState().qualityChoice;
      const pinned = choice === 'auto' ? null : tierById(choice);
      if (pinned && pinned.id !== governor.current().id) governor.set(pinned);

      const tier = exporting
        ? { ...tierById('full'), scale: exportingRef.current! }
        : governor.current();

      // Le canvas est retrouvé à chaque image plutôt que capturé au démarrage :
      // la boucle devient insensible à l'ordre de montage des composants et
      // survit à un remplacement du canvas.
      const ctx = resolveContext(canvasRef.current, ctxRef, tier.scale);
      if (!ctx) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const store = useStudio.getState();
      const { project, playing } = store;
      const placed = layoutClips(project.clips);
      const duration = placed.length === 0 ? 0 : placed[placed.length - 1].end;

      let time = store.playhead;
      if (playing && duration > 0) {
        time += delta;
        if (time >= duration) {
          time = duration;
          store.setPlaying(false);
          audioRef.current?.resetSchedule();
        }
        store.setPlayhead(time);
      }

      syncPlayback(placed, pool, time, playing);

      const audio = audioRef.current;
      if (audio) {
        for (const clip of project.clips) audio.setClipVolume(clip.id, clip.volume);
        audio.syncMusic(project.music?.url ?? null, project.music?.gain ?? 0);
        audio.syncMusicPosition(project.music?.offset ?? 0, time, playing);
        if (playing) audio.scheduleUpcoming(project, time);
      }

      renderFrame(ctx, project, time, pool, fonts, {
        placed,
        grade,
        frame: frameRef.current++,
        scale: tier.scale,
        bloom: tier.bloom,
      });

      const work = performance.now() - now;

      // Le filet de sécurité veille en permanence, lecture ou non : composer
      // l'image coûte le même prix à l'arrêt, et une interface figée l'est tout
      // autant. Seul un export y échappe, la pleine définition y étant imposée.
      if (pinned && !exporting) {
        if (panicRef.current!.observe(work)) {
          const index = QUALITY_TIERS.findIndex((t) => t.id === pinned.id);
          const fallback = QUALITY_TIERS[Math.min(index + 1, QUALITY_TIERS.length - 1)];
          governor.set(fallback);
          useStudio.setState({
            qualityChoice: 'auto',
            effectiveQuality: fallback.id,
            qualityRescued: true,
          });
          panicRef.current!.reset();
        }
      } else {
        panicRef.current!.reset();
      }

      // L'ajustement automatique, lui, n'a de sens qu'en lecture : à l'arrêt,
      // la charge mesurée ne dit rien de ce que coûtera le montage en marche.
      if (playing && !exporting && !pinned) {
        const changed = governor.observe(work, now);
        if (changed) useStudio.setState({ effectiveQuality: changed.id });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fonts]);

  // Libération des ressources au démontage : sans cela, les éléments vidéo et le
  // contexte audio survivraient à la page et retiendraient les fichiers en mémoire.
  useEffect(() => {
    const pool = poolRef.current;
    return () => {
      pool?.dispose();
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    const audio = audioRef.current;
    await audio.resume();

    // Le branchement ne peut avoir lieu qu'une fois le contexte audio créé,
    // donc au plus tôt au premier geste de l'utilisateur.
    const { project } = useStudio.getState();
    poolRef.current?.sync(project.clips, project.assets);
    for (const clip of project.clips) {
      const video = poolRef.current?.get(clip.id);
      if (video) audio.attachClip(clip.id, video);
    }
    audio.pruneClips(new Set(project.clips.map((c) => c.id)));
    return audio;
  }, []);

  const play = useCallback(() => {
    const store = useStudio.getState();
    if (store.project.clips.length === 0) return;

    void ensureAudio().then((audio) => {
      audio.resetSchedule();
      // Repartir de zéro quand la lecture est déjà au bout évite le clic sur un
      // bouton qui, sinon, ne produirait rien.
      const state = useStudio.getState();
      if (state.playhead >= state.duration() - 0.05) state.setPlayhead(0);
      state.setPlaying(true);
    });
  }, [ensureAudio]);

  const pause = useCallback(() => {
    useStudio.getState().setPlaying(false);
    audioRef.current?.resetSchedule();
    poolRef.current?.pauseAll();
  }, []);

  const toggle = useCallback(() => {
    if (useStudio.getState().playing) pause();
    else play();
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const store = useStudio.getState();
    store.setPlayhead(time);
    // Les bruitages programmés pour l'ancienne position n'ont plus lieu d'être.
    audioRef.current?.resetSchedule();
  }, []);

  const resources = useCallback(
    () => ({ pool: poolRef.current!, grade: gradeRef.current!, audio: audioRef.current }),
    [],
  );

  const beginExport = useCallback(async (scale = 1) => {
    exportingRef.current = scale;
    // Deux images d'attente : la première applique la nouvelle taille, la
    // seconde garantit qu'elle a bien été composée avant toute capture.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }, []);

  const endExport = useCallback(() => {
    exportingRef.current = null;
  }, []);

  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  const getCanvas = useCallback(() => canvasRef.current, []);

  // Identité stable : les consommateurs placent ce moteur dans les dépendances
  // de leurs effets, qui se relanceraient à chaque rendu sans cette mémoïsation.
  return useMemo(
    () => ({ setCanvas, getCanvas, play, pause, toggle, seek, resources, ensureAudio, beginExport, endExport }),
    [setCanvas, getCanvas, play, pause, toggle, seek, resources, ensureAudio, beginExport, endExport],
  );
}
