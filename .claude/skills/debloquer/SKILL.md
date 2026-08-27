---
name: debloquer
description: Reprendre la main quand une session distante refuse d'avancer — une permission refusée par le classificateur, un appel réseau qui rend 403, une suite de tests introuvable ou plus gardée par l'intégration continue, `main` qui a bougé sous les pieds ou une PR déjà fusionnée. Donne la parade dans l'ordre où elle coûte le moins cher, et dit à quel moment il faut s'arrêter et demander plutôt que d'insister. À utiliser dès qu'un outil refuse, échoue ou rend un résultat vide sans raison claire — « permission denied », « blocked by classifier », « CONNECT tunnel failed », « No commits between main and… », « ModuleNotFoundError » dans la CI, « je n'arrive pas à lancer les tests », « ça ne marche que chez moi », « pourquoi tu ne peux pas », « fais-le autrement ». À utiliser aussi **avant** un long travail dans une session distante, pour vérifier que la vérification qu'on vient de nommer sera réellement exécutable — découvrir au moment de pousser qu'on ne peut pas lancer la suite coûte le double.
---

# Débloquer une session

Une session distante tourne dans un conteneur bridé : le réseau passe par un
mandataire qui filtre, les commandes passent par un classificateur qui refuse, et
le dépôt reçoit plusieurs sessions en parallèle qui déplacent `main` pendant
qu'on travaille. Chacun de ces trois murs a une parade, et aucune des trois n'est
« insister ».

La règle qui les surplombe : **un refus n'autorise jamais à maquiller la
commande**. Découper une commande composée pour qu'elle soit lisible, oui.
Déguiser une écriture en test, non — ce serait contourner l'intention du garde-
fou, et cette intention est la seule chose qui protège le dépôt d'une session
partie de travers.

## 1. Une permission refusée

Symptôme : `Permission for this action was denied by the Claude Code auto mode
classifier`.

Dans l'ordre, du moins cher au plus cher :

**Découper la commande.** Le classificateur juge la commande entière. Une boucle
`for`, un `cmd1 && cmd2 ; cmd3`, un `python3 - <<'PY'` qui contient des écritures
se lisent mal et se font refuser, là où les mêmes actions passent une par une.
Observé plusieurs fois : `for tests in */tests; do …; done` refusé, la même
découverte faite en trois appels distincts acceptée.

**Passer par l'outil dédié.** `Read` plutôt que `cat`, `Grep` plutôt que `grep`,
`Glob` plutôt que `find`, `Edit`/`Write` plutôt qu'un `sed -i`. Ces outils sont
lus par le harnais comme ce qu'ils sont, quand une commande shell doit être
devinée. C'est souvent plus rapide *et* accepté.

**Inscrire la commande dans les permissions du dépôt.** C'est la parade durable :
une fois la règle posée, la commande ne repasse plus jamais devant le
classificateur. Le bloc à coller dans `.claude/settings.json` est en fin de
fiche.

**S'arrêter et le dire.** Si la commande reste refusée et qu'elle est
indispensable — typiquement : lancer la suite de tests avant de pousser — il faut
le dire au propriétaire plutôt que de pousser sans vérification. Une poussée non
vérifiée coûte un cycle de relecture et la confiance ; un aller-retour coûte une
minute.

Deux écritures resteront refusées quoi qu'on fasse, et c'est voulu :
`.claude/settings.json` lui-même (modifier son propre fichier de permissions) et
tout ce qui touche aux identifiants. Là, le bloc se transmet au propriétaire pour
qu'il le colle — il n'y a pas d'autre chemin, et il ne faut pas en chercher un.

## 2. Le réseau rend 403

Symptôme : `CONNECT tunnel failed, response 403`, ou un `curl` qui rend le code
`000`.

Le réseau n'est pas coupé, il est **filtré**. L'état du mandataire se lit :

```bash
curl -sS "$HTTPS_PROXY/__agentproxy/status"
```

La réponse liste ce qui passe sans mandataire (`pypi.org`,
`files.pythonhosted.org`, `registry.npmjs.org`, l'API Anthropic) et un journal
des refus récents, qui dit en clair quel hôte a été bloqué. `pip install` et
`npm install` fonctionnent donc toujours ; une API tierce quelconque, non — Yahoo
Finance et CoinGecko sont refusés, et c'est ce qui a empêché de vérifier
l'assistant d'allocation d'actifs de bout en bout.

**Ne jamais désactiver la vérification TLS ni retirer `HTTPS_PROXY`.** Le fichier
`/root/.ccr/README.md` donne les réglages par outil quand un client particulier
ne sait pas lire le mandataire.

La parade de conception, celle qui rend le projet vérifiable pour de bon :
**séparer le réseau du calcul**. Confiner les appels sortants à deux ou trois
fonctions nommées, garder tout le reste pur, et écrire les tests en injectant les
données à la main. Un test qui dépend d'un cours de bourse rend un verdict
différent demain ; un test qui reçoit `{"CW8.PA": 512.30}` rend le même verdict
dans dix ans. Le chemin réseau reste alors le seul point non couvert, et il se
dit tel quel dans le compte rendu — **jamais annoncé comme vérifié**.

## 3. `main` a bougé, ou la PR est déjà fusionnée

Ce dépôt reçoit plusieurs sessions en parallèle. Deux branches y ont construit
Life-Organizer chacune de son côté, et la seconde a dû être refaite.

Symptôme le plus déroutant : `create_pull_request` rend **« No commits between
main and <branche> »**. Ça ne veut pas dire que le travail a disparu, mais qu'il
est **déjà dans `main`** — quelqu'un a fusionné la PR entre-temps.

Le réflexe, avant d'ouvrir quoi que ce soit et avant de conclure quoi que ce soit
sur l'état du dépôt :

```bash
git fetch origin main
git log --oneline -1 origin/main
git merge-base --is-ancestor <ton-commit> origin/main && echo "déjà fusionné"
```

Si c'est déjà fusionné, la branche repart de la base commune, elle ne se
poursuit pas :

```bash
git checkout -B <branche> origin/main
```

Et vérifier ce que `main` a fait du travail : un projet peut avoir **déménagé**.
`patrimoine/` et `mon-app-audio/` sont passés sous `archives-backlog/` en cours
de route. Ce qui reste à la racine après un `checkout` n'est alors plus qu'un
reste non suivi — des `__pycache__` — qu'on nettoie parce qu'ils sont à soi.

Relire `CLAUDE.md` après un `fetch` qui ramène beaucoup de commits : c'est là que
les règles changent, et il a pris cent lignes en une journée.

## 4. Une suite de tests introuvable, ou plus gardée

**Où est la commande.** La dernière ligne de `hooks/session-start.sh` — celle que
la session affiche au démarrage — liste la commande de vérification de chaque
projet. C'est la seule liste tenue à jour quand un projet déménage. La lire plutôt
que de deviner un chemin.

**Est-elle réellement lancée ?** `.github/workflows/tests-python.yml` découvre les
suites plutôt que de les énumérer, ce qui est la bonne idée — mais toute
découverte a une profondeur. Le motif a déjà été `*/tests`, et le jour où le
studio audio et l'assistant d'allocation sont descendus sous `archives-backlog/`,
leurs soixante-deux tests sont sortis du champ sans qu'aucune ligne rouge
n'apparaisse : les tests existaient, ils étaient verts, et plus personne ne les
lançait. C'est le mode d'échec le plus coûteux du dépôt, parce qu'il est
silencieux — et il l'est doublement quand « tests verts » est la condition de
reprise écrite sur la fiche d'un projet en sommeil.

La boucle passe aujourd'hui par `find -maxdepth 3`, ce qui couvre un projet
rangé un cran plus bas. Un quatrième niveau sortirait encore du champ : après
tout déplacement, refaire tourner la découverte à la main et compter.

```bash
for tests in $(find . -maxdepth 3 -type d -name tests -not -path '*/node_modules/*' | sort); do
  ls "$tests"/test_*.py >/dev/null 2>&1 && echo "$tests"
done
```

Quand un test importe une bibliothèque absente, c'est
`.github/requirements-tests.txt` qu'on complète — un seul endroit, exprès, et
volontairement plus court que le hook. Avant d'ajouter une suite à la CI,
vérifier ce qu'elle atteint vraiment : une dépendance importée **tardivement**,
dans le corps d'une fonction qu'aucune assertion ne traverse, n'a pas à y
figurer.

## 5. Ce qui fait gagner le plus de temps

- **Nommer la vérification avant d'écrire**, et vérifier tout de suite qu'elle
  est *exécutable ici*. Découvrir au moment de pousser que la commande est
  refusée ou que l'API est bloquée coûte le double.
- **Grouper les appels indépendants** dans un même tour : trois lectures qui ne
  dépendent pas l'une de l'autre partent ensemble.
- **Déléguer la sortie bavarde** à l'agent `verificateur`, qui rend un verdict
  au lieu de déverser trois cents lignes de tests dans le fil.
- **Passer le relais avant que le fil ne pèse.** Une conversation est relue en
  entier à chaque message, captures comprises. Dès qu'un fil change de sujet,
  ouvrir la session suivante avec un résumé de reprise.
- **Décider plutôt que demander**, sauf pour ce qui part en public au nom de
  quelqu'un, ce qui détruit sans retour, et ce qui engage de l'argent.

## Le bloc de permissions à coller

Claude ne peut pas écrire ce fichier lui-même — c'est le garde-fou qui protège
ses propres permissions, et c'est très bien ainsi. Le propriétaire du dépôt
complète le tableau `permissions.allow` déjà présent dans
`.claude/settings.json`, où vivent les autorisations Supabase en lecture :

```json
"permissions": {
  "allow": [
    "Bash(ls:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(wc:*)",
    "Bash(sed -n:*)", "Bash(diff:*)", "Bash(find:*)", "Bash(grep:*)", "Bash(rg:*)",

    "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)",
    "Bash(git ls-files:*)", "Bash(git ls-tree:*)", "Bash(git merge-base:*)",
    "Bash(git branch:*)", "Bash(git fetch:*)", "Bash(git checkout:*)",
    "Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)",

    "Bash(npm test)", "Bash(npm run typecheck)", "Bash(npm run lint)",
    "Bash(npm run build)", "Bash(npm run fixtures)", "Bash(npm run verify)",
    "Bash(npm run verify:reprise)", "Bash(npm install:*)",

    "Bash(python3 -m unittest:*)", "Bash(python3 -m pip install:*)",
    "Bash(python3 kdp/pipeline/valider.py:*)", "Bash(python3 kdp/vignette.py:*)",

    "Bash(flutter analyze:*)", "Bash(flutter test:*)", "Bash(flutter pub get:*)",
    "Bash(dart run build_runner:*)"
  ],
  "deny": [
    "Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(git reset --hard:*)"
  ]
}
```

Ce que la liste contient et ce qu'elle ne contient pas se justifie : on autorise
d'avance **ce qui vérifie** (les suites de test de chaque projet, les commandes de
lecture) et **ce qui installe** (une session distante repart d'un conteneur nu),
et on refuse d'avance ce qui **réécrit un historique** — une poussée forcée sur
une branche partagée invalide la copie de travail de tous les autres, et le dépôt
en interdit déjà le principe.
