/**
 * Portage de `habillage/carte.py`. **Le Python fait foi**, et il porte les
 * quatre contraintes : la bande sûre à 12–45 % (intersection des trois
 * plateformes, jamais la plus permissive), les 7:1 de contraste, le texte qui
 * passe à la ligne au lieu de s'étirer, et surtout la quatrième —
 *
 *   **la carte ne peut pas afficher un score que le modèle n'a pas mesuré.**
 *
 * Cette dernière est rendue structurelle ici comme là-bas : `blocs()` ne
 * fabrique la mention que si la source est `MESUREE`. Il n'existe aucun autre
 * chemin de code menant à un pourcentage, et c'est volontaire — une consigne
 * laissée à la discipline de l'appelant finit toujours par être oubliée.
 *
 * L'identifiant du dégradé porte l'intention : un `id` est global au
 * **document**, pas au fichier, et deux cartes posées dans la même page avec
 * le même `id` prennent toutes deux la couleur de la première. Ce cas n'est
 * pas théorique ici : ces cartes ont vocation à vivre dans une page web.
 */

import { Source, habiller } from "./intentions.ts";
import { palette } from "./palette.ts";
import { pourcent0 } from "./format.ts";
import { affichable, type Verdict } from "./verdict.ts";

export const LARGEUR = 1080;
export const HAUTEUR = 1920;

export const HAUT_SUR = Math.trunc(HAUTEUR * 0.12);  // 230
export const BAS_SUR = Math.trunc(HAUTEUR * 0.45);   // 864

export const MARGE_LATERALE = 96;
export const COLONNE = LARGEUR - 2 * MARGE_LATERALE;

export const TAILLE_TITRE = 84;
export const TAILLE_SOUS_TITRE = 52;
export const TAILLE_MENTION = 30;
export const INTERLIGNE = 1.22;
export const AVANCE = 0.56;

export interface Ligne {
  texte: string;
  x: number;
  y: number;
  taille: number;
  graisse: number;
  couleur: string;
}

function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function couper(texte: string, taille: number, largeur = COLONNE): string[] {
  const parLigne = Math.max(1, Math.trunc(largeur / (taille * AVANCE)));
  const lignes: string[] = [];
  let courante = "";
  // `split()` sans argument en Python découpe sur toute suite d'espaces et
  // ignore les vides ; `split(/\s+/)` seul laisserait une chaîne vide en tête
  // si le texte commence par une espace. Le filtre rétablit l'équivalence.
  for (const mot of texte.split(/\s+/).filter((m) => m.length > 0)) {
    const essai = `${courante} ${mot}`.trim();
    if (essai.length <= parLigne || !courante) {
      courante = essai;
    } else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

export function blocs(verdict: Verdict): Ligne[] {
  const parure = habiller(verdict.intention);
  const teintes = palette(verdict.intention);

  const titre = couper(parure.titre, TAILLE_TITRE);
  const sous = couper(parure.sousTitre, TAILLE_SOUS_TITRE);

  const pasTitre = Math.trunc(TAILLE_TITRE * INTERLIGNE);
  const pasSous = Math.trunc(TAILLE_SOUS_TITRE * INTERLIGNE);
  const ecart = 56;

  // ── La règle du §1, rendue structurelle ────────────────────────────────
  const mention = verdict.source === Source.MESUREE
    ? `${verdict.classeDominante} · ${pourcent0(verdict.confiance)}`
    : null;

  const total =
    titre.length * pasTitre + ecart + sous.length * pasSous +
    (mention ? Math.trunc(TAILLE_MENTION * INTERLIGNE) + 40 : 0);

  // `//` en Python est une division entière **plancher**, pas une troncature.
  // Sur des valeurs positives les deux coïncident, et elles le sont ici ; le
  // `floor` est explicite pour que la différence ne se reperde pas.
  let y = Math.floor((HAUT_SUR + BAS_SUR) / 2) - Math.floor(total / 2) + TAILLE_TITRE;
  const sortie: Ligne[] = [];

  for (const ligne of titre) {
    sortie.push({ texte: ligne, x: MARGE_LATERALE, y, taille: TAILLE_TITRE,
                  graisse: 800, couleur: teintes.texte });
    y += pasTitre;
  }
  y += ecart;
  for (const ligne of sous) {
    sortie.push({ texte: ligne, x: MARGE_LATERALE, y, taille: TAILLE_SOUS_TITRE,
                  graisse: 400, couleur: teintes.texte });
    y += pasSous;
  }
  if (mention) {
    y += 40;
    sortie.push({ texte: mention, x: MARGE_LATERALE, y, taille: TAILLE_MENTION,
                  graisse: 600, couleur: teintes.accent });
  }

  return sortie;
}

export function enSvg(verdict: Verdict): string {
  if (!affichable(verdict)) {
    throw new Error(
      "Un verdict dont la porte a fermé n'a pas de carte : il n'y avait pas " +
      "de chat. Voir `affichable`.",
    );
  }
  const teintes = palette(verdict.intention);
  const lignes = blocs(verdict);

  const hautBarre = Math.min(...lignes.map((l) => l.y)) - TAILLE_TITRE - 44;

  const corps = lignes.map((l) =>
    `  <text x="${l.x}" y="${l.y}" font-size="${l.taille}" font-weight="${l.graisse}" ` +
    `fill="${l.couleur}">${echapper(l.texte)}</text>`
  ).join("\n");

  const cle = verdict.intention;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}">
  <defs>
    <linearGradient id="fond-${cle}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${teintes.fond}"/>
      <stop offset="100%" stop-color="${teintes.fondBas}"/>
    </linearGradient>
  </defs>
  <rect width="${LARGEUR}" height="${HAUTEUR}" fill="url(#fond-${cle})"/>
  <rect x="${MARGE_LATERALE}" y="${hautBarre}" width="120" height="10" rx="5" fill="${teintes.accent}"/>
  <g font-family="Inter, Roboto, 'Helvetica Neue', Arial, sans-serif">
${corps}
  </g>
</svg>
`;
}
