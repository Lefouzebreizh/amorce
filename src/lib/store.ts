'use client';

import { create } from 'zustand';
import { uid } from './id';
import { emptyProject, layoutClips, totalDuration } from './timeline';
import type { QualityTier } from './quality';
import {
  DEFAULT_CLIP,
  type Caption,
  type CaptionStyleId,
  type Clip,
  type MediaAsset,
  type MusicTrack,
  type Project,
  type SfxId,
  type ExportPreset,
  type SoundCue,
} from './types';

/** Choix de qualité : « auto » laisse la surveillance décider. */
export type QualityChoice = 'auto' | QualityTier['id'];

/** Élément sélectionné dans l'éditeur : pilote le contenu du panneau de droite. */
export type Selection =
  | { kind: 'clip'; id: string }
  | { kind: 'caption'; id: string }
  | { kind: 'cue'; id: string }
  | null;

type StudioState = {
  project: Project;
  selection: Selection;
  /** Position de la tête de lecture, en secondes. */
  playhead: number;
  playing: boolean;
  /** Qualité demandée par l'utilisateur. */
  qualityChoice: QualityChoice;
  /**
   * Palier réellement appliqué.
   *
   * Écrit par la boucle de rendu, jamais pendant le rendu React : la valeur de
   * départ est donc une constante, identique côté serveur et côté navigateur,
   * et la surveillance la corrige dès les premières images.
   */
  effectiveQuality: QualityTier['id'];
  /** Vrai quand le filet de sécurité a repris la main sur un choix trop lourd. */
  qualityRescued: boolean;
  setQualityChoice: (choice: QualityChoice) => void;
  /** Définition retenue pour le fichier produit. */
  exportPreset: ExportPreset['id'];
  setExportPreset: (id: ExportPreset['id']) => void;

  // -- Médias ---------------------------------------------------------------
  addAssets: (assets: MediaAsset[]) => void;
  removeAsset: (assetId: string) => void;

  // -- Clips ----------------------------------------------------------------
  appendClip: (assetId: string) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  moveClip: (from: number, to: number) => void;
  splitClipAtPlayhead: () => void;

  // -- Sous-titres ----------------------------------------------------------
  addCaption: (style?: CaptionStyleId) => void;
  updateCaption: (id: string, patch: Partial<Caption>) => void;
  removeCaption: (id: string) => void;

  // -- Bruitages ------------------------------------------------------------
  addCue: (sfx: SfxId, time?: number) => void;
  updateCue: (id: string, patch: Partial<SoundCue>) => void;
  removeCue: (id: string) => void;

  // -- Musique --------------------------------------------------------------
  setMusic: (music: MusicTrack | null) => void;
  updateMusic: (patch: Partial<MusicTrack>) => void;

  // -- Lecture --------------------------------------------------------------
  select: (selection: Selection) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  renameProject: (name: string) => void;
  duration: () => number;
};

/** Ramène une valeur dans l'intervalle [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const useStudio = create<StudioState>((set, get) => ({
  project: emptyProject(),
  selection: null,
  playhead: 0,
  playing: false,
  qualityChoice: 'auto',
  effectiveQuality: 'high',
  qualityRescued: false,
  exportPreset: 'full',
  setExportPreset: (exportPreset) => set({ exportPreset }),
  // Un nouveau choix efface l'avertissement : l'utilisateur a repris la main.
  setQualityChoice: (qualityChoice) => set({ qualityChoice, qualityRescued: false }),

  addAssets: (assets) =>
    set((state) => ({ project: { ...state.project, assets: [...state.project.assets, ...assets] } })),

  removeAsset: (assetId) =>
    set((state) => {
      const asset = state.project.assets.find((a) => a.id === assetId);
      if (asset) URL.revokeObjectURL(asset.url);
      return {
        project: {
          ...state.project,
          assets: state.project.assets.filter((a) => a.id !== assetId),
          // Un clip ne peut pas survivre à la disparition de son média source.
          clips: state.project.clips.filter((c) => c.assetId !== assetId),
        },
      };
    }),

  appendClip: (assetId) =>
    set((state) => {
      const asset = state.project.assets.find((a) => a.id === assetId);
      if (!asset) return state;
      const clip: Clip = {
        ...DEFAULT_CLIP,
        id: uid('clip'),
        assetId,
        outPoint: asset.duration,
        // Le tout premier clip n'a rien à enchaîner : il démarre sec.
        transition: state.project.clips.length === 0 ? 'cut' : DEFAULT_CLIP.transition,
      };
      return {
        project: { ...state.project, clips: [...state.project.clips, clip] },
        selection: { kind: 'clip', id: clip.id },
      };
    }),

  updateClip: (id, patch) =>
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removeClip: (id) =>
    set((state) => ({
      project: { ...state.project, clips: state.project.clips.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'clip' && state.selection.id === id ? null : state.selection,
    })),

  moveClip: (from, to) =>
    set((state) => {
      const clips = [...state.project.clips];
      if (from < 0 || from >= clips.length || to < 0 || to >= clips.length) return state;
      const [moved] = clips.splice(from, 1);
      clips.splice(to, 0, moved);
      return { project: { ...state.project, clips } };
    }),

  splitClipAtPlayhead: () =>
    set((state) => {
      const { clips } = state.project;
      const placed = layoutClips(clips);
      const target = placed.find((p) => state.playhead > p.start + 0.05 && state.playhead < p.end - 0.05);
      if (!target) return state;

      const clip = target.clip;
      // Position de la coupe dans le média source.
      const cutSource = clip.inPoint + (state.playhead - target.start) * clip.speed;
      const head: Clip = { ...clip, outPoint: cutSource };
      const tail: Clip = { ...clip, id: uid('clip'), inPoint: cutSource, transition: 'cut', transitionDuration: 0 };

      const index = clips.findIndex((c) => c.id === clip.id);
      const next = [...clips];
      next.splice(index, 1, head, tail);
      return { project: { ...state.project, clips: next }, selection: { kind: 'clip', id: tail.id } };
    }),

  addCaption: (style = 'punch') =>
    set((state) => {
      const start = state.playhead;
      const caption: Caption = {
        id: uid('cap'),
        text: 'Attends la fin 👀',
        start,
        end: start + 2,
        style,
        y: 0.5,
      };
      return {
        project: { ...state.project, captions: [...state.project.captions, caption] },
        selection: { kind: 'caption', id: caption.id },
      };
    }),

  updateCaption: (id, patch) =>
    set((state) => ({
      project: {
        ...state.project,
        captions: state.project.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removeCaption: (id) =>
    set((state) => ({
      project: { ...state.project, captions: state.project.captions.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'caption' && state.selection.id === id ? null : state.selection,
    })),

  addCue: (sfx, time) =>
    set((state) => {
      const cue: SoundCue = { id: uid('sfx'), sfx, time: time ?? state.playhead, gain: 0.8 };
      return {
        project: { ...state.project, cues: [...state.project.cues, cue] },
        selection: { kind: 'cue', id: cue.id },
      };
    }),

  updateCue: (id, patch) =>
    set((state) => ({
      project: { ...state.project, cues: state.project.cues.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
    })),

  removeCue: (id) =>
    set((state) => ({
      project: { ...state.project, cues: state.project.cues.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'cue' && state.selection.id === id ? null : state.selection,
    })),

  setMusic: (music) =>
    set((state) => {
      if (state.project.music) URL.revokeObjectURL(state.project.music.url);
      return { project: { ...state.project, music } };
    }),

  updateMusic: (patch) =>
    set((state) => ({
      project: { ...state.project, music: state.project.music ? { ...state.project.music, ...patch } : null },
    })),

  select: (selection) => set({ selection }),
  setPlayhead: (time) => set((state) => ({ playhead: clamp(time, 0, totalDuration(state.project.clips)) })),
  setPlaying: (playing) => set({ playing }),
  renameProject: (name) => set((state) => ({ project: { ...state.project, name } })),
  duration: () => totalDuration(get().project.clips),
}));
