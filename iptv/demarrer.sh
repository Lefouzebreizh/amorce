#!/usr/bin/env bash
#
# Tout ce qu'il faut pour regarder, en une commande.
#
#     ./demarrer.sh
#
# Installe si besoin, remplit le cache s'il est vide, démarre le serveur,
# attend qu'il réponde vraiment, et affiche l'adresse à taper sur le téléphone
# ou la télévision. Ctrl-C arrête tout.
#
# ---------------------------------------------------------------------------
# Pourquoi ce script existe
# ---------------------------------------------------------------------------
#
# Le parcours documenté demandait quatre commandes dans deux fenêtres, et
# l'adresse n'arrivait qu'à la dernière. Entre-temps, trois façons de croire
# que « ça ne marche pas » :
#
#   * lancer `dev` sans avoir rien importé — l'écran est vide, et un catalogue
#     vide ressemble exactement à une panne ;
#   * taper l'adresse avant que Next.js ait fini de compiler — le téléphone
#     affiche une erreur de connexion, on croit l'adresse fausse ;
#   * lire l'adresse dans une documentation plutôt que sur la machine : elle
#     dépend de la box et change quand on rebranche.
#
# Les trois disparaissent quand une seule commande fait l'ordre complet et ne
# montre l'adresse qu'une fois le serveur debout.
#
# ---------------------------------------------------------------------------
# La seule décision qui mérite d'être écrite
# ---------------------------------------------------------------------------
#
# **Les chaînes de démonstration ne s'ajoutent que sur un cache vide.**
#
# `iptv demo` importe sous l'adresse « demonstration », qui est une *source* à
# part entière : la relancer sur un catalogue déjà rempli n'écrase rien, mais
# glisse sept flux de test au milieu d'un vrai abonnement. On les retrouve des
# semaines plus tard sans savoir d'où ils sortent.
#
# Le compte se lit donc avant, et la démonstration ne part que s'il vaut zéro.
# C'est aussi ce qui rend le script rejouable : au deuxième lancement il ne
# touche plus aux données, il se contente de servir.

set -uo pipefail

# Se placer dans le dossier du script, jamais dans celui d'où on l'appelle :
# `npm` lirait sinon le `package.json` de la racine du dépôt, qui est celui
# d'Amorce, et lancerait le studio de montage à la place.
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

PORT="${PORT:-3000}"
serveur=""

# Arrêter le serveur quoi qu'il arrive — Ctrl-C, erreur, fin normale. Sans ce
# filet, un `dev` reste en fond et le lancement suivant tombe sur « port déjà
# utilisé », ce qui ne ressemble à rien de connu.
nettoyer() {
  if [ -n "$serveur" ] && kill -0 "$serveur" 2>/dev/null; then
    echo
    echo "Arrêt du serveur…"
    kill "$serveur" 2>/dev/null
    wait "$serveur" 2>/dev/null
  fi
}
trap nettoyer EXIT INT TERM

iptv() { node --disable-warning=ExperimentalWarning src/cli.ts "$@"; }

# --- 1. Les dépendances -----------------------------------------------------

if [ ! -d node_modules ]; then
  echo "Installation des dépendances (une seule fois)…"
  npm install --silent || { echo "✗ npm install a échoué."; exit 1; }
fi

# --- 2. Le catalogue --------------------------------------------------------

# `resume` écrit « Total : N entrées ». On ne lit que le nombre ; s'il manque,
# on prend zéro, ce qui fait partir la démonstration — le cas d'une base
# absente ou illisible, où c'est exactement ce qu'on veut.
total=$(iptv resume 2>/dev/null | sed -n 's/^Total : \([0-9]*\) .*/\1/p')
total="${total:-0}"

if [ "$total" -eq 0 ]; then
  echo "Catalogue vide — chargement des chaînes de démonstration…"
  iptv demo >/dev/null || { echo "✗ le chargement de démonstration a échoué."; exit 1; }
  echo "  ✓ chaînes de test publiques en place"
  echo "    Pour brancher le vôtre : npm run iptv -- importer <votre lien>"
else
  echo "Catalogue déjà rempli : $total entrées. Rien n'est ajouté."
fi

# --- 3. Le serveur ----------------------------------------------------------

echo "Démarrage du serveur…"
npm run dev >/tmp/iptv-dev.log 2>&1 &
serveur=$!

# Attendre que le serveur réponde *vraiment*, pas qu'il soit lancé. Next.js
# accepte la connexion avant d'avoir compilé la première page : annoncer
# l'adresse trop tôt fait tomber le téléphone sur une erreur, et c'est
# l'adresse qu'on accuse. Soixante secondes suffisent largement à froid.
pret=""
for _ in $(seq 60); do
  if ! kill -0 "$serveur" 2>/dev/null; then
    echo "✗ le serveur s'est arrêté. Journal :"
    tail -20 /tmp/iptv-dev.log
    exit 1
  fi
  if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:${PORT}/"; then
    pret="oui"
    break
  fi
  sleep 1
done

if [ -z "$pret" ]; then
  echo "✗ le serveur n'a pas répondu en 60 s. Journal :"
  tail -20 /tmp/iptv-dev.log
  exit 1
fi

# --- 4. L'adresse -----------------------------------------------------------

echo
echo "════════════════════════════════════════════════"
echo "  Sur cet ordinateur :"
echo
echo "    http://localhost:${PORT}"
echo
echo "  Sur le téléphone ou la télévision, même Wi-Fi :"
echo
iptv adresse --port "$PORT" 2>/dev/null | sed -n 's|^ *\(http://.*\)|    \1|p' | grep . || {
  echo "    (aucune adresse réseau trouvée — cette machine n'est"
  echo "     sur aucun réseau local, seul localhost fonctionnera)"
}
echo
echo "  Ctrl-C pour arrêter."
echo "════════════════════════════════════════════════"

# Rendre la main au serveur : le script vit tant qu'il vit, et le `trap`
# ci-dessus le coupe proprement au Ctrl-C.
wait "$serveur"
