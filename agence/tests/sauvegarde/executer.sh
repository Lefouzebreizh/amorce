#!/usr/bin/env bash
# Éprouve l'aller-retour complet : sauvegarder, tout perdre, restaurer.
#
# Une sauvegarde ne se vérifie pas en lisant son script. Ce contrôle fabrique
# une base au schéma du socle, y met des lignes et des comptes, la sauvegarde
# avec `sauvegarder.sh`, **détruit la base**, puis la restaure avec
# `restaurer.sh` et exige que le compte des lignes revienne — RLS comprise.
#
# C'est le seul contrôle du socle qui prouve quelque chose sur les données du
# client plutôt que sur son code.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

. tests/postgres-ephemere.sh
demarrer_postgres_si_absent

BASE="sauvegarde_controle"
SORTIE="$(mktemp -d)"
nettoyer() {
  psql -q -d postgres -c "drop database if exists ${BASE}" >/dev/null 2>&1 || true
  rm -rf "$SORTIE"
}
trap nettoyer EXIT

psql -v ON_ERROR_STOP=1 -q -d postgres \
  -c "drop database if exists ${BASE}" -c "create database ${BASE}"

# La chaîne de connexion en clés/valeurs plutôt qu'en URI : le serveur jetable
# n'écoute que sur une prise locale, qui n'a pas de forme d'URI portable.
URL="dbname=${BASE} host=${PGHOST:-/var/run/postgresql} port=${PGPORT:-5432} user=${PGUSER:-postgres}"

psql -v ON_ERROR_STOP=1 -q -d "$URL" \
  -f tests/rls/socle-supabase.sql \
  -f supabase/schema.sql

# Deux comptes et cinq projets : assez pour qu'un décalage de colonnes ou une
# clé étrangère mal ordonnée se voie, assez peu pour tenir en une seconde.
psql -v ON_ERROR_STOP=1 -q -d "$URL" <<'SQL'
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'claire@exemple.fr'),
  ('a0000000-0000-4000-8000-000000000002', 'hugo@exemple.fr');

update public.profiles set full_name = 'Claire Danet', company_name = 'Danet & Fils'
  where id = 'a0000000-0000-4000-8000-000000000001';

insert into public.projects (user_id, title, description, status, amount_estimated)
select 'a0000000-0000-4000-8000-000000000001', 'Chantier ' || n, 'Devis ' || n,
       (array['draft', 'in_progress', 'completed'])[1 + n % 3],
       1000 * n
from generate_series(1, 5) as n;
SQL

bash supabase/sauvegarder.sh "$URL" "$SORTIE" > "$SORTIE/journal.txt"
DOSSIER="$(find "$SORTIE" -mindepth 1 -maxdepth 1 -type d | head -1)"

# Le manifeste doit porter des chiffres, sinon la restauration se vérifierait
# contre rien et passerait au vert sur une base vide.
grep -qE '^projects 5$' "$DOSSIER/manifeste.txt" \
  || { echo "Le manifeste ne compte pas les 5 projets."; cat "$DOSSIER/manifeste.txt"; exit 1; }
grep -qE '^auth.users 2$' "$DOSSIER/manifeste.txt" \
  || { echo "Le manifeste ne compte pas les 2 comptes."; exit 1; }

# Tout perdre. C'est le geste que la sauvegarde est censée rattraper, et le
# seul qui prouve qu'elle le rattrape.
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database ${BASE}"

bash supabase/restaurer.sh "$DOSSIER"

echo "Aller-retour de sauvegarde : conforme."
