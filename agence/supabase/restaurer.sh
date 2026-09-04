#!/usr/bin/env bash
# Restaure une sauvegarde, et vérifie qu'elle valait quelque chose.
#
# C'est la moitié qui manque partout. Un `pg_dump` planifié qui n'a jamais été
# relu ne dit rien : il peut tourner vert pendant deux ans sur une base vidée
# par une migration ratée. Ce script restaure pour de bon, puis compare ce qui
# est revenu au manifeste écrit le jour de la sauvegarde.
#
#   bash supabase/restaurer.sh ~/sauvegardes-agence/2026-09-04-1530
#
# Sans second argument, la restauration se fait dans une base locale jetable :
# c'est l'usage normal — on vérifie une sauvegarde, on n'écrase rien. Une URL en
# second argument restaure dans une vraie base, et ce geste-là est destructeur.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

DOSSIER="${1:-}"
CIBLE="${2:-}"

if [ -z "$DOSSIER" ] || [ ! -f "$DOSSIER/manifeste.txt" ]; then
  echo "Usage : bash supabase/restaurer.sh <dossier de sauvegarde> [url cible]" >&2
  echo "Le dossier doit contenir manifeste.txt, schema.sql, donnees.dump." >&2
  exit 1
fi

if [ -n "$CIBLE" ]; then
  # Écrire dans une base de production est rouge au sens de CLAUDE.md §5 : on ne
  # le fait pas sur une frappe de trop.
  echo "⚠️  Restauration dans une base réelle : $CIBLE"
  echo "Les tables publiques existantes seront écrasées. Taper « ecraser » pour continuer."
  read -r reponse
  [ "$reponse" = "ecraser" ] || { echo "Annulé."; exit 1; }
else
  . tests/postgres-ephemere.sh
  demarrer_postgres_si_absent

  BASE="restauration_$(date +%s)"
  psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database ${BASE}"
  CIBLE="dbname=${BASE}"

  # Le socle de Supabase — rôles, `auth.users`, `auth.uid()` — n'est pas dans la
  # sauvegarde : Supabase le fournit, `pg_dump --schema=public` ne le prend pas.
  # Sans lui, le schéma restauré échoue sur la première politique RLS.
  psql -v ON_ERROR_STOP=1 -q -d "$CIBLE" -f tests/rls/socle-supabase.sql
fi

# Le schéma sauvegardé porte son propre `create schema public` : toute base
# PostgreSQL en a déjà un, et l'ordre échoue. Le retirer serait le bon geste si
# une restauration ajoutait ; elle remplace. On rend donc le schéma vide d'abord,
# ce qui est exactement ce que « restaurer cette sauvegarde » veut dire.
psql -v ON_ERROR_STOP=1 -q -d "$CIBLE" -c 'drop schema if exists public cascade'
psql -v ON_ERROR_STOP=1 -q -d "$CIBLE" -f "$DOSSIER/schema.sql"
psql -v ON_ERROR_STOP=1 -q -d "$CIBLE" -f "$DOSSIER/comptes.sql"

# L'ordre est contraint et il se retourne contre lui-même : `profiles.id`
# référence `auth.users`, donc les comptes passent d'abord — et leur insertion
# **réveille le déclencheur** qui fabrique un profil par compte. Ces profils-là
# sont vides, et ils entrent en collision avec les vrais, restaurés juste après :
# `duplicate key value violates unique constraint "profiles_pkey"`.
#
# On efface donc ce que le déclencheur vient d'inventer, avant de poser ce que
# la sauvegarde contient. `cascade` ne coûte rien ici : dans une restauration,
# tout ce qui dépend des profils arrive après cette ligne.
#
# Trouvé par l'aller-retour, et invisible autrement : chaque moitié est juste.
psql -v ON_ERROR_STOP=1 -q -d "$CIBLE" -c 'truncate public.profiles cascade'

pg_restore --data-only --no-owner --disable-triggers \
  --dbname "$CIBLE" "$DOSSIER/donnees.dump"

# --- La vérification, qui est le sujet du script -------------------------------

ecart=0

# 1. Les lignes. Le manifeste dit ce qui est parti ; on compte ce qui est
#    revenu. Une table absente compte pour zéro, ce qui est le bon verdict.
while read -r table attendu; do
  [ -n "$table" ] || continue
  if [ "$table" = "auth.users" ]; then
    obtenu="$(psql -tAd "$CIBLE" -c 'select count(*) from auth.users')"
  else
    obtenu="$(psql -tAd "$CIBLE" -c "select count(*) from public.\"$table\"" 2>/dev/null || echo 0)"
  fi

  if [ "$obtenu" != "$attendu" ]; then
    echo "✗ $table : $obtenu ligne(s) restaurée(s), $attendu attendue(s)."
    ecart=1
  else
    echo "✓ $table : $obtenu ligne(s)."
  fi
done < <(sed -n '/## Lignes par table/,/^$/p' "$DOSSIER/manifeste.txt" | grep -E '^[a-z_.]+ [0-9]+$')

# 2. La RLS. Une restauration qui ramène les lignes sans les politiques rend une
#    base ouverte à qui détient la clé publique — et rien ne le signale. C'est le
#    défaut le plus cher que ce script puisse attraper.
nues="$(psql -tAd "$CIBLE" -c "
  select string_agg(c.relname, ', ')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")"

if [ -n "$nues" ]; then
  echo "✗ RLS désactivée sur : $nues"
  ecart=1
else
  echo "✓ RLS active sur toutes les tables publiques."
fi

politiques="$(psql -tAd "$CIBLE" -c "select count(*) from pg_policies where schemaname = 'public'")"
if [ "$politiques" -lt 1 ]; then
  echo "✗ Aucune politique RLS restaurée."
  ecart=1
else
  echo "✓ $politiques politique(s) RLS restaurée(s)."
fi

# 3. Le déclencheur hors `public`. C'est le défaut que l'aller-retour a trouvé :
#    il ne casse rien à la restauration, il casse la **prochaine inscription**.
declencheurs="$(psql -tAd "$CIBLE" -c "
  select count(*) from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc f on f.oid = t.tgfoid
  join pg_namespace fn on fn.oid = f.pronamespace
  where not t.tgisinternal and n.nspname <> 'public' and fn.nspname = 'public'")"

if [ "$declencheurs" -lt 1 ]; then
  echo "✗ Aucun déclencheur sur auth.users : un nouveau compte n'aurait pas de profil."
  ecart=1
else
  echo "✓ $declencheurs déclencheur(s) hors public restauré(s)."
fi

if [ "${ecart:-0}" != 0 ]; then
  echo
  echo "La sauvegarde ne se restaure pas fidèlement. Ne pas s'y fier." >&2
  exit 1
fi

echo
echo "Sauvegarde restaurée et conforme au manifeste."
