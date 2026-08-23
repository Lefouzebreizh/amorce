import { useEffect, useRef, useState } from 'react'
import { transitionFrame } from '../lib/transitionStyles'

interface Props {
  preview: string
  /** Lance la boucle d'animation (prévisualisation avant application). */
  active: boolean
  duration: number
}

/**
 * Vignette de prévisualisation d'une transition : deux plans stylisés animés
 * selon la même description que l'aperçu 9:16 et le rendu ffmpeg.
 */
export function TransitionThumb({ preview, active, duration }: Props) {
  const [progress, setProgress] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (!active) {
      setProgress(0)
      return
    }
    // Boucle : montée sur la durée de l'effet, puis pause avant reprise.
    const cycle = duration * 1000 + 600
    const startedAt = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - startedAt) % cycle
      setProgress(Math.min(1, elapsed / (duration * 1000)))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [active, duration])

  const frame = transitionFrame(preview, progress)

  return (
    <div className="thumb" aria-hidden>
      <div className="thumb__plane thumb__plane--a" style={frame.outgoing} />
      <div className="thumb__plane thumb__plane--b" style={frame.incoming} />
      {frame.overlay ? <div className="thumb__overlay" style={frame.overlay} /> : null}
    </div>
  )
}
