import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { FiltreStatuts } from '@/components/filtre-statut';
import { ListeProjets } from '@/components/liste-projets';
import { variantesBouton } from '@/components/ui/button';
import { estFiltreStatut, listerProjets } from '@/lib/projets';
import { exigerSession } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Projets' };

export default async function PageProjets({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  // Un paramètre inconnu dans l'URL ne doit pas produire de page vide ni
  // d'erreur : il retombe silencieusement sur « tous ».
  const filtre = estFiltreStatut(statut) ? statut : 'tous';

  const session = await exigerSession();
  const projets = await listerProjets(session, filtre);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projets.length} fiche{projets.length > 1 ? 's' : ''} affichée
            {projets.length > 1 ? 's' : ''}.
          </p>
        </div>

        <Link href="/projets/nouveau" className={variantesBouton({})}>
          <Plus aria-hidden />
          Nouveau projet
        </Link>
      </header>

      <FiltreStatuts actif={filtre} />
      <ListeProjets projets={projets} />
    </div>
  );
}
