import { type Cadrage, type Visee, trajectoire } from './cadrage.ts';

/**
 * Trouver le sujet dans un rush, pour savoir où cadrer.
 *
 * Ce module est le seul d'Amorce qui charge un modèle. Il est **facultatif de
 * bout en bout** : rien ne l'importe au démarrage, il se charge à la demande, et
 * un rush sans trajectoire se rend exactement comme avant — au milieu.
 *
 * ## Ce qu'il télécharge, et ce que ça coûte
 *
 * MediaPipe BlazeFace, servi par Amorce elle-même depuis `/mediapipe/` :
 * **3,6 Mo au premier usage** sur le réseau (11,89 Mo une fois décompressés),
 * mis en cache ensuite. Aucun CDN, donc rien qui révèle à un tiers qu'on ouvre
 * le studio, et l'application marche hors ligne une fois les fichiers là.
 * `scripts/assembler-mediapipe.mjs` les pose ; ils ne sont pas versionnés.
 *
 * ## Ce que ce module ne sait pas encore faire
 *
 * **Choisir entre deux visages quand il n'a pas d'histoire.** La règle « le plus
 * grand » est fausse et c'est mesuré : sur une planche tirée d'un vrai rush, le
 * cadrage a suivi un visage d'arrière-plan plus grand que celui du sujet qui
 * parlait. Le plus grand visage n'est pas le sujet ; **celui qui parle l'est**,
 * et le savoir demande l'activité de la bouche croisée avec l'énergie du son —
 * ce que ce lot ne fait pas.
 *
 * Ce qui est fait ici est la moitié qui ne demande rien : **la continuité**.
 * Une fois un sujet choisi, on le garde tant qu'il est là, au lieu de sauter au
 * plus gros visage à chaque image. Ça ne répare pas le premier choix d'un plan,
 * ça l'empêche de changer d'avis en cours de route.
 */

/** Une boîte rendue par le détecteur, en pixels de l'image analysée. */
export type Boite = { x: number; y: number; largeur: number; hauteur: number };

/**
 * Au-delà de ce rapport de surface, un visage plus grand reprend la main.
 *
 * Sans ce garde-fou, la continuité deviendrait de l'entêtement : quelqu'un qui
 * entre au premier plan pendant qu'un figurant reste au fond ne serait jamais
 * suivi. Avec, il faut être franchement plus proche de la caméra — le double de
 * surface — pour déloger le sujet en cours.
 */
export const DOMINANCE = 2;

/**
 * Le centre du sujet, parmi les visages vus sur une image.
 *
 * `precedent` est le centre retenu à l'échantillon d'avant, s'il y en avait un.
 * Rend `null` quand il n'y a aucun visage : l'appelant n'ajoute alors pas de
 * visée, et le trépied garde ce qu'il tenait.
 */
export function centreDuSujet(boites: Boite[], precedent?: number): number | null {
  if (boites.length === 0) return null;

  const centre = (b: Boite) => b.x + b.largeur / 2;
  const surface = (b: Boite) => b.largeur * b.hauteur;
  const plusGrande = boites.reduce((a, b) => (surface(b) > surface(a) ? b : a));

  if (precedent === undefined) return centre(plusGrande);

  const plusProche = boites.reduce((a, b) =>
    Math.abs(centre(b) - precedent) < Math.abs(centre(a) - precedent) ? b : a);

  if (plusProche === plusGrande) return centre(plusGrande);
  return surface(plusGrande) >= surface(plusProche) * DOMINANCE
    ? centre(plusGrande)
    : centre(plusProche);
}

/**
 * Change les visages relevés image par image en trajectoire prête à rendre.
 *
 * Les boîtes arrivent dans l'espace de l'image analysée, qui est réduite pour
 * aller vite ; `echelle` les ramène aux pixels de la source. Faire porter la
 * conversion ici plutôt qu'au détecteur garde ce dernier ignorant du rush.
 */
export function cadrageDepuisBoites(
  parEchantillon: Boite[][],
  options: {
    largeurSource: number;
    hauteurSource: number;
    /** Échantillons par seconde. */
    parSeconde: number;
    /** Facteur pour passer de l'image analysée à la source. */
    echelle: number;
    coupes?: number[];
  },
): Cadrage {
  const visees: Visee[] = [];
  let precedent: number | undefined;

  for (let i = 0; i < parEchantillon.length; i++) {
    const centre = centreDuSujet(parEchantillon[i], precedent);
    if (centre === null) continue;
    precedent = centre;
    visees.push({ image: i, centre: centre * options.echelle });
  }

  return {
    parSeconde: options.parSeconde,
    centres: trajectoire(visees, {
      largeurSource: options.largeurSource,
      hauteurSource: options.hauteurSource,
      images: parEchantillon.length,
      coupes: options.coupes,
    }),
  };
}

/** Taille de l'image donnée au détecteur. Plus petit, il rate ; plus grand, il traîne. */
const LARGEUR_ANALYSE = 480;

/** Échantillons par seconde. Le trépied lisse entre deux, inutile d'en faire plus. */
export const PAR_SECONDE = 10;

type Detecteur = {
  detectForVideo: (
    image: HTMLVideoElement | HTMLCanvasElement,
    horodatage: number,
  ) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] };
  close: () => void;
};

let enCours: Promise<Detecteur> | null = null;

/**
 * Charge le détecteur, une seule fois par onglet.
 *
 * L'import est dynamique à dessein : sans lui, le paquet entrerait dans le lot
 * principal du studio et tout le monde le paierait, y compris ceux qui ne
 * montent que des rushes verticaux — c'est-à-dire la majorité.
 */
async function detecteur(): Promise<Detecteur> {
  if (!enCours) {
    enCours = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fichiers = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      return (await FaceDetector.createFromOptions(fichiers, {
        baseOptions: { modelAssetPath: '/mediapipe/visage.tflite' },
        runningMode: 'VIDEO',
      })) as unknown as Detecteur;
    })().catch((erreur) => {
      // Un échec ne doit pas rester collé : le prochain essai doit repartir.
      enCours = null;
      throw erreur;
    });
  }
  return enCours;
}

/**
 * Relève les visages d'un rush et rend sa trajectoire de cadrage.
 *
 * Rend `null` plutôt que de lever : le studio doit rester utilisable quand le
 * modèle ne se charge pas — réseau coupé, fichiers absents, navigateur qui
 * refuse le WASM. Un rush sans trajectoire se rend au milieu, comme avant, et
 * personne ne perd son montage parce qu'un modèle manque.
 */
export async function detecterCadrage(
  video: HTMLVideoElement,
  options: { coupes?: number[] } = {},
): Promise<Cadrage | null> {
  const largeur = video.videoWidth;
  const hauteur = video.videoHeight;
  // Une source déjà verticale n'a aucun côté à perdre : rien à chercher.
  if (!largeur || !hauteur || largeur <= hauteur) return null;

  let modele: Detecteur;
  try {
    modele = await detecteur();
  } catch {
    return null;
  }

  const echelle = largeur / LARGEUR_ANALYSE;
  const toile = document.createElement('canvas');
  toile.width = LARGEUR_ANALYSE;
  toile.height = Math.round(hauteur / echelle);
  const ctx = toile.getContext('2d');
  if (!ctx) return null;

  const duree = Number.isFinite(video.duration) ? video.duration : 0;
  if (duree <= 0) return null;

  const echantillons = Math.max(1, Math.round(duree * PAR_SECONDE));
  const parEchantillon: Boite[][] = [];
  const etait = video.currentTime;

  try {
    for (let i = 0; i < echantillons; i++) {
      const instant = (i / PAR_SECONDE);
      await placer(video, Math.min(instant, duree - 0.001));
      ctx.drawImage(video, 0, 0, toile.width, toile.height);
      const vu = modele.detectForVideo(toile, Math.round(instant * 1000));
      parEchantillon.push(
        vu.detections
          .map((d) => d.boundingBox)
          .filter((b): b is NonNullable<typeof b> => Boolean(b))
          .map((b) => ({ x: b.originX, y: b.originY, largeur: b.width, hauteur: b.height })),
      );
    }
  } catch {
    return null;
  } finally {
    await placer(video, etait).catch(() => undefined);
  }

  return cadrageDepuisBoites(parEchantillon, {
    largeurSource: largeur,
    hauteurSource: hauteur,
    parSeconde: PAR_SECONDE,
    echelle,
    coupes: options.coupes,
  });
}

/** Amène la vidéo à un instant et attend que l'image y soit vraiment. */
function placer(video: HTMLVideoElement, instant: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const fini = () => {
      video.removeEventListener('seeked', fini);
      video.removeEventListener('error', rate);
      resolve();
    };
    const rate = () => {
      video.removeEventListener('seeked', fini);
      video.removeEventListener('error', rate);
      reject(new Error('la vidéo refuse de se placer'));
    };
    video.addEventListener('seeked', fini);
    video.addEventListener('error', rate);
    video.currentTime = instant;
  });
}
