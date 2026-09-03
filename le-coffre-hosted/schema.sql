-- Le Coffre — schéma Supabase (Postgres + Storage)
--
-- Même garantie que la version locale de Life-Organizer : ce serveur (ici,
-- Supabase) ne voit jamais la phrase secrète ni la clé qui en dérive, ni le
-- contenu en clair d'un document. Il ne stocke que des blobs opaques, un sel
-- et un vérificateur — comparables à un hachage de mot de passe classique.
-- Auth Supabase fournit le compte (email + mot de passe) ; RLS (Row Level
-- Security) fait tout le travail d'isolement entre utilisateurs, pas le code
-- applicatif — une politique mal écrite dans un backend serait un risque,
-- une politique RLS refusée par Postgres lui-même ne l'est pas.

-- Un coffre par utilisateur, identifié par son compte Supabase Auth.
create table if not exists public.coffres (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sel text not null,
  iterations integer not null default 600000,
  verificateur_iv text not null,
  verificateur_texte text not null,
  index_chiffre text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

alter table public.coffres enable row level security;

-- Chacun ne voit et ne modifie que sa propre ligne — jamais celle d'un autre,
-- même en cas de bug côté frontend : c'est Postgres qui refuse, pas le JS.
create policy "coffre_propriétaire_lit" on public.coffres
  for select using (auth.uid() = user_id);

create policy "coffre_propriétaire_crée" on public.coffres
  for insert with check (auth.uid() = user_id);

create policy "coffre_propriétaire_met_à_jour" on public.coffres
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Un coffre s'efface avec le compte (on_delete cascade) — jamais autrement :
-- la suppression réelle d'un document reste un geste explicite, jamais un
-- effet de bord.

create or replace function public.toucher_maj_le()
returns trigger as $$
begin
  new.maj_le = now();
  return new;
end;
$$ language plpgsql;

create trigger coffres_maj_le
  before update on public.coffres
  for each row execute function public.toucher_maj_le();

-- Les policies RLS ci-dessus filtrent les LIGNES, mais Postgres exige en plus
-- des droits de base sur la TABLE — sans ce GRANT, tout utilisateur connecté
-- (rôle authenticated) se heurte à "permission denied" avant même que RLS
-- n'entre en jeu. Repéré en testant l'inscription réelle : la table existait,
-- RLS était activée, et pourtant rien ne passait tant que ce GRANT manquait.
grant select, insert, update on public.coffres to authenticated;

-- Stockage des documents chiffrés : un bucket privé, chemin
-- "<user_id>/<nom_opaque>" — même principe que modules/coffre/stockage.py en
-- local (noms aléatoires, aucun rapport avec le nom d'origine, qui vit
-- uniquement dans l'index chiffré ci-dessus).
insert into storage.buckets (id, name, public)
values ('coffre-objets', 'coffre-objets', false)
on conflict (id) do nothing;

create policy "objets_propriétaire_lit" on storage.objects
  for select using (
    bucket_id = 'coffre-objets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "objets_propriétaire_dépose" on storage.objects
  for insert with check (
    bucket_id = 'coffre-objets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "objets_propriétaire_supprime" on storage.objects
  for delete using (
    bucket_id = 'coffre-objets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Volontairement absent : une politique "update" sur storage.objects — un
-- blob chiffré ne se corrige pas, il se remplace (supprimer puis déposer),
-- exactement le choix déjà fait par modules/coffre/stockage.py en local.
