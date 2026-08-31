import { dansLaBandeSure, Y_PAR_DEFAUT } from './captions.ts';
import type { Caption, CaptionStyleId } from './types.ts';

/**
 * Le carton de fin : ce qui donne envie de l'épisode suivant.
 *
 * Relevé sur un export réel du 29/08/2026 : la vidéo s'arrêtait sur le dernier
 * plan, écran noir direct, sans un mot. Pour un feuilleton publié sur TikTok
 * c'est la fin la plus coûteuse qui soit — la plateforme enchaîne aussitôt sur
 * la vidéo suivante, celle de quelqu'un d'autre, et rien n'a dit qu'il y avait
 * une suite. `montage-auto` sait poser un carton (`--carte`) ; le studio, non.
 *
 * Ce module ne dessine rien et ne touche à aucun rendu : il **constate** qu'il
 * n'y a pas de fin écrite, et **propose** celle qui manque. Poser le texte
 * reste un geste de l'interface.
 *
 * Le texte proposé porte volontairement un crochet à remplir. Écrire la phrase
 * à la place de quelqu'un serait lui mettre des mots dans la bouche — c'est le
 * principe des gabarits d'`autoFinish`, et `crochetsARemplir` existe justement
 * pour empêcher qu'un crochet parte gravé dans le fichier.
 */

/**
 * Sous cette durée, un texte de fin n'a pas le temps d'être lu.
 *
 * Mesuré ailleurs dans ce dépôt : un plan a besoin d'au moins 1,4 s pour être
 * lu. Une phrase courte lue en fin de film, alors que l'œil vient de suivre de
 * l'action, en demande un peu plus.
 */
export const DUREE_CARTON = 1.8;

/**
 * La fenêtre qui compte pour juger qu'un film « finit sur du texte ».
 *
 * Un sous-titre qui s'arrête une seconde avant la fin laisse le film mourir en
 * silence : ce qui décide, c'est ce qui est à l'écran au dernier instant, pas
 * ce qui a été écrit quelque part vers la fin.
 */
const FENETRE_FIN = 0.4;

/** Le film se termine-t-il sur un texte encore affiché ? */
export function aUneFinEcrite(captions: Caption[], duree: number): boolean {
  if (duree <= 0) return false;
  return captions.some((c) => c.text.trim() !== '' && c.end >= duree - FENETRE_FIN && c.start < duree);
}

/**
 * Le carton qui manque, prêt à être posé — ou `null` s'il y en a déjà un.
 *
 * La hauteur est celle des sous-titres, ramenée dans la bande que les trois
 * plateformes laissent libre : un carton centré ou posé bas serait mangé par
 * la colonne de droite de TikTok, qui recouvre tout à partir de 72 %.
 *
 * La durée est **prise sur la fin du film**, jamais ajoutée après : rallonger
 * le film déplacerait la dernière image et le raccord audio, ce qui ne regarde
 * pas un carton de texte. Sur un film plus court que le carton, on prend ce
 * qu'il reste plutôt que de rendre un début négatif.
 */
export function cartonFinPropose(
  captions: Caption[],
  duree: number,
  style: CaptionStyleId = 'punch',
): Omit<Caption, 'id'> | null {
  if (duree <= 0 || aUneFinEcrite(captions, duree)) return null;

  const longueur = Math.min(DUREE_CARTON, duree);
  return {
    text: 'LA SUITE : [CE QUI ARRIVE ENSUITE]',
    start: Math.max(0, duree - longueur),
    end: duree,
    style,
    y: dansLaBandeSure(Y_PAR_DEFAUT),
  };
}
