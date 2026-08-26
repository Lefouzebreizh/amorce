import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Bouton dans la convention Shadcn/ui, sans la dépendance `Slot` de Radix :
 * un lien qui doit ressembler à un bouton applique `variantesBouton(...)` sur
 * son `className` plutôt que de passer par `asChild`. Une dépendance de moins
 * pour un composant qui reste identique à l'usage.
 */
export const variantesBouton = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
    'transition-colors outline-none',
    'disabled:pointer-events-none disabled:opacity-60',
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variante: {
        primaire: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        secondaire: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        contour: 'border border-border bg-card hover:bg-muted',
        fantome: 'hover:bg-muted hover:text-foreground',
        destructif:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        lien: 'text-primary underline-offset-4 hover:underline',
      },
      taille: {
        // 44 px de haut : la cible tactile minimale recommandée. Les tailles
        // plus petites sont réservées aux commandes secondaires d'une ligne de
        // tableau, jamais à l'action principale d'un écran.
        normale: 'h-11 px-4 py-2',
        petite: 'h-9 rounded-md px-3 text-sm',
        grande: 'h-12 rounded-lg px-6 text-base',
        icone: 'size-11',
      },
    },
    defaultVariants: {
      variante: 'primaire',
      taille: 'normale',
    },
  },
);

export type ProprietesBouton = React.ComponentProps<'button'> &
  VariantProps<typeof variantesBouton>;

export function Button({ className, variante, taille, ...reste }: ProprietesBouton) {
  return (
    <button className={cn(variantesBouton({ variante, taille }), className)} {...reste} />
  );
}
