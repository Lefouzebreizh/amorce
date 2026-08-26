import * as React from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...reste }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...reste}
    />
  );
}

export function CardHeader({ className, ...reste }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...reste} />;
}

export function CardTitle({ className, ...reste }: React.ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-lg font-semibold leading-tight tracking-tight', className)} {...reste} />
  );
}

export function CardDescription({ className, ...reste }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...reste} />;
}

export function CardContent({ className, ...reste }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...reste} />;
}

export function CardFooter({ className, ...reste }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...reste} />;
}
