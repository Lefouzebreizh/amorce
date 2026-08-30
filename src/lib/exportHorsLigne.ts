/**
 * Encodage hors ligne du film, image par image.
 *
 * ## Pourquoi ce module existe
 *
 * L'export historique filme le canvas **pendant que l'aperçu joue** :
 * `captureStream` prend ce qui passe, `MediaRecorder` enregistre. Le fichier ne
 * reçoit donc que les images que l'appareil a eu le temps de composer, et une
 * seule image manquée ne se rattrape jamais.
 *
 * Mesuré sur un export livré par l'utilisateur : **222 images pour 17,5 s**,
 * soit 12,7 par seconde au lieu de 30, avec un écart montant à 517 ms — une
 * demi-seconde figée sur une seule image. Il l'a décrit comme un tremblement et
 * a cherché du côté de l'entrelacement ; les deux fichiers étaient pourtant
 * `progressive`. Ce ne sont pas des images mal encodées, ce sont des images
 * **absentes**.
 *
 * Ici, rien ne court après l'horloge. On compose l'image *n*, on l'encode, on
 * passe à la suivante. Un appareil lent met plus longtemps ; il ne perd rien.
 * C'est la seule façon de tenir la cadence promise sur un téléphone.
 *
 * ## Ce qui avait fait renoncer, et qui était faux
 *
 * Le dépôt tenait que piloter les rushes image par image coûtait **265 ms par
 * déplacement**, soit 2 min 40 pour vingt secondes de film. Remesuré sur un
 * conteneur sans carte graphique :
 *
 * - déplacement séquentiel d'un trentième de seconde : **7,3 ms**
 * - déplacement puis composition en 1080 × 1920 : **25,7 ms**
 * - vingt secondes de film, six cents images : **15,4 s**
 *
 * Plus rapide que le temps réel, sans accélération matérielle. Le renoncement
 * reposait sur un chiffre trente-cinq fois trop grand.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne sait pas ce qu'est un plan, un sous-titre ni un étalonnage. Il reçoit
 * une fonction `composer(temps)` qui remplit le canvas, et un `AudioBuffer`
 * déjà mixé. C'est ce qui le rend éprouvable sans studio : les tests lui
 * donnent un damier et un sinus.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

/** Codecs vidéo tentés, du plus capable au plus modeste. */
const CODECS_VIDEO = [
  /*
   * H.264 High niveau 4.0 en tête.
   *
   * L'export historique demandait `avc1.42E01E` — Baseline, **niveau 3.0**, qui
   * plafonne à 720p — pour une composition en 1080 × 1920. Le Baseline n'a en
   * outre ni CABAC ni images bidirectionnelles : à débit égal il rend nettement
   * moins bien. Relevé sur un fichier livré : `profile=Baseline`, 2,35 Mb/s,
   * quand la source de l'utilisateur était en `High` à 9,6 Mb/s.
   */
  { codec: 'avc1.640028', piste: 'avc' as const, nom: 'H.264 High' },
  { codec: 'avc1.4D4028', piste: 'avc' as const, nom: 'H.264 Main' },
  { codec: 'avc1.42E01E', piste: 'avc' as const, nom: 'H.264 Baseline' },
  /*
   * VP9 ferme la marche, et ce n'est pas un repli théorique.
   *
   * Un Chromium bâti sans codecs propriétaires — celui de la vérification, et
   * plus généralement toute construction libre — refuse **toutes** les chaînes
   * `avc1`, à l'encodage comme au décodage. Sondé : `avc1.640028` non,
   * `avc1.42E01E` non, `vp09.00.10.08` oui.
   *
   * Le VP9 se range parfaitement dans un conteneur MP4, et c'est déjà ce que
   * l'ancien export produisait sans le dire lorsqu'il retombait sur le type
   * `video/mp4` nu. La différence est qu'ici le fichier est correctement
   * décrit : le multiplexeur écrit la vraie durée dans l'entête, là où
   * `MediaRecorder` n'en écrivait aucune.
   */
  { codec: 'vp09.00.10.08', piste: 'vp9' as const, nom: 'VP9' },
];

/** Codecs sonores tentés, dans l'ordre. */
const CODECS_AUDIO = [
  { codec: 'mp4a.40.2', piste: 'aac' as const, nom: 'AAC' },
  { codec: 'opus', piste: 'opus' as const, nom: 'Opus' },
];

export type ChoixCodec = { codec: string; piste: 'avc' | 'vp9'; nom: string };
export type ChoixCodecAudio = { codec: string; piste: 'aac' | 'opus'; nom: string };

/** Vrai si le navigateur sait encoder hors ligne. */
export function encodageHorsLigneDisponible(): boolean {
  return (
    typeof VideoEncoder !== 'undefined'
    && typeof VideoFrame !== 'undefined'
    && typeof AudioEncoder !== 'undefined'
    && typeof AudioData !== 'undefined'
  );
}

/**
 * Premier codec vidéo que le navigateur accepte à cette définition.
 *
 * On interroge par définition réelle, jamais par nom de navigateur : le même
 * Chrome accepte le H.264 sur un téléphone et le refuse dans une construction
 * libre, et rien dans la chaîne d'agent utilisateur ne le dit.
 */
export async function choisirCodecVideo(
  largeur: number,
  hauteur: number,
  images: number,
  debit: number,
): Promise<ChoixCodec | null> {
  if (typeof VideoEncoder === 'undefined') return null;

  for (const candidat of CODECS_VIDEO) {
    for (const acceleration of ['prefer-hardware', 'no-preference'] as const) {
      try {
        const verdict = await VideoEncoder.isConfigSupported({
          codec: candidat.codec,
          width: largeur,
          height: hauteur,
          bitrate: debit,
          framerate: images,
          hardwareAcceleration: acceleration,
        });
        if (verdict.supported) return candidat;
      } catch {
        // Une configuration refusée lève au lieu de rendre `supported: false`
        // selon les navigateurs : les deux cas veulent dire la même chose.
      }
    }
  }
  return null;
}

/** Premier codec sonore que le navigateur accepte. */
export async function choisirCodecAudio(
  canaux: number,
  frequence: number,
): Promise<ChoixCodecAudio | null> {
  if (typeof AudioEncoder === 'undefined') return null;

  for (const candidat of CODECS_AUDIO) {
    try {
      const verdict = await AudioEncoder.isConfigSupported({
        codec: candidat.codec,
        numberOfChannels: canaux,
        sampleRate: frequence,
        bitrate: 192_000,
      });
      if (verdict.supported) return candidat;
    } catch {
      // Voir ci-dessus.
    }
  }
  return null;
}

/** Nombre d'images encodées d'avance avant d'attendre l'encodeur. */
const FILE_MAX = 6;

/** Une image clé toutes les deux secondes : c'est le pas de navigation. */
const CLE_TOUTES_LES = 2;

/** Échantillons par bloc sonore remis à l'encodeur. */
const BLOC_AUDIO = 4800;

export type ParamsEncodage = {
  /** Canvas déjà à la définition de sortie. */
  canvas: HTMLCanvasElement;
  /**
   * Remplit le canvas pour l'instant demandé. Doit être terminé au retour.
   *
   * Reçoit aussi le numéro d'image : le grain et tout effet animé doivent
   * dépendre du rang, jamais d'un compteur qui court — sans quoi deux exports
   * du même montage ne donneraient pas le même fichier.
   */
  composer: (temps: number, image: number) => Promise<void>;
  /** Mixage complet, déjà rendu. `null` pour un film muet. */
  audio: AudioBuffer | null;
  duree: number;
  images: number;
  debit: number;
  onProgress?: (avancement: number) => void;
  signal?: AbortSignal;
};

export type ResultatEncodage = {
  blob: Blob;
  codec: ChoixCodec;
  codecAudio: ChoixCodecAudio | null;
  /** Images réellement écrites. Elles ne peuvent pas manquer, on les compte quand même. */
  imagesEcrites: number;
};

/**
 * Encode le film entier et rend le fichier.
 *
 * Le déroulé est volontairement séquentiel : composer, encoder, avancer. La
 * seule concurrence tolérée est la file de l'encodeur, bornée par `FILE_MAX` —
 * sans cette borne, une composition rapide remplirait la mémoire d'images non
 * encodées avant que l'encodeur n'ait rendu la première.
 */
export async function encoderFilm(params: ParamsEncodage): Promise<ResultatEncodage> {
  const { canvas, composer, audio, duree, images, debit } = params;

  if (!encodageHorsLigneDisponible()) {
    throw new Error('Ce navigateur ne sait pas encoder hors ligne.');
  }
  if (duree <= 0) throw new Error('Il n’y a rien à exporter : la timeline est vide.');

  const codec = await choisirCodecVideo(canvas.width, canvas.height, images, debit);
  if (!codec) throw new Error('Aucun codec vidéo disponible pour cette définition.');

  const codecAudio = audio
    ? await choisirCodecAudio(audio.numberOfChannels, audio.sampleRate)
    : null;

  const total = Math.max(1, Math.round(duree * images));
  const cible = new ArrayBufferTarget();

  const muxer = new Muxer({
    target: cible,
    video: {
      codec: codec.piste,
      width: canvas.width,
      height: canvas.height,
      /*
       * La cadence déclarée est ce qui manquait le plus au fichier précédent.
       * `MediaRecorder` n'écrivait aucune durée : `ffprobe` rendait
       * `duration=N/A` et un `<video>` rendait `Infinity`, d'où des dimensions
       * à zéro et une image noire dans tout ce qui relisait le fichier.
       */
      frameRate: images,
    },
    ...(codecAudio && audio
      ? {
          audio: {
            codec: codecAudio.piste,
            numberOfChannels: audio.numberOfChannels,
            sampleRate: audio.sampleRate,
          },
        }
      : {}),
    /*
     * Métadonnées en tête du fichier.
     *
     * C'est ce qui permet à une plateforme de connaître la durée sans lire
     * l'intégralité du fichier — et à l'utilisateur de voir une barre de
     * progression juste dès la première seconde de lecture.
     */
    fastStart: 'in-memory',
  });

  let imagesEcrites = 0;
  let erreurEncodeur: Error | null = null;

  const encodeur = new VideoEncoder({
    output: (morceau, meta) => {
      muxer.addVideoChunk(morceau, meta);
      imagesEcrites += 1;
    },
    error: (cause) => {
      erreurEncodeur = cause instanceof Error ? cause : new Error(String(cause));
    },
  });

  encodeur.configure({
    codec: codec.codec,
    width: canvas.width,
    height: canvas.height,
    bitrate: debit,
    framerate: images,
    /*
     * `avc: { format: 'avc' }` demande les paramètres de flux dans l'entête du
     * conteneur plutôt qu'en tête de chaque morceau. C'est ce que `mp4-muxer`
     * attend d'une piste `avc` ; sans cela le fichier sort illisible sur les
     * lecteurs stricts, y compris celui d'iOS.
     */
    ...(codec.piste === 'avc' ? { avc: { format: 'avc' as const } } : {}),
  });

  const cleToutesLes = Math.max(1, Math.round(images * CLE_TOUTES_LES));

  try {
    for (let n = 0; n < total; n += 1) {
      if (params.signal?.aborted) throw new DOMException('Export annulé', 'AbortError');
      if (erreurEncodeur) throw erreurEncodeur;

      const temps = n / images;
      await composer(temps, n);

      // Le temps est en microsecondes, et il est **calculé**, jamais relevé sur
      // une horloge : c'est ce qui donne des intervalles rigoureusement égaux.
      const image = new VideoFrame(canvas, {
        timestamp: Math.round((n * 1_000_000) / images),
        duration: Math.round(1_000_000 / images),
      });

      encodeur.encode(image, { keyFrame: n % cleToutesLes === 0 });
      image.close();

      while (encodeur.encodeQueueSize > FILE_MAX) {
        await new Promise<void>((resoudre) => {
          encodeur.addEventListener('dequeue', () => resoudre(), { once: true });
        });
      }

      // Le son est encodé après la vidéo : il est déjà rendu, il ne coûte rien
      // à attendre, et l'avancement affiché reste celui du travail réel.
      params.onProgress?.((n + 1) / total);
    }

    await encodeur.flush();
    if (erreurEncodeur) throw erreurEncodeur;

    if (audio && codecAudio) await encoderSon(muxer, audio, codecAudio);

    muxer.finalize();
  } finally {
    if (encodeur.state !== 'closed') encodeur.close();
  }

  return {
    blob: new Blob([cible.buffer], { type: 'video/mp4' }),
    codec,
    codecAudio,
    imagesEcrites,
  };
}

/**
 * Encode le mixage déjà rendu et le remet au multiplexeur.
 *
 * Le mixage arrive en `AudioBuffer` : des canaux séparés, en virgule flottante.
 * `AudioData` accepte exactement cette forme sous `f32-planar`, à condition que
 * les canaux se suivent dans un seul tableau — d'où la recopie.
 */
async function encoderSon(
  muxer: Muxer<ArrayBufferTarget>,
  audio: AudioBuffer,
  choix: ChoixCodecAudio,
): Promise<void> {
  let erreur: Error | null = null;

  const encodeur = new AudioEncoder({
    output: (morceau, meta) => muxer.addAudioChunk(morceau, meta),
    error: (cause) => {
      erreur = cause instanceof Error ? cause : new Error(String(cause));
    },
  });

  encodeur.configure({
    codec: choix.codec,
    numberOfChannels: audio.numberOfChannels,
    sampleRate: audio.sampleRate,
    bitrate: 192_000,
  });

  const canaux = audio.numberOfChannels;
  const pistes = Array.from({ length: canaux }, (_, c) => audio.getChannelData(c));

  for (let debut = 0; debut < audio.length; debut += BLOC_AUDIO) {
    if (erreur) break;
    const taille = Math.min(BLOC_AUDIO, audio.length - debut);
    const donnees = new Float32Array(taille * canaux);
    for (let c = 0; c < canaux; c += 1) {
      donnees.set(pistes[c].subarray(debut, debut + taille), c * taille);
    }

    const bloc = new AudioData({
      format: 'f32-planar',
      sampleRate: audio.sampleRate,
      numberOfFrames: taille,
      numberOfChannels: canaux,
      timestamp: Math.round((debut / audio.sampleRate) * 1_000_000),
      data: donnees,
    });
    encodeur.encode(bloc);
    bloc.close();
  }

  await encodeur.flush();
  if (encodeur.state !== 'closed') encodeur.close();
  if (erreur) throw erreur;
}
