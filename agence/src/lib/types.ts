/*
 * Types de la base, écrits à la main plutôt que générés.
 *
 * `supabase gen types` produit le même fichier, mais exige un projet joignable
 * et la CLI installée — deux choses qu'un poste qui vient de cloner le dépôt
 * n'a pas. Le socle tient dans un seul schéma de deux tables : le maintenir à
 * la main coûte moins cher qu'une étape de génération à ne jamais oublier.
 *
 * En contrepartie, ce fichier est le miroir exact de `supabase/schema.sql`.
 * Toute colonne ajoutée là-bas s'ajoute ici, sans quoi TypeScript laisse passer
 * une requête que PostgreSQL refusera.
 */

/** Les trois états d'un projet, tels que la contrainte CHECK les impose. */
export const STATUTS_PROJET = ['draft', 'in_progress', 'completed'] as const;
export type StatutProjet = (typeof STATUTS_PROJET)[number];

/** Les rôles applicatifs. Seul le serveur peut les écrire (voir le schéma). */
export const ROLES = ['user', 'admin', 'manager'] as const;
export type Role = (typeof ROLES)[number];

/** Libellés affichés — le reste de l'application ne connaît que ces clés. */
export const LIBELLES_STATUT: Record<StatutProjet, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  completed: 'Terminé',
};

export const LIBELLES_ROLE: Record<Role, string> = {
  user: 'Utilisateur',
  admin: 'Administrateur',
  manager: 'Responsable',
};

export type Profil = {
  id: string;
  updated_at: string;
  full_name: string | null;
  company_name: string | null;
  role: Role;
  avatar_url: string | null;
};

export type Projet = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: StatutProjet;
  amount_estimated: number;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profil;
        // `id` vient de `auth.users` et le trigger d'inscription pose la ligne :
        // l'application n'insère jamais de profil elle-même.
        Insert: {
          id: string;
          updated_at?: string;
          full_name?: string | null;
          company_name?: string | null;
          role?: Role;
          avatar_url?: string | null;
        };
        // `role` est absent volontairement : la colonne n'est pas accordée en
        // écriture au rôle `authenticated`. La refuser aussi côté types évite
        // d'écrire un appel qui échouerait à l'exécution.
        Update: {
          full_name?: string | null;
          company_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: Projet;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: StatutProjet;
          amount_estimated?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: StatutProjet;
          amount_estimated?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      // Sans argument, et c'est sa garantie : la cible est `auth.uid()`, jamais
      // un identifiant fourni par l'appelant.
      supprimer_mon_compte: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
