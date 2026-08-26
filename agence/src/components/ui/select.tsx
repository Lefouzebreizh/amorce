import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/*
 * Une liste déroulante native, habillée — et non la liste reconstruite de
 * Shadcn/ui, qui apporte deux dépendances Radix.
 *
 * Sur téléphone, le contrôle natif ouvre le sélecteur du système : plus
 * confortable au pouce que n'importe quelle liste refaite en JavaScript. Le
 * jour où une option a besoin d'une icône ou d'une description, c'est le moment
 * de passer à la version Radix, pas avant.
 */
export function Select({ className, children, ...reste }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-11 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-base',
          'transition-[border-color] outline-none focus-visible:border-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'aria-invalid:border-destructive',
          className,
        )}
        {...reste}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
