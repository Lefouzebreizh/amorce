/** Formate une durée en `m:ss` ou `m:ss.d` selon la précision demandée. */
export function formatTime(seconds: number, decimals = 0): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = safe - m * 60
  const str = decimals > 0 ? s.toFixed(decimals).padStart(decimals + 3, '0') : String(Math.floor(s)).padStart(2, '0')
  return `${m}:${str}`
}

/** Durée courte pour les tags de la bibliothèque : `0,4 s` / `0.4s`. */
export function formatDurationTag(seconds: number, lang: 'fr' | 'en'): string {
  const value = seconds < 1 ? seconds.toFixed(2).replace(/0$/, '') : seconds.toFixed(1)
  return lang === 'fr' ? `${value.replace('.', ',')} s` : `${value}s`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
