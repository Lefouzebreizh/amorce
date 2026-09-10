import { type Cadrage, type Visee, trajectoire } from './cadrage.ts';
import { type Mesure, sonAligne, suivrePistes, sujetQuiParle } from './parole.ts';

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
 * ## Comment le sujet est choisi
 *
 * **Celui qui parle**, quand la mesure le dit — c'est `parole.ts` qui croise le
 * remuement de la bouche avec l'énergie du son, et ce module lui fournit la
 * matière. La règle « le plus grand » qui régnait avant est fausse, et c'était
 * mesuré : sur une planche tirée d'un vrai rush, le cadrage suivait un visage
 * d'arrière-plan plus grand que celui du sujet qui parlait.
 *
 * Elle n'a pas disparu pour autant : elle reste le **pis-aller**, et il sert
 * souvent — plan muet, visage unique, deux personnes qui parlent ensemble. Ce
 * qui a changé est qu'on ne s'en contente plus quand on peut faire mieux.
 *
 * Et **la continuité** par-dessus : une fois le sujet choisi, on le garde tant
 * qu'il est là, au lieu de sauter au plus gros visage à chaque image.
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
export function centreDuSujet(boites: Boite[], precedent?: number, parlant?: number): number | null {
  if (boites.length === 0) return null;

  const centre = (b: Boite) => b.x + b.largeur / 2;
  const surface = (b: Boite) => b.largeur * b.hauteur;
  const plusGrande = boites.reduce((a, b) => (surface(b) > surface(a) ? b : a));

  if (precedent === undefined) {
    /*
     * Le démarrage à froid, et c'est là que tout se joue : la première image
     * d'un plan décide de qui la caméra va suivre pendant toute sa durée.
     *
     * `parlant` **prime**, et il ne passe pas par le rattrapage de dominance
     * qui gouverne la suite. Le laisser s'y soumettre rendrait le module
     * inutile : le défaut d'origine est précisément qu'un visage plus grand
     * emportait le morceau, et « plus grand » n'a jamais voulu dire « c'est
     * lui qui parle ».
     */
    if (parlant !== undefined) {
      return centre(
        boites.reduce((a, b) =>
          Math.abs(centre(b) - parlant) < Math.abs(centre(a) - parlant) ? b : a),
      );
    }
    return centre(plusGrande);
  }

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
    /**
     * Abscisse du visage qui parle, en pixels de l'image analysée, quand la
     * mesure a su le désigner. Absente, le pis-aller reprend la main.
     */
    parlant?: number;
  },
): Cadrage {
  const visees: Visee[] = [];
  let precedent: number | undefined;

  for (let i = 0; i < parEchantillon.length; i++) {
    const centre = centreDuSujet(parEchantillon[i], precedent, options.parlant);
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

/**
 * Sur combien d'échantillons on cherche qui parle, au début du plan.
 *
 * Deux secondes. La question posée est « qui parle au moment où la caméra doit
 * choisir », pas « qui parle tout du long » : une fois le sujet retenu, la
 * continuité prend le relais et n'a besoin de personne. Plus court ne laisse
 * pas le temps d'une syllabe et d'un silence, sans quoi il n'y a rien à
 * corréler ; beaucoup plus long ferait porter à ce calcul le suivi d'un plan
 * entier, que les entrées et sorties de champ rendent faux.
 */
export const FENETRE_PAROLE = 20;

/**
 * Où se trouve la bouche dans une boîte de visage.
 *
 * Tiers bas, moitié centrale. Aucune hypothèse à vérifier — voir l'entête de
 * `parole.ts` sur les points caractéristiques, qu'on n'emploie pas.
 */
const BOUCHE = { haut: 0.62, bas: 0.95, gauche: 0.25, droite: 0.75 };

/** Luminance moyenne de la région de la bouche, de 0 à 255. */
function luminanceBouche(ctx: CanvasRenderingContext2D, boite: Boite): number {
  const x = Math.round(boite.x + boite.largeur * BOUCHE.gauche);
  const y = Math.round(boite.y + boite.hauteur * BOUCHE.haut);
  const l = Math.max(1, Math.round(boite.largeur * (BOUCHE.droite - BOUCHE.gauche)));
  const h = Math.max(1, Math.round(boite.hauteur * (BOUCHE.bas - BOUCHE.haut)));
  // Une boîte peut déborder du cadre : `getImageData` lève sur une largeur
  // nulle, et rend du transparent hors du canvas — on borne plutôt que d'espérer.
  if (x < 0 || y < 0 || x + l > ctx.canvas.width || y + h > ctx.canvas.height) return 0;

  const { data } = ctx.getImageData(x, y, l, h);
  let somme = 0;
  for (let i = 0; i < data.length; i += 4) somme += (data[i] + data[i + 1] + data[i + 2]) / 3;
  return somme / (data.length / 4);
}

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
  options: {
    coupes?: number[];
    /**
     * Énergie du son du rush, une valeur par échantillon d'image, telle que
     * `energieParFenetre` la rend. Absente — rush muet, décodage refusé — la
     * question « qui parle » n'est simplement pas posée, et le pis-aller reste
     * celui d'avant.
     */
    energie?: number[];
  } = {},
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
  /*
   * La bouche n'est mesurée que sur la fenêtre de début, et jamais au-delà.
   *
   * `getImageData` par visage et par échantillon coûte cher, et le reste du
   * plan n'en a aucun usage : la continuité ne demande pas qui parle, elle
   * demande seulement de ne pas changer d'avis.
   */
  const bouches: Mesure[][] = [];
  const etait = video.currentTime;

  try {
    for (let i = 0; i < echantillons; i++) {
      const instant = (i / PAR_SECONDE);
      await placer(video, Math.min(instant, duree - 0.001));
      ctx.drawImage(video, 0, 0, toile.width, toile.height);
      const vu = modele.detectForVideo(toile, Math.round(instant * 1000));
      const boites = vu.detections
        .map((d) => d.boundingBox)
        .filter((b): b is NonNullable<typeof b> => Boolean(b))
        .map((b) => ({ x: b.originX, y: b.originY, largeur: b.width, hauteur: b.height }));
      parEchantillon.push(boites);

      if (options.energie && bouches.length < FENETRE_PAROLE) {
        bouches.push(
          boites.map((boite) => ({
            centre: boite.x + boite.largeur / 2,
            largeur: boite.largeur,
            bouche: luminanceBouche(ctx, boite),
          })),
        );
      }
    }
  } catch {
    return null;
  } finally {
    await placer(video, etait).catch(() => undefined);
  }

  /*
   * Qui parle, s'il y a de quoi le dire. `sujetQuiParle` rend `null` bien plus
   * souvent qu'il ne tranche — c'est voulu, et l'appelant n'a rien de spécial à
   * faire de ce cas : `cadrageDepuisBoites` retombe alors sur la plus grande
   * boîte, exactement comme avant ce module.
   */
  let parlant: number | null = null;
  if (options.energie) {
    const suivi = suivrePistes(bouches, FENETRE_PAROLE);
    parlant = sujetQuiParle(suivi.pistes, sonAligne(options.energie, suivi.depart, FENETRE_PAROLE));
  }

  return cadrageDepuisBoites(parEchantillon, {
    largeurSource: largeur,
    hauteurSource: hauteur,
    parSeconde: PAR_SECONDE,
    echelle,
    coupes: options.coupes,
    parlant: parlant ?? undefined,
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
