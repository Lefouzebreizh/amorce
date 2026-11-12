'use client';

import type { BesoinId } from '@/lib/services';

export function ChoisirService({ besoin, children, className = 'outil-bouton' }: {
  besoin: BesoinId; children: React.ReactNode; className?: string;
}) {
  return <a href="#formulaire" className={className} onClick={() => {
    window.dispatchEvent(new CustomEvent('artisan:besoin', { detail: besoin }));
  }}>{children}</a>;
}
