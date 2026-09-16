-- Les Edge Functions de connexion et de récupération utilisent service_role :
-- elles doivent pouvoir retrouver l'identifiant et limiter les tentatives sans
-- ouvrir ces tables aux navigateurs anonymes ou authentifiés.

grant select on public.coffre_identifiants to service_role;
grant select, insert, delete on public.coffre_connexion_tentatives to service_role;
