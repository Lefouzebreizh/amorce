import Link from 'next/link';

import { LIBELLES_STATUT, STATUTS_PROJET } from '@/lib/types';
import type { FiltreStatut } from '@/lib/projets';
import { cn } from '@/lib/utils';

/*
 * Filtre de la liste, écrit avec des liens et non des boutons : le filtre
 * choisi vit dans l'URL. Elle se partage, se met en favori, et le bouton
 * « précédent » du navigateur défait le filtre comme on s'y attend. Aucun
 * JavaScript n'est envoyé pour cela.
 */
const OPTIONS: { valeur: FiltreStatut; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  ...STATUTS_PROJET.map((statut) => ({ valeur: statut, libelle: LIBELLES_STATUT[statut] })),
];

export function FiltreStatuts({ actif }: { actif: FiltreStatut }) {
  return (
    <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
      {OPTIONS.map(({ valeur, libelle }) => (
        <Link
          key={valeur}
          href={valeur === 'tous' ? '/projets' : `/projets?statut=${valeur}`}
          aria-current={valeur === actif ? 'true' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors',
            valeur === actif
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {libelle}
        </Link>
      ))}
    </div>
  );
}
