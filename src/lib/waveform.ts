/**
 * Calcule les crêtes d'un AudioBuffer pour dessiner la forme d'onde des clips
 * sur la timeline (cahier §3.3).
 */
export function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets)
  const channels = Math.min(buffer.numberOfChannels, 2)
  if (channels === 0) return peaks

  const samplesPerBucket = Math.max(1, Math.floor(buffer.length / buckets))

  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    for (let b = 0; b < buckets; b++) {
      const start = b * samplesPerBucket
      const end = Math.min(data.length, start + samplesPerBucket)
      let max = 0
      // Sous-échantillonnage : inutile de lire chaque sample pour une crête.
      const step = Math.max(1, Math.floor((end - start) / 512))
      for (let i = start; i < end; i += step) {
        const v = Math.abs(data[i])
        if (v > max) max = v
      }
      if (max > peaks[b]) peaks[b] = max
    }
  }

  // Normalisation : une voix enregistrée bas doit rester lisible.
  let loudest = 0
  for (const p of peaks) if (p > loudest) loudest = p
  if (loudest > 0.001) {
    for (let i = 0; i < peaks.length; i++) peaks[i] = Math.min(1, peaks[i] / loudest)
  }
  return peaks
}

/** Extrait la portion `[in, out]` des crêtes d'un média pour un clip. */
export function slicePeaks(peaks: Float32Array, duration: number, from: number, to: number): Float32Array {
  if (duration <= 0) return new Float32Array(0)
  const start = Math.floor((from / duration) * peaks.length)
  const end = Math.ceil((to / duration) * peaks.length)
  return peaks.slice(Math.max(0, start), Math.min(peaks.length, Math.max(start + 1, end)))
}
