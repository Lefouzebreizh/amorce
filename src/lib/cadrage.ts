import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from './types.ts';

/**
 * Le cadrage d'un rush plus large que 9:16.
 *
 * Le rendu recouvre plutôt qu'il n'ajuste — des bandes noires gâcheraient la
 * seule chose que le format vertical apporte — et jusqu'ici il gardait le
 * **milieu**, toujours. Sur un rush 1920 × 1080 ramené en 1080 × 1920, le
 * facteur de recouvrement vaut 1,778 : il ne reste que 607,5 px des 1920
 * d'origine, soit 31,6 % gardés et **68,4 % jetés au milieu**. Un sujet dans
 * le tiers gauche sort du cadre, et rien ne le savait.
 *
 * Ce module décide **où** regarder. Il ne détecte rien : il reçoit des points
 * d'intérêt déjà mesurés, et rend une trajectoire qu'on peut suivre sans
 * qu'elle donne le mal de mer.
 *
 * ## Pourquoi une trajectoire calculée d'avance, et non une caméra qui suit
 *
 * C'est la seule différence de fond avec les pipelines qui font ça côté
 * serveur, et elle n'est pas négociable ici. Une caméra qui intègre image après
 * image porte un **état** : sa position dépend de tout ce qui a précédé.
 * Or `renderFrame` est appelé par l'aperçu **et** par l'export, dans le
 * désordre — on déplace la tête de lecture, on recule, l'export encode hors
 * ligne image par image. Un état accumulé donnerait deux images différentes
 * pour le même instant selon le chemin parcouru pour y arriver, ce qui casse
 * l'invariant n°1 : un seul chemin de rendu, une seule image possible.
 *
 * Donc on calcule **une fois** toute la trajectoire, dans l'ordre, et le rendu
 * ne fait plus que la **lire** à un instant donné. Le lissage garde tout son
 * sens ; il cesse d'être une dérive.
 *
 * ## Le trépied lourd
 *
 * Les réglages viennent d'OpenShorts (mutonby/openshorts, MIT), portés et non
 * copiés : leur code est du Python qui pilote un filtre FFmpeg, le nôtre rend
 * un décalage pour un canvas. Ce qui se transpose est l'arithmétique, et elle
 * porte ses mesures — reprises ici parce qu'un réglage sans sa raison se fait
 * « améliorer » au premier coup d'œil.
 */

/**
 * Part de la largeur visible en deçà de laquelle la caméra **ne bouge pas**.
 *
 * C'est le trépied : tant que le sujet reste dans cette zone autour du centre
 * courant, on ne suit pas. Une caméra qui corrige en permanence des écarts de
 * quelques pixels fabrique un tremblement que rien ne justifie à l'écran.
 */
export const ZONE_MORTE = 0.25;

/**
 * Nombre de détections consécutives qu'un grand saut doit tenir avant d'être suivi.
 *
 * Mesuré chez eux sur du vrai matériel, et c'est le réglage qui décide : **22 %
 * des mises à jour de cible sautaient plus loin que toute la zone morte**, et
 * presque toutes étaient des erreurs de détecteur — un second visage, une boîte
 * qui accroche un autre bout de corps. Les suivre immédiatement donne une
 * caméra qui balaye.
 *
 * Le gain est chiffré, sur 262 s de rushes réels, en passant de 1 à 3 :
 * revirements dans une scène **0,41 → 0,13 par seconde** (−69 %), déplacement
 * de caméra **91 → 60 px/s** (−34 %).
 *
 * Et le prix est chiffré aussi, ce qui vaut d'être gardé : sur 84 scènes, 54 se
 * calment, 23 ne bougent pas, et **7 s'agitent davantage** — jusqu'à 59 → 108
 * px/s — parce que s'engager plus tard laisse parfois plus de chemin à faire.
 * Le bilan est franchement positif, il n'est pas universel.
 */
export const CONFIRMATIONS = 3;

/** Vitesse de suivi ordinaire, en pixels source par image. Un panoramique lent. */
export const VITESSE_LENTE = 3;

/** Vitesse de rattrapage, au-delà d'un demi-cadre d'écart. */
export const VITESSE_RAPIDE = 15;

/** Un point d'intérêt mesuré sur une image, en pixels de la source. */
export type Visee = {
  /** Numéro de l'image, depuis le début du plan. */
  image: number;
  /** Abscisse du centre de ce qui compte, en pixels source. */
  centre: number;
};

export type OptionsCadrage = {
  /** Largeur de la source, en pixels. */
  largeurSource: number;
  /** Hauteur de la source, en pixels. */
  hauteurSource: number;
  /** Nombre d'images de la trajectoire à produire. */
  images: number;
  /** Images où le plan change, et où la caméra coupe au lieu de suivre. */
  coupes?: number[];
};

/** Largeur de source réellement conservée par le recouvrement 9:16. */
export function largeurVisible(largeurSource: number, hauteurSource: number): number {
  const recouvrement = Math.max(OUTPUT_WIDTH / largeurSource, OUTPUT_HEIGHT / hauteurSource);
  return Math.min(largeurSource, OUTPUT_WIDTH / recouvrement);
}

/**
 * La trajectoire du centre de cadrage, image par image.
 *
 * Pure et déterministe : mêmes visées, même sortie, quel que soit l'ordre dans
 * lequel le rendu lira le résultat.
 *
 * Sans aucune visée, elle rend le centre de la source à chaque image — soit
 * exactement le comportement d'avant, ce qui garantit qu'un rush sans détection
 * ne change pas d'aspect.
 */
export function trajectoire(visees: Visee[], options: OptionsCadrage): number[] {
  const { largeurSource, hauteurSource, images } = options;
  const coupes = new Set(options.coupes ?? []);
  const visible = largeurVisible(largeurSource, hauteurSource);
  const demiVisible = visible / 2;
  const zoneMorte = visible * ZONE_MORTE;

  const parImage = new Map<number, number>();
  for (const visee of visees) parImage.set(visee.image, visee.centre);

  const borne = (valeur: number) =>
    Math.min(largeurSource - demiVisible, Math.max(demiVisible, valeur));

  let courant = largeurSource / 2;
  let cible = largeurSource / 2;
  let enAttente: number | null = null;
  let compte = 0;
  /*
   * Une coupe efface le sujet précédent au lieu de le rattraper.
   *
   * L'amortissement ci-dessous existe pour rejeter le bruit d'un détecteur
   * **à l'intérieur** d'un plan. À une coupe il fait l'inverse de ce qu'on
   * veut : le visage du nouveau plan est par construction loin de l'ancienne
   * cible, donc retenu le temps des confirmations, puis rejoint à la vitesse
   * d'un panoramique. Chez eux, ça donnait un torse sans tête pendant une
   * seconde et demie après chaque coupe.
   */
  let couperVers = true;

  const sortie: number[] = [];

  for (let image = 0; image < images; image++) {
    if (coupes.has(image)) {
      enAttente = null;
      compte = 0;
      couperVers = true;
    }

    const mesure = parImage.get(image);
    if (mesure !== undefined) {
      const vue = borne(mesure);
      if (couperVers) {
        couperVers = false;
        enAttente = null;
        compte = 0;
        cible = vue;
        courant = vue;
      } else if (Math.abs(vue - cible) > zoneMorte) {
        // Le même grand saut que la dernière fois ? On compte. Sinon on
        // repart de zéro : deux mesures aberrantes et contradictoires ne
        // doivent pas se confirmer l'une l'autre.
        if (enAttente !== null && Math.abs(vue - enAttente) <= zoneMorte) compte += 1;
        else {
          enAttente = vue;
          compte = 1;
        }
        if (compte >= CONFIRMATIONS) {
          enAttente = null;
          compte = 0;
          cible = vue;
        }
      } else {
        enAttente = null;
        compte = 0;
        cible = vue;
      }
    }

    const ecart = cible - courant;
    if (Math.abs(ecart) > zoneMorte) {
      const sens = ecart > 0 ? 1 : -1;
      const vitesse = Math.abs(ecart) > visible / 2 ? VITESSE_RAPIDE : VITESSE_LENTE;
      courant += sens * vitesse;
      // Ne pas dépasser : sans ça la caméra oscille autour de sa cible.
      if ((sens === 1 && courant > cible) || (sens === -1 && courant < cible)) courant = cible;
    }

    courant = borne(courant);
    sortie.push(courant);
  }

  return sortie;
}

/**
 * Le décalage horizontal à donner au rendu pour que ce centre soit au milieu.
 *
 * `renderFrame` dessine la source recouvrante centrée, puis ajoute `dx`. Placer
 * le point `centre` de la source au milieu du cadre revient donc à décaler de
 * l'écart entre ce point et le milieu de la source, à l'échelle du
 * recouvrement. Rendu séparément du calcul de trajectoire pour que le rendu
 * n'ait rien à savoir du trépied.
 */
export function decalage(
  centre: number,
  largeurSource: number,
  hauteurSource: number,
  echelle = 1,
): number {
  const recouvrement = Math.max(OUTPUT_WIDTH / largeurSource, OUTPUT_HEIGHT / hauteurSource);
  /*
   * L'échelle entre dans le calcul, et l'oublier décale tout.
   *
   * `drawCover` multiplie le recouvrement par l'échelle du moment — un zoom, un
   * balayage — avant de placer l'image. Un décalage calculé à l'échelle 1 et
   * appliqué à une image agrandie de 18 % viserait 18 % trop court, et le sujet
   * glisserait hors du cadre pendant le zoom.
   */
  return (largeurSource / 2 - centre) * recouvrement * echelle;
}

/** La trajectoire d'un rush, telle qu'elle voyage avec lui. */
export type Cadrage = { parSeconde: number; centres: number[] };

/**
 * Le centre visé à un instant de la source, ou son milieu si on ne sait pas.
 *
 * Lit au plus proche plutôt qu'en interpolant : le trépied avance de 3 px par
 * image en régime normal, si bien qu'un demi-échantillon d'écart vaut moins
 * d'un pixel à l'écran — et une interpolation lisserait les coupes, qui doivent
 * rester nettes.
 */
export function centreA(
  cadrage: Cadrage | undefined,
  tempsSource: number,
  largeurSource: number,
): number {
  if (!cadrage || cadrage.centres.length === 0 || cadrage.parSeconde <= 0) {
    return largeurSource / 2;
  }
  const index = Math.round(tempsSource * cadrage.parSeconde);
  const borne = Math.min(cadrage.centres.length - 1, Math.max(0, index));
  return cadrage.centres[borne];
}
