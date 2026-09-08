/*
 * Les trois seuls habillages de bouton de la page, écrits une fois.
 *
 * `min-h-14` et non `min-h-11` : le plancher tactile du dépôt est de 44 px, et
 * il vaut pour un réglage discret dans une interface. Ici on vise un pouce qui
 * décide d'un achat, souvent avec des mains de chantier — on prend large.
 */

export const BOUTON_BASE =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-center text-lg ' +
  'font-semibold transition-[background-color,box-shadow,transform] duration-200 ' +
  'motion-safe:active:scale-[0.98]';

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
export const BOUTON_PRINCIPAL =
  `${BOUTON_BASE} bg-accent text-accent-encre shadow-lg shadow-accent/20 ` +
  'hover:bg-accent-vif hover:shadow-xl hover:shadow-accent/30';

/*
 * Le survol change vraiment de surface. Il valait `hover:bg-slab` sur un fond
 * déjà `bg-slab` — un état de survol qui ne fait rien, ce qui est pire qu'aucun
 * survol : le doigt appuie sans retour, et sur un écran tactile c'est le seul
 * signe qu'on a bien touché la cible.
 */
export const BOUTON_CONTOUR = `${BOUTON_BASE} border-2 border-accent bg-slab text-accent hover:bg-panel`;

export const SECTION = 'mx-auto w-full max-w-5xl px-5 py-16 sm:py-24';

/*
 * Le titrage porte la police de titre, et il a gagné en échelle.
 *
 * `font-titre` est Bricolage Grotesque ; `tracking-tight` la resserre, parce
 * qu'une grotesque large s'espace toute seule aux grandes tailles. Le saut de
 * 3xl→4xl a été porté à 4xl→5xl : sur un téléphone tenu à bout de bras au
 * soleil, c'est la taille du titre qui dit où commence une section, avant même
 * qu'on lise le mot.
 */
export const TITRE_SECTION =
  'font-titre text-4xl font-extrabold tracking-tight text-encre sm:text-5xl';

/*
 * Le filet violet, et c'est tout ce que le violet fait sur cette page.
 *
 * Un dégradé d'un pixel posé au-dessus d'une carte : il donne le relief que
 * réclame une hiérarchie sombre, sans porter un mot ni une action. Sa mesure de
 * contraste ne s'applique pas — il n'y a rien à lire dessus.
 */
export const FILET_VIOLET =
  'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r ' +
  'before:from-transparent before:via-violet before:to-transparent';

/*
 * Une carte qui répond au doigt.
 *
 * Le relief ne vient pas d'une ombre portée — sur fond sombre, une ombre ne se
 * voit pas — mais du **changement de surface** : `slab` monte vers `panel`, et
 * la bordure prend l'accent. C'est la seule façon de dire « touché » sur une
 * page qui n'a pas de blanc.
 */
export const CARTE =
  'relative overflow-hidden rounded-2xl border border-edge bg-slab ' +
  'transition-[background-color,border-color,transform] duration-200 ' +
  'hover:border-accent/40 hover:bg-panel motion-safe:hover:-translate-y-0.5';
