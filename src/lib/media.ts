import type { MediaAsset } from '../types'
import { uid } from './id'
import { decodeAudio } from './audioContext'
import { computePeaks } from './waveform'

/** Résolution de la forme d'onde stockée avec le média. */
const PEAK_BUCKETS = 1200

/** Durée maximale d'une vidéo importée : 1 minute (cahier §3.1). */
export const MAX_VIDEO_DURATION = 60

export const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/x-m4v']
export const VIDEO_EXT = ['.mp4', '.mov', '.m4v']
export const AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg']
export const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.ogg']

export type ImportErrorCode = 'format' | 'duration' | 'decode'

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    readonly detail?: string,
  ) {
    super(code)
    this.name = 'ImportError'
  }
}

function hasExtension(name: string, extensions: string[]): boolean {
  const lower = name.toLowerCase()
  return extensions.some((ext) => lower.endsWith(ext))
}

export function isAcceptedVideo(file: File): boolean {
  return VIDEO_MIME.includes(file.type) || hasExtension(file.name, VIDEO_EXT)
}

export function isAcceptedAudio(file: File): boolean {
  return AUDIO_MIME.includes(file.type) || hasExtension(file.name, AUDIO_EXT)
}

interface Probe {
  duration: number
  width: number
  height: number
}

/** Lit les métadonnées d'un média via un élément HTML, sans le décoder entièrement. */
function probe(file: Blob, kind: 'video' | 'audio'): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement(kind)
    el.preload = 'metadata'
    el.muted = true

    const cleanup = () => {
      el.removeAttribute('src')
      el.load()
      URL.revokeObjectURL(url)
    }

    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new ImportError('decode', 'timeout'))
    }, 20_000)

    el.onloadedmetadata = () => {
      window.clearTimeout(timeout)
      const duration = el.duration
      const width = kind === 'video' ? (el as HTMLVideoElement).videoWidth : 0
      const height = kind === 'video' ? (el as HTMLVideoElement).videoHeight : 0
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new ImportError('decode', 'duration inconnue'))
        return
      }
      resolve({ duration, width, height })
    }

    el.onerror = () => {
      window.clearTimeout(timeout)
      cleanup()
      reject(new ImportError('decode'))
    }

    el.src = url
  })
}

/** Décode la piste audio une fois à l'import : forme d'onde et présence audio. */
async function extractAudioProfile(blob: Blob): Promise<{ hasAudio: boolean; peaks: number[] }> {
  try {
    const buffer = await decodeAudio(await blob.arrayBuffer())
    if (!buffer) return { hasAudio: false, peaks: [] }
    return { hasAudio: true, peaks: Array.from(computePeaks(buffer, PEAK_BUCKETS)) }
  } catch {
    return { hasAudio: false, peaks: [] }
  }
}

/** Valide puis transforme un fichier vidéo en média prêt à poser sur la timeline. */
export async function importVideoFile(file: File): Promise<MediaAsset> {
  if (!isAcceptedVideo(file)) throw new ImportError('format')
  const { duration, width, height } = await probe(file, 'video')
  if (duration > MAX_VIDEO_DURATION + 0.5) {
    throw new ImportError('duration', duration.toFixed(1))
  }
  const audio = await extractAudioProfile(file)
  return {
    id: uid('media'),
    name: file.name,
    type: 'video',
    mime: file.type || 'video/mp4',
    duration: Math.min(duration, MAX_VIDEO_DURATION),
    width,
    height,
    size: file.size,
    blob: file,
    hasAudio: audio.hasAudio,
    peaks: audio.peaks,
  }
}

/** Valide puis transforme un fichier audio en piste de musique de fond. */
export async function importAudioFile(file: File): Promise<MediaAsset> {
  if (!isAcceptedAudio(file)) throw new ImportError('format')
  const { duration } = await probe(file, 'audio')
  const audio = await extractAudioProfile(file)
  return {
    id: uid('music'),
    name: file.name,
    type: 'audio',
    mime: file.type || 'audio/mpeg',
    duration,
    width: 0,
    height: 0,
    size: file.size,
    blob: file,
    hasAudio: audio.hasAudio,
    peaks: audio.peaks,
  }
}

/** Extension de fichier utilisée côté ffmpeg (le conteneur doit rester exact). */
export function extensionFor(asset: MediaAsset): string {
  const lower = asset.name.toLowerCase()
  const match = lower.match(/\.([a-z0-9]{2,4})$/)
  if (match) return match[1]
  if (asset.mime.includes('quicktime')) return 'mov'
  return asset.type === 'video' ? 'mp4' : 'mp3'
}
