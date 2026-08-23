import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { Clip, MediaAsset, SfxPlacement } from '../types'
import { computeSegments } from '../state/store'
import { getTransition } from '../data/transitions'
import { getSfx } from '../data/sfx'
import { extensionFor } from './media'
import { audioBufferToWav, renderSfx } from './sfxSynth'

/** Format de sortie imposé par le cahier des charges (§3.6). */
export const OUTPUT_WIDTH = 1080
export const OUTPUT_HEIGHT = 1920
export const OUTPUT_FPS = 30

export type ExportStage = 'loading' | 'writing' | 'encoding' | 'done'

export interface ExportProgress {
  stage: ExportStage
  /** 0..1 pour l'étape d'encodage, sinon indéterminé. */
  progress: number
}

export interface ExportInput {
  clips: Clip[]
  assets: Record<string, MediaAsset>
  sfxPlacements: SfxPlacement[]
  music: MediaAsset | null
  voiceLevel: number
  musicLevel: number
  sfxLevel: number
  onProgress?: (p: ExportProgress) => void
}

let ffmpeg: FFmpeg | null = null

async function getFFmpeg(onProgress?: (p: ExportProgress) => void): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg
  onProgress?.({ stage: 'loading', progress: 0 })
  const instance = new FFmpeg()
  // Le core est servi depuis l'application : aucun appel à un CDN externe.
  const base = import.meta.env.BASE_URL
  await instance.load({
    coreURL: `${base}ffmpeg/ffmpeg-core.js`,
    wasmURL: `${base}ffmpeg/ffmpeg-core.wasm`,
  })
  ffmpeg = instance
  return instance
}

/** Interrompt un export en cours ; le moteur sera rechargé au suivant. */
export async function cancelExport(): Promise<void> {
  if (ffmpeg?.loaded) {
    ffmpeg.terminate()
  }
  ffmpeg = null
}

function fmt(value: number): string {
  return value.toFixed(3)
}

/** Chaîne de filtres vidéo appliquée à chaque clip avant assemblage. */
function clipVideoFilter(inputIndex: number, clip: Clip, label: string): string {
  return (
    `[${inputIndex}:v]trim=start=${fmt(clip.in)}:end=${fmt(clip.out)},setpts=PTS-STARTPTS,` +
    `fps=${OUTPUT_FPS},scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},setsar=1,format=yuv420p[${label}]`
  )
}

export async function exportVideo(input: ExportInput): Promise<Blob> {
  const { clips, assets, sfxPlacements, music, onProgress } = input
  if (clips.length === 0) throw new Error('timeline-vide')

  const instance = await getFFmpeg(onProgress)
  onProgress?.({ stage: 'writing', progress: 0 })

  const segments = computeSegments(clips)
  const total = segments[segments.length - 1].end

  // — Écriture des sources dans le système de fichiers virtuel —
  const inputFiles: string[] = []
  const assetInput = new Map<string, number>()

  for (const clip of clips) {
    if (assetInput.has(clip.assetId)) continue
    const asset = assets[clip.assetId]
    if (!asset) throw new Error(`média introuvable: ${clip.assetId}`)
    const name = `src${assetInput.size}.${extensionFor(asset)}`
    await instance.writeFile(name, await fetchFile(asset.blob))
    assetInput.set(clip.assetId, inputFiles.length)
    inputFiles.push(name)
  }

  const placements = sfxPlacements
    .filter((p) => getSfx(p.sfxId) && p.at < total)
    .sort((a, b) => a.at - b.at)
  const sfxInputs: { index: number; placement: SfxPlacement }[] = []
  for (const placement of placements) {
    const def = getSfx(placement.sfxId)!
    const wav = audioBufferToWav(await renderSfx(def))
    const name = `sfx${sfxInputs.length}.wav`
    await instance.writeFile(name, wav)
    sfxInputs.push({ index: inputFiles.length, placement })
    inputFiles.push(name)
  }

  let musicIndex = -1
  if (music) {
    const name = `music.${extensionFor(music)}`
    await instance.writeFile(name, await fetchFile(music.blob))
    musicIndex = inputFiles.length
    inputFiles.push(name)
  }

  // — Graphe de filtres —
  const filters: string[] = []

  segments.forEach((segment) => {
    filters.push(clipVideoFilter(assetInput.get(segment.clip.assetId)!, segment.clip, `v${segment.index}`))
  })

  let videoLabel = 'v0'
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]
    const definition = getTransition(segment.clip.transitionId)
    const next = `x${i}`
    if (definition && segment.transitionDuration > 0.05) {
      // `offset` = instant, dans le flux déjà assemblé, où démarre le fondu.
      filters.push(
        `[${videoLabel}][v${i}]xfade=transition=${definition.xfade}:` +
          `duration=${fmt(segment.transitionDuration)}:offset=${fmt(segment.start)}[${next}]`,
      )
    } else {
      filters.push(`[${videoLabel}][v${i}]concat=n=2:v=1:a=0[${next}]`)
    }
    videoLabel = next
  }

  // — Audio : voix de chaque clip, bruitages, musique —
  const audioLabels: string[] = []

  segments.forEach((segment) => {
    const asset = assets[segment.clip.assetId]
    if (!asset?.hasAudio || input.voiceLevel <= 0) return
    const label = `a${segment.index}`
    const delayMs = Math.round(segment.start * 1000)
    filters.push(
      `[${assetInput.get(segment.clip.assetId)}:a]atrim=start=${fmt(segment.clip.in)}:end=${fmt(segment.clip.out)},` +
        `asetpts=PTS-STARTPTS,aresample=48000,volume=${fmt(input.voiceLevel)},` +
        `adelay=${delayMs}:all=1[${label}]`,
    )
    audioLabels.push(label)
  })

  sfxInputs.forEach(({ index, placement }, i) => {
    if (input.sfxLevel <= 0) return
    const label = `s${i}`
    const delayMs = Math.round(placement.at * 1000)
    filters.push(
      `[${index}:a]aresample=48000,volume=${fmt(input.sfxLevel * placement.gain)},adelay=${delayMs}:all=1[${label}]`,
    )
    audioLabels.push(label)
  })

  if (musicIndex >= 0 && music?.hasAudio && input.musicLevel > 0) {
    const fadeStart = Math.max(0, total - 0.6)
    filters.push(
      `[${musicIndex}:a]atrim=start=0:end=${fmt(total)},asetpts=PTS-STARTPTS,aresample=48000,` +
        `volume=${fmt(input.musicLevel)},afade=t=out:st=${fmt(fadeStart)}:d=0.6[m0]`,
    )
    audioLabels.push('m0')
  }

  const hasAudio = audioLabels.length > 0
  if (hasAudio) {
    if (audioLabels.length === 1) {
      filters.push(`[${audioLabels[0]}]apad=whole_dur=${fmt(total)},atrim=end=${fmt(total)}[aout]`)
    } else {
      filters.push(
        `${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:` +
          `normalize=0:dropout_transition=0,volume=0.9,atrim=end=${fmt(total)}[aout]`,
      )
    }
  }

  // — Encodage —
  onProgress?.({ stage: 'encoding', progress: 0 })
  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    onProgress?.({ stage: 'encoding', progress: Math.max(0, Math.min(1, progress)) })
  }
  instance.on('progress', onFfmpegProgress)

  const args = [
    ...inputFiles.flatMap((name) => ['-i', name]),
    '-filter_complex',
    filters.join(';'),
    '-map',
    `[${videoLabel}]`,
    ...(hasAudio ? ['-map', '[aout]', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : ['-an']),
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(OUTPUT_FPS),
    '-t',
    fmt(total),
    '-movflags',
    '+faststart',
    'amorce-export.mp4',
  ]

  try {
    const code = await instance.exec(args)
    if (code !== 0) throw new Error(`ffmpeg (code ${code})`)
    const data = await instance.readFile('amorce-export.mp4')
    onProgress?.({ stage: 'done', progress: 1 })
    const bytes = data as Uint8Array
    return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'video/mp4' })
  } finally {
    instance.off('progress', onFfmpegProgress)
    // Nettoyage du FS virtuel : les vidéos importées pèsent lourd en mémoire.
    for (const name of [...inputFiles, 'amorce-export.mp4']) {
      try {
        await instance.deleteFile(name)
      } catch {
        /* déjà supprimé */
      }
    }
  }
}
