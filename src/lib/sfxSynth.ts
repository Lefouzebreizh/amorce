import type { SfxDef, SfxRecipe } from '../types'
import { getAudioContext } from './audioContext'

const SAMPLE_RATE = 48_000

/** Générateur pseudo-aléatoire déterministe : préécoute et export identiques. */
function makeRng(seed: number) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) / 0xffffffff) * 2 - 1
  }
}

function seedFrom(type: string): number {
  let h = 2166136261
  for (let i = 0; i < type.length; i++) {
    h ^= type.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function noiseBuffer(ctx: BaseAudioContext, duration: number, seed: number): AudioBuffer {
  const length = Math.max(1, Math.ceil(duration * ctx.sampleRate))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  const rng = makeRng(seed)
  for (let i = 0; i < length; i++) data[i] = rng()
  return buffer
}

/** Construit le graphe audio d'un bruitage dans le contexte fourni. */
function build(ctx: BaseAudioContext, recipe: SfxRecipe, duration: number, destination: AudioNode) {
  const t0 = ctx.currentTime
  const end = t0 + duration
  const master = ctx.createGain()
  master.gain.value = recipe.gain
  master.connect(destination)

  const seed = seedFrom(recipe.type)

  const startNoise = (filterType: BiquadFilterType, from: number, to: number, q: number) => {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, duration, seed)
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.Q.value = q
    filter.frequency.setValueAtTime(Math.max(20, from), t0)
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), end)
    src.connect(filter)
    return { src, filter }
  }

  const env = (attack: number, release: number, peak = 1) => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.max(0.005, duration * attack))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.02, duration * release))
    return g
  }

  const tone = (type: OscillatorType, from: number, to: number) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(20, from), t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), end)
    return osc
  }

  switch (recipe.type) {
    case 'whoosh':
    case 'swipe': {
      const { src, filter } = startNoise('bandpass', recipe.freq, recipe.freq * recipe.sweep, 1.4)
      const g = env(recipe.type === 'swipe' ? 0.15 : 0.35, 1)
      filter.connect(g).connect(master)
      src.start(t0)
      src.stop(end)
      break
    }
    case 'riser': {
      const osc = tone('sawtooth', recipe.freq, recipe.freq * recipe.sweep)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(600, t0)
      lp.frequency.exponentialRampToValueAtTime(9000, end)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(1, end - 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(lp).connect(g).connect(master)
      const { src, filter } = startNoise('highpass', 400, 6000, 0.7)
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.0001, t0)
      ng.gain.exponentialRampToValueAtTime(0.5, end)
      filter.connect(ng).connect(master)
      osc.start(t0)
      osc.stop(end)
      src.start(t0)
      src.stop(end)
      break
    }
    case 'tape': {
      const osc = tone('triangle', recipe.freq, recipe.freq * recipe.sweep)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(6000, t0)
      lp.frequency.exponentialRampToValueAtTime(200, end)
      const g = env(0.05, 1)
      osc.connect(lp).connect(g).connect(master)
      osc.start(t0)
      osc.stop(end)
      break
    }
    case 'impact':
    case 'sub': {
      const osc = tone('sine', recipe.freq, recipe.freq * recipe.sweep)
      const g = env(recipe.type === 'impact' ? 0.02 : 0.15, 1)
      osc.connect(g).connect(master)
      osc.start(t0)
      osc.stop(end)
      if (recipe.type === 'impact') {
        const { src, filter } = startNoise('lowpass', 3000, 300, 0.7)
        const ng = env(0.01, 0.25, 0.6)
        filter.connect(ng).connect(master)
        src.start(t0)
        src.stop(end)
      }
      break
    }
    case 'click': {
      const { src, filter } = startNoise('highpass', recipe.freq, recipe.freq * recipe.sweep, 0.8)
      const g = env(0.05, 1)
      filter.connect(g).connect(master)
      src.start(t0)
      src.stop(end)
      break
    }
    case 'pop': {
      const osc = tone('sine', recipe.freq, recipe.freq * recipe.sweep)
      const g = env(0.1, 1)
      osc.connect(g).connect(master)
      osc.start(t0)
      osc.stop(end)
      break
    }
    case 'glitch': {
      // Rafale de micro-fenêtres : le rendu « numérique » vient du hachage.
      const slices = 7
      const step = duration / slices
      const rng = makeRng(seed)
      for (let i = 0; i < slices; i++) {
        const on = rng() > -0.2
        if (!on) continue
        const osc = ctx.createOscillator()
        osc.type = i % 2 === 0 ? 'square' : 'sawtooth'
        osc.frequency.value = recipe.freq * (0.5 + Math.abs(rng()) * 1.5)
        const g = ctx.createGain()
        const s = t0 + i * step
        g.gain.setValueAtTime(0, s)
        g.gain.setValueAtTime(0.5, s + 0.002)
        g.gain.setValueAtTime(0, s + step * 0.7)
        osc.connect(g).connect(master)
        osc.start(s)
        osc.stop(s + step)
      }
      break
    }
    case 'ding': {
      for (const [ratio, level] of [
        [1, 1],
        [2.76, 0.4],
        [5.4, 0.18],
      ] as const) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = recipe.freq * ratio
        const g = ctx.createGain()
        g.gain.setValueAtTime(level, t0)
        g.gain.exponentialRampToValueAtTime(0.0001, end)
        osc.connect(g).connect(master)
        osc.start(t0)
        osc.stop(end)
      }
      break
    }
  }
}

/** Rend un bruitage hors ligne — utilisé pour l'export. */
export async function renderSfx(def: SfxDef): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(def.duration * SAMPLE_RATE), SAMPLE_RATE)
  build(ctx, def.recipe, def.duration, ctx.destination)
  return ctx.startRendering()
}

let previewSource: GainNode | null = null

/** Joue un bruitage immédiatement (préécoute bibliothèque et timeline). */
export function playSfx(def: SfxDef, gain = 1): void {
  const ctx = getAudioContext()
  stopSfxPreview()
  const out = ctx.createGain()
  out.gain.value = gain
  out.connect(ctx.destination)
  build(ctx, def.recipe, def.duration, out)
  previewSource = out
  window.setTimeout(() => {
    if (previewSource === out) previewSource = null
    out.disconnect()
  }, def.duration * 1000 + 120)
}

export function stopSfxPreview(): void {
  if (previewSource) {
    previewSource.disconnect()
    previewSource = null
  }
}

/** Encode un AudioBuffer en WAV 16 bits pour l'injecter dans ffmpeg. */
export function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels
  const length = buffer.length * channels * 2
  const out = new DataView(new ArrayBuffer(44 + length))

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) out.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  out.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, channels, true)
  out.setUint32(24, buffer.sampleRate, true)
  out.setUint32(28, buffer.sampleRate * channels * 2, true)
  out.setUint16(32, channels * 2, true)
  out.setUint16(34, 16, true)
  writeString(36, 'data')
  out.setUint32(40, length, true)

  let offset = 44
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c))
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i]))
      out.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Uint8Array(out.buffer)
}
