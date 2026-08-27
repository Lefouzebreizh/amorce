-- Ce que Supabase fournit avant que `supabase/schema.sql` ne s'exécute.
--
-- Ce fichier n'est **pas** livré au client : il ne sert qu'à faire tourner
-- `supabase/verifier-rls.sql` sur un PostgreSQL ordinaire, en intégration
-- continue ou sur un poste de développement. Sur un vrai projet Supabase, tout
-- ce qui suit existe déjà.
--
-- Il reproduit trois choses, et la troisième est la plus importante :
--
--   1. les rôles `anon` et `authenticated`, sous lesquels PostgREST exécute les
--      requêtes du navigateur ;
--   2. `auth.users` et `auth.uid()`, la source d'identité ;
--   3. les privilèges accordés d'office par Supabase sur tout ce qui est créé
--      dans `public`. Sans eux, le `revoke` du schéma n'aurait rien à reprendre
--      et le test de l'escalade de rôle passerait pour de mauvaises raisons.

-- Les rôles appartiennent au serveur et non à la base : ils survivent à la
-- suppression de la base de contrôle, et deux exécutions d'affilée les
-- retrouveraient déjà là.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant anon, authenticated, service_role to current_user;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Version réduite de la table d'identité : seules les colonnes que le socle lit
-- ou écrit. Les autres n'entrent dans aucune politique.
create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

-- L'identité de l'appelant vient du jeton, transmis par PostgREST dans un
-- paramètre de session. C'est la définition de Supabase, à l'identique.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  -- `nullif` **avant** la conversion, comme le fait Supabase : un paramètre vide
  -- ou absent doit rendre nul, pas lever « invalid input syntax for type json ».
  -- L'ordre inverse paraît équivalent et ne l'est pas — il fait échouer toute
  -- politique évaluée hors session, et le contrôle accuse alors le mauvais
  -- coupable.
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Le point décisif : Supabase ouvre par défaut tous les privilèges sur les
-- tables de `public`. C'est de là que vient l'escalade de rôle que le schéma
-- referme, et c'est ce que ce test doit pouvoir reproduire.
alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
