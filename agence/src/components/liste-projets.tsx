import Link from 'next/link';
import { ArrowUpRight, FolderPlus } from 'lucide-react';

import { BadgeStatut } from '@/components/badge-statut';
import { variantesBouton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formaterDate, formaterMontant } from '@/lib/format';
import type { Projet } from '@/lib/types';

/*
 * Liste des projets. Chaque ligne est un lien complet et non une carte munie
 * d'un bouton : la cible tactile fait alors toute la largeur de l'écran.
 */
export function ListeProjets({ projets }: { projets: readonly Projet[] }) {
  if (projets.length === 0) {
    return <ListeVide />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {projets.map((projet) => (
        <li key={projet.id}>
          <Link
            href={`/projets/${projet.id}`}
            className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="transition-colors group-hover:border-ring/40 group-hover:bg-muted/40">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{projet.title}</span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {projet.description ?? 'Sans description'}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm font-medium tabular-nums">
                    {formaterMontant(projet.amount_estimated)}
                  </span>
                  <BadgeStatut statut={projet.status} />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formaterDate(projet.created_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListeVide() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <FolderPlus aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">Aucun projet pour le moment</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Créez une première fiche : un titre, un statut et le montant estimé suffisent à
          démarrer le suivi.
        </p>
        <Link href="/projets/nouveau" className={variantesBouton({ taille: 'petite' })}>
          Créer un projet
        </Link>
      </CardContent>
    </Card>
  );
}
