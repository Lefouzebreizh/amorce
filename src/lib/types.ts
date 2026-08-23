/**
 * Modèle de données d'Amorce.
 *
 * Un projet = des médias sources (`MediaAsset`) découpés en `Clip`s posés bout à
 * bout sur une timeline, plus des calques par-dessus : sous-titres et bruitages.
 *
 * Tout vit dans le navigateur : les fichiers ne sont jamais envoyés sur un serveur.
 */

/** Format de sortie : vertical plein écran, le seul qui compte sur TikTok. */
export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;
export const OUTPUT_FPS = 30;

/** Un fichier vidéo importé par l'utilisateur. */
export type MediaAsset = {
  id: string;
  name: string;
  /** URL objet du fichier, valable tant que l'onglet est ouvert. */
  url: string;
  duration: number;
  width: number;
  height: number;
  /** Vignette en data URL, affichée dans la bibliothèque et la timeline. */
  thumbnail: string;
  /** Le média porte-t-il une piste sonore exploitable. */
  hasAudio: boolean;
};

/** Transitions disponibles entre deux clips. */
export type TransitionKind =
  | 'cut'
  | 'fade'
  | 'whipPan'
  | 'zoomPunch'
  | 'slideUp'
  | 'flash'
  | 'glitch';

/** Mouvement appliqué pendant toute la durée d'un clip. */
export type ClipMotion = 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'shake';

/** Un segment de média posé sur la timeline. */
export type Clip = {
  id: string;
  assetId: string;
  /** Point d'entrée dans le média source, en secondes. */
  inPoint: number;
  /** Point de sortie dans le média source, en secondes. */
  outPoint: number;
  /** Facteur de vitesse : 1 = normal, 2 = deux fois plus rapide. */
  speed: number;
  /** Transition qui amène ce clip. Ignorée sur le premier clip. */
  transition: TransitionKind;
  /** Durée de la transition entrante, en secondes de timeline. */
  transitionDuration: number;
  motion: ClipMotion;
  /** Volume de la piste sonore du clip, 0 à 1. */
  volume: number;
};

/** Styles de sous-titres pensés pour la lisibilité en scroll. */
export type CaptionStyleId = 'punch' | 'karaoke' | 'minimal' | 'neon' | 'subtitle';

export type Caption = {
  id: string;
  text: string;
  /** Début sur la timeline, en secondes. */
  start: number;
  /** Fin sur la timeline, en secondes. */
  end: number;
  style: CaptionStyleId;
  /** Position verticale du centre du bloc, de 0 (haut) à 1 (bas). */
  y: number;
  /** Couleur du texte. Absente, celle du style s'applique. */
  color?: string;
  /** Facteur de taille appliqué au corps du style. */
  scale?: number;
};

/**
 * Couleurs proposées pour un sous-titre.
 *
 * Volontairement peu nombreuses et toutes très contrastées : sur une image
 * vidéo quelconque, un texte pastel devient illisible, et proposer une palette
 * complète reviendrait à laisser choisir la mauvaise option.
 */
export const CAPTION_COLORS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'Blanc' },
  { value: '#ffe14d', label: 'Jaune' },
  { value: '#22e37a', label: 'Vert' },
  { value: '#ff5c68', label: 'Rouge' },
  { value: '#48d2ff', label: 'Cyan' },
  { value: '#0a0a0a', label: 'Noir' },
];

/** Tailles proposées, en facteur du corps défini par le style. */
export const CAPTION_SCALES: { value: number; label: string }[] = [
  { value: 0.72, label: 'Petit' },
  { value: 1, label: 'Normal' },
  { value: 1.3, label: 'Grand' },
];

/** Bruitages de synthèse, générés en Web Audio (aucun fichier à héberger). */
export type SfxId =
  | 'whoosh'
  | 'boom'
  | 'ding'
  | 'riser'
  | 'pop'
  | 'click'
  | 'swipe'
  | 'subdrop'
  | 'reverse'
  | 'sparkle'
  | 'punch'
  | 'zap'
  | 'wind';

/** Un bruitage déclenché à un instant précis de la timeline. */
export type SoundCue = {
  id: string;
  sfx: SfxId;
  /** Instant de déclenchement sur la timeline, en secondes. */
  time: number;
  gain: number;
};

/**
 * Définitions d'export proposées.
 *
 * L'enregistrement se faisant en temps réel, un appareil qui ne tient pas la
 * cadence perd des images. Diviser le nombre de pixels par deux suffit souvent
 * à retrouver un rendu fluide, pour une perte de finesse que le réencodage des
 * plateformes efface de toute façon en grande partie.
 */
export type ExportPreset = {
  id: 'full' | 'light';
  label: string;
  description: string;
  /** Facteur appliqué à la définition de référence. */
  scale: number;
};

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'full',
    label: '1080 × 1920',
    description: 'Définition recommandée par les plateformes.',
    scale: 1,
  },
  {
    id: 'light',
    label: '720 × 1280',
    description: 'Deux fois moins de pixels : à choisir si l’export saccade.',
    scale: 2 / 3,
  },
];

export function exportPreset(id: ExportPreset['id']): ExportPreset {
  return EXPORT_PRESETS.find((p) => p.id === id) ?? EXPORT_PRESETS[0];
}

/**
 * Table de mixage.
 *
 * Trois sources se disputent la même sortie : le son d'origine des plans, les
 * bruitages, la musique. Sans réglage séparé, un rush bruyant couvre les
 * bruitages qu'on vient de poser, et le seul recours serait de baisser le
 * volume de chaque plan un par un.
 */
export type MixSettings = {
  /** Son d'origine des plans, de 0 à 1. */
  clips: number;
  /** Bruitages, de 0 à 1. */
  sfx: number;
  /** Musique de fond, de 0 à 1. */
  music: number;
};

/**
 * Équilibre de départ.
 *
 * Les bruitages passent devant : leur fonction est de marquer une coupe ou un
 * impact, ce qu'ils ne peuvent pas faire au même niveau que le fond sonore.
 */
export const DEFAULT_MIX: MixSettings = { clips: 0.75, sfx: 1, music: 0.6 };

/** Rendus colorimétriques disponibles. */
export type LookId =
  | 'naturel'
  | 'cinema'
  | 'blockbuster'
  | 'argentique'
  | 'nuit'
  | 'or'
  | 'noir'
  | 'reve';

/** Réglages du rendu cinématographique, appliqués à tout le montage. */
export type CinemaSettings = {
  look: LookId;
  /** Dosage global du rendu, de 0 (aucun) à 1 (plein effet). */
  intensity: number;
  /** Hauteur des bandes cinémascope, de 0 (aucune) à 1. */
  bars: number;
};

/** Musique de fond optionnelle, importée par l'utilisateur. */
export type MusicTrack = {
  name: string;
  url: string;
  duration: number;
  gain: number;
  /** Décalage de départ dans le morceau, en secondes. */
  offset: number;
};

export type Project = {
  name: string;
  assets: MediaAsset[];
  clips: Clip[];
  captions: Caption[];
  cues: SoundCue[];
  music: MusicTrack | null;
  cinema: CinemaSettings;
  mix: MixSettings;
};

/** Rendu par défaut : discrètement cinéma, sans bandes. */
export const DEFAULT_CINEMA: CinemaSettings = { look: 'cinema', intensity: 0.7, bars: 0 };

/**
 * Durée plancher d'un plan, en secondes.
 *
 * En dessous, le plan n'a plus de sens : il ne se voit pas à la lecture, son
 * bloc devient illisible sur la timeline, et un curseur manipulé au doigt y
 * tombe bien trop facilement.
 */
export const MIN_CLIP_DURATION = 0.3;

/** Valeurs par défaut d'un clip fraîchement ajouté à la timeline. */
export const DEFAULT_CLIP: Omit<Clip, 'id' | 'assetId' | 'outPoint'> = {
  inPoint: 0,
  speed: 1,
  transition: 'fade',
  transitionDuration: 0.35,
  motion: 'none',
  volume: 1,
};
