import { useEffect, useRef } from 'react'

interface Props {
  /** Crêtes normalisées du média complet. */
  peaks: number[]
  duration: number
  from: number
  to: number
  width: number
  height: number
  color: string
}

/** Forme d'onde d'un clip, dessinée sur canvas (cahier §3.3). */
export function Waveform({ peaks, duration, from, to, width, height, color }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    if (peaks.length === 0 || duration <= 0 || width < 2) return

    const start = Math.floor((from / duration) * peaks.length)
    const end = Math.max(start + 1, Math.ceil((to / duration) * peaks.length))
    const span = end - start
    const mid = height / 2
    const barWidth = 2
    const gap = 1
    const bars = Math.max(1, Math.floor(width / (barWidth + gap)))

    ctx.fillStyle = color
    for (let i = 0; i < bars; i++) {
      const index = start + Math.floor((i / bars) * span)
      const value = peaks[Math.min(peaks.length - 1, Math.max(0, index))] ?? 0
      const barHeight = Math.max(1.5, value * (height - 6))
      ctx.fillRect(i * (barWidth + gap), mid - barHeight / 2, barWidth, barHeight)
    }
  }, [peaks, duration, from, to, width, height, color])

  return <canvas ref={ref} className="waveform" style={{ width, height }} aria-hidden />
}
