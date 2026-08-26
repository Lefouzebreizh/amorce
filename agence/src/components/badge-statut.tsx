import { Badge, type ProprietesBadge } from '@/components/ui/badge';
import { LIBELLES_STATUT, type StatutProjet } from '@/lib/types';

/*
 * Un statut se lit à la couleur, mais jamais à la couleur seule : le libellé
 * est toujours écrit. Une pastille verte muette ne dit rien à qui ne distingue
 * pas le vert du gris — soit près d'un homme sur douze.
 */
const VARIANTES: Record<StatutProjet, NonNullable<ProprietesBadge['variante']>> = {
  draft: 'neutre',
  in_progress: 'information',
  completed: 'succes',
};

export function BadgeStatut({ statut }: { statut: StatutProjet }) {
  return <Badge variante={VARIANTES[statut]}>{LIBELLES_STATUT[statut]}</Badge>;
}
