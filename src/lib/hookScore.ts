import type { Bilingual, HookAdvice, HookScore, HookSignals } from '../types'
import { decodeAudio } from './audioContext'

/** Fenêtre analysée : les 2 premières secondes (cahier §3.4). */
export const HOOK_WINDOW = 2
const FPS = 12
const FRAME_W = 108
const FRAME_H = 192

/**
 * Pondération des signaux. Le rythme de coupe et l'attaque sonore dominent :
 * ce sont les deux marqueurs que les formats courts récompensent le plus
 * nettement dans les 2 premières secondes.
 */
const WEIGHTS: Record<keyof HookSignals, number> = {
  cutRhythm: 0.26,
  audioOnset: 0.2,
  motion: 0.2,
  contrast: 0.14,
  timeToAction: 0.12,
  saturation: 0.08,
}

export interface HookAnalysisInput {
  blob: Blob
  /** Début de la fenêtre dans le média source. */
  startOffset: number
  /** Coupes déjà présentes sur la timeline dans la fenêtre analysée. */
  timelineCuts: number
}

interface FrameStats {
  luma: number
  contrast: number
  saturation: number
}

function waitEvent(el: HTMLMediaElement, event: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(`timeout:${event}`))
    }, timeoutMs)
    const onDone = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('media-error'))
    }
    function cleanup() {
      window.clearTimeout(timer)
      el.removeEventListener(event, onDone)
      el.removeEventListener('error', onError)
    }
    el.addEventListener(event, onDone, { once: true })
    el.addEventListener('error', onError, { once: true })
  })
}

function analyzeFrame(data: Uint8ClampedArray): FrameStats {
  let sum = 0
  let sumSq = 0
  let sat = 0
  const pixels = data.length / 4
  const luma = new Float32Array(pixels)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    luma[p] = y
    sum += y
    sumSq += y * y
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    sat += max === 0 ? 0 : (max - min) / max
  }

  const mean = sum / pixels
  const variance = Math.max(0, sumSq / pixels - mean * mean)
  return { luma: mean, contrast: Math.sqrt(variance), saturation: sat / pixels }
}

function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let diff = 0
  const pixels = a.length / 4
  for (let i = 0; i < a.length; i += 4) {
    const ya = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
    const yb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]
    diff += Math.abs(ya - yb)
  }
  return diff / pixels / 255
}

interface VisualResult {
  motion: number
  contrast: number
  saturation: number
  detectedCuts: number
  timeToAction: number
}

async function analyzeVisual(blob: Blob, startOffset: number): Promise<VisualResult> {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W
  canvas.height = FRAME_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas-2d-indisponible')

  try {
    await waitEvent(video, 'loadeddata')

    const steps = Math.round(HOOK_WINDOW * FPS)
    const frames: FrameStats[] = []
    const diffs: number[] = []
    let previous: Uint8ClampedArray | null = null

    for (let i = 0; i < steps; i++) {
      const t = startOffset + (i / FPS)
      if (t >= video.duration) break
      video.currentTime = t
      try {
        await waitEvent(video, 'seeked', 4000)
      } catch {
        break
      }
      ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H)
      const { data } = ctx.getImageData(0, 0, FRAME_W, FRAME_H)
      frames.push(analyzeFrame(data))
      if (previous) diffs.push(meanAbsDiff(previous, data))
      previous = new Uint8ClampedArray(data)
    }

    if (frames.length === 0) throw new Error('aucune-frame')

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const motion = avg(diffs)
    const contrast = avg(frames.map((f) => f.contrast))
    const saturation = avg(frames.map((f) => f.saturation))

    // Un saut brutal de luminance signe un changement de plan.
    const detectedCuts = diffs.filter((d) => d > 0.22).length

    // Instant où l'image « décolle » vraiment par rapport au repos initial.
    const threshold = Math.max(0.035, motion * 1.3)
    const firstActive = diffs.findIndex((d) => d > threshold)
    const timeToAction = firstActive === -1 ? HOOK_WINDOW : (firstActive + 1) / FPS

    return { motion, contrast, saturation, detectedCuts, timeToAction }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

interface AudioResult {
  onset: number
}

async function analyzeAudio(blob: Blob, startOffset: number): Promise<AudioResult | null> {
  const buffer = await decodeAudio(await blob.arrayBuffer())
  if (!buffer) return null

  const rate = buffer.sampleRate
  const channel = buffer.getChannelData(0)
  const windowSize = Math.floor(rate * 0.02)
  const rmsAt = (from: number, to: number) => {
    const start = Math.max(0, Math.floor(from * rate))
    const end = Math.min(channel.length, Math.floor(to * rate))
    if (end <= start) return 0
    let sum = 0
    const step = Math.max(1, Math.floor((end - start) / 4000))
    let count = 0
    for (let i = start; i < end; i += step) {
      sum += channel[i] * channel[i]
      count++
    }
    return count ? Math.sqrt(sum / count) : 0
  }

  const overall = rmsAt(0, buffer.duration)
  if (overall < 1e-5) return { onset: 0 }

  // Enveloppe de la fenêtre d'accroche, par tranches de 20 ms.
  const slices: number[] = []
  for (let t = startOffset; t < startOffset + HOOK_WINDOW; t += 0.02) {
    slices.push(rmsAt(t, t + windowSize / rate))
  }
  if (slices.length === 0) return { onset: 0 }

  const peak = Math.max(...slices)
  const level = peak / (overall * 2.2)

  // Nombre de fronts montants nets : une accroche sonore « attaque ».
  let onsets = 0
  for (let i = 1; i < slices.length; i++) {
    if (slices[i] > slices[i - 1] * 1.8 && slices[i] > overall * 0.6) onsets++
  }
  const onsetDensity = Math.min(1, onsets / 6)

  return { onset: Math.min(1, level * 0.65 + onsetDensity * 0.35) }
}

/** Courbe en cloche : le rythme idéal tourne autour de 3 coupes en 2 secondes. */
function cutRhythmScore(cuts: number): number {
  const ideal = 3
  const spread = 1.9
  const bell = Math.exp(-((cuts - ideal) ** 2) / (2 * spread ** 2))
  // Un plan-séquence garde un plancher : il peut fonctionner, il part de moins loin.
  return Math.min(1, 0.18 + bell * 0.82)
}

const ADVICE: Record<keyof HookSignals, Bilingual> = {
  cutRhythm: {
    fr: 'Ajoute une coupe autour de 0,8 s : trois respirations en 2 secondes tiennent mieux l’attention.',
    en: 'Add a cut around 0.8s: three beats in 2 seconds hold attention better.',
  },
  audioOnset: {
    fr: 'Pose un bruitage d’impact sur la première image — une attaque sonore nette relance l’écoute.',
    en: 'Drop an impact sound on the first frame — a sharp audio attack re-engages the ear.',
  },
  motion: {
    fr: 'Démarre sur un plan qui bouge, ou ajoute un zoom progressif sur les 2 premières secondes.',
    en: 'Start on a moving shot, or add a slow zoom over the first 2 seconds.',
  },
  contrast: {
    fr: 'Le plan d’ouverture manque de contraste : cherche un cadre avec un sujet nettement détaché du fond.',
    en: 'The opening shot lacks contrast: find a frame where the subject stands out from the background.',
  },
  timeToAction: {
    fr: 'Coupe le temps mort du début : fais commencer la vidéo au moment où il se passe quelque chose.',
    en: 'Trim the dead air at the start: begin the video where something actually happens.',
  },
  saturation: {
    fr: 'Les couleurs sont ternes : un plan d’ouverture plus dense visuellement accroche mieux le regard.',
    en: 'Colors are dull: a visually denser opening shot catches the eye faster.',
  },
}

function buildAdvice(signals: HookSignals, weights: Record<keyof HookSignals, number>): HookAdvice[] {
  return (Object.keys(signals) as (keyof HookSignals)[])
    .map((key) => ({ key, deficit: (1 - signals[key]) * weights[key] }))
    .filter((entry) => signals[entry.key] < 0.72 && entry.deficit > 0.02)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 3)
    .map((entry) => ({
      text: ADVICE[entry.key],
      gain: Math.max(3, Math.min(20, Math.round(entry.deficit * 100))),
    }))
}

function levelFor(score: number): HookScore['level'] {
  if (score < 50) return 'faible'
  if (score < 75) return 'moyen'
  return 'fort'
}

/**
 * Calcule le score d'accroche des 2 premières secondes à partir de signaux
 * réellement mesurés sur le média : rythme de coupe (timeline + changements de
 * plan détectés), mouvement, contraste, densité colorée, attaque sonore et
 * délai avant l'entrée en action.
 */
export async function analyzeHook(input: HookAnalysisInput): Promise<HookScore> {
  const visual = await analyzeVisual(input.blob, input.startOffset)
  const audio = await analyzeAudio(input.blob, input.startOffset)

  const signals: HookSignals = {
    cutRhythm: cutRhythmScore(input.timelineCuts + visual.detectedCuts),
    motion: Math.min(1, visual.motion / 0.09),
    contrast: Math.min(1, visual.contrast / 0.26),
    saturation: Math.min(1, visual.saturation / 0.45),
    audioOnset: audio ? audio.onset : 0,
    timeToAction: Math.max(0, 1 - visual.timeToAction / HOOK_WINDOW),
  }

  // Sans piste audio lisible, on redistribue son poids sur les signaux visuels.
  const weights = { ...WEIGHTS }
  if (!audio) {
    const share = WEIGHTS.audioOnset / 5
    weights.audioOnset = 0
    weights.cutRhythm += share
    weights.motion += share
    weights.contrast += share
    weights.saturation += share
    weights.timeToAction += share
  }

  const raw = (Object.keys(signals) as (keyof HookSignals)[]).reduce(
    (acc, key) => acc + signals[key] * weights[key],
    0,
  )
  const score = Math.max(1, Math.min(100, Math.round(raw * 100)))

  return {
    score,
    level: levelFor(score),
    signals,
    advice: buildAdvice(signals, weights),
    audioUnavailable: !audio,
  }
}
