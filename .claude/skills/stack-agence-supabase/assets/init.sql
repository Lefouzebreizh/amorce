-- Socle d'initialisation Supabase — profils et projets.
--
-- Rejouable : chaque objet est créé sous condition, les triggers sont
-- reposés. Le rejouer sur une base déjà initialisée ne perd aucune donnée.
--
-- Trois décisions structurent ce fichier, et chacune corrige un piège qui
-- se paie cher en production :
--
--   1. Les droits d'écriture sont accordés colonne par colonne. Une policy
--      RLS choisit les *lignes* qu'on a le droit de modifier, jamais les
--      *colonnes* : sans les GRANT ci-dessous, « je modifie mon profil »
--      inclut « je passe mon rôle à admin ».
--   2. `auth.uid()` est enveloppé dans un sous-select. PostgreSQL le traite
--      alors comme une constante évaluée une fois, au lieu de rappeler la
--      fonction pour chaque ligne examinée.
--   3. Les fonctions SECURITY DEFINER fixent `search_path`. Sans cela, un
--      objet homonyme créé dans un schéma que l'appelant contrôle peut être
--      exécuté avec les droits du propriétaire de la fonction.

-- ---------------------------------------------------------------------------
-- 1. Profils — le prolongement applicatif de `auth.users`
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  full_name    text,
  company_name text,
  role         text not null default 'user' check (role in ('user', 'manager', 'admin')),
  avatar_url   text,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

comment on column public.profiles.role is
  'Modifiable uniquement côté serveur (service_role) : voir les GRANT plus bas.';

-- ---------------------------------------------------------------------------
-- 2. Projets — table métier d'exemple, à remplacer par le domaine du client
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (length(trim(title)) between 1 and 200),
  description      text,
  status           text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
  amount_estimated numeric(10, 2) not null default 0 check (amount_estimated >= 0),
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- Chaque policy filtre sur `user_id` : sans cet index, toute lecture parcourt
-- la table entière avant de jeter les lignes des autres.
create index if not exists projects_user_id_created_at_idx
  on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Droits de table — ce que le rôle a le droit de faire, colonne comprise
-- ---------------------------------------------------------------------------
--
-- Supabase accorde par défaut tous les droits sur le schéma `public` aux rôles
-- `anon` et `authenticated`. On repart donc de zéro et on n'accorde que le
-- nécessaire. Ne jamais remplacer le GRANT ciblé ci-dessous par un
-- `grant update on public.profiles` : cela rouvre l'auto-promotion en admin.

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, company_name, avatar_url) on public.profiles to authenticated;

revoke all on public.projects from anon, authenticated;
grant select, insert, update, delete on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sécurité au niveau ligne
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

drop policy if exists "Lire son propre profil" on public.profiles;
create policy "Lire son propre profil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- `with check` est écrit alors que PostgreSQL réutiliserait `using` en son
-- absence : la règle par défaut est facile à oublier, et le jour où l'on ajoute
-- un `using` plus permissif que le contrôle d'écriture voulu, l'oubli devient
-- une faille. Deux lignes explicites valent mieux qu'une règle mémorisée.
drop policy if exists "Modifier son propre profil" on public.profiles;
create policy "Modifier son propre profil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Lire ses projets" on public.projects;
create policy "Lire ses projets"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Créer ses projets" on public.projects;
create policy "Créer ses projets"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Modifier ses projets" on public.projects;
create policy "Modifier ses projets"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Supprimer ses projets" on public.projects;
create policy "Supprimer ses projets"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Automatismes
-- ---------------------------------------------------------------------------

-- Horodatage de modification. Le faire écrire par le client serait déclaratif :
-- il suffirait d'omettre le champ pour mentir sur la fraîcheur de la ligne.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- Création du profil à l'inscription. SECURITY DEFINER parce que le nouvel
-- inscrit n'a, à cet instant, aucun droit d'écriture sur `profiles` — et il ne
-- doit pas en avoir, sinon il choisirait son rôle.
--
-- `on conflict do nothing` : une erreur ici ferait échouer l'inscription
-- entière côté Auth, avec un message que l'utilisateur ne peut pas comprendre.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
