import Link from 'next/link';

import { variantesBouton } from '@/components/ui/button';

/*
 * Rendu à la demande, et non pré-rendu à la compilation : le jeton de la
 * politique de sécurité n'existe qu'au moment de la requête (voir
 * `lib/securite.ts`). Une page pré-rendue n'en porte pas, et `strict-dynamic`
 * refuserait alors ses scripts — la page s'afficherait sans jamais s'animer.
 */
export const dynamic = 'force-dynamic';

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
