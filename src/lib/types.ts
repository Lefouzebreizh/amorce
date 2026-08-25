/**
 * Modèle de données d'Amorce.
 *
 * Un projet = des médias sources (`MediaAsset`) découpés en `Clip`s posés bout à
 * bout sur une timeline, plus des calques par-dessus : sous-titres, bruitages
 * — de synthèse ou importés — et voix off.
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
  /**
   * Couleur de la pastille qui surligne le mot prononcé, en karaoké.
   *
   * Absente, celle du style s'applique. La couleur du texte posé dessus n'est
   * pas réglable : elle se déduit du contraste, sans quoi on pourrait composer
   * un couple parfaitement illisible en deux gestes.
   */
  highlightColor?: string;
  /** Facteur de taille appliqué au corps du style. */
  scale?: number;
  /**
   * Le texte bat-il lentement au lieu de rester immobile.
   *
   * À réserver à ce qui presse — un compte à rebours, une question finale. Un
   * montage où tout pulse n'attire l'œil sur rien.
   */
  pulse?: boolean;
  /**
   * Réplique de voix off dont ce sous-titre est issu, s'il en vient.
   *
   * Ce lien rend le calage rejouable : retoucher le texte puis recaler remplace
   * les sous-titres précédents au lieu d'en empiler une seconde série par-dessus
   * la première.
   */
  voiceId?: string;
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
 * Un bruitage importé, posé à un instant de la timeline.
 *
 * Les sons de synthèse couvrent bien ce qui est abstrait — une coupe, un
 * souffle, une tension. Ils ne peuvent rien pour ce qui doit être reconnaissable :
 * un rugissement, un coup d'orchestre, une explosion de film. Ceux-là se
 * fabriquent avec un modèle entraîné sur du son réel, ailleurs, et n'ont plus
 * qu'à être déposés ici.
 *
 * Même forme qu'une réplique de voix, à deux différences près : rien à
 * prononcer, et surtout aucune baisse du fond — un bruitage doit percer le
 * mixage, pas lui faire de la place.
 */
export type SampleCue = {
  id: string;
  name: string;
  /** URL objet du fichier, valable tant que l'onglet est ouvert. */
  url: string;
  duration: number;
  /** Instant de la timeline où le bruitage commence, en secondes. */
  start: number;
  gain: number;
};

/**
 * Une réplique de voix off, posée à un instant de la timeline.
 *
 * Une liste plutôt qu'une piste unique, parce que c'est ainsi qu'arrive une
 * voix générée : un fichier par réplique, à placer chacun en face de son plan.
 * Les concaténer à la main hors du studio obligerait à tout refaire dès qu'un
 * plan bouge d'une demi-seconde.
 *
 * Le texte voyage avec le son : c'est lui qui donne les sous-titres, et le
 * séparer de sa réplique reviendrait à devoir les réassocier à chaque calage.
 */
export type VoiceCue = {
  id: string;
  name: string;
  /** URL objet du fichier, valable tant que l'onglet est ouvert. */
  url: string;
  duration: number;
  /** Instant de la timeline où la réplique commence, en secondes. */
  start: number;
  gain: number;
  /** Texte prononcé, d'où sont tirés les sous-titres. */
  script: string;
  /**
   * Passages parlés détectés dans le fichier, en secondes depuis son début.
   *
   * Conservés plutôt que recalculés : l'analyse demande de décoder tout le
   * fichier, ce qui se paie en centaines de millisecondes sur téléphone. Elle a
   * lieu une fois à l'import, et sert ensuite aussi bien au calage des
   * sous-titres qu'à la baisse automatique du fond.
   */
  segments: { start: number; end: number }[];
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
 * Quatre sources se disputent la même sortie : le son d'origine des plans, les
 * bruitages, la musique et la voix off. Sans réglage séparé, un rush bruyant
 * couvre les bruitages qu'on vient de poser, et le seul recours serait de
 * baisser le volume de chaque plan un par un.
 */
export type MixSettings = {
  /** Son d'origine des plans, de 0 à 1. */
  clips: number;
  /** Bruitages, de 0 à 1. */
  sfx: number;
  /** Musique de fond, de 0 à 1. */
  music: number;
  /** Voix off, de 0 à 1. */
  voice: number;
  /**
   * Baisse appliquée au fond pendant que la voix parle, de 0 (aucune) à 1.
   *
   * Le geste manuel qu'elle remplace — descendre la musique sur chaque réplique
   * puis la remonter — est le plus fastidieux du montage sonore, et celui qu'on
   * refait entièrement dès qu'une réplique se décale.
   */
  ducking: number;
};

/**
 * Équilibre de départ.
 *
 * Les bruitages passent devant : leur fonction est de marquer une coupe ou un
 * impact, ce qu'ils ne peuvent pas faire au même niveau que le fond sonore.
 *
 * La voix passe devant tout le reste, et à plein niveau : dès qu'un mot se
 * devine au lieu de s'entendre, plus rien d'autre dans le montage n'a
 * d'importance.
 */
export const DEFAULT_MIX: MixSettings = { clips: 0.75, sfx: 1, music: 0.6, voice: 1, ducking: 0.7 };

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
  samples: SampleCue[];
  voices: VoiceCue[];
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
