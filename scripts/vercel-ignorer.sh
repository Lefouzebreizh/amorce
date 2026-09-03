#!/usr/bin/env bash
#
# Décider si Vercel doit déployer ce commit, ou l'ignorer.
#
# ---------------------------------------------------------------------------
# Pourquoi ce script existe
# ---------------------------------------------------------------------------
#
# Ce dépôt porte plusieurs projets et reçoit plusieurs sessions en parallèle.
# Quatre projets Vercel y étaient branchés — `amorce` (racine), `amorce-51up`
# (dossier `artisan-express`), `iptv`, `nexuscrypto` — et **chacun se
# déclenchait sur chaque commit**, quel que soit le fichier touché. Une pull
# request qui ne changeait qu'une ligne de Markdown lançait donc quatre
# déploiements.
#
# Mesuré le 31/08/2026 : **80 fusions sur `main` en vingt-quatre heures**, soit
# 320 déploiements de production, plus les aperçus de chaque poussée de branche.
# Le palier gratuit en autorise **cent par jour**. Il a été épuisé, et le refus
# tombe en statut rouge sur toutes les PR à la fois :
#
#     Resource is limited — try again in 24 hours
#     (more than 100, code: "api-deployments-free-per-day")
#
# Aucune PR n'en était bloquée, mais chaque rouge coûtait une vérification à la
# main et **masquait un vrai échec** — celui de `nexuscrypto`, qui échouait au
# build depuis sa création sans que personne ne le distingue du quota.
#
# ---------------------------------------------------------------------------
# Le contrat de Vercel, et pourquoi il se lit à l'envers
# ---------------------------------------------------------------------------
#
# Vercel appelle ce script par son réglage « Ignored Build Step », déclaré dans
# le `vercel.json` du **dossier racine du projet** sous la clé `ignoreCommand`.
# La convention de sortie est inversée par rapport au réflexe :
#
#     sortie 0  -> Vercel ANNULE le déploiement
#     sortie 1  -> Vercel DÉPLOIE
#
# C'est l'inverse de la convention Unix habituelle, et c'est le piège de ce
# fichier : un `exit 0` ajouté par réflexe en fin de script couperait tous les
# déploiements en silence.
#
# ---------------------------------------------------------------------------
# Première mesure après la mise en place — 31/08/2026, PR #485
#
# Diff de Markdown pur (`INDEX.md` et une fiche de `projets-actifs/`), donc
# aucun des chemins déclarés. Résultat observé sur les statuts de la PR :
#
#     amorce        -> s'est déclenché  (attendu : annulé)
#     amorce-51up   -> ne s'est pas déclenché
#     iptv          -> ne s'est pas déclenché
#     nexuscrypto   -> ne s'est pas déclenché
#
# Trois sur quatre se comportent comme prévu. Le cas d'`amorce` reste ouvert et
# **ne se tranche pas depuis une session** — `vercel.com` et `*.vercel.app` sont
# refusés par le mandataire. Deux explications tiennent, et il faut regarder le
# journal du déploiement pour choisir :
#
#   1. Le **dossier racine** du projet `amorce` n'est pas la racine du dépôt, et
#      Vercel ne lit alors pas ce `vercel.json`-ci. C'est le point que le
#      README de `nexuscrypto` signale déjà comme à vérifier au tableau de bord :
#      il n'était confirmé que pour `nexuscrypto`, déduit pour les trois autres.
#   2. Le **refus de quota précède l'étape d'annulation**. Ce jour-là le palier
#      était épuisé ; si Vercel compte la tentative et la refuse avant d'évaluer
#      l'`ignoreCommand`, le filtre ne peut pas se manifester. Dans ce cas il
#      n'y a rien à corriger et la mesure du lendemain le dira.
#
# La mesure qui départage — 31/08/2026, PR #487
#
# Diff de Markdown pur à nouveau. Cette fois Vercel a rendu son verdict pour
# chacun :
#
#     amorce-51up   -> Ignored
#     iptv          -> Ignored
#     nexuscrypto   -> Ignored
#     amorce        -> s'est déclenché, puis refusé par le quota
#
# **La deuxième explication tombe.** Le refus de quota ne précède pas l'étape
# d'annulation : trois projets ont bien été évalués et annulés alors que le
# palier était épuisé. Le mécanisme fonctionne, et il fonctionne même quota
# épuisé.
#
# Reste donc la première : **le projet `amorce` ne lit pas ce `vercel.json`**.
# Les trois qui obéissent ont tous un dossier racine déclaré — `artisan-express`,
# `iptv`, `nexuscrypto` — et leur `vercel.json` y vit. Celui d'`amorce` est à la
# racine du dépôt ; si le réglage *Root Directory* du projet pointe ailleurs,
# Vercel ne le voit pas.
#
# ---------------------------------------------------------------------------
# Tranché — 02/09/2026, par le journal de construction
#
# **`amorce` lit bien ce `vercel.json`.** La première explication tombe à son
# tour, et il n'y a plus rien à vérifier au tableau de bord. Journal du
# déploiement `dpl_5hT3BWLMM22ASi7TRkm98giyxYGb` (branche `main`, commit
# 28beb4e), lu par le connecteur Vercel, trois lignes qui suffisent :
#
#     Running "bash scripts/vercel-ignorer.sh src public next.config.ts …"
#     Rien de touché dans : … — déploiement annulé.
#     The Deployment has been canceled as a result of running the command
#     defined in the "Ignored Build Step" setting.
#
# Le script est donc appelé, il décide, et Vercel obéit. Les trois projets
# restants — `amorce`, `amorce-51up`, `iptv` — se comportent tous comme prévu.
# `nexuscrypto` a quitté la liste : son projet Vercel a été supprimé le
# 31/08/2026, ce que `CLAUDE.md` porte déjà.
#
# **Ce qui n'est pas expliqué, et qu'il ne faut pas inventer :** pourquoi
# `amorce` s'était déclenché le 31/08. Les deux explications écrites ci-dessus
# sont maintenant réfutées toutes les deux, et rien dans ce qui a été mesuré ne
# dit ce qui s'est passé ce jour-là. Le palier de quota était épuisé — c'est le
# seul fait établi qui distingue les deux journées.
#
# La leçon de méthode, elle, est nette : **le journal de construction tranche en
# une lecture ce que trois observations de statut n'avaient pas départagé.** Un
# statut dit qu'un déploiement a été annulé, jamais par quoi. Aller au journal
# avant de bâtir une hypothèse, et avant de confier une vérification à
# quelqu'un.
#
# ---------------------------------------------------------------------------
# Le principe qui gouverne les cas douteux : on déploie
# ---------------------------------------------------------------------------
#
# Un déploiement de trop coûte une unité de quota. Un déploiement manquant
# coûte bien plus cher, et il est invisible : le propriétaire teste une version
# ancienne en croyant tester la neuve, rapporte des défauts déjà corrigés, et
# chaque « recharge de force » ne sert à rien. C'est arrivé, deux heures durant,
# et c'est écrit dans `second-brain/lecons.md`.
#
# Donc : **dès qu'on ne sait pas comparer, on déploie.** Historique tronqué,
# premier commit, dépôt sans parent, `git` qui râle — tous ces cas sortent en 1.
# Le seul chemin qui annule est celui où la comparaison a réussi et n'a rien
# trouvé.
#
# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
#
#     bash scripts/vercel-ignorer.sh <chemin> [<chemin>...]
#
# Les chemins se donnent **depuis la racine du dépôt**, jamais depuis le dossier
# racine du projet Vercel : le script s'y replace lui-même. C'est ce qui permet
# à `iptv/vercel.json` et à `artisan-express/vercel.json` d'appeler le même
# script que la racine, avec la même écriture.
#
# Un chemin qui n'existe pas n'est pas une erreur pour `git diff` : il ne
# rapporte simplement aucune différence. On peut donc y nommer un fichier à
# venir sans casser la comparaison.

# Se replacer à la racine du dépôt. Vercel exécute cette commande depuis le
# dossier racine du projet — la racine pour `amorce`, `iptv/` pour `iptv` — et
# les chemins surveillés sont écrits depuis la racine du dépôt.
racine=$(git rev-parse --show-toplevel 2>/dev/null) || exit 1
cd "$racine" || exit 1

# Sans parent, il n'y a rien à comparer. C'est le cas d'un clone tronqué à un
# seul commit, et celui du tout premier commit d'une branche. On déploie.
git rev-parse --verify --quiet HEAD^ >/dev/null 2>&1 || exit 1

# `git diff --quiet` implique `--exit-code` : 0 s'il n'y a aucune différence,
# 1 s'il y en a, 128 s'il échoue. Le `if` ne distingue pas 1 de 128, et c'est
# voulu : les deux mènent au déploiement.
if git diff --quiet HEAD^ HEAD -- "$@"; then
  echo "Rien de touché dans : $* — déploiement annulé."
  exit 0
fi

echo "Au moins un de ces chemins a bougé : $* — déploiement lancé."
exit 1
