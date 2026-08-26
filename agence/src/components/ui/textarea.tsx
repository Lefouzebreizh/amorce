import * as React from 'react';

import { cn } from '@/lib/utils';

export function Textarea({ className, ...reste }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-base',
        'placeholder:text-muted-foreground',
        'transition-[border-color] outline-none focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-destructive',
        className,
      )}
      {...reste}
    />
  );
}
