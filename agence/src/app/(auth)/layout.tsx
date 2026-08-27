import Link from 'next/link';

import { PiedDePage } from '@/components/pied-de-page';

/*
 * Coque des pages d'authentification : une carte centrée, rien d'autre à
 * l'écran. Toute navigation supplémentaire ici est une occasion de partir sans
 * s'être connecté.
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Socle Agence
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <div className="w-full max-w-md">
        <PiedDePage />
      </div>
    </div>
  );
}
