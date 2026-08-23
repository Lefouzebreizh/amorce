import { useCallback, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { computeSegments, totalDuration, useStore } from '../state/store'
import { getTransition } from '../data/transitions'
import { getSfx } from '../data/sfx'
import { playSfx } from '../lib/sfxSynth'
import { formatTime } from '../lib/format'
import { Waveform } from './Waveform'
import { IconClose, IconSplit, IconTrash, IconZoomIn, IconZoomOut } from './Icons'

const TRACK_HEIGHT = 68
const PADDING_RIGHT = 120

/** Pas de graduation lisible selon le zoom courant (px par seconde). */
function tickStep(zoom: number): number {
  if (zoom > 220) return 0.25
  if (zoom > 120) return 0.5
  if (zoom > 60) return 1
  if (zoom > 30) return 2
  return 5
}

export function Timeline() {
  const { t, bi } = useI18n()
  const clips = useStore((s) => s.clips)
  const assets = useStore((s) => s.assets)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const playhead = useStore((s) => s.playhead)
  const setPlayhead = useStore((s) => s.setPlayhead)
  const selectedClipId = useStore((s) => s.selectedClipId)
  const selectClip = useStore((s) => s.selectClip)
  const selectedCutIndex = useStore((s) => s.selectedCutIndex)
  const selectCut = useStore((s) => s.selectCut)
  const splitAtPlayhead = useStore((s) => s.splitAtPlayhead)
  const removeClip = useStore((s) => s.removeClip)
  const reorderClip = useStore((s) => s.reorderClip)
  const setTransition = useStore((s) => s.setTransition)
  const sfxPlacements = useStore((s) => s.sfxPlacements)
  const removeSfx = useStore((s) => s.removeSfx)
  const moveSfx = useStore((s) => s.moveSfx)
  const sfxLevel = useStore((s) => s.sfxLevel)
  const showToast = useStore((s) => s.showToast)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const segments = useMemo(() => computeSegments(clips), [clips])
  const duration = useMemo(() => totalDuration(clips), [clips])
  const innerWidth = duration * zoom + PADDING_RIGHT

  /** Convertit une position de pointeur en instant de la timeline. */
  const timeFromEvent = useCallback(
    (clientX: number) => {
      const el = scrollRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left + el.scrollLeft
      return Math.max(0, Math.min(duration, x / zoom))
    },
    [duration, zoom],
  )

  const startScrub = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    setPlayhead(timeFromEvent(event.clientX))
    const onMove = (moveEvent: PointerEvent) => setPlayhead(timeFromEvent(moveEvent.clientX))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const ticks = useMemo(() => {
    const step = tickStep(zoom)
    const out: number[] = []
    for (let time = 0; time <= duration + step; time += step) out.push(Number(time.toFixed(3)))
    return out
  }, [duration, zoom])

  const onSplit = () => {
    if (!splitAtPlayhead()) showToast({ text: t('timeline.splitHint'), tone: 'info' })
  }

  const dragSfx = (id: string) => (event: React.PointerEvent) => {
    event.stopPropagation()
    const onMove = (moveEvent: PointerEvent) => moveSfx(id, timeFromEvent(moveEvent.clientX))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <section className="timeline" aria-label={t('timeline.title')}>
      <header className="timeline__bar">
        <h2 className="timeline__title">{t('timeline.title')}</h2>

        <div className="timeline__tools">
          <button type="button" className="btn btn--ghost btn--tiny" onClick={onSplit} disabled={clips.length === 0}>
            <IconSplit size={15} />
            {t('timeline.split')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            onClick={() => selectedClipId && removeClip(selectedClipId)}
            disabled={!selectedClipId}
          >
            <IconTrash size={15} />
            {t('timeline.delete')}
          </button>
          <span className="timeline__sep" />
          <button type="button" className="btn btn--ghost btn--tiny" onClick={() => setZoom(zoom / 1.4)} title={t('timeline.zoomOut')}>
            <IconZoomOut size={15} />
          </button>
          <button type="button" className="btn btn--ghost btn--tiny" onClick={() => setZoom(zoom * 1.4)} title={t('timeline.zoomIn')}>
            <IconZoomIn size={15} />
          </button>
        </div>

        <span className="timeline__duration mono">
          {t('timeline.duration')} · {formatTime(duration, 1)}
        </span>
      </header>

      <div className="timeline__scroll" ref={scrollRef} onPointerDown={startScrub}>
        <div className="timeline__inner" style={{ width: innerWidth }}>
          <div className="ruler">
            {ticks.map((time) => (
              <span key={time} className="ruler__tick" style={{ left: time * zoom }}>
                <span className="ruler__label mono">{formatTime(time, zoom > 120 ? 1 : 0)}</span>
              </span>
            ))}
          </div>

          <div className="track track--video" style={{ height: TRACK_HEIGHT }}>
            {clips.length === 0 ? <p className="track__empty">{t('timeline.empty')}</p> : null}

            {segments.map((segment) => {
              const asset = assets[segment.clip.assetId]
              const width = Math.max(6, segment.duration * zoom)
              const selected = segment.clip.id === selectedClipId
              return (
                <div
                  key={segment.clip.id}
                  className={`clip${selected ? ' is-selected' : ''}${dragIndex === segment.index ? ' is-dragging' : ''}`}
                  style={{ left: segment.start * zoom, width }}
                  draggable
                  onDragStart={() => setDragIndex(segment.index)}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragIndex !== null) reorderClip(dragIndex, segment.index)
                    setDragIndex(null)
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    selectClip(segment.clip.id)
                    setPlayhead(timeFromEvent(event.clientX))
                  }}
                  title={asset?.name}
                >
                  <span className="clip__name">{asset?.name ?? '—'}</span>
                  {asset && asset.peaks.length > 0 ? (
                    <Waveform
                      peaks={asset.peaks}
                      duration={asset.duration}
                      from={segment.clip.in}
                      to={segment.clip.out}
                      width={width - 4}
                      height={30}
                      color={selected ? 'rgba(61,235,216,0.9)' : 'rgba(139,146,166,0.75)'}
                    />
                  ) : null}
                  <span className="clip__duration mono">{formatTime(segment.duration, 1)}</span>
                </div>
              )
            })}

            {segments.slice(1).map((segment) => {
              const definition = getTransition(segment.clip.transitionId)
              const selected = selectedCutIndex === segment.index
              return (
                <button
                  key={`cut-${segment.clip.id}`}
                  type="button"
                  className={`cut${selected ? ' is-selected' : ''}${definition ? ' has-transition' : ''}`}
                  style={{ left: segment.start * zoom }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => selectCut(selected ? null : segment.index)}
                  title={definition ? bi(definition.name) : t('timeline.noTransition')}
                >
                  <span className="cut__head">
                    <span className="cut__label mono">{definition ? bi(definition.name) : t('timeline.cut')}</span>
                    {definition ? (
                      <span
                        className="cut__remove"
                        role="button"
                        tabIndex={0}
                        aria-label={t('timeline.removeTransition')}
                        onClick={(event) => {
                          event.stopPropagation()
                          setTransition(segment.index, null)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.stopPropagation()
                            setTransition(segment.index, null)
                          }
                        }}
                      >
                        <IconClose size={10} />
                      </span>
                    ) : null}
                  </span>
                  <span className="cut__mark" />
                </button>
              )
            })}
          </div>

          <div className="track track--sfx">
            <span className="track__tag mono">{t('timeline.sfxTrack')}</span>
            {sfxPlacements.map((placement) => {
              const def = getSfx(placement.sfxId)
              if (!def) return null
              return (
                <div
                  key={placement.id}
                  className="sfxpin"
                  style={{ left: placement.at * zoom, width: Math.max(92, def.duration * zoom) }}
                  onPointerDown={dragSfx(placement.id)}
                  onDoubleClick={() => playSfx(def, sfxLevel * placement.gain)}
                  title={bi(def.name)}
                >
                  <span className="sfxpin__name">{bi(def.name)}</span>
                  <button
                    type="button"
                    className="sfxpin__remove"
                    aria-label={t('timeline.delete')}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => removeSfx(placement.id)}
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="playhead" style={{ transform: `translateX(${playhead * zoom}px)` }}>
            <span className="playhead__head" />
          </div>
        </div>
      </div>

      <p className="timeline__hint">{t('timeline.reorderHint')}</p>
    </section>
  )
}
