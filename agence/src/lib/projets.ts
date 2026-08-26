/*
 * Lecture des projets.
 *
 * Les requêtes ne filtrent pas sur `user_id` : la politique RLS le fait déjà,
 * et l'écrire ici laisserait croire que la sécurité tient à cette ligne. Un
 * administrateur bénéficie d'ailleurs d'une politique plus large — filtrer en
 * TypeScript la lui retirerait sans que rien ne le dise.
 */
import type { Session } from '@/lib/supabase/session';
import type { Projet, StatutProjet } from '@/lib/types';
import { STATUTS_PROJET } from '@/lib/types';

/** Filtre de la liste : un statut, ou tous. */
export type FiltreStatut = StatutProjet | 'tous';

export function estFiltreStatut(valeur: string | undefined): valeur is FiltreStatut {
  if (valeur === undefined) {
    return false;
  }

  return valeur === 'tous' || (STATUTS_PROJET as readonly string[]).includes(valeur);
}

/*
 * Plafond volontaire. Le socle affiche une liste complète, sans pagination :
 * au-delà, la page devient illisible bien avant d'être lente. Le jour où un
 * client dépasse ce volume, c'est une pagination qu'il faut ajouter, pas un
 * plafond plus haut.
 */
const PLAFOND = 200;

export async function listerProjets(
  session: Session,
  filtre: FiltreStatut = 'tous',
): Promise<Projet[]> {
  let requete = session.client
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PLAFOND);

  if (filtre !== 'tous') {
    requete = requete.eq('status', filtre);
  }

  const { data, error } = await requete;

  if (error) {
    console.error('[socle-agence]', error);
    return [];
  }

  return data;
}

export async function lireProjet(session: Session, identifiant: string): Promise<Projet | null> {
  const { data, error } = await session.client
    .from('projects')
    .select('*')
    .eq('id', identifiant)
    .maybeSingle();

  if (error) {
    console.error('[socle-agence]', error);
    return null;
  }

  return data;
}

export type Statistiques = {
  total: number;
  parStatut: Record<StatutProjet, number>;
  montantTotal: number;
  montantEnCours: number;
};

export function calculerStatistiques(projets: readonly Projet[]): Statistiques {
  const parStatut: Record<StatutProjet, number> = {
    draft: 0,
    in_progress: 0,
    completed: 0,
  };

  let montantTotal = 0;
  let montantEnCours = 0;

  for (const projet of projets) {
    parStatut[projet.status] += 1;
    montantTotal += projet.amount_estimated;

    if (projet.status === 'in_progress') {
      montantEnCours += projet.amount_estimated;
    }
  }

  return { total: projets.length, parStatut, montantTotal, montantEnCours };
}
