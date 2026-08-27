-- Données de démonstration — à exécuter sur une base de démonstration, jamais
-- sur celle d'un client.
--
-- Pourquoi ce fichier existe : au premier rendez-vous, le socle montre un
-- tableau de bord à zéro, une liste vide et un état vide bien dessiné. C'est
-- honnête et parfaitement inutile pour juger de quoi que ce soit. Un client
-- n'achète pas une promesse d'écran rempli, il achète l'écran rempli.
--
-- Les projets sont rattachés à un compte **qui existe déjà** — le vôtre, créé
-- par le formulaire d'inscription comme n'importe qui. C'est ce que la RLS
-- impose : un projet n'est visible que par son propriétaire, donc des comptes
-- fictifs ne rempliraient l'écran de personne. Fabriquer de faux utilisateurs
-- dans `auth.users` demanderait en plus de leur inventer un mot de passe, qui
-- finirait versionné dans ce dépôt.
--
--   -- dans l'éditeur SQL de Supabase, ou par psql :
--   set demo.compte = 'vous@exemple.fr';
--   \i supabase/demo.sql
--
-- Rejouable : une seconde exécution remplace les données au lieu de les
-- empiler. Effaçable d'une ligne, donnée à la fin.

do $$
declare
  courriel text := nullif(current_setting('demo.compte', true), '');
  destinataire uuid;
  reels integer;
begin
  if courriel is null then
    raise exception
      'Indiquer le compte destinataire : set demo.compte = ''vous@exemple.fr'';';
  end if;

  select id into destinataire from auth.users where email = courriel;

  if destinataire is null then
    raise exception
      'Aucun compte pour « % ». Créez-le par le formulaire d''inscription d''abord.',
      courriel;
  end if;

  /*
   * Garde-fou. Ce script est fait pour une base de démonstration ; appliqué à
   * celle d'un client, il noie ses vrais projets sous une dizaine de faux, et
   * personne ne saura ensuite lesquels effacer. La présence d'autres comptes
   * est le signe le plus simple qu'on n'est pas là où on croit.
   */
  select count(*) into reels from public.profiles where id <> destinataire;

  if reels > 0 and nullif(current_setting('demo.forcer', true), '') is distinct from 'oui' then
    raise exception
      'Cette base porte % autre(s) compte(s) : ce n''est pas une base de démonstration. Pour passer outre en connaissance de cause : set demo.forcer = ''oui'';',
      reels;
  end if;

  -- Les identifiants tiennent dans un espace réservé (`de110…`) : c'est lui qui
  -- rend l'effacement sûr, sans avoir à deviner ce qui est faux.
  delete from public.projects
   where id::text like 'de110000-%';

  insert into public.projects (id, user_id, title, description, status, amount_estimated, created_at)
  values
    ('de110000-0000-0000-0000-000000000001', destinataire,
     'Refonte du site vitrine',
     'Six pages, reprise de la charte existante, mise en ligne avant la rentrée.',
     'in_progress', 8400.00, now() - interval '38 days'),
    ('de110000-0000-0000-0000-000000000002', destinataire,
     'Espace client et suivi de commandes',
     'Authentification, historique, relances automatiques par courriel.',
     'in_progress', 14500.00, now() - interval '31 days'),
    ('de110000-0000-0000-0000-000000000003', destinataire,
     'Migration de la boutique',
     'Reprise du catalogue et des comptes, sans coupure de service.',
     'in_progress', 22000.00, now() - interval '24 days'),
    ('de110000-0000-0000-0000-000000000004', destinataire,
     'Tableau de bord des ventes',
     'Trois indicateurs par magasin, mis à jour chaque nuit.',
     'completed', 6200.00, now() - interval '96 days'),
    ('de110000-0000-0000-0000-000000000005', destinataire,
     'Prise de rendez-vous en ligne',
     'Créneaux par praticien, rappel la veille, annulation sans appel.',
     'completed', 9800.00, now() - interval '74 days'),
    ('de110000-0000-0000-0000-000000000006', destinataire,
     'Refonte de la newsletter',
     null,
     'completed', 3100.00, now() - interval '61 days'),
    ('de110000-0000-0000-0000-000000000007', destinataire,
     'Application de saisie terrain',
     'Relevés hors connexion, synchronisés au retour du réseau.',
     'draft', 31000.00, now() - interval '12 days'),
    ('de110000-0000-0000-0000-000000000008', destinataire,
     'Portail fournisseurs',
     'Dépôt de factures, accusé de réception, suivi de paiement.',
     'draft', 18700.00, now() - interval '6 days'),
    ('de110000-0000-0000-0000-000000000009', destinataire,
     'Refonte de l''identité visuelle',
     null,
     'draft', 4500.00, now() - interval '3 days'),
    ('de110000-0000-0000-0000-000000000010', destinataire,
     'Audit d''accessibilité',
     'Parcours d''inscription et de commande, sur lecteur d''écran et au clavier.',
     'draft', 2400.00, now() - interval '1 day');

  raise notice 'Dix projets rattachés à % : 3 en cours, 3 terminés, 4 brouillons.', courriel;
end $$;

-- Pour tout retirer, sans rien deviner :
--
--   delete from public.projects where id::text like 'de110000-%';
