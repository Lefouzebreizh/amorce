#!/usr/bin/env bash
# Sauvegarde la base d'un client, hors de Supabase et hors du dépôt.
#
# Pourquoi ce script existe : la sauvegarde d'un hébergeur protège de la panne,
# jamais de l'hébergeur. Un projet suspendu pour impayé, une facture qui saute,
# un compte fermé — et les données du client sont derrière une porte que
# personne n'ouvre. Une copie qu'on détient soi-même est la seule qui reste
# quand le fournisseur est le problème.
#
#   bash supabase/sauvegarder.sh "postgresql://postgres:MDP@db.PROJET.supabase.co:5432/postgres"
#
# Le dossier de destination est le second argument ; sans lui, `~/sauvegardes-agence`.
set -euo pipefail

URL="${1:-}"
DESTINATION="${2:-$HOME/sauvegardes-agence}"

if [ -z "$URL" ]; then
  echo "Usage : bash supabase/sauvegarder.sh <url de connexion> [dossier]" >&2
  echo "L'URL se lit dans Supabase → Project Settings → Database → Connection string." >&2
  exit 1
fi

# --- Trois refus, chacun payé une fois par quelqu'un ---------------------------

# 1. Le pooler en mode transaction ne sait pas servir pg_dump : il coupe au
#    premier `SET`, et l'erreur ne nomme jamais le port. C'est l'adresse
#    « Transaction pooler » que Supabase met en avant dans son interface.
case "$URL" in
  *:6543/*)
    echo "Cette URL est celle du pooler (port 6543), qui ne sait pas servir pg_dump." >&2
    echo "Prendre la connexion directe, port 5432, dans le même écran Supabase." >&2
    exit 1
    ;;
esac

# 2. `pg_dump` refuse un serveur plus récent que lui, et le dit en anglais au
#    milieu d'une sortie longue. Autant le dire ici, avec le remède.
version_serveur="$(psql "$URL" -tAc 'show server_version_num')"
version_outil="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"

if [ "$((version_serveur / 10000))" -gt "$version_outil" ]; then
  echo "Le serveur est en PostgreSQL $((version_serveur / 10000)), pg_dump en $version_outil." >&2
  echo "pg_dump refuse un serveur plus récent que lui. Installer le client de la" >&2
  echo "même version majeure, ou lancer ce script depuis un conteneur" >&2
  echo "postgres:$((version_serveur / 10000))." >&2
  exit 1
fi

# 3. Une sauvegarde porte les données personnelles des utilisateurs du client.
#    Elle n'entre pas dans Git — ni versionnée, ni oubliée dans l'arbre de
#    travail où un `git add -A` la ramasserait.
if git -C "$DESTINATION" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Le dossier de destination est dans un dépôt Git." >&2
  echo "Une sauvegarde porte les données personnelles des utilisateurs : elle vit" >&2
  echo "hors du dépôt, sur un support chiffré, et jamais dans un commit." >&2
  exit 1
fi

# --- La sauvegarde -------------------------------------------------------------

horodatage="$(date +%Y-%m-%d-%H%M)"
dossier="$DESTINATION/$horodatage"
mkdir -p "$dossier"
chmod 700 "$dossier"

# Trois fichiers plutôt qu'un, parce qu'ils ne se restaurent pas ensemble.
#
# Le schéma est lisible et se compare à `supabase/schema.sql` : c'est lui qui
# dit si la base du client a dérivé. Les données sont au format propriétaire de
# PostgreSQL, seul à savoir restaurer table par table et à respecter l'ordre des
# clés étrangères. Les comptes sont à part parce qu'ils vivent dans `auth`, un
# schéma que Supabase gère : les restaurer se décide, ça ne s'impose pas.
pg_dump "$URL" --schema-only --schema=public --no-owner --no-privileges \
  --file "$dossier/schema.sql"

# `--schema=public` laisse dehors un objet dont le socle dépend : le déclencheur
# posé sur `auth.users`, qui crée le profil d'un compte à son inscription. Il vit
# dans le schéma `auth`, que Supabase gère, mais il appelle une fonction de
# `public`, donc il est bien à nous. Sans cette reprise, une base restaurée
# accepte de nouveaux comptes **sans jamais leur créer de profil** — et rien ne
# le signale avant la première inscription réelle. Trouvé par l'aller-retour de
# `tests/sauvegarde/`, jamais par la lecture du script.
{
  echo
  echo "-- Objets hors du schéma public dont le socle dépend, repris à la main :"
  echo "-- pg_dump --schema=public ne les emporte pas."
  # `search_path` vide avant la génération : sans lui, `pg_get_triggerdef` rend
  # `handle_new_user()` sans son schéma, et pg_dump pose justement un
  # `search_path` vide en tête du fichier restauré — la fonction est alors
  # introuvable au moment précis où on en a besoin.
  psql "$URL" -qtA -c "set search_path = ''" -c "
    select pg_get_triggerdef(t.oid) || ';'
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc f on f.oid = t.tgfoid
    join pg_namespace fn on fn.oid = f.pronamespace
    where not t.tgisinternal
      and n.nspname <> 'public'
      and fn.nspname = 'public'
    order by 1"
} >> "$dossier/schema.sql"

pg_dump "$URL" --data-only --schema=public --format=custom \
  --file "$dossier/donnees.dump"

# `--column-inserts` : les colonnes d'`auth.users` changent entre versions de
# Supabase, et une insertion positionnelle se décalerait en silence sur une
# base plus récente. Nommer les colonnes fait échouer franchement à la place.
pg_dump "$URL" --data-only --column-inserts \
  --table=auth.users --table=auth.identities \
  --file "$dossier/comptes.sql"

# --- Le manifeste --------------------------------------------------------------
#
# Sans lui, une restauration ne peut pas se vérifier : rien ne dit combien de
# lignes auraient dû revenir. C'est ce qui sépare une sauvegarde d'un fichier.
{
  echo "# Sauvegarde du $horodatage"
  echo "serveur: PostgreSQL $((version_serveur / 10000))"
  echo "pg_dump: $version_outil"
  echo
  echo "## Lignes par table"
  psql "$URL" -tAF' ' -c "
    select relname, n_live_tup
    from pg_stat_user_tables
    where schemaname = 'public'
    order by relname"
  echo "auth.users $(psql "$URL" -tAc 'select count(*) from auth.users')"
  echo
  echo "## Ce que cette sauvegarde ne contient pas"
  echo "- les fichiers du stockage (bucket Supabase Storage)"
  echo "- les fonctions edge et leurs secrets"
  echo "- les variables d'environnement de l'hébergeur"
  echo "- les réglages du projet Supabase (fournisseurs d'authentification, SMTP)"
} > "$dossier/manifeste.txt"

chmod 600 "$dossier"/*

echo "Sauvegarde écrite dans $dossier"
echo
sed -n '/## Lignes par table/,/^$/p' "$dossier/manifeste.txt"
echo "Une sauvegarde jamais restaurée n'est pas une sauvegarde :"
echo "  bash supabase/restaurer.sh $dossier"
