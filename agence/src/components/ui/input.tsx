import * as React from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...reste }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base',
        'placeholder:text-muted-foreground',
        'transition-[border-color,box-shadow] outline-none',
        'focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-60',
        // `aria-invalid` porte déjà l'information pour les lecteurs d'écran ;
        // la bordure rouge la rend visible sans dupliquer d'état en React.
        'aria-invalid:border-destructive',
        className,
      )}
      {...reste}
    />
  );
}
