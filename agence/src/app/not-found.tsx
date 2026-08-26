import Link from 'next/link';

import { variantesBouton } from '@/components/ui/button';

export default function PageIntrouvable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-primary">Erreur 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Cette page n&apos;existe pas</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Le lien est peut-être ancien, ou la fiche a été supprimée depuis.
      </p>
      <Link href="/tableau-de-bord" className={variantesBouton({ variante: 'contour' })}>
        Retour à mon espace
      </Link>
    </main>
  );
}
