'use client';

import { create } from 'zustand';
import { uid } from './id.ts';
import { captionsFromVoice } from './voice.ts';
import { emptyProject, layoutClips, totalDuration } from './timeline.ts';
import type { QualityTier } from './quality.ts';
import {
  DEFAULT_CLIP,
  MIN_CLIP_DURATION,
  type Caption,
  type CaptionStyleId,
  type Clip,
  type MediaAsset,
  type MixSettings,
  type MusicTrack,
  type ExportPreset,
  type Project,
  type SfxId,
  type SampleCue,
  type SoundCue,
  type VoiceCue,
} from './types.ts';

/** Choix de qualité : « auto » laisse la surveillance décider. */
export type QualityChoice = 'auto' | QualityTier['id'];

/** Élément sélectionné dans l'éditeur : pilote le contenu du panneau de droite. */
export type Selection =
  | { kind: 'clip'; id: string }
  | { kind: 'caption'; id: string }
  | { kind: 'cue'; id: string }
  | null;

/** Un état antérieur du projet, conservé pour pouvoir y revenir. */
type Snapshot = { project: Project; label: string };

/** Profondeur de l'historique. Au-delà, les états les plus anciens tombent. */
const HISTORY_LIMIT = 60;

/**
 * Délai en deçà duquel deux modifications de même nature n'en font qu'une.
 *
 * Sans ce regroupement, un simple glissement de jauge produirait des dizaines
 * d'entrées et il faudrait autant d'annulations pour revenir en arrière.
 */
const COALESCE_MS = 600;

/**
 * Modifications susceptibles d'être regroupées.
 *
 * Uniquement celles qui viennent d'une commande continue — jauge qu'on fait
 * glisser, texte qu'on saisit — où chaque valeur intermédiaire n'a pas de sens
 * en soi. Un geste discret n'est jamais fondu dans le précédent : découper un
 * plan juste après l'avoir ajouté doit s'annuler en deux fois, sinon
 * l'annulation en défait plus que ce qu'on croyait.
 */
const COALESCING = new Set([
  'reglage',
  'texte-reglage',
  'son-reglage',
  'musique-reglage',
  'voix-reglage',
  'bruitage-reglage',
  'mixage',
  'nom',
]);

type StudioState = {
  project: Project;
  /** États antérieurs, du plus ancien au plus récent. */
  past: Snapshot[];
  /** États annulés, prêts à être rétablis. */
  future: Snapshot[];
  undo: () => void;
  redo: () => void;
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
  /**
   * Pourquoi le montage n'est pas conservé, ou null s'il l'est.
   *
   * Hors du projet, donc hors de l'historique : c'est un état de la machine, pas
   * une décision de l'utilisateur, et l'annuler n'aurait aucun sens.
   */
  storageError: string | null;
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
  duplicateClip: (id: string) => void;
  /** Découpe un plan en morceaux d'environ `target` secondes. */
  chopClip: (id: string, target?: number) => void;
  /** Pose un bruitage sur chaque raccord qui n'en a pas encore. */
  addSoundsOnCuts: () => void;
  /** Relance l'attention là où l'analyse a repéré un creux. */
  fillTensionGaps: (moments: number[]) => void;
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

  // -- Bruitages importés ---------------------------------------------------
  addSamples: (cues: SampleCue[]) => void;
  updateSample: (id: string, patch: Partial<SampleCue>) => void;
  removeSample: (id: string) => void;

  // -- Voix off -------------------------------------------------------------
  addVoices: (cues: VoiceCue[]) => void;
  updateVoice: (id: string, patch: Partial<VoiceCue>) => void;
  removeVoice: (id: string) => void;
  /** Fabrique les sous-titres d'une réplique à partir de son texte. */
  alignVoice: (id: string) => void;

  // -- Musique --------------------------------------------------------------
  setMusic: (music: MusicTrack | null) => void;
  /** Ajuste l'équilibre entre les trois sources sonores. */
  setMix: (patch: Partial<MixSettings>) => void;
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

/**
 * Remet la tête de lecture dans les bornes du montage.
 *
 * Raccourcir ou supprimer un plan raccourcit le montage, et la tête de lecture
 * peut se retrouver au-delà de la fin. Le lecteur affiche alors une position
 * supérieure à la durée totale — vu sur un montage ramené à 0,1 s dont la tête
 * restait à 2,1 s — et le curseur de défilement bute en butée sans correspondre
 * à ce qui est affiché.
 */
function reclamp<T extends { project: Project; playhead: number }>(state: T): T {
  const limit = totalDuration(state.project.clips);
  return state.playhead > limit ? { ...state, playhead: limit } : state;
}

export const useStudio = create<StudioState>((set, get) => {
  /** Nature et instant de la dernière modification, pour le regroupement. */
  let lastLabel = '';
  let lastAt = 0;

  /**
   * Applique une modification du projet en la rendant annulable.
   *
   * Les changements qui ne touchent pas au projet — sélection, tête de lecture,
   * réglages d'affichage — passent directement par `set` : les inscrire dans
   * l'historique obligerait à annuler plusieurs fois pour défaire une seule
   * action réelle.
   */
  const mutate = (label: string, producer: (state: StudioState) => Partial<StudioState>) =>
    set((state) => {
      const patch = producer(state);
      if (!patch.project || patch.project === state.project) return patch;

      const now = Date.now();
      const merge = COALESCING.has(label) && label === lastLabel && now - lastAt < COALESCE_MS;
      lastLabel = label;
      lastAt = now;

      return {
        ...patch,
        past: merge ? state.past : [...state.past, { project: state.project, label }].slice(-HISTORY_LIMIT),
        future: [],
      };
    });

  return {
  project: emptyProject(),
  past: [],
  future: [],

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;

      // Le regroupement est rompu : sans cela, la modification suivante
      // viendrait se fondre dans une entrée qui n'existe plus.
      lastLabel = '';
      return {
        project: previous.project,
        past: state.past.slice(0, -1),
        future: [{ project: state.project, label: previous.label }, ...state.future].slice(0, HISTORY_LIMIT),
        selection: null,
        playing: false,
        playhead: Math.min(state.playhead, totalDuration(previous.project.clips)),
      };
    }),

  redo: () =>
    set((state) => {
      const [next, ...rest] = state.future;
      if (!next) return state;

      lastLabel = '';
      return {
        project: next.project,
        past: [...state.past, { project: state.project, label: next.label }].slice(-HISTORY_LIMIT),
        future: rest,
        selection: null,
        playing: false,
        playhead: Math.min(state.playhead, totalDuration(next.project.clips)),
      };
    }),

  selection: null,
  playhead: 0,
  playing: false,
  qualityChoice: 'auto',
  effectiveQuality: 'high',
  qualityRescued: false,
  storageError: null,
  exportPreset: 'full',
  setExportPreset: (exportPreset) => set({ exportPreset }),
  // Un nouveau choix efface l'avertissement : l'utilisateur a repris la main.
  setQualityChoice: (qualityChoice) => set({ qualityChoice, qualityRescued: false }),

  addAssets: (assets) =>
    mutate('import', (state) => ({ project: { ...state.project, assets: [...state.project.assets, ...assets] } })),

  removeAsset: (assetId) =>
    mutate('import-retrait', (state) => {
      const asset = state.project.assets.find((a) => a.id === assetId);
      if (asset) URL.revokeObjectURL(asset.url);
      return reclamp({
        ...state,
        project: {
          ...state.project,
          assets: state.project.assets.filter((a) => a.id !== assetId),
          // Un clip ne peut pas survivre à la disparition de son média source.
          clips: state.project.clips.filter((c) => c.assetId !== assetId),
        },
      });
    }),

  appendClip: (assetId) =>
    mutate('ajout-plan', (state) => {
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
    mutate('reglage', (state) =>
      reclamp({
        ...state,
        project: {
          ...state.project,
          clips: state.project.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        },
      }),
    ),

  removeClip: (id) =>
    mutate('retrait-plan', (state) =>
      reclamp({
        ...state,
        project: { ...state.project, clips: state.project.clips.filter((c) => c.id !== id) },
        selection: state.selection?.kind === 'clip' && state.selection.id === id ? null : state.selection,
      }),
    ),

  /**
   * Insère une copie du plan juste après l'original.
   *
   * Les rushes générés par IA durent souvent deux ou trois secondes : sans
   * duplication, il devient impossible d'atteindre les quinze à trente secondes
   * qui font un format court tenable. La copie garde ses points d'entrée et de
   * sortie — c'est en la retouchant qu'on obtient une variation plutôt qu'une
   * répétition.
   */
  duplicateClip: (id) =>
    mutate('duplication', (state) => {
      const index = state.project.clips.findIndex((c) => c.id === id);
      if (index === -1) return state;

      const copy: Clip = { ...state.project.clips[index], id: uid('clip') };
      const clips = [...state.project.clips];
      clips.splice(index + 1, 0, copy);
      return {
        project: { ...state.project, clips },
        selection: { kind: 'clip', id: copy.id },
      };
    }),

  /**
   * Découpe un plan en morceaux réguliers.
   *
   * C'est le geste que réclame l'analyse quand un plan s'étire, et le plus
   * coûteux à faire à la main : il faudrait déplacer la tête de lecture et
   * couper une dizaine de fois de suite. Les morceaux s'enchaînent en coupe
   * franche, la cadence la plus nerveuse.
   */
  chopClip: (id, target = 2) =>
    mutate('decoupage', (state) => {
      const index = state.project.clips.findIndex((c) => c.id === id);
      if (index === -1) return state;

      const clip = state.project.clips[index];
      const sourceSpan = clip.outPoint - clip.inPoint;
      const shown = sourceSpan / Math.max(0.1, clip.speed);
      const pieces = Math.floor(shown / Math.max(0.5, target));
      if (pieces < 2) return state;

      const step = sourceSpan / pieces;
      const chopped: Clip[] = Array.from({ length: pieces }, (_, piece) => ({
        ...clip,
        id: uid('clip'),
        inPoint: clip.inPoint + piece * step,
        outPoint: clip.inPoint + (piece + 1) * step,
        // Le premier morceau hérite de la transition d'origine ; les suivants
        // s'enchaînent sec, sans quoi le découpage perdrait sa nervosité.
        transition: piece === 0 ? clip.transition : 'cut',
        transitionDuration: piece === 0 ? clip.transitionDuration : 0,
      }));

      const clips = [...state.project.clips];
      clips.splice(index, 1, ...chopped);
      return reclamp({ ...state, project: { ...state.project, clips }, selection: null });
    }),

  /**
   * Pose un bruitage sur chaque raccord.
   *
   * Les raccords déjà sonorisés sont laissés tels quels : la fonction peut être
   * relancée après un nouveau découpage sans empiler les sons au même endroit.
   */
  addSoundsOnCuts: () =>
    mutate('sons-auto', (state) => {
      const placed = layoutClips(state.project.clips);
      const cycle: SfxId[] = ['boom', 'whoosh', 'punch', 'swipe', 'whoosh', 'subdrop'];
      const added: SoundCue[] = [];

      const isFree = (time: number) =>
        ![...state.project.cues, ...added].some((c) => Math.abs(c.time - time) < 0.15);

      if (isFree(0.02)) added.push({ id: uid('sfx'), sfx: 'punch', time: 0.02, gain: 0.9 });

      placed.slice(1).forEach((item, index) => {
        const at = Math.max(0, item.start);
        if (isFree(at)) {
          added.push({ id: uid('sfx'), sfx: cycle[index % cycle.length], time: at, gain: 0.85 });
        }
      });

      if (added.length === 0) return state;
      return { project: { ...state.project, cues: [...state.project.cues, ...added] } };
    }),

  /** Pose une ponctuation sonore aux instants signalés par l'analyse. */
  fillTensionGaps: (moments) =>
    mutate('relance', (state) => {
      const added: SoundCue[] = [];
      const isFree = (time: number) =>
        ![...state.project.cues, ...added].some((c) => Math.abs(c.time - time) < 0.2);

      for (const moment of moments) {
        const at = Math.max(0, moment + 0.3);
        if (isFree(at)) added.push({ id: uid('sfx'), sfx: 'sparkle', time: at, gain: 0.7 });
      }

      if (added.length === 0) return state;
      return { project: { ...state.project, cues: [...state.project.cues, ...added] } };
    }),

  moveClip: (from, to) =>
    mutate('deplacement', (state) => {
      const clips = [...state.project.clips];
      if (from < 0 || from >= clips.length || to < 0 || to >= clips.length) return state;
      const [moved] = clips.splice(from, 1);
      clips.splice(to, 0, moved);
      // Réordonner change les transitions applicables, donc la durée totale.
      return reclamp({ ...state, project: { ...state.project, clips } });
    }),

  splitClipAtPlayhead: () =>
    mutate('coupe', (state) => {
      const { clips } = state.project;
      const placed = layoutClips(clips);
      // Chaque moitié doit rester au-dessus du plancher, sinon la coupe crée un
      // fragment invisible que l'utilisateur devra retrouver pour le supprimer.
      const target = placed.find(
        (p) =>
          state.playhead > p.start + MIN_CLIP_DURATION && state.playhead < p.end - MIN_CLIP_DURATION,
      );
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

  /**
   * Ajoute un sous-titre à la position de lecture.
   *
   * Le texte par défaut est neutre, et non une accroche toute faite : la même
   * phrase que celle posée par le montage express produisait deux sous-titres
   * identiques, superposés à l'écran, sans que rien ne signale qu'il y en avait
   * deux.
   *
   * La hauteur est décalée si un autre sous-titre occupe déjà l'instant visé,
   * pour la même raison : deux textes au même endroit se lisent comme un seul
   * texte abîmé.
   */
  addCaption: (style = 'punch') =>
    mutate('ajout-texte', (state) => {
      const start = state.playhead;
      const end = start + 2;

      const occupied = state.project.captions
        .filter((c) => c.start < end && c.end > start)
        .map((c) => c.y);

      // On descend par paliers jusqu'à trouver une hauteur libre, sans jamais
      // sortir de la zone lisible.
      const candidates = [0.5, 0.32, 0.66, 0.2, 0.78];
      const free = candidates.find((y) => occupied.every((taken) => Math.abs(taken - y) > 0.08));

      const caption: Caption = {
        id: uid('cap'),
        text: 'Ton texte ici',
        start,
        end,
        style,
        y: free ?? 0.5,
      };
      return {
        project: { ...state.project, captions: [...state.project.captions, caption] },
        selection: { kind: 'caption', id: caption.id },
      };
    }),

  updateCaption: (id, patch) =>
    mutate('texte-reglage', (state) => ({
      project: {
        ...state.project,
        captions: state.project.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removeCaption: (id) =>
    mutate('retrait-texte', (state) => ({
      project: { ...state.project, captions: state.project.captions.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'caption' && state.selection.id === id ? null : state.selection,
    })),

  addCue: (sfx, time) =>
    mutate('ajout-son', (state) => {
      const cue: SoundCue = { id: uid('sfx'), sfx, time: time ?? state.playhead, gain: 0.8 };
      return {
        project: { ...state.project, cues: [...state.project.cues, cue] },
        selection: { kind: 'cue', id: cue.id },
      };
    }),

  updateCue: (id, patch) =>
    mutate('son-reglage', (state) => ({
      project: { ...state.project, cues: state.project.cues.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
    })),

  removeCue: (id) =>
    mutate('retrait-son', (state) => ({
      project: { ...state.project, cues: state.project.cues.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'cue' && state.selection.id === id ? null : state.selection,
    })),

  setMix: (patch) =>
    mutate('mixage', (state) => ({
      project: { ...state.project, mix: { ...state.project.mix, ...patch } },
    })),

  addSamples: (cues) =>
    mutate('ajout-bruitage', (state) => ({
      project: { ...state.project, samples: [...state.project.samples, ...cues] },
    })),

  updateSample: (id, patch) =>
    mutate('bruitage-reglage', (state) => ({
      project: {
        ...state.project,
        samples: state.project.samples.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removeSample: (id) =>
    mutate('retrait-bruitage', (state) => {
      const cue = state.project.samples.find((c) => c.id === id);
      if (cue) URL.revokeObjectURL(cue.url);
      return { project: { ...state.project, samples: state.project.samples.filter((c) => c.id !== id) } };
    }),

  addVoices: (cues) =>
    mutate('ajout-voix', (state) => ({
      project: { ...state.project, voices: [...state.project.voices, ...cues] },
    })),

  updateVoice: (id, patch) =>
    mutate('voix-reglage', (state) => ({
      project: {
        ...state.project,
        voices: state.project.voices.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      },
    })),

  /**
   * Retire une réplique, et avec elle les sous-titres qu'elle avait produits.
   *
   * Les garder laisserait à l'écran un texte que plus rien ne prononce, et il
   * faudrait les retrouver un par un pour les effacer. Le geste reste annulable,
   * ce qui suffit à couvrir le regret.
   */
  removeVoice: (id) =>
    mutate('retrait-voix', (state) => {
      const cue = state.project.voices.find((v) => v.id === id);
      if (cue) URL.revokeObjectURL(cue.url);
      return {
        project: {
          ...state.project,
          voices: state.project.voices.filter((v) => v.id !== id),
          captions: state.project.captions.filter((c) => c.voiceId !== id),
        },
      };
    }),

  alignVoice: (id) =>
    mutate('calage-voix', (state) => {
      const cue = state.project.voices.find((v) => v.id === id);
      if (!cue) return state;

      /*
       * Un sous-titre posé après la dernière image n'existe pas.
       *
       * Une réplique placée trop tard produisait des sous-titres au-delà de la
       * fin du montage — vu à 13,9 s sur une vidéo de 13,6 s. Ils ne
       * s'affichaient jamais, ne comptaient dans aucune couverture, et rien à
       * l'écran ne disait pourquoi le calage semblait n'avoir rien fait.
       *
       * Ceux qui débordent sont ramenés à la fin, ceux qui commencent après
       * sont écartés : mieux vaut perdre une phrase que d'en garder une
       * invisible.
       */
      const limit = totalDuration(state.project.clips);

      const produced = captionsFromVoice(cue.script, cue.segments, () => uid('cap'), {
        offset: cue.start,
      })
        .filter((caption) => limit <= 0 || caption.start < limit)
        .map((caption) => ({
          ...caption,
          end: limit > 0 ? Math.min(caption.end, limit) : caption.end,
          voiceId: id,
        }))
        .filter((caption) => caption.end > caption.start);

      return {
        project: {
          ...state.project,
          // Les sous-titres de cette réplique sont remplacés, jamais complétés.
          captions: [...state.project.captions.filter((c) => c.voiceId !== id), ...produced],
        },
      };
    }),

  setMusic: (music) =>
    mutate('musique', (state) => {
      if (state.project.music) URL.revokeObjectURL(state.project.music.url);
      return { project: { ...state.project, music } };
    }),

  updateMusic: (patch) =>
    mutate('musique-reglage', (state) => ({
      project: { ...state.project, music: state.project.music ? { ...state.project.music, ...patch } : null },
    })),

  select: (selection) => set({ selection }),
  setPlayhead: (time) => set((state) => ({ playhead: clamp(time, 0, totalDuration(state.project.clips)) })),
  setPlaying: (playing) => set({ playing }),
  renameProject: (name) => mutate('nom', (state) => ({ project: { ...state.project, name } })),
  duration: () => totalDuration(get().project.clips),
  };
});
