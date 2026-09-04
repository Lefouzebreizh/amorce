# Fabrique un PostgreSQL jetable quand aucun serveur n'est joignable.
#
# Ce fichier se *source*, il ne s'exécute pas. Il était écrit dans
# `tests/rls/executer.sh` ; le contrôle de sauvegarde en avait besoin mot pour
# mot, et deux copies d'un amorçage de serveur divergent au premier correctif —
# celle qu'on ne relance pas garde le défaut.
#
# L'intégration continue fournit son propre serveur et ne passe jamais ici. Une
# session distante, elle, n'a que le binaire `docker` sans démon derrière : la
# voie par conteneur y échoue, et un contrôle qu'on ne peut pas lancer là où
# l'on travaille finit par n'être jamais lancé.
#
# Deux obstacles, tous deux propres à ce terrain : les binaires du serveur ne
# sont pas dans le PATH (seuls les clients y sont), et `initdb` refuse de
# s'exécuter en root — d'où le détour par l'utilisateur `postgres`, à qui le
# répertoire doit appartenir.

demarrer_postgres_si_absent() {
  pg_isready -q 2>/dev/null && return 0

  PATH="$PATH:$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"
  export PATH

  if ! command -v initdb >/dev/null; then
    echo "Aucun PostgreSQL joignable, et le serveur n'est pas installé." >&2
    echo "Démarrez-en un, ou définissez PGHOST/PGUSER/PGPASSWORD." >&2
    return 1
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
}
