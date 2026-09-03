-- Le Coffre — schéma Supabase (Postgres + Storage)
--
-- Reconstruit depuis `src/lib/coffre.ts` le 03/09/2026, quand `le-coffre-hosted/`
-- a été retiré. Ce fichier existe parce que son absence était un vrai trou :
-- l'entête de `coffre.ts` renvoyait à « la migration
-- `creer_le_coffre_multi_utilisateurs` », qui ne vivait que dans le projet
-- Supabase — donc nulle part dans Git. Un dépôt fraîchement cloné portait le
-- client et pas la base qu'il interroge.
--
-- Ce n'est pas une copie du schéma qu'emportait la page seule : celle-ci
-- rangeait tout dans une table unique `coffres`, là où ce code-ci interroge
-- `coffre_cles`, `coffre_index` et le bucket `coffre-objets`. Recopier l'autre
-- aurait été pire qu'un fichier absent — il aurait eu l'air juste.
--
-- Ce qui est vérifié : chaque table, chaque colonne et chaque nom de bucket
-- ci-dessous est lu ou écrit par `src/lib/coffre.ts`, ligne à ligne. Ce qui ne
-- l'est pas : ce schéma n'a pas été rejoué contre un projet Supabase depuis ce
-- dépôt (`execute_sql` et `apply_migration` ne sont pas accordés). Il se pose à
-- la main dans l'éditeur SQL, et il est idempotent pour que ce soit sans risque.
--
-- La garantie tenue ici est celle de `SECURITY.md` : Supabase ne voit jamais la
-- phrase secrète ni la clé qui en dérive, seulement des octets opaques, un sel
-- et un vérificateur chiffré. L'isolement entre comptes est **refusé par
-- Postgres**, pas décidé par le client — une policy RLS tient là où un contrôle
-- écrit dans le JavaScript se contourne en ouvrant les outils de développement.

-- ---------------------------------------------------------------------------
-- 1. Les informations de clé : un coffre par compte.
-- ---------------------------------------------------------------------------
-- `sel` et `iterations` servent à redériver la clé ; `verificateur_*` est un
-- texte connu chiffré avec elle. Déverrouiller, c'est déchiffrer ce
-- vérificateur et comparer — le serveur ne participe pas à la décision.
create table if not exists public.coffre_cles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sel text not null,
  iterations integer not null default 600000,
  verificateur_iv text not null,
  verificateur_texte text not null,
  cree_le timestamptz not null default now()
);

alter table public.coffre_cles enable row level security;

-- Trois policies et pas une de plus : le code crée sa ligne, la relit, et ne la
-- modifie jamais. Pas de `delete` non plus — supprimer sa ligne de clés rendrait
-- tous les objets déjà déposés définitivement illisibles, sans rien effacer.
drop policy if exists "cles_proprietaire_lit" on public.coffre_cles;
create policy "cles_proprietaire_lit" on public.coffre_cles
  for select using (auth.uid() = user_id);

drop policy if exists "cles_proprietaire_cree" on public.coffre_cles;
create policy "cles_proprietaire_cree" on public.coffre_cles
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. L'index chiffré : ce qui porte les noms d'origine.
-- ---------------------------------------------------------------------------
-- `contenu` est le JSON de l'index, chiffré puis encodé en base64. C'est lui qui
-- fait que le stockage ne connaît que des noms opaques : sans la phrase secrète,
-- on peut compter les objets et voir leur taille, jamais savoir ce qu'ils sont.
create table if not exists public.coffre_index (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contenu text not null,
  mis_a_jour_le timestamptz not null default now()
);

alter table public.coffre_index enable row level security;

-- `sauvegarderIndex` fait un `upsert` : il lui faut insert **et** update, et la
-- clé primaire sur `user_id` est ce qui rend l'upsert possible. Retirer l'une
-- des deux policies casserait le dépôt d'un fichier au moment d'écrire l'index,
-- après que l'objet chiffré est déjà parti — l'état le plus désagréable.
drop policy if exists "index_proprietaire_lit" on public.coffre_index;
create policy "index_proprietaire_lit" on public.coffre_index
  for select using (auth.uid() = user_id);

drop policy if exists "index_proprietaire_cree" on public.coffre_index;
create policy "index_proprietaire_cree" on public.coffre_index
  for insert with check (auth.uid() = user_id);

drop policy if exists "index_proprietaire_met_a_jour" on public.coffre_index;
create policy "index_proprietaire_met_a_jour" on public.coffre_index
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Le stockage des objets chiffrés.
-- ---------------------------------------------------------------------------
-- Bucket **privé** : `public` à `false` n'est pas un détail de confort. Un
-- bucket public sert ses objets à qui connaît l'adresse, sans passer par aucune
-- policy — les octets resteraient chiffrés, mais le nombre, la taille et les
-- dates de dépôt de chacun seraient lisibles par n'importe qui.
insert into storage.buckets (id, name, public)
values ('coffre-objets', 'coffre-objets', false)
on conflict (id) do nothing;

-- Le chemin d'un objet est `<user_id>/<nom opaque>` — voir `deposerFichier`.
-- L'isolement tient donc à son premier segment, et `storage.foldername(name)`
-- est indexé à partir de 1, pas de 0.
drop policy if exists "objets_proprietaire_lit" on storage.objects;
create policy "objets_proprietaire_lit" on storage.objects
  for select using (
    bucket_id = 'coffre-objets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "objets_proprietaire_depose" on storage.objects;
create policy "objets_proprietaire_depose" on storage.objects
  for insert with check (
    bucket_id = 'coffre-objets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "objets_proprietaire_supprime" on storage.objects;
create policy "objets_proprietaire_supprime" on storage.objects
  for delete using (
    bucket_id = 'coffre-objets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
