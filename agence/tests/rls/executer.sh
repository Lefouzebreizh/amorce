#!/usr/bin/env bash
# Exécute `supabase/verifier-rls.sql` sur un PostgreSQL ordinaire.
#
# Le script de contrôle est écrit pour l'éditeur SQL de Supabase ; il tourne
# aussi bien ici, à condition de lui fournir ce que Supabase fournit d'office
# (rôles, `auth.users`, `auth.uid()`, privilèges par défaut). C'est le rôle de
# `socle-supabase.sql`.
#
# La base est fabriquée puis jetée à chaque exécution : un contrôle qui dépend
# de ce qu'une exécution précédente a laissé ne contrôle plus rien.
#
# Connexion : les variables habituelles de libpq (PGHOST, PGUSER, PGPASSWORD).
# Sans elles, la connexion se fait par la prise locale, en superutilisateur.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

if ! command -v psql >/dev/null; then
  {
    echo "psql est introuvable : ce contrôle a besoin d'un PostgreSQL."
    echo "Le plus court, sans rien installer :"
    echo "  docker run --rm -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 --name postgres-controle postgres:16"
    echo "  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:rls"
  } >&2
  exit 1
fi

# Aucun serveur joignable : en monter un, jetable, plutôt que de renoncer.
#
# L'intégration continue fournit le sien et ne passe jamais ici. Une session
# distante, elle, n'a que le binaire `docker` sans démon derrière : la voie
# indiquée plus haut y échoue, et un contrôle qu'on ne peut pas lancer là où
# l'on travaille finit par n'être jamais lancé.
#
# Deux obstacles, tous deux propres à ce terrain : les binaires du serveur ne
# sont pas dans le PATH (seuls les clients y sont), et `initdb` refuse de
# s'exécuter en root — d'où le détour par l'utilisateur `postgres`, à qui le
# répertoire doit appartenir.
if ! pg_isready -q 2>/dev/null; then
  PATH="$PATH:$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"
  export PATH

  if ! command -v initdb >/dev/null; then
    echo "Aucun PostgreSQL joignable, et le serveur n'est pas installé." >&2
    echo "Démarrez-en un, ou définissez PGHOST/PGUSER/PGPASSWORD." >&2
    exit 1
  fi

  EPHEMERE="$(mktemp -d)"
  if [ "$(id -u)" = 0 ]; then
    chown postgres:postgres "$EPHEMERE"
    sous_postgres() { su postgres -c "PATH=$PATH; $*"; }
  else
    sous_postgres() { eval "$*"; }
  fi

  # Le serveur n'écoute que sur sa prise locale, dans un répertoire temporaire :
  # rien n'est exposé, et deux exécutions simultanées ne se marchent pas dessus.
  sous_postgres "initdb -D $EPHEMERE/data -U postgres --auth=trust" >/dev/null
  sous_postgres "pg_ctl -D $EPHEMERE/data -l $EPHEMERE/journal \
    -o '-k $EPHEMERE -p 5432 -c listen_addresses=' start" >/dev/null

  arreter_ephemere() {
    sous_postgres "pg_ctl -D $EPHEMERE/data -m immediate stop" >/dev/null 2>&1 || true
    rm -rf "$EPHEMERE"
  }
  trap arreter_ephemere EXIT

  PGHOST="$EPHEMERE"; PGPORT=5432; PGUSER=postgres
  export PGHOST PGPORT PGUSER

  for _ in $(seq 20); do
    pg_isready -q && break
    sleep 0.5
  done
fi

BASE="${BASE_DE_CONTROLE:-socle_agence_controle}"

psql -v ON_ERROR_STOP=1 -q -d postgres \
  -c "drop database if exists ${BASE}" \
  -c "create database ${BASE}"

# `ON_ERROR_STOP` est ce qui donne son verdict au script : une exception levée
# par un contrôle arrête psql, qui sort en erreur.
psql -v ON_ERROR_STOP=1 -q -d "${BASE}" \
  -f tests/rls/socle-supabase.sql \
  -f supabase/schema.sql \
  -f supabase/verifier-rls.sql

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database ${BASE}"

echo "Politiques RLS : conformes."
