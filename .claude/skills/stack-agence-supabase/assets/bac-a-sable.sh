#!/bin/bash
# Monte un PostgreSQL jetable, y simule le schéma `auth` de Supabase, applique
# `init.sql` puis joue `tests-rls.sql`.
#
# Pourquoi un bac à sable plutôt que la base du client : les politiques de
# sécurité se testent en tentant de les violer, et on ne tente pas cela sur des
# données réelles. Une instance locale se jette après usage, et le même script
# tourne en intégration continue.
#
# Deux points appris en le construisant :
#   - `initdb` refuse de tourner en root : d'où le `su postgres`.
#   - Les rôles PostgreSQL sont globaux au cluster, pas à la base : les créer
#     une seule fois, sinon le second appel échoue sur « role already exists ».

set -euo pipefail

ici="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base="${BAC_A_SABLE:-/tmp/bac-supabase}"
port="${PGPORT_TEST:-55432}"

export PATH="$PATH:$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"
command -v initdb >/dev/null || { echo "PostgreSQL absent (paquet postgresql)"; exit 1; }

rm -rf "$base"; mkdir -p "$base"
if [ "$(id -u)" = 0 ]; then
  chown postgres:postgres "$base"
  lance() { su postgres -c "PATH=$PATH; $*"; }
else
  lance() { eval "$*"; }
fi

lance "initdb -D $base/data -U postgres --auth=trust" >/dev/null
lance "pg_ctl -D $base/data -o '-k $base -p $port -c listen_addresses=' -l $base/log start" >/dev/null
trap 'lance "pg_ctl -D $base/data -m immediate stop" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 20); do pg_isready -h "$base" -p "$port" >/dev/null 2>&1 && break; sleep 0.5; done

export PGHOST="$base" PGPORT="$port" PGUSER=postgres PGDATABASE=postgres

# Le strict nécessaire de Supabase : les trois rôles, le schéma `auth`, et
# `auth.uid()` qui lit l'identifiant du porteur du jeton. Supabase accorde par
# défaut tous les droits sur `public` aux rôles publics — on reproduit ce
# point de départ, sinon le `revoke all` d'init.sql ne prouverait rien.
psql -q -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
SQL

echo "── Schéma"
psql -q -v ON_ERROR_STOP=1 -f "$ici/init.sql" 2>&1 | grep -v 'NOTICE:' || true
echo "── Rejeu (le script doit être idempotent)"
psql -q -v ON_ERROR_STOP=1 -f "$ici/init.sql" 2>&1 | grep -v 'NOTICE:' || true

echo "── Politiques de sécurité"
resultat="$(psql -f "$ici/tests-rls.sql" 2>&1 | grep -oE '(PASS|ECHEC) [0-9]+ —.*' || true)"
echo "$resultat" | sed 's/^/   /'

if echo "$resultat" | grep -q '^ECHEC'; then
  echo "── Verdict : au moins une politique laisse passer ce qu'elle devrait refuser."
  exit 1
fi
echo "── Verdict : $(echo "$resultat" | grep -c '^PASS') contrôles passés."
