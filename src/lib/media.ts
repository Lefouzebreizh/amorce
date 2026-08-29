'use client';

import { uid } from './id';
import { analyseVoice } from './voice';
import { COTE, empreinte } from './ressemblance';
import { IMAGE_DURATION } from './types';
import type { MediaAsset, MusicTrack, SampleCue, VoiceCue } from './types';

/**
 * Import de fichiers depuis le disque.
 *
 * Tout reste local : on crée une URL objet sur le fichier et on lit ses
 * métadonnées avec un élément <video> hors écran. Aucun octet ne part sur le
 * réseau, ce qui évite d'avoir à héberger — et à payer — le stockage des rushes.
 */

/** Attend un évènement du média, ou échoue au bout du délai imparti. */
function waitFor(
  el: HTMLMediaElement | HTMLImageElement,
  event: string,
  timeoutMs = 45000,
): Promise<void> {
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

/**
 * Détecte la présence d'une piste audio.
 *
 * Aucun navigateur ne l'expose de la même façon, et la plupart ne répondent
 * qu'après avoir commencé à décoder — ce qui n'a pas encore eu lieu à l'import.
 * On ne conclut donc à l'absence de son que sur une réponse franche : un
 * compteur d'octets décodés encore à zéro ne prouve rien.
 *
 * Le doute profite au son. Se tromper dans ce sens fait au pire mixer du
 * silence ; se tromper dans l'autre couperait une voix off sans le signaler.
 */
function detectAudio(video: HTMLVideoElement): boolean {
  const probe = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };

  if (typeof probe.mozHasAudio === 'boolean') return probe.mozHasAudio;
  if (probe.audioTracks) return probe.audioTracks.length > 0;
  if ((probe.webkitAudioDecodedByteCount ?? 0) > 0) return true;
  return true;
}

/** Capture une image du média et la renvoie en data URL. */
/**
 * Vignette et empreinte, du même canevas.
 *
 * L'empreinte sort du dessin qui existe déjà : aucun décodage de plus, aucune
 * seconde de plus à l'import. C'est ce qui permet de la calculer sur un
 * téléphone sans que personne ne s'en aperçoive.
 */
function grabThumbnail(source: HTMLVideoElement | HTMLImageElement, maxWidth = 160): {
  thumbnail: string;
  empreinte: string;
} {
  const [sw, sh] =
    source instanceof HTMLVideoElement
      ? [source.videoWidth, source.videoHeight]
      : [source.naturalWidth, source.naturalHeight];
  const ratio = sh / sw || 16 / 9;
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = Math.round(maxWidth * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { thumbnail: '', empreinte: '' };
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  // Huit sur huit en gris, tirés du même dessin.
  let signature = '';
  try {
    const petit = document.createElement('canvas');
    petit.width = COTE;
    petit.height = COTE;
    const pctx = petit.getContext('2d');
    if (pctx) {
      pctx.drawImage(canvas, 0, 0, COTE, COTE);
      const pixels = pctx.getImageData(0, 0, COTE, COTE).data;
      const gris: number[] = [];
      for (let i = 0; i < pixels.length; i += 4) {
        gris.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
      }
      signature = empreinte(gris);
    }
  } catch {
    // Un canevas teinté par une source d'une autre origine lève à la lecture
    // des pixels. Le studio continue sans empreinte plutôt que de s'arrêter.
  }

  return { thumbnail: canvas.toDataURL('image/jpeg', 0.7), empreinte: signature };
}

/**
 * Explique pourquoi un fichier audio n'a pas pu être lu.
 *
 * « Fichier illisible » n'aide personne : la cause est presque toujours l'une de
 * deux, et elles appellent des gestes opposés. Un fichier vide vient d'un
 * espace de stockage en ligne que le sélecteur a rendu sans l'avoir téléchargé —
 * le fichier est bon, c'est la copie qui manque. Un format non pris en charge
 * demande au contraire de réexporter. Confondre les deux fait perdre un
 * quart d'heure à chaque fois.
 */
function audioFailure(file: File): Error {
  if (file.size === 0) {
    return new Error(
      `« ${file.name} » est arrivé vide. C’est le cas quand le fichier est encore dans le nuage : ouvre-le une fois depuis ton gestionnaire de fichiers pour le télécharger sur l’appareil, puis réessaie.`,
    );
  }

  // `canPlayType` ne répond que sur le type déclaré, jamais sur le contenu :
  // une réponse vide est un verdict, une réponse quelconque ne prouve rien.
  if (file.type && document.createElement('audio').canPlayType(file.type) === '') {
    return new Error(`Ce navigateur ne sait pas décoder le format ${file.type}. Réexporte en MP3 ou en WAV.`);
  }

  const size = file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} Ko` : `${(file.size / 1024 / 1024).toFixed(1)} Mo`;
  return new Error(`« ${file.name} » n’a pas pu être décodé (${size}, ${file.type || 'type inconnu'}).`);
}

/** Transforme un fichier vidéo en média utilisable par le studio. */
export async function loadVideoAsset(file: File): Promise<MediaAsset> {
  /*
   * Le fichier vide se dit avant toute tentative de décodage.
   *
   * Le chemin audio le faisait déjà ; celui des rushes laissait le décodeur
   * échouer et rendait « format non pris en charge », ce qui envoie chercher un
   * autre encodage alors que le fichier est bon — c'est la copie qui manque.
   * Sur Android, un rush choisi depuis un stockage en ligne arrive à zéro octet
   * tant qu'il n'a pas été téléchargé sur l'appareil.
   */
  if (file.size === 0) {
    throw new Error(
      `« ${file.name} » est arrivé vide. C’est le cas quand le fichier est encore dans le nuage : ouvre-le une fois depuis ton gestionnaire de fichiers pour le télécharger sur l’appareil, puis réessaie.`,
    );
  }

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
      kind: 'video',
      url,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
      ...grabThumbnail(video),
      hasAudio: detectAudio(video),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Transforme une image fixe en média utilisable par le studio.
 *
 * C'est le chemin des illustrations, des pages, des captures — tout ce qui
 * existe déjà et qui n'a jamais été filmé. Sans lui, une chaîne dont la
 * matière première est dessinée ne peut pas faire sa première vidéo, et
 * l'échec se présente sous la forme d'un fichier « refusé » qui envoie
 * chercher un problème d'encodage inexistant.
 *
 * Aucune durée n'est mesurée : une image n'en a pas. On lui accorde
 * `IMAGE_DURATION`, que la timeline pourra raccourcir à volonté.
 */
export async function loadImageAsset(file: File): Promise<MediaAsset> {
  // Même piège qu'aux rushes : sur Android, un fichier encore dans le nuage
  // arrive à zéro octet, et « format non pris en charge » enverrait réexporter
  // une image parfaitement valide.
  if (file.size === 0) {
    throw new Error(
      `« ${file.name} » est arrivé vide. C’est le cas quand le fichier est encore dans le nuage : ouvre-le une fois depuis ton gestionnaire de fichiers pour le télécharger sur l’appareil, puis réessaie.`,
    );
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  // Le tracé sur canvas d'une image d'origine étrangère souillerait le
  // contexte et rendrait l'export impossible. Les URL objet sont de même
  // origine, mais l'attribut est posé avant `src`, comme pour les rushes.
  image.crossOrigin = 'anonymous';
  image.src = url;

  try {
    await waitFor(image, 'load');

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error(`« ${file.name} » n’a pas pu être décodé comme image.`);
    }

    return {
      id: uid('asset'),
      name: file.name,
      kind: 'image',
      url,
      duration: IMAGE_DURATION,
      width: image.naturalWidth,
      height: image.naturalHeight,
      ...grabThumbnail(image),
      // Une image n'a pas de son. Le dire franchement évite que le graphe
      // audio tente de brancher une source sur un élément qui n'en est pas un.
      hasAudio: false,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Importe un fichier de la bibliothèque, quel qu'il soit.
 *
 * Le type MIME décide, et lui seul : c'est la seule information disponible
 * avant d'avoir tenté un décodage, et se tromper de décodeur produit un
 * message d'erreur qui désigne la mauvaise cause.
 */
export function loadAsset(file: File): Promise<MediaAsset> {
  return file.type.startsWith('image/') ? loadImageAsset(file) : loadVideoAsset(file);
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
  } catch {
    URL.revokeObjectURL(url);
    throw audioFailure(file);
  }
}

/**
 * Importe un fichier audio comme réplique de voix off.
 *
 * L'analyse du signal a lieu ici, une fois pour toutes : c'est le seul moment
 * où l'on peut se permettre de décoder le fichier entier, et le résultat sert
 * ensuite à chaque calage sans jamais y revenir.
 *
 * Un fichier illisible n'est pas fatal — on le pose sans segments plutôt que de
 * rejeter l'import. La réplique s'entend, seul le calage automatique manque, et
 * c'est bien plus utile qu'un message d'erreur devant un fichier qui, lui,
 * s'entend parfaitement.
 */
export async function loadVoiceCue(file: File, context: BaseAudioContext, start = 0): Promise<VoiceCue> {
  const url = URL.createObjectURL(file);

  try {
    const { duration, segments } = await analyseVoice(context, url);
    return { id: uid('voix'), name: file.name, url, duration, start, gain: 1, script: '', segments };
  } catch {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    try {
      await waitFor(audio, 'loadedmetadata');
    } catch {
      URL.revokeObjectURL(url);
      throw audioFailure(file);
    }
    return {
      id: uid('voix'),
      name: file.name,
      url,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      start,
      gain: 1,
      script: '',
      segments: [],
    };
  }
}

/**
 * Importe un fichier audio comme bruitage posé sur la timeline.
 *
 * Aucune analyse du signal, contrairement à une réplique de voix : on ne cale
 * rien dessus, il n'y a que sa durée à connaître pour savoir quand il s'arrête.
 */
export async function loadSampleCue(file: File, start = 0): Promise<SampleCue> {
  const url = URL.createObjectURL(file);
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.src = url;

  try {
    await waitFor(audio, 'loadedmetadata');
    return {
      id: uid('bruitage'),
      name: file.name,
      url,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      start,
      gain: 0.9,
    };
  } catch {
    URL.revokeObjectURL(url);
    throw audioFailure(file);
  }
}

/** Formate une durée en `m:ss` pour l'affichage. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}
