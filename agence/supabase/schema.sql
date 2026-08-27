-- Schéma d'initialisation du socle — à exécuter tel quel dans l'éditeur SQL du
-- projet Supabase (Dashboard > SQL Editor > New query).
--
-- Le script est rejouable : il ne casse pas un projet où il a déjà tourné.
--
-- Trois décisions structurent ce fichier, et elles sont la raison pour laquelle
-- la sécurité tient sans une ligne de code applicatif :
--
--   1. La RLS est la seule barrière qui compte. L'application parle à
--      PostgreSQL avec la clé publique et le jeton de l'utilisateur ; ce sont
--      les politiques ci-dessous qui décident de ce qu'il voit. Une faille
--      d'interface ne peut donc pas exposer les données d'un autre client.
--   2. Un utilisateur ne peut pas s'accorder un rôle. La colonne `role` est
--      retirée des privilèges d'écriture de `authenticated` : sans cela,
--      « je modifie mon propre profil » suffit à devenir administrateur.
--   3. Les fonctions SECURITY DEFINER fixent `search_path`. Une fonction qui
--      s'exécute avec les droits du propriétaire et résout ses tables via le
--      chemin de recherche de l'appelant est une élévation de privilège.

-- ---------------------------------------------------------------------------
-- 1. Profils — le prolongement applicatif de `auth.users`
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    full_name text,
    company_name text,
    role text default 'user' not null check (role in ('user', 'admin', 'manager')),
    avatar_url text
);

comment on table public.profiles is
    'Données métier de l''utilisateur. `auth.users` reste la table d''identité, gérée par Supabase.';

-- ---------------------------------------------------------------------------
-- 2. Projets — la table de démonstration du socle
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null check (char_length(btrim(title)) between 1 and 120),
    description text check (description is null or char_length(description) <= 2000),
    status text default 'draft' not null check (status in ('draft', 'in_progress', 'completed')),
    -- Un montant estimé négatif n'existe pas ; la contrainte évite d'avoir à
    -- s'en souvenir dans chaque formulaire.
    amount_estimated numeric(10, 2) default 0.00 not null check (amount_estimated >= 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- La liste d'un utilisateur est le seul accès réel à cette table : sans cet
-- index, chaque affichage du tableau de bord parcourt tous les projets de tous
-- les clients avant que la RLS n'en écarte 99 %.
create index if not exists projects_user_id_created_at_idx
    on public.projects (user_id, created_at desc);

create index if not exists projects_status_idx
    on public.projects (user_id, status);

-- ---------------------------------------------------------------------------
-- 3. Horodatage de modification, posé par le serveur
-- ---------------------------------------------------------------------------

-- `updated_at` n'est pas confié au client : il est écrasé à chaque écriture.
-- La colonne est d'ailleurs absente des privilèges accordés plus bas.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc'::text, now());
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

-- ---------------------------------------------------------------------------
-- 4. Rôle courant, sans récursion
-- ---------------------------------------------------------------------------

-- Une politique de `profiles` qui interroge `profiles` pour connaître le rôle
-- se rappelle elle-même et PostgreSQL refuse la requête. La fonction s'exécute
-- donc avec les droits du propriétaire, ce qui la place hors RLS — et elle fixe
-- son `search_path` pour que cette dérogation ne serve à rien d'autre.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Activation de la RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Politiques
-- ---------------------------------------------------------------------------

-- `(select auth.uid())` plutôt que `auth.uid()` : entre parenthèses, PostgreSQL
-- évalue l'appel une fois pour la requête au lieu d'une fois par ligne. Sur une
-- liste de quelques centaines de projets, l'écart se voit.

drop policy if exists "Un utilisateur lit son propre profil" on public.profiles;
create policy "Un utilisateur lit son propre profil"
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "Un administrateur lit tous les profils" on public.profiles;
create policy "Un administrateur lit tous les profils"
    on public.profiles for select
    to authenticated
    using (public.is_admin());

-- Le WITH CHECK est ce qui empêche de réécrire la ligne d'un autre : sans lui,
-- la politique ne contrôlerait que les lignes lues, pas celles produites.
drop policy if exists "Un utilisateur modifie son propre profil" on public.profiles;
create policy "Un utilisateur modifie son propre profil"
    on public.profiles for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists "Un utilisateur gère ses propres projets" on public.projects;
create policy "Un utilisateur gère ses propres projets"
    on public.projects for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Un administrateur lit tous les projets" on public.projects;
create policy "Un administrateur lit tous les projets"
    on public.projects for select
    to authenticated
    using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Privilèges de colonnes — l'escalade de rôle se ferme ici
-- ---------------------------------------------------------------------------

-- Supabase accorde par défaut tous les privilèges à `anon` et `authenticated`
-- sur les nouvelles tables de `public`. La RLS filtre les lignes, mais pas les
-- colonnes : avec un simple `grant update`, « je modifie mon profil » permet
-- d'écrire `role = 'admin'`. Les privilèges sont donc repris à zéro puis
-- redonnés colonne par colonne.

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, company_name, avatar_url) on public.profiles to authenticated;

revoke all on public.projects from anon, authenticated;
grant select, insert, update, delete on public.projects to authenticated;

-- Un rôle ne se change donc plus que depuis le tableau de bord Supabase ou une
-- tâche serveur porteuse de la clé `service_role`, jamais depuis l'application.

-- ---------------------------------------------------------------------------
-- 8. Création automatique du profil à l'inscription
-- ---------------------------------------------------------------------------

-- Le profil doit exister avant la première requête de l'utilisateur : le créer
-- depuis l'application laisserait une fenêtre où « connecté mais sans profil »
-- est un état possible, et la moitié des écrans devrait le prévoir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, company_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  -- Rejouer le script ou réimporter un utilisateur ne doit pas faire échouer
  -- l'inscription sur une clé primaire déjà prise.
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Même reprise de privilèges que pour `is_admin()` plus haut : sans elle,
-- PostgreSQL laisse l'EXECUTE par défaut à PUBLIC, et Supabase publie la
-- fonction en `/rest/v1/rpc/handle_new_user` — son linter le signale sur un
-- projet neuf. Mesuré : l'appel direct est de toute façon refusé
-- (« trigger functions can only be called as triggers »), donc la brèche est
-- close par PostgreSQL avant de l'être par le privilège. La ligne reste parce
-- qu'une fonction SECURITY DEFINER laissée ouverte est un avertissement de
-- plus à trier chez chaque client, et qu'un tri se fait mal quand il est long.
-- Le déclencheur, lui, ne dépend pas de ce privilège : il continue de créer le
-- profil et d'en recopier les métadonnées.
revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 9. Rattrapage des comptes créés avant ce script
-- ---------------------------------------------------------------------------

insert into public.profiles (id, full_name, company_name, avatar_url)
select
    u.id,
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'company_name',
    u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 10. Effacement du compte, par son titulaire
-- ---------------------------------------------------------------------------

/*
 * Le RGPD donne à toute personne le droit d'obtenir l'effacement de ses données
 * (article 17). Sur un socle qui collecte nom, entreprise et adresse
 * électronique, ce n'est pas une option de confort : c'est une obligation, et
 * elle doit être exerçable sans écrire à personne.
 *
 * La difficulté est que l'identité vit dans `auth.users`, table de Supabase que
 * la clé publique ne touche pas. La voie habituelle est d'appeler
 * `auth.admin.deleteUser()` avec la clé `service_role` — celle qui contourne
 * toute la RLS. La faire porter à l'application reviendrait à loger dans le
 * serveur applicatif un passe-partout de la base entière, pour un usage que
 * l'utilisateur déclenche lui-même : mauvais échange.
 *
 * Cette fonction fait le même travail en restant dans le schéma, qui est déjà
 * la frontière de sécurité de ce socle. Trois propriétés la rendent sûre, et
 * aucune n'est décorative :
 *
 *   - **Elle ne prend aucun paramètre.** Il n'existe donc aucune façon de la
 *     pointer sur le compte d'un autre : la cible est `auth.uid()`, lue du
 *     jeton, et rien d'autre ne peut l'influencer.
 *   - **`security definer` avec `search_path` vide.** Elle s'exécute avec les
 *     droits du propriétaire — c'est ce qui lui donne accès à `auth.users` —
 *     mais ne peut pas être détournée en plaçant une table homonyme dans un
 *     schéma que l'appelant contrôle.
 *   - **`EXECUTE` retiré à `public`**, accordé au seul rôle `authenticated` :
 *     un visiteur anonyme, dont `auth.uid()` est nul, ne peut pas même
 *     l'appeler pour voir ce qui se passe.
 *
 * Le reste part par les clés étrangères : `profiles` est en `on delete
 * cascade` sur `auth.users`, et `projects` sur `profiles`. Aucune ligne de
 * l'utilisateur ne survit, et rien n'est à nettoyer à la main — un effacement
 * qui oublie une table est un effacement qui n'a pas eu lieu.
 */
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demandeur uuid := (select auth.uid());
begin
  if demandeur is null then
    raise exception 'Aucune session : l''effacement ne s''exerce que sur son propre compte.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from auth.users where id = demandeur;
end;
$$;

revoke all on function public.supprimer_mon_compte() from public;
grant execute on function public.supprimer_mon_compte() to authenticated;
