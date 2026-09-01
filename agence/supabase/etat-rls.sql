-- Contrôle de dérive — à exécuter sur la base d'un projet **en production**.
--
-- `verifier-rls.sql` éprouve les politiques en jouant de vraies requêtes : il
-- lui faut une base jetable, et il écrit dans `auth.users`. On ne le passe donc
-- jamais sur le projet d'un client.
--
-- Celui-ci ne fait que lire les catalogues de PostgreSQL. Aucune écriture,
-- aucune transaction à annuler, rien à nettoyer : il répond à la seule question
-- qui compte une fois le socle livré — **la base ressemble-t-elle encore à ce
-- que le dépôt décrit ?**
--
-- C'est la question qui manquait. Le schéma s'applique en collant un fichier
-- dans un éditeur SQL ; il se modifie tout aussi facilement, un soir de
-- débogage, en désactivant une politique « juste pour voir ». Rien, ensuite,
-- ne le signale : l'intégration continue contrôle le dépôt, pas le projet du
-- client.
--
--   psql -v ON_ERROR_STOP=1 -f supabase/etat-rls.sql "postgresql://…"
--
-- Sans message, la base est conforme. Un écart interrompt le script en le
-- nommant.

\set ON_ERROR_STOP on

do $$
declare
  table_sans_rls text;
  politique text;
  attendues text[] := array[
    'Un utilisateur lit son propre profil',
    'Un administrateur lit tous les profils',
    'Un utilisateur modifie son propre profil',
    'Un utilisateur gère ses propres projets',
    'Un administrateur lit tous les projets'
  ];
begin
  -- 1. La RLS est-elle encore active ? Une politique reste visible dans le
  -- catalogue même quand la RLS est coupée : c'est la panne silencieuse type.
  select string_agg(c.relname, ', ') into table_sans_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'projects')
    and not c.relrowsecurity;

  if table_sans_rls is not null then
    raise exception 'RLS désactivée sur : %. Tout le contenu de ces tables est lisible par n''importe quel porteur de la clé publique.', table_sans_rls;
  end if;

  -- 2. Les cinq politiques du socle sont-elles toutes là ?
  foreach politique in array attendues loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and policyname = politique
    ) then
      raise exception 'Politique absente : « % ». Elle a été supprimée ou renommée depuis la livraison.', politique;
    end if;
  end loop;

  -- 3. Une politique ajoutée après coup est aussi une dérive : elle n'a jamais
  -- été éprouvée par `verifier-rls.sql`.
  select string_agg(policyname, ', ') into politique
  from pg_policies
  where schemaname = 'public'
    and tablename in ('profiles', 'projects')
    and not (policyname = any (attendues));

  if politique is not null then
    raise exception 'Politique inconnue du dépôt : « % ». Ajoutée à la main, elle n''a été éprouvée par aucun contrôle.', politique;
  end if;

  -- 4. Le verrou d'escalade de rôle : personne d'autre que le propriétaire ne
  -- doit pouvoir écrire `profiles.role`. C'est le privilège de colonne, pas la
  -- RLS, qui ferme cette porte — et un `grant` trop large la rouvre en silence.
  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and privilege_type = 'UPDATE'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'Le rôle est modifiable par un compte ordinaire : un utilisateur peut se déclarer administrateur.';
  end if;

  -- 5. `is_admin()` décide de tout ce qu'un administrateur voit. En
  -- `security definer`, elle s'exécute avec les droits de son propriétaire :
  -- un `search_path` non figé permettrait de lui faire lire une autre table.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ) then
    raise exception 'is_admin() manque, n''est plus « security definer », ou son search_path n''est plus figé.';
  end if;

  -- 6. `supprimer_mon_compte()` écrit dans `auth.users` : c'est la fonction la
  -- plus puissante du socle. Trois dérives la rendraient dangereuse, et aucune
  -- ne se voit à l'usage — l'application continuerait de fonctionner.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'supprimer_mon_compte'
      and p.prosecdef
      and p.pronargs = 0
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ) then
    raise exception 'supprimer_mon_compte() manque, a gagné un argument, n''est plus « security definer », ou son search_path n''est plus figé.';
  end if;

  -- Le droit d'exécution laissé à `public` est la dérive silencieuse par
  -- excellence : elle ouvre la fonction à tout porteur de la clé publique, et
  -- rien dans l'application ne change d'apparence. Le socle a déjà eu à
  -- reprendre exactement cet oubli sur une autre fonction.
  if has_function_privilege('public', 'public.supprimer_mon_compte()', 'execute')
     or has_function_privilege('public', 'public.handle_new_user()', 'execute')
     or has_function_privilege('public', 'public.is_admin()', 'execute') then
    raise exception 'Une fonction du socle est exécutable par « public » : le droit a été réaccordé après la livraison.';
  end if;

  raise notice 'Base conforme au socle : RLS active, cinq politiques, rôle verrouillé, fonctions intactes.';
end
$$;
