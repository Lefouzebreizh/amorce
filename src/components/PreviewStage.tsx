import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { computeSegments, totalDuration, useStore } from '../state/store'
import { useAssetUrls } from '../hooks/useAssetUrls'
import { transitionFrame } from '../lib/transitionStyles'
import { getTransition } from '../data/transitions'
import { getSfx } from '../data/sfx'
import { playSfx } from '../lib/sfxSynth'
import { formatTime } from '../lib/format'
import { Dropzone } from './Dropzone'
import { IconMute, IconPause, IconPlay, IconSound } from './Icons'
import type { CSSProperties } from 'react'

interface SlotState {
  clipIndex: number | null
  style: CSSProperties
  z: number
}

const EMPTY_SLOTS: [SlotState, SlotState] = [
  { clipIndex: null, style: {}, z: 1 },
  { clipIndex: null, style: {}, z: 0 },
]

/** Aperçu 9:16 : lecture, pause, transitions et déclenchement des bruitages. */
export function PreviewStage() {
  const { t } = useI18n()
  const clips = useStore((s) => s.clips)
  const assets = useStore((s) => s.assets)
  const playhead = useStore((s) => s.playhead)
  const playing = useStore((s) => s.playing)
  const setPlayhead = useStore((s) => s.setPlayhead)
  const setPlaying = useStore((s) => s.setPlaying)
  const voiceLevel = useStore((s) => s.voiceLevel)
  const musicLevel = useStore((s) => s.musicLevel)
  const sfxLevel = useStore((s) => s.sfxLevel)
  const sfxPlacements = useStore((s) => s.sfxPlacements)
  const musicAsset = useStore((s) => (s.musicAssetId ? s.assets[s.musicAssetId] : null))

  const urls = useAssetUrls(assets)
  const segments = useMemo(() => computeSegments(clips), [clips])
  const duration = useMemo(() => totalDuration(clips), [clips])

  const [muted, setMuted] = useState(false)
  const [slots, setSlots] = useState<[SlotState, SlotState]>(EMPTY_SLOTS)

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null])
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef(0)
  const lastTickRef = useRef(0)
  const lastPlayheadRef = useRef(0)

  /** Positionne un élément vidéo sur le clip et l'instant voulus. */
  const syncVideo = useCallback(
    (slot: number, clipIndex: number, time: number, shouldPlay: boolean) => {
      const el = videoRefs.current[slot]
      const segment = segments[clipIndex]
      if (!el || !segment) return
      const url = urls[segment.clip.assetId]
      if (!url) return

      if (el.dataset.url !== url) {
        el.dataset.url = url
        el.src = url
      }
      const target = segment.clip.in + (time - segment.start)
      if (Number.isFinite(target) && Math.abs(el.currentTime - target) > 0.18) {
        try {
          el.currentTime = Math.max(0, target)
        } catch {
          /* seek impossible tant que les métadonnées ne sont pas prêtes */
        }
      }
      el.volume = muted ? 0 : Math.min(1, voiceLevel)
      if (shouldPlay && el.paused) void el.play().catch(() => undefined)
      if (!shouldPlay && !el.paused) el.pause()
    },
    [segments, urls, muted, voiceLevel],
  )

  /** Recalcule quel(s) clip(s) sont visibles et avec quel état de transition. */
  const renderAt = useCallback(
    (time: number, isPlaying: boolean) => {
      if (segments.length === 0) {
        setSlots(EMPTY_SLOTS)
        return
      }

      let index = 0
      for (let i = 0; i < segments.length; i++) {
        if (time >= segments[i].start - 1e-6) index = i
      }
      const current = segments[index]
      const overlap = current.transitionDuration
      const inTransition = index > 0 && overlap > 0 && time < current.start + overlap
      const definition = getTransition(current.clip.transitionId)

      const currentSlot = index % 2
      const otherSlot = currentSlot === 0 ? 1 : 0

      const next: [SlotState, SlotState] = [...EMPTY_SLOTS] as [SlotState, SlotState]

      if (inTransition && definition) {
        const p = Math.max(0, Math.min(1, (time - current.start) / overlap))
        const frame = transitionFrame(definition.preview, p)
        next[currentSlot] = { clipIndex: index, style: frame.incoming, z: 2 }
        next[otherSlot] = { clipIndex: index - 1, style: frame.outgoing, z: 1 }
        syncVideo(currentSlot, index, time, isPlaying)
        syncVideo(otherSlot, index - 1, time, isPlaying)
      } else {
        next[currentSlot] = { clipIndex: index, style: { opacity: 1 }, z: 2 }
        next[otherSlot] = { clipIndex: null, style: { opacity: 0 }, z: 1 }
        syncVideo(currentSlot, index, time, isPlaying)
        const other = videoRefs.current[otherSlot]
        if (other && !other.paused) other.pause()
      }

      setSlots(next)
    },
    [segments, syncVideo],
  )

  // Boucle de lecture : la timeline fait référence, les vidéos se recalent.
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      videoRefs.current.forEach((el) => el?.pause())
      musicRef.current?.pause()
      return
    }

    lastTickRef.current = performance.now()
    lastPlayheadRef.current = useStore.getState().playhead

    const tick = (now: number) => {
      const delta = (now - lastTickRef.current) / 1000
      lastTickRef.current = now
      const previous = useStore.getState().playhead
      const next = previous + delta

      if (next >= duration) {
        setPlayhead(duration)
        setPlaying(false)
        return
      }

      // Déclenchement des bruitages franchis pendant cette image.
      for (const placement of sfxPlacements) {
        if (placement.at > previous && placement.at <= next) {
          const def = getSfx(placement.sfxId)
          if (def) playSfx(def, muted ? 0 : sfxLevel * placement.gain)
        }
      }

      setPlayhead(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, duration, setPlayhead, setPlaying, sfxPlacements, sfxLevel, muted])

  // Rendu visuel à chaque changement de position.
  useEffect(() => {
    renderAt(playhead, playing)
  }, [playhead, playing, renderAt])

  // Musique de fond calée sur la tête de lecture.
  useEffect(() => {
    const el = musicRef.current
    if (!el) return
    el.volume = muted ? 0 : Math.min(1, musicLevel)
    if (playing) {
      if (Math.abs(el.currentTime - playhead) > 0.3) el.currentTime = Math.min(playhead, el.duration || playhead)
      if (el.paused) void el.play().catch(() => undefined)
    } else if (!el.paused) {
      el.pause()
    }
  }, [playing, playhead, musicLevel, muted])

  const toggle = () => {
    if (clips.length === 0) return
    if (!playing && playhead >= duration - 0.05) setPlayhead(0)
    setPlaying(!playing)
  }

  // Barre d'espace : lecture / pause, sauf pendant la saisie d'un champ.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.code === 'Space') {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const musicUrl = musicAsset ? urls[musicAsset.id] : null

  return (
    <section className="stage" aria-label={t('preview.title')}>
      <div className="stage__frame">
        {clips.length === 0 ? (
          <Dropzone />
        ) : (
          <div className="stage__viewport">
            {[0, 1].map((slot) => (
              <video
                key={slot}
                ref={(el) => {
                  videoRefs.current[slot] = el
                }}
                className="stage__video"
                style={{ ...slots[slot].style, zIndex: slots[slot].z, visibility: slots[slot].clipIndex === null ? 'hidden' : 'visible' }}
                playsInline
                preload="auto"
              />
            ))}
          </div>
        )}
      </div>

      {musicUrl ? <audio ref={musicRef} src={musicUrl} preload="auto" hidden /> : null}

      <div className="stage__controls">
        <button type="button" className="stage__play" onClick={toggle} disabled={clips.length === 0} aria-label={playing ? t('preview.pause') : t('preview.play')}>
          {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        <span className="stage__time mono">
          {formatTime(playhead, 1)} / {formatTime(duration, 1)}
        </span>
        <button
          type="button"
          className="stage__mute"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t('preview.unmuted') : t('preview.muted')}
        >
          {muted ? <IconMute size={16} /> : <IconSound size={16} />}
        </button>
      </div>

      {clips.length > 0 ? (
        <div className="stage__add">
          <Dropzone variant="compact" />
        </div>
      ) : null}
    </section>
  )
}
