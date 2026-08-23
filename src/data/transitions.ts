import type { TransitionDef } from '../types'

/**
 * Bibliothèque de transitions. Chaque entrée porte son nom FR/EN, sa durée par
 * défaut, son énergie (cahier §3.2) et le filtre `xfade` ffmpeg correspondant :
 * la prévisualisation CSS et le rendu final décrivent donc le même effet.
 */
export const transitions: TransitionDef[] = [
  // — Impact —
  { id: 'tr-cut-flash', kind: 'transition', name: { fr: 'Flash blanc', en: 'White flash' }, duration: 0.2, energy: 'impact', xfade: 'fadewhite', preview: 'flash' },
  { id: 'tr-cut-black', kind: 'transition', name: { fr: 'Coupe noire', en: 'Black cut' }, duration: 0.25, energy: 'impact', xfade: 'fadeblack', preview: 'black' },
  { id: 'tr-zoom-punch', kind: 'transition', name: { fr: 'Zoom coup de poing', en: 'Punch zoom' }, duration: 0.3, energy: 'impact', xfade: 'zoomin', preview: 'zoom' },
  { id: 'tr-glitch', kind: 'transition', name: { fr: 'Glitch numérique', en: 'Digital glitch' }, duration: 0.25, energy: 'impact', xfade: 'pixelize', preview: 'glitch' },
  { id: 'tr-slice-h', kind: 'transition', name: { fr: 'Lamelles', en: 'Slices' }, duration: 0.35, energy: 'impact', xfade: 'hlslice', preview: 'slice' },
  { id: 'tr-squeeze', kind: 'transition', name: { fr: 'Écrasement', en: 'Squeeze' }, duration: 0.3, energy: 'impact', xfade: 'squeezeh', preview: 'squeeze' },

  // — Fluide —
  { id: 'tr-slide-left', kind: 'transition', name: { fr: 'Glissé latéral', en: 'Side slide' }, duration: 0.4, energy: 'fluide', xfade: 'slideleft', preview: 'slide-l' },
  { id: 'tr-slide-up', kind: 'transition', name: { fr: 'Glissé vertical', en: 'Vertical slide' }, duration: 0.4, energy: 'fluide', xfade: 'slideup', preview: 'slide-u' },
  { id: 'tr-wipe-left', kind: 'transition', name: { fr: 'Balayage', en: 'Wipe' }, duration: 0.4, energy: 'fluide', xfade: 'wipeleft', preview: 'wipe-l' },
  { id: 'tr-cover-up', kind: 'transition', name: { fr: 'Recouvrement', en: 'Cover up' }, duration: 0.45, energy: 'fluide', xfade: 'coverup', preview: 'cover-u' },
  { id: 'tr-radial', kind: 'transition', name: { fr: 'Balayage radial', en: 'Radial sweep' }, duration: 0.5, energy: 'fluide', xfade: 'radial', preview: 'radial' },
  { id: 'tr-circle-open', kind: 'transition', name: { fr: 'Ouverture cercle', en: 'Circle open' }, duration: 0.45, energy: 'fluide', xfade: 'circleopen', preview: 'circle' },

  // — Doux —
  { id: 'tr-fade', kind: 'transition', name: { fr: 'Fondu enchaîné', en: 'Crossfade' }, duration: 0.6, energy: 'doux', xfade: 'fade', preview: 'fade' },
  { id: 'tr-dissolve', kind: 'transition', name: { fr: 'Dissolution', en: 'Dissolve' }, duration: 0.7, energy: 'doux', xfade: 'dissolve', preview: 'dissolve' },
  { id: 'tr-blur', kind: 'transition', name: { fr: 'Fondu flouté', en: 'Blur fade' }, duration: 0.6, energy: 'doux', xfade: 'hblur', preview: 'blur' },
  { id: 'tr-grays', kind: 'transition', name: { fr: 'Passage désaturé', en: 'Desaturated pass' }, duration: 0.8, energy: 'doux', xfade: 'fadegrays', preview: 'grays' },
]

export const transitionById = new Map(transitions.map((t) => [t.id, t]))

export function getTransition(id: string | null | undefined): TransitionDef | undefined {
  return id ? transitionById.get(id) : undefined
}
