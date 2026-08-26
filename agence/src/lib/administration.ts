/*
 * Vue d'ensemble réservée aux administrateurs.
 *
 * Rien n'est filtré ici sur le rôle : les politiques `Un administrateur lit
 * tous les profils` et `Un administrateur lit tous les projets` élargissent
 * déjà ce que PostgreSQL sert à ces requêtes. Refaire le test en TypeScript
 * laisserait croire que c'est lui qui protège les données — et une autre
 * requête, écrite plus tard sans ce test, passerait pour sûre.
 *
 * Le rapprochement projets / clients se fait ici plutôt qu'en base : PostgREST
 * sait imbriquer les deux tables, mais deux requêtes à plat restent typées sans
 * acrobatie et se lisent d'un coup d'œil, pour un socle qui compte ses clients
 * en dizaines.
 */
import type { Session } from '@/lib/supabase/session';
import type { Profil, Projet } from '@/lib/types';

export type FicheClient = {
  profil: Profil;
  nombreDeProjets: number;
  montantTotal: number;
  dernierProjet: string | null;
};

export type VueAdministration = {
  clients: FicheClient[];
  nombreDeProjets: number;
  montantTotal: number;
};

export async function lireVueAdministration(session: Session): Promise<VueAdministration> {
  const [profils, projets] = await Promise.all([
    session.client.from('profiles').select('*'),
    session.client.from('projects').select('*').order('created_at', { ascending: false }),
  ]);

  if (profils.error || projets.error) {
    console.error('[socle-agence]', profils.error ?? projets.error);
    return { clients: [], nombreDeProjets: 0, montantTotal: 0 };
  }

  return assemblerFiches(profils.data, projets.data);
}

/**
 * Rapprochement pur, séparé de la requête pour être vérifiable sans base :
 * c'est ici que se joue ce qu'un administrateur lit, et un total faux ne se
 * remarque pas à l'écran.
 *
 * Les projets sont attendus du plus récent au plus ancien, comme les rend la
 * requête.
 */
export function assemblerFiches(
  profils: readonly Profil[],
  projets: readonly Projet[],
): VueAdministration {
  const fiches = new Map<string, FicheClient>();

  for (const profil of profils) {
    fiches.set(profil.id, {
      profil,
      nombreDeProjets: 0,
      montantTotal: 0,
      dernierProjet: null,
    });
  }

  for (const projet of projets) {
    const fiche = fiches.get(projet.user_id);

    // Un projet sans fiche correspondante n'arrive pas : la clé étrangère
    // l'interdit. Il arriverait en revanche si un jour la politique des projets
    // devenait plus large que celle des profils — mieux vaut l'ignorer que
    // planter la page.
    if (!fiche) {
      continue;
    }

    fiche.nombreDeProjets += 1;
    fiche.montantTotal += projet.amount_estimated;
    // Les projets arrivent du plus récent au plus ancien : le premier vu pour
    // un client est donc le bon.
    fiche.dernierProjet ??= projet.created_at;
  }

  const clients = [...fiches.values()].sort(comparerFiches);

  return {
    clients,
    nombreDeProjets: projets.length,
    montantTotal: projets.reduce((total, projet) => total + projet.amount_estimated, 0),
  };
}

/** Les clients les plus actifs d'abord ; à égalité, par ordre alphabétique. */
function comparerFiches(gauche: FicheClient, droite: FicheClient): number {
  if (gauche.nombreDeProjets !== droite.nombreDeProjets) {
    return droite.nombreDeProjets - gauche.nombreDeProjets;
  }

  return nomAffiche(gauche.profil).localeCompare(nomAffiche(droite.profil), 'fr');
}

export function nomAffiche(profil: Profil): string {
  return profil.full_name ?? profil.company_name ?? 'Compte sans nom';
}
