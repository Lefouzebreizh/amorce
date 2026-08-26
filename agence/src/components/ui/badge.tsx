import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export const variantesBadge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variante: {
        neutre: 'bg-muted text-muted-foreground',
        information: 'bg-accent text-accent-foreground',
        succes: 'bg-success/15 text-success',
        attention: 'bg-warning/20 text-warning-foreground',
      },
    },
    defaultVariants: {
      variante: 'neutre',
    },
  },
);

export type ProprietesBadge = React.ComponentProps<'span'> & VariantProps<typeof variantesBadge>;

export function Badge({ className, variante, ...reste }: ProprietesBadge) {
  return <span className={cn(variantesBadge({ variante }), className)} {...reste} />;
}
