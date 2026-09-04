/**
 * Portage de `habillage/palette.py`. **Le Python fait foi**, et il porte la
 * raison de chaque teinte ainsi que le relevé de contraste du 03/09/2026.
 *
 * Une seule chose est vraie ici et pas là-bas : ces valeurs sont **recopiées**,
 * donc elles peuvent diverger en silence. C'est précisément ce que le témoin
 * de conformité attrape — il compare le SVG entier, teintes comprises.
 */

import { Intention } from "./intentions.ts";

export interface Palette {
  fond: string;
  fondBas: string;
  texte: string;
  accent: string;
}

export const PALETTES: Record<Intention, Palette> = {
  [Intention.DEMANDE]:
    { fond: "#3A2417", fondBas: "#1B0F08", texte: "#FFF3E4", accent: "#FFB35C" },
  [Intention.STRESS]:
    { fond: "#2B1B33", fondBas: "#120A16", texte: "#F4E9FA", accent: "#C99DEB" },
  [Intention.CONTENTEMENT]:
    { fond: "#16301F", fondBas: "#07130C", texte: "#E8F7EC", accent: "#7FD99A" },
  [Intention.INDECIS]:
    { fond: "#232323", fondBas: "#0D0D0D", texte: "#EDEDED", accent: "#B1B1B1" },
};

export function palette(intention: Intention): Palette {
  return PALETTES[intention];
}
