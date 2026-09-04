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
# L'amorçage vit dans `tests/postgres-ephemere.sh`, partagé avec le contrôle de
# sauvegarde — deux copies divergeraient au premier correctif.
. "$(dirname "${BASH_SOURCE[0]}")/../postgres-ephemere.sh"
demarrer_postgres_si_absent

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
