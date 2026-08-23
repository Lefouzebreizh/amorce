'use client';

import type { AudioEngine } from './audio.ts';
import { OUTPUT_FPS } from './types.ts';

/**
 * Export du montage.
 *
 * L'enregistrement se fait en temps réel, en filmant le canvas de
 * prévisualisation pendant qu'il joue. C'est plus lent qu'un rendu hors ligne —
 * trente secondes de vidéo prennent trente secondes — mais cela supprime toute
 * possibilité d'écart entre ce que l'utilisateur a validé à l'écran et ce qu'il
 * récupère dans son fichier : c'est littéralement la même image.
 */

export type ExportFormat = {
  mimeType: string;
  extension: string;
  /** Nom du format, tel qu'affiché à l'utilisateur. */
  label: string;
};

/** Formats testés par ordre de préférence. */
const CANDIDATES: ExportFormat[] = [
  // MP4 en premier : c'est le seul format que toutes les plateformes acceptent
  // sans reconversion. Les navigateurs récents savent l'enregistrer directement.
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/mp4', extension: 'mp4', label: 'MP4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm', label: 'WebM (VP9)' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm', label: 'WebM (VP8)' },
  { mimeType: 'video/webm', extension: 'webm', label: 'WebM' },
];

/**
 * Formats audio seuls, pour récupérer la bande-son sans l'image.
 *
 * `audio/mp4` sans précision de codec est volontairement absent : le navigateur
 * y place alors de l'Opus, et le fichier se retrouve nommé `.m4a` — une
 * extension qui promet de l'AAC — avec un contenu que la plupart des lecteurs
 * refusent d'ouvrir. Mieux vaut un `.webm` honnête qu'un `.m4a` trompeur.
 */
const AUDIO_CANDIDATES: ExportFormat[] = [
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a', label: 'M4A (AAC)' },
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm', label: 'WebM (Opus)' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg', label: 'OGG (Opus)' },
  { mimeType: 'audio/webm', extension: 'webm', label: 'WebM' },
];

/** Meilleur format disponible sur ce navigateur. */
export function pickFormat(audioOnly = false): ExportFormat | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = audioOnly ? AUDIO_CANDIDATES : CANDIDATES;
  return list.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
}

export type ExportResult = {
  blob: Blob;
  format: ExportFormat;
};

export type RecordParams = {
  canvas: HTMLCanvasElement;
  audio: AudioEngine;
  /** Durée du montage, en secondes. */
  duration: number;
  /** Démarre la lecture depuis le début. */
  startPlayback: () => void;
  /** Interrompt la lecture. */
  stopPlayback: () => void;
  /** Position courante de la tête de lecture. */
  currentTime: () => number;
  /** Vrai tant que la lecture est en cours. */
  isPlaying: () => boolean;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
  /**
   * N'enregistre que la bande-son.
   *
   * Le mixage des trois sources est déjà fait dans le graphe audio : il suffit
   * de ne pas joindre la piste vidéo pour en récupérer le résultat seul.
   */
  audioOnly?: boolean;
};

/** Débit vidéo. Généreux : le grain et les dégradés sont coûteux à encoder. */
const VIDEO_BITRATE = 12_000_000;
const AUDIO_BITRATE = 192_000;

/** Marge laissée après la dernière image pour qu'elle soit bien enregistrée. */
const TAIL_MS = 400;

/** Enregistre le montage et renvoie le fichier obtenu. */
export async function recordMontage(params: RecordParams): Promise<ExportResult> {
  const audioOnly = params.audioOnly === true;
  const format = pickFormat(audioOnly);
  if (!format) {
    throw new Error(
      'Ce navigateur ne sait pas enregistrer ce format. Passe par Chrome, Edge ou Firefox à jour.',
    );
  }
  if (params.duration <= 0) throw new Error('Il n’y a rien à exporter : la timeline est vide.');

  // Le canvas continue de tourner pendant un export audio : c'est lui qui fait
  // avancer la lecture, donc le son. Seule sa piste n'est pas jointe au flux.
  const videoStream = params.canvas.captureStream(OUTPUT_FPS);
  const stream = new MediaStream([
    ...(audioOnly ? [] : videoStream.getVideoTracks()),
    ...params.audio.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    ...(audioOnly ? {} : { videoBitsPerSecond: VIDEO_BITRATE }),
    audioBitsPerSecond: AUDIO_BITRATE,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: format.mimeType }));
    recorder.onerror = () => reject(new Error('L’enregistrement s’est interrompu.'));
  });

  params.startPlayback();

  try {
    // La lecture ne démarre pas instantanément : elle attend la reprise du
    // contexte audio, qui est asynchrone. Enregistrer avant cet instant
    // graverait une image figée en tête du fichier.
    await waitForStart(params);

    // Des tranches régulières évitent de garder tout le fichier dans un seul
    // bloc mémoire, ce qui poserait problème sur les montages longs.
    recorder.start(1000);
    await waitForEnd(params);
    // On laisse la dernière image traverser la chaîne d'encodage avant de couper.
    await delay(TAIL_MS);
  } finally {
    params.stopPlayback();
    if (recorder.state !== 'inactive') recorder.stop();
    for (const track of videoStream.getVideoTracks()) track.stop();
  }

  const blob = await finished;
  if (blob.size === 0) throw new Error('Le fichier produit est vide. Relance l’export.');

  return { blob, format };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Délai au-delà duquel on considère que la lecture ne démarrera pas. */
const START_TIMEOUT_MS = 5000;

/** Attend que la lecture ait réellement commencé. */
function waitForStart(params: RecordParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();

    const tick = () => {
      if (params.signal?.aborted) {
        reject(new DOMException('Export annulé', 'AbortError'));
        return;
      }
      // On se contente d'un démarrage constaté, ou d'un délai dépassé : mieux
      // vaut un fichier avec quelques images de trop que pas de fichier du tout.
      if (params.isPlaying() || performance.now() - startedAt > START_TIMEOUT_MS) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

/** Attend la fin de la lecture, en rendant compte de l'avancement. */
function waitForEnd(params: RecordParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (params.signal?.aborted) {
        reject(new DOMException('Export annulé', 'AbortError'));
        return;
      }

      const time = params.currentTime();
      params.onProgress?.(Math.min(1, time / params.duration));

      // La lecture est déjà confirmée démarrée : son arrêt signifie donc la fin
      // du montage, ou une interruption. Dans les deux cas, il faut couper.
      if (time >= params.duration - 0.02 || !params.isPlaying()) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

/** Déclenche le téléchargement du fichier produit. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // La libération immédiate annulerait le téléchargement dans certains
  // navigateurs, qui lisent l'URL après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Nom de fichier sûr, dérivé du nom du projet. */
export function safeFilename(projectName: string, extension: string): string {
  const base = projectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'amorce'}.${extension}`;
}
