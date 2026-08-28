/*
 * Les trois seuls habillages de bouton de la page, écrits une fois.
 *
 * `min-h-14` et non `min-h-11` : le plancher tactile du dépôt est de 44 px, et
 * il vaut pour un réglage discret dans une interface. Ici on vise un pouce qui
 * décide d'un achat, souvent avec des mains de chantier — on prend large.
 */

export const BOUTON_BASE =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-center text-lg font-semibold transition-colors';

export const BOUTON_PRINCIPAL = `${BOUTON_BASE} bg-chantier text-white hover:bg-[#c44f00]`;

export const BOUTON_SECONDAIRE = `${BOUTON_BASE} bg-bleu text-white hover:bg-bleu-sombre`;

export const BOUTON_CONTOUR = `${BOUTON_BASE} border-2 border-bleu bg-white text-bleu hover:bg-bleu-pale`;

export const SECTION = 'mx-auto w-full max-w-5xl px-5 py-14 sm:py-20';

export const TITRE_SECTION = 'text-3xl font-bold tracking-tight text-encre sm:text-4xl';
