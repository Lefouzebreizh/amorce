/*
 * Mesure du contraste des jetons de couleur, en dehors de tout navigateur.
 *
 * Pourquoi ce fichier existe : `globals.css` invite explicitement un client à
 * réécrire sa charte dans un seul bloc, et rien ne disait jusqu'ici ce qu'une
 * teinte déplacée venait de rendre illisible. Un commentaire affirmait « une
 * couleur d'état lisible prime sur une couleur d'état jolie » — c'était une
 * intention, pas une mesure. Ici c'est une mesure, et le test qui l'utilise
 * refuse la poussée si un couple passe sous le seuil.
 *
 * Tout est en bibliothèque standard : la conversion oklch → sRGB fait vingt
 * lignes, et une dépendance de plus dans le socle est une dépendance de plus à
 * suivre pour chaque projet client qui en naît.
 */

export type Srgb = { r: number; g: number; b: number };

/** Une couleur oklch telle qu'elle est écrite dans la feuille de style. */
export type Oklch = { l: number; c: number; h: number };

/*
 * oklch → sRGB. Les matrices sont celles de la spécification CSS Color 4
 * (oklab → LMS cubes → linéaire sRGB), suivies de l'encodage gamma.
 *
 * Les valeurs hors gamut sont ramenées par simple écrêtage, exactement comme le
 * fait un navigateur qui n'a pas d'écran plus large que sRGB : on mesure donc
 * la couleur réellement affichée, et non la couleur idéale.
 */
export function oklchVersSrgb({ l, c, h }: Oklch): Srgb {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lCube = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCube = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCube = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lineaire = [
    4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  ];

  const [r, g, bleu] = lineaire.map((canal) => {
    const encode =
      canal <= 0.0031308 ? 12.92 * canal : 1.055 * Math.abs(canal) ** (1 / 2.4) - 0.055;

    return Math.min(1, Math.max(0, encode)) * 255;
  }) as [number, number, number];

  return { r, g, b: bleu };
}

/** Luminance relative WCAG 2.1, sur des canaux 0–255. */
export function luminance({ r, g, b }: Srgb): number {
  const [rl, gl, bl] = [r, g, b].map((canal) => {
    const normalise = canal / 255;

    return normalise <= 0.04045 ? normalise / 12.92 : ((normalise + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Rapport de contraste WCAG 2.1, entre 1 (identiques) et 21 (noir sur blanc).
 * Le seuil AA est de 4,5 pour un texte courant, 3 pour un texte large ou un
 * élément d'interface.
 */
export function contraste(premierPlan: Srgb, fond: Srgb): number {
  const a = luminance(premierPlan);
  const b = luminance(fond);
  const [clair, sombre] = a > b ? [a, b] : [b, a];

  return (clair + 0.05) / (sombre + 0.05);
}

/*
 * Aplat semi-transparent posé sur un fond opaque — ce que fait `bg-success/15`.
 * Sans cette composition, on mesurerait le vert plein alors que l'œil voit un
 * vert très dilué : la pastille de statut paraîtrait conforme et ne le serait
 * pas.
 */
export function composer(couche: Srgb, opacite: number, fond: Srgb): Srgb {
  const melange = (dessus: number, dessous: number) => dessus * opacite + dessous * (1 - opacite);

  return {
    r: melange(couche.r, fond.r),
    g: melange(couche.g, fond.g),
    b: melange(couche.b, fond.b),
  };
}

/*
 * Lecture des jetons depuis la feuille de style elle-même, plutôt qu'une copie
 * dans le test. Une copie se désynchronise au premier changement de charte, et
 * le test continuerait alors de valider des couleurs que personne n'affiche.
 *
 * Deux blocs sont extraits : le `:root` de tête, et celui que la requête
 * `prefers-color-scheme: dark` redéfinit. Le thème sombre hérite du clair pour
 * les jetons qu'il ne réécrit pas.
 */
export type Theme = 'clair' | 'sombre';

const JETON = /--([a-z-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;

function extraireJetons(source: string): Map<string, Oklch> {
  const jetons = new Map<string, Oklch>();

  for (const correspondance of source.matchAll(JETON)) {
    // Les quatre groupes sont non optionnels dans l'expression : la garde
    // n'existe que pour satisfaire `noUncheckedIndexedAccess`.
    const [, nom, l, c, h] = correspondance;

    if (nom === undefined || l === undefined || c === undefined || h === undefined) continue;

    jetons.set(nom, { l: Number(l), c: Number(c), h: Number(h) });
  }

  return jetons;
}

/** Découpe le bloc `@media (prefers-color-scheme: dark)` du reste de la feuille. */
export function lireJetons(css: string): Record<Theme, Map<string, Oklch>> {
  const debutSombre = css.indexOf('@media (prefers-color-scheme: dark)');

  if (debutSombre === -1) {
    throw new Error("La feuille de style ne déclare aucun thème sombre : jetons introuvables.");
  }

  const clair = extraireJetons(css.slice(0, debutSombre));
  const sombre = new Map(clair);

  for (const [nom, valeur] of extraireJetons(css.slice(debutSombre))) {
    sombre.set(nom, valeur);
  }

  return { clair, sombre };
}
