-- Contrôle des politiques de sécurité — à exécuter tel quel dans l'éditeur SQL
-- du projet Supabase, après `supabase/schema.sql`.
--
-- Pourquoi ce fichier existe : ni TypeScript, ni les tests unitaires, ni le
-- build ne voient une politique RLS. Une politique trop large ne se remarque
-- qu'en production, et par la mauvaise personne. Ce script est le seul endroit
-- où la question « qui peut lire quoi » reçoit une réponse vérifiée.
--
-- Il ne laisse aucune trace : tout se passe dans une transaction annulée à la
-- fin. Les trois comptes de test n'existent que le temps des contrôles.
--
-- Un contrôle qui échoue interrompt le script avec une phrase qui dit lequel.
-- Sans message, tout est conforme.

begin;

-- ---------------------------------------------------------------------------
-- Décor : trois comptes, quatre projets
-- ---------------------------------------------------------------------------

-- Le trigger `on_auth_user_created` crée les profils : ne pas les insérer ici,
-- c'est aussi le vérifier.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@controle.test', '{"full_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@controle.test', '{"full_name": "Bruno"}'),
  ('33333333-3333-3333-3333-333333333333', 'adele@controle.test', '{"full_name": "Adèle"}');

-- Le rôle ne se donne que depuis le serveur : c'est précisément ce que les
-- contrôles plus bas cherchent à mettre en défaut.
update public.profiles
   set role = 'admin'
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.projects (id, user_id, title, amount_estimated, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Site vitrine', 1000, 'draft'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Refonte', 2000, 'in_progress'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Boutique', 3000, 'completed');

do $$
begin
  if (select count(*) from public.profiles) <> 3 then
    raise exception 'Le trigger d''inscription n''a pas créé un profil par compte.';
  end if;

  if (select full_name from public.profiles
       where id = '11111111-1111-1111-1111-111111111111') is distinct from 'Alice' then
    raise exception 'Le trigger d''inscription ne recopie pas les métadonnées du compte.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Alice, utilisatrice ordinaire
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

do $$
declare
  refuse boolean;
  lignes integer;
begin
  if (select count(*) from public.projects) <> 2 then
    raise exception 'Alice voit des projets qui ne sont pas les siens.';
  end if;

  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Alice voit le profil d''un autre compte.';
  end if;

  -- Créer un projet au nom de quelqu'un d'autre : refusé par le WITH CHECK.
  refuse := false;
  begin
    insert into public.projects (user_id, title)
    values ('22222222-2222-2222-2222-222222222222', 'Projet déposé chez autrui');
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un utilisateur peut créer un projet au nom d''un autre.';
  end if;

  -- Modifier le projet d'un autre : la ligne n'est pas visible, donc pas
  -- modifiable. PostgreSQL ne lève rien, il ne touche simplement rien — c'est
  -- pourquoi le contrôle porte sur le nombre de lignes.
  update public.projects set title = 'Détourné'
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics lignes = row_count;
  if lignes <> 0 then
    raise exception 'FAILLE : un utilisateur peut modifier le projet d''un autre.';
  end if;

  delete from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics lignes = row_count;
  if lignes <> 0 then
    raise exception 'FAILLE : un utilisateur peut supprimer le projet d''un autre.';
  end if;

  -- Le cœur du sujet : s'accorder un rôle en modifiant son propre profil.
  refuse := false;
  begin
    update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111';
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un utilisateur peut s''accorder le rôle administrateur.';
  end if;

  -- Réécrire l'horodatage de modification est refusé de la même façon : la
  -- colonne appartient au serveur.
  refuse := false;
  begin
    update public.profiles set updated_at = '1970-01-01'
     where id = '11111111-1111-1111-1111-111111111111';
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un utilisateur peut antidater son propre profil.';
  end if;

  -- Ce qui doit marcher : modifier son nom, créer son projet.
  update public.profiles set full_name = 'Alice Martin'
   where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics lignes = row_count;
  if lignes <> 1 then
    raise exception 'Un utilisateur ne peut plus modifier son propre profil.';
  end if;

  insert into public.projects (user_id, title, amount_estimated)
  values ('11111111-1111-1111-1111-111111111111', 'Nouveau projet', 500);

  if (select count(*) from public.projects) <> 3 then
    raise exception 'Un utilisateur ne peut plus créer ses propres projets.';
  end if;

  -- Les contraintes de la table valent pour tout le monde, application
  -- comprise : un montant négatif ou un titre vide n'atteint jamais la base.
  refuse := false;
  begin
    insert into public.projects (user_id, title, amount_estimated)
    values ('11111111-1111-1111-1111-111111111111', 'Montant absurde', -1);
  exception when check_violation then
    refuse := true;
  end;
  if not refuse then
    raise exception 'Un montant estimé négatif est accepté par la base.';
  end if;

  refuse := false;
  begin
    insert into public.projects (user_id, title)
    values ('11111111-1111-1111-1111-111111111111', '   ');
  exception when check_violation then
    refuse := true;
  end;
  if not refuse then
    raise exception 'Un titre vide est accepté par la base.';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Adèle, administratrice : elle lit tout, elle n'écrit rien de plus
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

do $$
declare
  lignes integer;
  refuse boolean;
begin
  if not public.is_admin() then
    raise exception 'La fonction is_admin() ne reconnaît pas un administrateur.';
  end if;

  if (select count(*) from public.profiles) <> 3 then
    raise exception 'Un administrateur ne voit pas tous les profils.';
  end if;

  if (select count(*) from public.projects) <> 4 then
    raise exception 'Un administrateur ne voit pas tous les projets.';
  end if;

  -- La politique d'administration ouvre la lecture, et elle seule.
  update public.projects set title = 'Corrigé d''autorité'
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics lignes = row_count;
  if lignes <> 0 then
    raise exception 'FAILLE : un administrateur peut modifier le projet d''un client.';
  end if;

  -- Supprimer un profil est refusé plus tôt encore : le privilège DELETE sur
  -- `profiles` n'est accordé à personne côté client. Un compte se ferme depuis
  -- `auth.users`, et la suppression descend par la clé étrangère.
  refuse := false;
  begin
    delete from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un administrateur peut supprimer le profil d''un client.';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Le visiteur anonyme, qui porte la même clé publique que tout le monde
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);
set local role anon;

do $$
declare
  refuse boolean := false;
begin
  begin
    perform count(*) from public.projects;
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un visiteur anonyme atteint la table des projets.';
  end if;

  refuse := false;
  begin
    perform count(*) from public.profiles;
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un visiteur anonyme atteint la table des profils.';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- L'effacement du compte, qui touche `auth.users`
-- ---------------------------------------------------------------------------

-- Cette fonction est la seule du socle à écrire hors de `public`. Elle mérite
-- donc d'être éprouvée comme une politique : ce qu'elle refuse compte autant
-- que ce qu'elle fait.

select set_config('request.jwt.claims', '', true);
set local role anon;

do $$
declare
  refuse boolean := false;
begin
  begin
    perform public.supprimer_mon_compte();
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : un visiteur anonyme peut appeler l''effacement de compte.';
  end if;
end $$;

reset role;

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

do $$
declare
  refuse boolean := false;
begin
  -- La fonction ne prend aucun paramètre : viser le compte d'un autre n'est pas
  -- « refusé », c'est impossible à formuler. Ce contrôle-ci garde cette forme,
  -- car lui ajouter un argument un jour rouvrirait la porte en silence.
  begin
    perform public.supprimer_mon_compte('11111111-1111-1111-1111-111111111111');
  exception when undefined_function then
    refuse := true;
  end;
  if not refuse then
    raise exception 'FAILLE : l''effacement accepte un identifiant en argument.';
  end if;

  perform public.supprimer_mon_compte();
end $$;

reset role;

do $$
begin
  if exists (select 1 from auth.users where id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'Le compte effacé existe encore.';
  end if;

  if exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'Le profil du compte effacé a survécu : la cascade ne suit pas.';
  end if;

  if exists (select 1 from public.projects
              where user_id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'Les projets du compte effacé ont survécu : la cascade ne suit pas.';
  end if;

  -- Et surtout : personne d'autre n'a été emporté.
  if not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FAILLE : l''effacement a emporté le compte d''un autre.';
  end if;
end $$;

do $$
begin
  raise notice 'Politiques conformes : lecture, écriture, rôles, anonymat et effacement contrôlés.';
end $$;

-- Rien de tout cela ne reste : les comptes de test, leurs profils et leurs
-- projets disparaissent avec la transaction.
rollback;
