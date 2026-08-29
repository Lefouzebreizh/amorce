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
  /*
   * `video/mp4` sans précision de codec reste, alors que son équivalent audio
   * est écarté plus bas. L'asymétrie est délibérée et elle a été mesurée.
   *
   * Ce que fait cette ligne : là où le H.264 manque, le navigateur accepte
   * quand même ce type et y place du VP9 avec de l'Opus. `ffprobe` sur un
   * export réel : `codec_name=vp9`, `codec_name=opus`, conteneur `.mp4`. Une
   * extension qui promet du H.264 avec un contenu qui n'en est pas.
   *
   * La retirer paraît donc évident — c'est exactement le raisonnement du
   * commentaire audio. Éprouvé : le parcours complet passe de 91 à 87, et les
   * trois contrôles perdus disent pourquoi. `MediaRecorder` **n'écrit aucune
   * durée dans un WebM** : `ffprobe` rend `duration=N/A`, un `<video>` rend
   * `Infinity`, et de là tout s'effondre — dimensions à 0 × 0, image noire.
   * Le `.mp4` mal nommé, lui, porte ses 31,4 s.
   *
   * Le repli WebM est donc pire que le défaut qu'il corrige : un fichier dont
   * personne ne connaît la durée ne s'ouvre nulle part, quand un VP9 en `.mp4`
   * se lit et se reconvertit. Sur un vrai téléphone la question ne se pose pas
   * — le H.264 de la ligne précédente gagne.
   *
   * La vraie sortie demande d'écrire la durée dans l'en-tête, donc un
   * multiplexeur à nous : c'est le chantier WebCodecs, pas une ligne de liste.
   */
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

/**
 * Débit vidéo, en bits par pixel et par image.
 *
 * Il valait 12 Mb/s, en dur, quelle que soit la définition demandée — donc
 * autant pour un export en 720 que pour un 1080, alors qu'il y a deux fois
 * moins de pixels à décrire. Sur un téléphone qui encode réellement à trente
 * images par seconde, une vidéo de trente secondes pesait quarante-cinq
 * mégaoctets : trop lourde à envoyer sur un réseau mobile, et rejetée par
 * l'application photo comme un fichier anormal.
 *
 * 0,075 bit par pixel et par image donne environ 4,7 Mb/s en 1080 × 1920 à
 * trente images par seconde — soit douze mégaoctets pour vingt secondes. C'est
 * le débit autour duquel TikTok, Reels et Shorts réencodent de toute façon :
 * au-dessus, on paie du poids que personne ne garde.
 *
 * Le poids n'est pas qu'une question de plateforme. Un fichier de trente
 * mégaoctets ne s'envoie pas depuis un téléphone en réseau mobile : il est
 * refusé par la plupart des messageries, et il fait renoncer avant même
 * d'arriver à la publication.
 */
const BITS_PAR_PIXEL = 0.075;
const AUDIO_BITRATE = 192_000;

/**
 * Débit vidéo pour une définition donnée, jamais sous un plancher lisible.
 *
 * Le plancher valait 2 Mb/s. Il écrasait les petites définitions : en 540 × 960
 * le calcul demande 1,2 Mb/s, le plancher le remontait à 2, et le préréglage
 * de partage ne pesait plus que deux dixièmes de mégaoctet de moins que le 720.
 * Un choix qui ne change rien n'est pas un choix.
 *
 * 1 Mb/s suffit à tenir une définition réduite sans blocs visibles ; en dessous,
 * les aplats se cassent en carrés dès qu'une image bouge.
 */
export function debitVideo(largeur: number, hauteur: number, images: number): number {
  return Math.max(1_000_000, Math.round(largeur * hauteur * images * BITS_PAR_PIXEL));
}

/**
 * Relit le fichier produit et compte ses cadres vides.
 *
 * Un export peut être parfaitement conforme et à moitié vide : la durée est
 * bonne, la définition est bonne, le son est là, et l'image ne montre rien.
 * C'est arrivé — dix-sept cadres vides sur vingt-sept dans un film livré, le
 * plan n'étant pas encore décodé au moment où l'enregistrement passait dessus.
 * L'utilisateur l'a découvert en le regardant, après l'avoir exporté et envoyé.
 *
 * Un cadre vide n'est pas un cadre noir : l'étalonnage peut l'avoir teinté. Ce
 * qui le distingue est l'absence de **relief** — l'écart-type des luminances
 * d'une image qui contient quelque chose ne descend pas sous une dizaine.
 *
 * On échantillonne huit instants, pas plus : le but est de dire « ce fichier
 * est vide » avant que quelqu'un ne le publie, pas de noter sa qualité. Un
 * échec de relecture ne bloque rien — mieux vaut livrer sans avoir pu vérifier
 * que refuser un fichier peut-être bon.
 */
export async function relireLExport(blob: Blob): Promise<{ vides: number; total: number } | null> {
  if (typeof document === 'undefined') return null;

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('illisible'));
      setTimeout(() => reject(new Error('trop long')), 15_000);
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 114;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const total = 8;
    let vides = 0;
    for (let k = 0; k < total; k += 1) {
      // Ni la toute première image ni la dernière : l'une peut précéder le
      // premier plan, l'autre suivre la dernière, et toutes deux sont noires
      // à dessein.
      video.currentTime = video.duration * ((k + 0.5) / total);
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        setTimeout(resolve, 2_000);
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let somme = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) somme += (data[i] + data[i + 1] + data[i + 2]) / 3;
      const moyenne = somme / n;
      let ecart = 0;
      for (let i = 0; i < data.length; i += 4) {
        ecart += ((data[i] + data[i + 1] + data[i + 2]) / 3 - moyenne) ** 2;
      }
      if (Math.sqrt(ecart / n) < 8) vides += 1;
    }
    return { vides, total };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
    ...(audioOnly
      ? {}
      : {
          videoBitsPerSecond: debitVideo(
            params.canvas.width,
            params.canvas.height,
            OUTPUT_FPS,
          ),
        }),
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
