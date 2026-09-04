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
 *
 * Ce choix a une frontière, et elle est plus proche qu'on ne croit :
 * **PostgREST plafonne une réponse à mille lignes** (`db.max-rows`, réglage par
 * défaut de Supabase). Au-delà, la requête réussit et rend mille lignes — sans
 * erreur, sans en-tête d'avertissement dans le corps de la réponse. Les totaux
 * affichés deviennent alors *faux* et non *lents*, ce qui est bien pire : un
 * chiffre présenté comme le total du compte client est en réalité celui des
 * mille premières lignes, et rien à l'écran ne le laisse deviner.
 *
 * D'où le `count: 'exact'` sur les deux requêtes. Il coûte un `count(*)` au
 * serveur et rend le nombre réel, que l'on compare à ce qui est arrivé. Quand
 * les deux diffèrent, la page le dit au lieu d'afficher un total inventé.
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
  /** Nombre réel de comptes, qui peut dépasser `clients.length`. */
  nombreDeComptes: number;
  /** Nombre réel de projets, qui peut dépasser ce qui a servi au montant. */
  nombreDeProjets: number;
  /** Somme des projets **reçus** : une minoration dès que `tronquee` est posée. */
  montantTotal: number;
  /**
   * Non nul quand le serveur a coupé la réponse. Porte ce qui manque, ligne
   * pour ligne — c'est la seule chose qui permette à la page de dire
   * honnêtement ce qu'elle montre.
   */
  tronquee: { comptes: number; projets: number } | null;
};

/** Totaux réels rendus par `count: 'exact'`, quand la requête les fournit. */
export type Totaux = { comptes: number | null; projets: number | null };

export async function lireVueAdministration(session: Session): Promise<VueAdministration> {
  const [profils, projets] = await Promise.all([
    session.client.from('profiles').select('*', { count: 'exact' }),
    session.client
      .from('projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false }),
  ]);

  if (profils.error || projets.error) {
    console.error('[socle-agence]', profils.error ?? projets.error);

    return {
      clients: [],
      nombreDeComptes: 0,
      nombreDeProjets: 0,
      montantTotal: 0,
      tronquee: null,
    };
  }

  return assemblerFiches(profils.data, projets.data, {
    comptes: profils.count,
    projets: projets.count,
  });
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
  totaux: Totaux = { comptes: null, projets: null },
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

  // `?? profils.length` : sans `count`, on ne sait rien de plus que ce qu'on a
  // reçu, et supposer une coupure inventerait un avertissement.
  const nombreDeComptes = totaux.comptes ?? profils.length;
  const nombreDeProjets = totaux.projets ?? projets.length;

  const comptesManquants = Math.max(0, nombreDeComptes - profils.length);
  const projetsManquants = Math.max(0, nombreDeProjets - projets.length);

  return {
    clients,
    nombreDeComptes,
    nombreDeProjets,
    montantTotal: projets.reduce((total, projet) => total + projet.amount_estimated, 0),
    tronquee:
      comptesManquants + projetsManquants > 0
        ? { comptes: comptesManquants, projets: projetsManquants }
        : null,
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
