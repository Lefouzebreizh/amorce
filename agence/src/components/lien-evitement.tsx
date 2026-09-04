/*
 * Lien d'évitement : le premier élément atteignable au clavier, invisible tant
 * qu'il n'a pas le focus.
 *
 * Sans lui, entrer dans le contenu de l'espace privé coûte quatre à cinq
 * tabulations — le logo, chaque rubrique de la barre latérale — et il faut les
 * refaire à chaque changement de page. Ce n'est pas un détail de conformité :
 * c'est la différence entre une application qu'on utilise au clavier et une
 * application qu'on abandonne.
 *
 * Il ne s'affiche qu'au focus, donc jamais à la souris : `sr-only` le sort du
 * flux sans le sortir de l'ordre de tabulation, `focus:not-sr-only` l'y remet
 * le temps qu'il est atteint. La cible porte `tabIndex={-1}` pour que le focus
 * s'y pose réellement — un `<main>` sans cet attribut reçoit l'ancre mais pas
 * le focus, et la tabulation suivante repartirait du haut de la page.
 *
 * La cible ne neutralise pas l'anneau de focus : `:focus-visible` ne se
 * déclenche qu'au clavier, si bien que l'anneau n'apparaît que sur le saut
 * délibéré — c'est la seule confirmation que l'utilisateur reçoit d'avoir été
 * déplacé.
 */
export const ID_CONTENU = 'contenu';

export function LienEvitement() {
  return (
    <a
      href={`#${ID_CONTENU}`}
      // `focus:px-4 focus:py-3` et non `px-4 py-3` : `not-sr-only` remet la
      // marge intérieure à zéro, et une marge écrite hors variante se fait
      // écraser. Mesuré — le lien sortait alors collé au texte sur 115 × 20 px,
      // à cheval sur le logo. Une pastille de 44 px de haut au minimum, comme
      // toute cible tactile.
      className="sr-only rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:py-3"
    >
      Aller au contenu
    </a>
  );
}
