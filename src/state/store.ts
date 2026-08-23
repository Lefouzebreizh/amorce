import { create } from 'zustand'
import type { Clip, HookScore, MediaAsset, SfxPlacement } from '../types'
import { uid } from '../lib/id'
import { getTransition } from '../data/transitions'
import { getSfx } from '../data/sfx'
import { clamp } from '../lib/format'
import * as storage from '../lib/storage'

/** Durée plancher d'un clip : en dessous, la découpe n'a plus de sens. */
export const MIN_CLIP_DURATION = 0.25

export interface Segment {
  clip: Clip
  index: number
  /** Position du clip sur la timeline, en secondes. */
  start: number
  end: number
  duration: number
  /** Durée de la transition entrante réellement appliquée. */
  transitionDuration: number
}

export interface Toast {
  text: string
  tone: 'info' | 'error' | 'success'
}

type Panel = 'library' | 'hooks' | 'audio' | 'export'

interface PersistedProject {
  clips: Clip[]
  sfxPlacements: SfxPlacement[]
  musicAssetId: string | null
  voiceLevel: number
  musicLevel: number
  sfxLevel: number
}

interface State extends PersistedProject {
  assets: Record<string, MediaAsset>
  hydrated: boolean

  // Interface
  panel: Panel
  libraryTab: 'transitions' | 'sfx'
  selectedClipId: string | null
  /** Index du clip dont la transition entrante est sélectionnée (coupe). */
  selectedCutIndex: number | null
  playhead: number
  playing: boolean
  zoom: number
  toast: Toast | null

  // Score d'accroche
  hookScore: HookScore | null
  hookLoading: boolean
}

interface Actions {
  hydrate: () => Promise<void>
  addAsset: (asset: MediaAsset) => Promise<void>
  addClipFromAsset: (asset: MediaAsset) => void
  removeClip: (clipId: string) => void
  splitAtPlayhead: () => boolean
  reorderClip: (from: number, to: number) => void
  setTransition: (clipIndex: number, transitionId: string | null) => void
  setTransitionDuration: (clipIndex: number, duration: number) => void
  addSfxAt: (sfxId: string, at: number) => void
  removeSfx: (id: string) => void
  moveSfx: (id: string, at: number) => void
  setMusic: (asset: MediaAsset | null) => Promise<void>
  setLevel: (which: 'voiceLevel' | 'musicLevel' | 'sfxLevel', value: number) => void
  applyPacing: (cuts: number[], transitionId: string) => 'ok' | 'no-clip' | 'too-short'

  setPanel: (panel: Panel) => void
  setLibraryTab: (tab: 'transitions' | 'sfx') => void
  selectClip: (clipId: string | null) => void
  selectCut: (index: number | null) => void
  setPlayhead: (t: number) => void
  setPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  showToast: (toast: Toast | null) => void
  setHookScore: (score: HookScore | null) => void
  setHookLoading: (loading: boolean) => void
  reset: () => Promise<void>
}

export type Store = State & Actions

const initialProject: PersistedProject = {
  clips: [],
  sfxPlacements: [],
  musicAssetId: null,
  voiceLevel: 1,
  musicLevel: 0.35,
  sfxLevel: 0.8,
}

/** Positions des clips en tenant compte du recouvrement des transitions. */
export function computeSegments(clips: Clip[]): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  clips.forEach((clip, index) => {
    const duration = Math.max(0, clip.out - clip.in)
    let overlap = 0
    if (index > 0 && clip.transitionId) {
      const previous = segments[index - 1]
      // Une transition ne peut pas dépasser la moitié des clips qu'elle relie.
      overlap = Math.min(clip.transitionDuration, duration / 2, previous.duration / 2)
    }
    const start = index === 0 ? 0 : cursor - overlap
    segments.push({ clip, index, start, end: start + duration, duration, transitionDuration: overlap })
    cursor = start + duration
  })
  return segments
}

export function totalDuration(clips: Clip[]): number {
  const segments = computeSegments(clips)
  return segments.length ? segments[segments.length - 1].end : 0
}

let saveTimer: number | undefined

function persist(state: State) {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void storage.saveProject<PersistedProject>({
      clips: state.clips,
      sfxPlacements: state.sfxPlacements,
      musicAssetId: state.musicAssetId,
      voiceLevel: state.voiceLevel,
      musicLevel: state.musicLevel,
      sfxLevel: state.sfxLevel,
    })
  }, 400)
}

export const useStore = create<Store>((set, get) => {
  /** Applique une mise à jour du projet et la sauvegarde en local. */
  const setProject = (partial: Partial<State>) => {
    set(partial)
    persist(get())
  }

  return {
    ...initialProject,
    assets: {},
    hydrated: false,
    panel: 'library',
    libraryTab: 'transitions',
    selectedClipId: null,
    selectedCutIndex: null,
    playhead: 0,
    playing: false,
    zoom: 90,
    toast: null,
    hookScore: null,
    hookLoading: false,

    async hydrate() {
      const [assets, project] = await Promise.all([
        storage.loadAssets(),
        storage.loadProject<PersistedProject>(),
      ])
      const byId: Record<string, MediaAsset> = {}
      for (const asset of assets) byId[asset.id] = asset

      // Un clip dont le média a disparu n'est plus jouable : on l'écarte.
      const clips = (project?.clips ?? []).filter((clip) => byId[clip.assetId])

      set({
        assets: byId,
        hydrated: true,
        clips,
        sfxPlacements: project?.sfxPlacements ?? [],
        musicAssetId: project?.musicAssetId && byId[project.musicAssetId] ? project.musicAssetId : null,
        voiceLevel: project?.voiceLevel ?? initialProject.voiceLevel,
        musicLevel: project?.musicLevel ?? initialProject.musicLevel,
        sfxLevel: project?.sfxLevel ?? initialProject.sfxLevel,
        selectedClipId: clips[0]?.id ?? null,
      })
    },

    async addAsset(asset) {
      set((state) => ({ assets: { ...state.assets, [asset.id]: asset } }))
      await storage.saveAsset(asset)
    },

    addClipFromAsset(asset) {
      const clip: Clip = {
        id: uid('clip'),
        assetId: asset.id,
        in: 0,
        out: asset.duration,
        transitionId: null,
        transitionDuration: 0,
      }
      setProject({ clips: [...get().clips, clip], selectedClipId: clip.id })
    },

    removeClip(clipId) {
      const clips = get().clips.filter((c) => c.id !== clipId)
      // Le premier clip n'a pas de transition entrante.
      if (clips[0]) clips[0] = { ...clips[0], transitionId: null, transitionDuration: 0 }
      setProject({
        clips,
        selectedClipId: clips[0]?.id ?? null,
        selectedCutIndex: null,
        playhead: Math.min(get().playhead, totalDuration(clips)),
      })
    },

    splitAtPlayhead() {
      const { clips, playhead } = get()
      const segments = computeSegments(clips)
      const segment = segments.find((s) => playhead > s.start + MIN_CLIP_DURATION && playhead < s.end - MIN_CLIP_DURATION)
      if (!segment) return false

      const localTime = segment.clip.in + (playhead - segment.start)
      const left: Clip = { ...segment.clip, out: localTime }
      const right: Clip = {
        ...segment.clip,
        id: uid('clip'),
        in: localTime,
        transitionId: null,
        transitionDuration: 0,
      }
      const next = [...clips]
      next.splice(segment.index, 1, left, right)
      setProject({ clips: next, selectedClipId: right.id })
      return true
    },

    reorderClip(from, to) {
      const clips = [...get().clips]
      if (from === to || from < 0 || to < 0 || from >= clips.length || to >= clips.length) return
      const [moved] = clips.splice(from, 1)
      clips.splice(to, 0, moved)
      if (clips[0]) clips[0] = { ...clips[0], transitionId: null, transitionDuration: 0 }
      setProject({ clips, selectedCutIndex: null })
    },

    setTransition(clipIndex, transitionId) {
      if (clipIndex <= 0) return
      const definition = getTransition(transitionId)
      const clips = get().clips.map((clip, index) =>
        index === clipIndex
          ? {
              ...clip,
              transitionId: definition ? definition.id : null,
              transitionDuration: definition ? definition.duration : 0,
            }
          : clip,
      )
      setProject({ clips })
    },

    setTransitionDuration(clipIndex, duration) {
      const clips = get().clips.map((clip, index) =>
        index === clipIndex ? { ...clip, transitionDuration: clamp(duration, 0.1, 2) } : clip,
      )
      setProject({ clips })
    },

    addSfxAt(sfxId, at) {
      if (!getSfx(sfxId)) return
      const placement: SfxPlacement = { id: uid('sfx'), sfxId, at: Math.max(0, at), gain: 1 }
      setProject({ sfxPlacements: [...get().sfxPlacements, placement] })
    },

    removeSfx(id) {
      setProject({ sfxPlacements: get().sfxPlacements.filter((p) => p.id !== id) })
    },

    moveSfx(id, at) {
      setProject({
        sfxPlacements: get().sfxPlacements.map((p) => (p.id === id ? { ...p, at: Math.max(0, at) } : p)),
      })
    },

    async setMusic(asset) {
      const previous = get().musicAssetId
      if (asset) {
        set((state) => ({ assets: { ...state.assets, [asset.id]: asset } }))
        await storage.saveAsset(asset)
      }
      if (previous && previous !== asset?.id) {
        await storage.deleteAsset(previous)
        set((state) => {
          const assets = { ...state.assets }
          delete assets[previous]
          return { assets }
        })
      }
      setProject({ musicAssetId: asset?.id ?? null })
    },

    setLevel(which, value) {
      setProject({ [which]: clamp(value, 0, 1.5) } as Partial<State>)
    },

    applyPacing(cuts, transitionId) {
      const { clips } = get()
      const first = clips[0]
      if (!first) return 'no-clip'

      const available = first.out - first.in
      const usable = cuts.filter((c) => c > MIN_CLIP_DURATION && c < available - MIN_CLIP_DURATION)
      if (usable.length === 0) return 'too-short'

      // On redécoupe le début du premier clip selon les points conseillés.
      const definition = getTransition(transitionId)
      const pieces: Clip[] = []
      let cursor = first.in
      for (const cut of usable) {
        const at = first.in + cut
        pieces.push({
          id: uid('clip'),
          assetId: first.assetId,
          in: cursor,
          out: at,
          transitionId: pieces.length === 0 ? first.transitionId : (definition?.id ?? null),
          transitionDuration: pieces.length === 0 ? first.transitionDuration : (definition?.duration ?? 0),
        })
        cursor = at
      }
      pieces.push({
        id: uid('clip'),
        assetId: first.assetId,
        in: cursor,
        out: first.out,
        transitionId: definition?.id ?? null,
        transitionDuration: definition?.duration ?? 0,
      })

      const next = [...pieces, ...clips.slice(1)]
      if (next[0]) next[0] = { ...next[0], transitionId: null, transitionDuration: 0 }
      setProject({ clips: next, selectedClipId: next[0]?.id ?? null, playhead: 0 })
      return 'ok'
    },

    setPanel: (panel) => set({ panel }),
    setLibraryTab: (libraryTab) => set({ libraryTab }),
    selectClip: (selectedClipId) => set({ selectedClipId }),
    selectCut: (selectedCutIndex) => set({ selectedCutIndex }),
    setPlayhead: (playhead) => set({ playhead: Math.max(0, playhead) }),
    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom: clamp(zoom, 24, 400) }),
    showToast: (toast) => set({ toast }),
    setHookScore: (hookScore) => set({ hookScore }),
    setHookLoading: (hookLoading) => set({ hookLoading }),

    async reset() {
      await storage.clearAll()
      set({
        ...initialProject,
        assets: {},
        selectedClipId: null,
        selectedCutIndex: null,
        playhead: 0,
        playing: false,
        hookScore: null,
      })
    },
  }
})

/** Sélecteurs dérivés, mémoïsés côté composant. */
export const selectSegments = (state: Store) => computeSegments(state.clips)
