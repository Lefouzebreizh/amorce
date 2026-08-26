-- Contrôle des politiques de sécurité, joué sur une vraie base.
--
-- Une policy RLS se relit très bien et se trompe très bien : « chacun ses
-- données » paraît juste jusqu'au jour où l'on constate qu'un utilisateur
-- pouvait changer son propre rôle. Ces treize cas rejouent les attaques
-- évidentes, chacun depuis le rôle qui les tenterait en production.
--
-- Ils tournent hors de Supabase, sur un PostgreSQL local, grâce au schéma
-- `auth` simulé par `bac-a-sable.sh` — donc sans base de test à provisionner
-- et sans jamais toucher aux données du client.
--
--   .claude/skills/stack-agence-supabase/assets/bac-a-sable.sh
--
-- Le test 5 est celui qui compte : il échoue sur un schéma de démarrage
-- ordinaire, où la policy « modifier son propre profil » autorise aussi à
-- modifier sa colonne `role`.
--
-- Adapter les tables au domaine du client ; garder la structure : chaque cas
-- nomme l'attaque, et son intitulé est ce qu'on lit dans le compte rendu.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

-- Deux inscriptions, via le seul chemin réel : auth.users.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@ex.fr', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@ex.fr',   '{"full_name":"Bob"}');

insert into public.projects (user_id, title) values
  ('22222222-2222-2222-2222-222222222222', 'Projet secret de Bob');

do $$
begin
  -- 1. Le trigger d'inscription a bien créé les deux profils, rôle 'user'.
  if (select count(*) from public.profiles where role = 'user') = 2 then
    raise notice 'PASS 1 — le trigger crée un profil par inscrit, rôle « user »';
  else
    raise notice 'ECHEC 1 — profils créés : %', (select count(*) from public.profiles);
  end if;
end $$;

-- Alice se connecte.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$
declare n int;
begin
  -- 2. Alice ne voit que son profil.
  select count(*) into n from public.profiles;
  if n = 1 then raise notice 'PASS 2 — Alice ne voit qu''un profil, le sien';
  else raise notice 'ECHEC 2 — Alice voit % profils', n; end if;

  -- 3. Alice ne voit pas les projets de Bob.
  select count(*) into n from public.projects;
  if n = 0 then raise notice 'PASS 3 — les projets de Bob sont invisibles pour Alice';
  else raise notice 'ECHEC 3 — Alice voit % projets de Bob', n; end if;

  -- 4. Alice modifie son nom : autorisé.
  begin
    update public.profiles set full_name = 'Alice Durand' where id = auth.uid();
    raise notice 'PASS 4 — Alice peut modifier son nom';
  exception when others then
    raise notice 'ECHEC 4 — modification du nom refusée : %', sqlerrm;
  end;

  -- 5. LE TEST QUI COMPTE : Alice tente de se promouvoir administratrice.
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise notice 'ECHEC 5 — AUTO-PROMOTION EN ADMIN RÉUSSIE (faille ouverte)';
  exception when insufficient_privilege then
    raise notice 'PASS 5 — auto-promotion en admin refusée (droit de colonne)';
  end;

  -- 6. Alice tente de modifier le profil de Bob.
  update public.profiles set full_name = 'piraté' where id <> auth.uid();
  get diagnostics n = row_count;
  if n = 0 then raise notice 'PASS 6 — le profil de Bob est hors de portée d''Alice';
  else raise notice 'ECHEC 6 — % ligne(s) de Bob modifiée(s)', n; end if;

  -- 7. Alice crée un projet à son nom.
  begin
    insert into public.projects (user_id, title) values (auth.uid(), 'Mon projet');
    raise notice 'PASS 7 — Alice crée un projet à son nom';
  exception when others then
    raise notice 'ECHEC 7 — création refusée : %', sqlerrm;
  end;

  -- 8. Alice crée un projet au nom de Bob.
  begin
    insert into public.projects (user_id, title)
    values ('22222222-2222-2222-2222-222222222222', 'Faux projet de Bob');
    raise notice 'ECHEC 8 — Alice a créé un projet au nom de Bob';
  exception when insufficient_privilege then
    raise notice 'PASS 8 — création au nom d''autrui refusée (RLS)';
  end;

  -- 9. Alice tente de transférer son projet à Bob (fuite par mise à jour).
  begin
    update public.projects set user_id = '22222222-2222-2222-2222-222222222222';
    raise notice 'ECHEC 9 — Alice a déplacé un projet vers le compte de Bob';
  exception when insufficient_privilege then
    raise notice 'PASS 9 — transfert de propriété refusé (with check)';
  end;

  -- 10. Alice tente de créer un profil de toutes pièces.
  begin
    insert into public.profiles (id, role) values (gen_random_uuid(), 'admin');
    raise notice 'ECHEC 10 — Alice a fabriqué un profil admin';
  exception when insufficient_privilege then
    raise notice 'PASS 10 — création de profil réservée au serveur';
  end;

  -- 11. Le titre vide est refusé par la contrainte.
  begin
    insert into public.projects (user_id, title) values (auth.uid(), '   ');
    raise notice 'ECHEC 11 — un titre vide a été accepté';
  exception when check_violation then
    raise notice 'PASS 11 — un titre vide est refusé';
  end;
end $$;

reset role;

-- 12. `updated_at` bouge tout seul.
do $$
declare avant timestamptz; apres timestamptz;
begin
  select updated_at into avant from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';
  perform pg_sleep(0.05);
  update public.profiles set full_name = 'Alice D.'
   where id = '11111111-1111-1111-1111-111111111111';
  select updated_at into apres from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';
  if apres > avant then raise notice 'PASS 12 — updated_at est mis à jour par le trigger';
  else raise notice 'ECHEC 12 — updated_at n''a pas bougé'; end if;
end $$;

-- 13. Le rôle anonyme ne lit rien.
set role anon;
do $$
declare n int;
begin
  begin
    select count(*) into n from public.profiles;
    if n = 0 then raise notice 'PASS 13 — le visiteur anonyme ne lit aucun profil';
    else raise notice 'ECHEC 13 — le visiteur anonyme lit % profils', n; end if;
  exception when insufficient_privilege then
    raise notice 'PASS 13 — le visiteur anonyme n''a aucun droit sur profiles';
  end;
end $$;
reset role;
