import type { SfxDef } from '../types'

/**
 * Bruitages générés par synthèse WebAudio (cf. `lib/sfxSynth.ts`) : aucun
 * fichier binaire à héberger, un rendu identique en préécoute et à l'export.
 */
export const sfx: SfxDef[] = [
  { id: 'sfx-whoosh', kind: 'sfx', name: { fr: 'Whoosh', en: 'Whoosh' }, duration: 0.45, category: 'transition', recipe: { type: 'whoosh', freq: 900, sweep: 0.25, gain: 0.7 } },
  { id: 'sfx-swipe', kind: 'sfx', name: { fr: 'Balayage', en: 'Swipe' }, duration: 0.3, category: 'transition', recipe: { type: 'swipe', freq: 1400, sweep: 3, gain: 0.6 } },
  { id: 'sfx-riser', kind: 'sfx', name: { fr: 'Montée', en: 'Riser' }, duration: 1.2, category: 'transition', recipe: { type: 'riser', freq: 220, sweep: 8, gain: 0.55 } },
  { id: 'sfx-tape', kind: 'sfx', name: { fr: 'Arrêt bande', en: 'Tape stop' }, duration: 0.6, category: 'transition', recipe: { type: 'tape', freq: 440, sweep: 0.12, gain: 0.6 } },

  { id: 'sfx-impact', kind: 'sfx', name: { fr: 'Impact', en: 'Impact' }, duration: 0.5, category: 'accent', recipe: { type: 'impact', freq: 110, sweep: 0.35, gain: 0.9 } },
  { id: 'sfx-sub', kind: 'sfx', name: { fr: 'Sub grave', en: 'Sub drop' }, duration: 0.8, category: 'accent', recipe: { type: 'sub', freq: 70, sweep: 0.4, gain: 0.85 } },
  { id: 'sfx-click', kind: 'sfx', name: { fr: 'Clic sec', en: 'Sharp click' }, duration: 0.12, category: 'accent', recipe: { type: 'click', freq: 2600, sweep: 0.6, gain: 0.5 } },
  { id: 'sfx-pop', kind: 'sfx', name: { fr: 'Pop', en: 'Pop' }, duration: 0.18, category: 'accent', recipe: { type: 'pop', freq: 620, sweep: 2.2, gain: 0.55 } },
  { id: 'sfx-glitch', kind: 'sfx', name: { fr: 'Glitch', en: 'Glitch' }, duration: 0.35, category: 'accent', recipe: { type: 'glitch', freq: 1200, sweep: 1, gain: 0.5 } },
  { id: 'sfx-ding', kind: 'sfx', name: { fr: 'Ding', en: 'Ding' }, duration: 0.9, category: 'accent', recipe: { type: 'ding', freq: 1320, sweep: 1, gain: 0.45 } },

  { id: 'sfx-air', kind: 'sfx', name: { fr: 'Souffle léger', en: 'Light air' }, duration: 1.5, category: 'ambiance', recipe: { type: 'whoosh', freq: 400, sweep: 1, gain: 0.28 } },
  { id: 'sfx-drone', kind: 'sfx', name: { fr: 'Nappe tendue', en: 'Tense drone' }, duration: 2, category: 'ambiance', recipe: { type: 'sub', freq: 90, sweep: 1.05, gain: 0.32 } },
]

export const sfxById = new Map(sfx.map((s) => [s.id, s]))

export function getSfx(id: string | null | undefined) {
  return id ? sfxById.get(id) : undefined
}
