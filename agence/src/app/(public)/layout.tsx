import Link from 'next/link';

import { PiedDePage } from '@/components/pied-de-page';

/*
 * Coque des pages publiques d'information. Une colonne étroite : ces textes se
 * lisent, ils ne se parcourent pas, et une ligne de quatre-vingts caractères
 * fatigue au bout d'un paragraphe.
 */
export default function LayoutPublic({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Socle Agence
      </Link>
      <main className="flex-1 py-10">{children}</main>
      <PiedDePage />
    </div>
  );
}
