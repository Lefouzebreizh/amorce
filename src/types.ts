/** Types partagés du projet AMORCE. */

export type Lang = 'fr' | 'en'

/** Toute chaîne visible par l'utilisateur existe en FR et EN (cahier §2). */
export interface Bilingual {
  fr: string
  en: string
}

/** Énergie d'une transition — sert au filtrage et au code couleur. */
export type Energy = 'impact' | 'fluide' | 'doux'

export interface TransitionDef {
  id: string
  kind: 'transition'
  name: Bilingual
  /** Durée par défaut, en secondes. */
  duration: number
  energy: Energy
  /** Nom du filtre `xfade` ffmpeg utilisé à l'export. */
  xfade: string
  /** Classe d'animation CSS jouée dans la prévisualisation. */
  preview: string
}

/** Recette de synthèse WebAudio — les bruitages sont générés, pas importés. */
export interface SfxRecipe {
  type: 'whoosh' | 'impact' | 'riser' | 'click' | 'pop' | 'glitch' | 'sub' | 'tape' | 'ding' | 'swipe'
  /** Fréquence de base en Hz. */
  freq: number
  /** Courbe de hauteur : > 1 monte, < 1 descend. */
  sweep: number
  /** Gain de sortie 0..1. */
  gain: number
}

export type SfxCategory = 'transition' | 'accent' | 'ambiance'

export interface SfxDef {
  id: string
  kind: 'sfx'
  name: Bilingual
  duration: number
  category: SfxCategory
  recipe: SfxRecipe
}

export type EffectDef = TransitionDef | SfxDef

/** Rythme de montage conseillé par un hook viral. */
export type Pace = 'rapide' | 'moyen' | 'lent'

export interface HookPattern {
  id: string
  name: Bilingual
  /** Patron de phrase à prononcer en ouverture. */
  template: Bilingual
  /** Explication du mécanisme psychologique. */
  rationale: Bilingual
  pace: Pace
  /** Points de coupe conseillés, en secondes depuis le début. */
  cuts: number[]
  /** Transition appliquée à chaque coupe du patron. */
  transitionId: string
  /** Score d'accroche estimé pour ce patron (référence, pas une mesure). */
  estimatedScore: number
}

/** Un média importé (vidéo ou musique), stocké en IndexedDB. */
export interface MediaAsset {
  id: string
  name: string
  type: 'video' | 'audio'
  mime: string
  duration: number
  width: number
  height: number
  size: number
  blob: Blob
  /** Faux si le média n'a pas de piste audio décodable. */
  hasAudio: boolean
  /** Crêtes pré-calculées pour la forme d'onde de la timeline. */
  peaks: number[]
}

/** Un clip = une portion d'un média posée sur la timeline. */
export interface Clip {
  id: string
  assetId: string
  /** Début et fin dans le média source, en secondes. */
  in: number
  out: number
  /** Transition entrante (avec le clip précédent). null = coupe franche. */
  transitionId: string | null
  transitionDuration: number
}

/** Un bruitage posé à un instant précis de la timeline. */
export interface SfxPlacement {
  id: string
  sfxId: string
  /** Position sur la timeline, en secondes. */
  at: number
  gain: number
}

/** Signaux mesurés sur les 2 premières secondes (cahier §3.4 et §5). */
export interface HookSignals {
  cutRhythm: number
  motion: number
  contrast: number
  saturation: number
  audioOnset: number
  timeToAction: number
}

export interface HookAdvice {
  text: Bilingual
  /** Gain potentiel estimé, en points. */
  gain: number
}

export interface HookScore {
  score: number
  level: 'faible' | 'moyen' | 'fort'
  signals: HookSignals
  advice: HookAdvice[]
  /** Vrai si la piste audio n'a pas pu être décodée (poids redistribués). */
  audioUnavailable: boolean
}

export interface OpeningPreset {
  id: string
  name: Bilingual
  description: Bilingual
  /** Score de référence affiché dans la maquette validée. */
  referenceScore: number
  pace: Pace
  cuts: number[]
  transitionId: string
}
