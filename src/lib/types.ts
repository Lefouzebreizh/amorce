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
};

/** Bruitages de synthèse, générés en Web Audio (aucun fichier à héberger). */
export type SfxId = 'whoosh' | 'boom' | 'ding' | 'riser' | 'pop' | 'click' | 'swipe';

/** Un bruitage déclenché à un instant précis de la timeline. */
export type SoundCue = {
  id: string;
  sfx: SfxId;
  /** Instant de déclenchement sur la timeline, en secondes. */
  time: number;
  gain: number;
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
};

/** Valeurs par défaut d'un clip fraîchement ajouté à la timeline. */
export const DEFAULT_CLIP: Omit<Clip, 'id' | 'assetId' | 'outPoint'> = {
  inPoint: 0,
  speed: 1,
  transition: 'fade',
  transitionDuration: 0.35,
  motion: 'none',
  volume: 1,
};
