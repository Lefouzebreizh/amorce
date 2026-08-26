import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleDot, Euro, FolderKanban, Plus } from 'lucide-react';

import { CarteStatistique } from '@/components/carte-statistique';
import { ListeProjets } from '@/components/liste-projets';
import { variantesBouton } from '@/components/ui/button';
import { formaterMontant } from '@/lib/format';
import { calculerStatistiques, listerProjets } from '@/lib/projets';
import { exigerSession, lireProfil } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function PageTableauDeBord() {
  const session = await exigerSession();
  const [profil, projets] = await Promise.all([
    lireProfil(session),
    listerProjets(session),
  ]);

  const stats = calculerStatistiques(projets);
  const prenom = profil?.full_name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {prenom ? `Bonjour ${prenom}` : 'Tableau de bord'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total === 0
              ? 'Votre espace est prêt. Il ne manque qu’un premier projet.'
              : `${stats.total} projet${stats.total > 1 ? 's' : ''} suivi${stats.total > 1 ? 's' : ''} dans votre espace.`}
          </p>
        </div>

        <Link href="/projets/nouveau" className={variantesBouton({})}>
          <Plus aria-hidden />
          Nouveau projet
        </Link>
      </header>

      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-3">
        <CarteStatistique
          intitule="Projets"
          valeur={String(stats.total)}
          precision={`${stats.parStatut.draft} brouillon${stats.parStatut.draft > 1 ? 's' : ''}`}
          icone={<FolderKanban aria-hidden className="size-4 text-muted-foreground" />}
        />
        <CarteStatistique
          intitule="En cours"
          valeur={String(stats.parStatut.in_progress)}
          precision={`${stats.parStatut.completed} terminé${stats.parStatut.completed > 1 ? 's' : ''}`}
          icone={<CircleDot aria-hidden className="size-4 text-muted-foreground" />}
        />
        <CarteStatistique
          intitule="Enveloppe en cours"
          valeur={formaterMontant(stats.montantEnCours)}
          precision={`${formaterMontant(stats.montantTotal)} tous statuts confondus`}
          icone={<Euro aria-hidden className="size-4 text-muted-foreground" />}
        />
      </section>

      <section aria-label="Derniers projets" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Derniers projets</h2>
          {projets.length > 0 ? (
            <Link
              href="/projets"
              className={variantesBouton({ variante: 'lien', taille: 'petite' })}
            >
              Voir tout
            </Link>
          ) : null}
        </div>

        {/* Cinq lignes : au-delà, le tableau de bord répète la page « Projets ». */}
        <ListeProjets projets={projets.slice(0, 5)} />
      </section>
    </div>
  );
}
