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

-- ---------------------------------------------------------------------------
-- 4. Les échéances en clair : ce que la fonction d'alerte a le droit de voir.
-- ---------------------------------------------------------------------------
-- Ajoutée le 06/09/2026, après un audit interne : la table était interrogée par
-- le client (`coffre.ts`) et lue par l'Edge Function d'alertes, mais **absente
-- de ce schéma** — donc sa RLS n'était prouvée nulle part, et un clone neuf la
-- créait sans garde. Sans RLS, n'importe quel compte authentifié lit par
-- l'API PostgREST les dates d'échéance et les `user_id` de **tous** les autres.
--
-- Seules la date et un type ('rendezvous' ou rien) partent en clair : le libellé
-- et le contenu restent chiffrés dans l'index. `alerte_envoyee_le` est écrit par
-- la fonction d'alerte, en service_role, qui contourne la RLS par conception.
create table if not exists public.coffre_echeances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  objet_nom text not null,
  date text not null,
  type text,
  alerte_envoyee_le timestamptz
);

alter table public.coffre_echeances enable row level security;

-- Le client insère une échéance et la supprime avec le document — rien d'autre.
-- Pas de `select` client : il ne lit jamais cette table (l'index chiffré porte
-- ses échéances côté navigateur), et ne pas l'exposer évite qu'un compte lise
-- les dates d'un autre. La fonction d'alerte lit en service_role, hors RLS.
drop policy if exists "echeances_proprietaire_cree" on public.coffre_echeances;
create policy "echeances_proprietaire_cree" on public.coffre_echeances
  for insert with check (auth.uid() = user_id);

drop policy if exists "echeances_proprietaire_supprime" on public.coffre_echeances;
create policy "echeances_proprietaire_supprime" on public.coffre_echeances
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Le journal des tentatives : la deuxième barrière anti-force-brute.
-- ---------------------------------------------------------------------------
-- Même histoire que la table ci-dessus, et le trou y était plus grave. Le
-- compteur d'échecs récents (`tropDeTentatives`) refuse d'aller plus loin après
-- dix `reussie=false`. Sans RLS, un compte authentifié pouvait **supprimer ses
-- propres échecs** pour remettre le compteur à zéro et forcer la phrase secrète
-- sans fin — ou lire et polluer les tentatives d'autrui.
create table if not exists public.coffre_tentatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reussie boolean not null,
  le timestamptz not null default now()
);

alter table public.coffre_tentatives enable row level security;

-- Insert et select sur ses propres lignes, et **volontairement ni delete ni
-- update** : c'est ce qui empêche d'effacer ses échecs pour contourner le
-- plafond. Ce que la RLS ne peut pas faire, et qui reste une limite du design :
-- le compteur est appelé par le client, donc un attaquant qui pilote le
-- navigateur peut choisir de ne jamais journaliser un échec. Fermer cela
-- demanderait de déplacer la vérification côté serveur (RPC ou Edge) — décision
-- d'architecture, hors de ce correctif de schéma. Le PBKDF2 à 600 000
-- itérations reste la première barrière, celle qui ne dépend pas du client.
drop policy if exists "tentatives_proprietaire_cree" on public.coffre_tentatives;
create policy "tentatives_proprietaire_cree" on public.coffre_tentatives
  for insert with check (auth.uid() = user_id);

drop policy if exists "tentatives_proprietaire_lit" on public.coffre_tentatives;
create policy "tentatives_proprietaire_lit" on public.coffre_tentatives
  for select using (auth.uid() = user_id);
