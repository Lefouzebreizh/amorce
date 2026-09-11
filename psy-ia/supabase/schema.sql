-- Schéma minimal de Psy IA.
--
-- Une seule table pour l'instant : le journal des déclenchements de la
-- couche 1 (détection de crise). Elle sert à deux choses : le seuil 2 de la
-- couche 3 (détresse qui revient sur plusieurs sessions distinctes) et la
-- revue humaine périodique (couche 4).
--
-- Choix volontaire, et non négociable sans en reparler à Erwann : cette
-- table ne stocke JAMAIS le texte d'un message, seulement qu'un signal a
-- été détecté, à quel niveau, et quand. C'est la même logique que
-- `le-coffre` pour les données sensibles : moins on stocke, moins on peut
-- fuiter. Non rejoué contre un vrai projet Supabase — voir TODO.md.

create table if not exists journal_crise (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant pseudonyme de la personne, jamais son adresse e-mail en
  -- clair ici (l'authentification, si elle existe, vit ailleurs).
  personne_id uuid not null,
  session_id text not null,
  niveau text not null check (niveau in ('modere', 'fort')),
  detecte_le timestamptz not null default now()
);

create index if not exists journal_crise_personne_idx on journal_crise (personne_id, detecte_le desc);

alter table journal_crise enable row level security;

-- Personne ne lit ce journal directement depuis le client : seule la
-- fonction Edge (clé de service) y écrit et le seuil 2 de la couche 3 le
-- lit côté serveur. Aucune policy `select`/`insert` pour le rôle `anon` ou
-- `authenticated` — c'est voulu, pas un oubli.
