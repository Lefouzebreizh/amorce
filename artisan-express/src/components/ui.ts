/*
 * Les trois seuls habillages de bouton de la page, écrits une fois.
 *
 * `min-h-14` et non `min-h-11` : le plancher tactile du dépôt est de 44 px, et
 * il vaut pour un réglage discret dans une interface. Ici on vise un pouce qui
 * décide d'un achat, souvent avec des mains de chantier — on prend large.
 */

/*
 * Le rayon et la durée viennent de la direction demandée — esprit linear.app.
 *
 * `rounded-lg` et non `rounded-xl` : une pilule très arrondie fait « appli
 * grand public », un rayon court fait « outil ». `duration-150` et non 200 :
 * une transition qui traîne se remarque, et ce qu'on veut est qu'elle ne se
 * remarque pas — le survol doit répondre avant qu'on ait fini de poser le
 * doigt.
 *
 * `min-h-14` et non `min-h-11` : le plancher tactile du dépôt est de 44 px, et
 * il vaut pour un réglage discret dans une interface. Ici on vise un pouce qui
 * décide d'un achat, souvent avec des mains de chantier — on prend large.
 */
export const BOUTON_BASE =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-lg px-6 text-center text-lg ' +
  'font-semibold tracking-[-0.01em] transition-[background-color,box-shadow,transform,border-color] ' +
  'duration-150 ease-out motion-safe:active:scale-[0.985]';

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
  `${BOUTON_BASE} bg-accent text-accent-encre shadow-lg shadow-accent/25 ` +
  'hover:bg-accent-vif hover:shadow-xl hover:shadow-accent/35';

/*
 * Le survol change vraiment de surface. Il valait `hover:bg-slab` sur un fond
 * déjà `bg-slab` — un état de survol qui ne fait rien, ce qui est pire qu'aucun
 * survol : le doigt appuie sans retour, et sur un écran tactile c'est le seul
 * signe qu'on a bien touché la cible.
 */
export const BOUTON_CONTOUR =
  `${BOUTON_BASE} border border-edge bg-slab text-encre hover:border-accent hover:bg-panel hover:text-accent`;

/*
 * L'air est la hiérarchie. La direction demandée sépare par l'espacement et la
 * taille plutôt que par la couleur : les sections respirent donc plus qu'avant
 * — 20 au lieu de 16 sur téléphone, 32 au lieu de 24 au-delà — et c'est ce
 * blanc-là qui dit « nouvelle idée », sans qu'aucun trait ni aucun aplat n'ait
 * à le dire.
 */
export const SECTION = 'mx-auto w-full max-w-5xl px-5 py-20 sm:py-32';

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
  'font-titre text-[2.35rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-encre ' +
  'sm:text-[3.25rem]';

/*
 * Le filet violet — un dégradé d'un pixel posé au-dessus d'une carte.
 *
 * Il porte `violet-trait` et non `violet` : la valeur d'origine rendait 2,44:1
 * sur un encadré, si bien que ce filet existait dans le code et pas vraiment à
 * l'œil. À 4,52:1 il se voit, ce qui est la moindre des choses pour un élément
 * dont c'est l'unique fonction.
 */
export const FILET_VIOLET =
  'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r ' +
  'before:from-transparent before:via-violet-trait before:to-transparent';

/*
 * Une carte qui répond au doigt.
 *
 * Le relief ne vient pas d'une ombre portée — sur fond sombre, une ombre ne se
 * voit pas — mais du **changement de surface** : `slab` monte vers `panel`, et
 * la bordure prend l'accent. C'est la seule façon de dire « touché » sur une
 * page qui n'a pas de blanc.
 */
export const CARTE =
  'relative overflow-hidden rounded-xl border border-edge bg-slab ' +
  'transition-[background-color,border-color,transform] duration-150 ease-out ' +
  'hover:border-accent/50 hover:bg-panel motion-safe:hover:-translate-y-px';

/*
 * La carte à bordure violette : ce qui structure sans appeler à agir.
 *
 * C'est la place que le propriétaire a donnée au violet le 08/09/2026 — il
 * **sépare**, le turquoise **désigne**. `violet-trait` rend **5,03:1** sur une
 * carte, très au-dessus du plancher de 3:1 d'un trait et très en dessous des
 * 7:1 d'un accent : exactement l'entre-deux qu'on cherche.
 *
 * **À pleine opacité, et ce n'est pas un détail.** Le premier jet écrivait
 * `border-violet-trait/70` — et une opacité posée sur une couleur mange le
 * contraste sans qu'aucun jeton ne le montre. Ce dépôt l'a déjà payé une fois,
 * sur l'encre d'un bouton à 85 % qui rendait 2,58:1. La mesure de 5,03:1 vaut
 * pour la couleur pleine, et seulement pour elle.
 *
 * Le survol passe la bordure à l'accent : c'est le seul moment où cette carte
 * a quelque chose à dire, et c'est le turquoise qui le dit.
 */
export const CARTE_VIOLET = CARTE.replace('border-edge', 'border-violet-trait');
