/*
 * Les trois seuls habillages de bouton de la page, écrits une fois.
 *
 * `min-h-14` et non `min-h-11` : le plancher tactile du dépôt est de 44 px, et
 * il vaut pour un réglage discret dans une interface. Ici on vise un pouce qui
 * décide d'un achat, souvent avec des mains de chantier — on prend large.
 */

export const BOUTON_BASE =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-center text-lg font-semibold transition-colors';

/*
 * Deux habillages, plus trois — et c'est la charte qui a tranché.
 *
 * `BOUTON_SECONDAIRE` existait parce que la page portait deux couleurs de
 * bouton plein : l'orange pour ce qui engage, le bleu pour le reste. Passés
 * tous les deux à l'accent unique, les deux constantes sont devenues
 * rigoureusement identiques — un doublon qui se serait déclenché à la place de
 * l'autre sans que rien ne change à l'écran, jusqu'au jour où quelqu'un aurait
 * modifié une seule des deux. Aucun composant ne l'appelait : elle est retirée.
 *
 * Ce qui reste dit la hiérarchie plutôt que la couleur : **un seul bouton plein
 * par écran**, celui qui fait avancer la vente, et le contour pour tout le
 * reste. C'est aussi ce que montrent les sites livrés, ce qui fait qu'un
 * prospect reconnaît la même main.
 */
export const BOUTON_PRINCIPAL = `${BOUTON_BASE} bg-accent text-accent-encre hover:bg-accent-vif`;

/*
 * Le survol change vraiment de surface. Il valait `hover:bg-slab` sur un fond
 * déjà `bg-slab` — un état de survol qui ne fait rien, ce qui est pire qu'aucun
 * survol : le doigt appuie sans retour, et sur un écran tactile c'est le seul
 * signe qu'on a bien touché la cible.
 */
export const BOUTON_CONTOUR = `${BOUTON_BASE} border-2 border-accent bg-slab text-accent hover:bg-panel`;

export const SECTION = 'mx-auto w-full max-w-5xl px-5 py-14 sm:py-20';

export const TITRE_SECTION = 'text-3xl font-bold tracking-tight text-encre sm:text-4xl';
