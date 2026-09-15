-- Sécurisation de lancement Mon Tiroir Secret : aucun accès aux données,
-- uniquement DDL pour fermer la surface RPC, optimiser RLS et indexer les FK.

revoke execute on function public.coffre_verifier_quota() from public, anon, authenticated;
grant execute on function public.coffre_verifier_quota() to service_role;

create index if not exists coffre_echeances_user_id_idx on public.coffre_echeances (user_id);

alter policy "chacun lit sa propre clé" on public.coffre_cles
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "chacun crée sa propre clé une seule fois" on public.coffre_cles
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "chacun lit son propre index" on public.coffre_index
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "chacun écrit son propre index" on public.coffre_index
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "chacun met à jour son propre index" on public.coffre_index
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "coffre_proprietaire_lit" on public.coffres
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "coffre_proprietaire_cree" on public.coffres
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "coffre_proprietaire_met_a_jour" on public.coffres
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "echeances_proprietaire_lit" on public.coffre_echeances
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "echeances_proprietaire_cree" on public.coffre_echeances
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "echeances_proprietaire_supprime" on public.coffre_echeances
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "tentatives_proprietaire_lit" on public.coffre_tentatives
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "tentatives_proprietaire_cree" on public.coffre_tentatives
  to authenticated
  with check ((select auth.uid()) = user_id);
