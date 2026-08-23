'use client';

import { uid } from './id';
import type { MediaAsset, MusicTrack } from './types';

/**
 * Import de fichiers depuis le disque.
 *
 * Tout reste local : on crée une URL objet sur le fichier et on lit ses
 * métadonnées avec un élément <video> hors écran. Aucun octet ne part sur le
 * réseau, ce qui évite d'avoir à héberger — et à payer — le stockage des rushes.
 */

/** Attend un évènement du média, ou échoue au bout du délai imparti. */
function waitFor(el: HTMLMediaElement, event: string, timeoutMs = 45000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      el.removeEventListener(event, onDone);
      el.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Lecture impossible : format non pris en charge par le navigateur.`));
    };
    const timer = setTimeout(() => {
      cleanup();
      // Généreux à dessein : décoder une vidéo de plusieurs mégaoctets sur un
      // téléphone modeste prend bien plus longtemps que sur un ordinateur, et
      // abandonner trop tôt ferait passer un fichier parfaitement valide pour
      // illisible.
      reject(new Error('Le fichier met trop de temps à se charger.'));
    }, timeoutMs);

    el.addEventListener(event, onDone, { once: true });
    el.addEventListener('error', onError, { once: true });
  });
}

/** Détecte la présence d'une piste audio, avec repli optimiste. */
function detectAudio(video: HTMLVideoElement): boolean {
  const probe = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (typeof probe.mozHasAudio === 'boolean') return probe.mozHasAudio;
  if (typeof probe.webkitAudioDecodedByteCount === 'number') return probe.webkitAudioDecodedByteCount > 0;
  if (probe.audioTracks) return probe.audioTracks.length > 0;
  // Indétectable sur ce navigateur : on suppose qu'il y a du son, quitte à
  // mixer du silence. L'inverse ferait disparaître l'audio sans prévenir.
  return true;
}

/** Capture une image du média et la renvoie en data URL. */
function grabThumbnail(video: HTMLVideoElement, maxWidth = 160): string {
  const ratio = video.videoHeight / video.videoWidth || 16 / 9;
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = Math.round(maxWidth * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/** Transforme un fichier vidéo en média utilisable par le studio. */
export async function loadVideoAsset(file: File): Promise<MediaAsset> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitFor(video, 'loadedmetadata');

    // Certains encodages annoncent une durée infinie tant qu'on n'a pas cherché
    // dedans : un aller-retour force le navigateur à la calculer.
    if (!Number.isFinite(video.duration)) {
      video.currentTime = 1e101;
      await waitFor(video, 'timeupdate', 5000).catch(() => undefined);
      video.currentTime = 0;
    }

    // On évite la toute première image, souvent noire dans les rendus IA.
    const thumbAt = Math.min(Math.max(video.duration * 0.1, 0.1), Math.max(video.duration - 0.05, 0.1));
    video.currentTime = thumbAt;
    await waitFor(video, 'seeked', 25000).catch(() => undefined);

    return {
      id: uid('asset'),
      name: file.name,
      url,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
      thumbnail: grabThumbnail(video),
      hasAudio: detectAudio(video),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Importe un fichier audio comme musique de fond. */
export async function loadMusicTrack(file: File): Promise<MusicTrack> {
  const url = URL.createObjectURL(file);
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.src = url;

  try {
    await waitFor(audio, 'loadedmetadata');
    return {
      name: file.name,
      url,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      gain: 0.35,
      offset: 0,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Formate une durée en `m:ss` pour l'affichage. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}
