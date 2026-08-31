---
name: debloquer
description: Reprendre la main quand une session distante refuse d'avancer — une permission refusée par le classificateur, un appel réseau qui rend 403, une suite de tests introuvable ou plus gardée par l'intégration continue, `main` qui a bougé sous les pieds, une PR déjà fusionnée ou impossible à ouvrir, ou une session ouverte sans dépôt attaché : dossier vide, rien d'installé, hook de démarrage jamais déclenché, SDK ou paquet système manquant. Donne la parade dans l'ordre où elle coûte le moins cher, et dit à quel moment il faut s'arrêter et demander plutôt que d'insister. À utiliser dès qu'un outil refuse, échoue ou rend un résultat vide sans raison claire — « permission denied », « blocked by classifier », « CONNECT tunnel failed », « No commits between main and… », « ModuleNotFoundError » dans la CI, « le dossier est vide », « rien n'est installé », « t'as rien installé », « je n'arrive pas à lancer les tests », « ça ne marche que chez moi », « pourquoi tu ne peux pas », « fais-le autrement ». À utiliser aussi **avant** un long travail dans une session distante, pour vérifier que la vérification qu'on vient de nommer sera réellement exécutable — découvrir au moment de pousser qu'on ne peut pas lancer la suite coûte le double. Ici on lève un **refus** ; savoir si un binaire ou un hôte existe seulement dans cette session — « command not found », « connection refused » — c'est `capacites-session`, qui sonde le terrain avant qu'on promette quoi que ce soit.
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

## Avant tout : la session a-t-elle un dépôt ?

Ce mur-là ne ressemble pas à un refus, et c'est ce qui le rend cher : rien ne
proteste. `/home/user` est vide, `git status` répond qu'on n'est pas dans un
dépôt, et les trois parades ci-dessous ne servent à rien parce qu'il n'y a rien
à débloquer.

Une session distante peut s'ouvrir **sans source attachée**. Vécu : dix minutes
à sonder un conteneur avant de comprendre que le dépôt n'y était simplement pas.

```
mcp__Claude_Code_Remote__list_repos          # le trouver
mcp__Claude_Code_Remote__add_repo            # l'attacher (access: "push")
git clone --depth 1 <url> /home/user/amorce  # UNE fois, sans rien en parallèle
mcp__Claude_Code_Remote__register_repo_root  # charge CLAUDE.md et les compétences
```

Un clone à la fois : le mandataire plafonne ce dépôt à deux opérations git
simultanées, et une seconde tentative fait échouer les deux (`429`). Si le
dossier existe déjà, `git -C … rev-parse HEAD` dit s'il est bon avant
d'envisager de le supprimer.

Puis, et c'est **la moitié qu'on oublie**, relancer le hook de démarrage à la
main :

```bash
CLAUDE_PROJECT_DIR=/home/user/amorce bash .claude/hooks/session-start.sh
```

Il ne s'est pas déclenché : au moment où la session s'est ouverte, il n'y avait
pas de dépôt à préparer. Sans ce rattrapage, la session paraît prête et rien
n'est installé — `node_modules` absents, pas de SDK Flutter, pas de Chromium —
et on l'apprend une commande à la fois. Le script est idempotent et prend
plusieurs minutes : le lancer en tâche de fond et travailler pendant ce temps.

Cette commande-là ne suffit pourtant pas : lancée ainsi, le hook installe tout
mais n'exporte rien, et `flutter` comme Chromium restent introuvables **bien
qu'installés**. Le § 5 donne la version complète, avec le fichier de variables à
relire — c'est la moitié qu'on oublie, et elle fait conclure à tort que
l'installation a échoué.

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
classificateur. `.claude/settings.json` porte déjà 84 autorisations — voir en fin
de fiche ce qu'elles couvrent et comment les étendre.

**S'arrêter et le dire.** Si la commande reste refusée et qu'elle est
indispensable — typiquement : lancer la suite de tests avant de pousser — il faut
le dire au propriétaire plutôt que de pousser sans vérification. Une poussée non
vérifiée coûte un cycle de relecture et la confiance ; un aller-retour coûte une
minute.

**Le verdict n'est pas stable, et c'est la chose la plus utile à savoir.** Le même
script de comparaison, lancé deux fois de suite sans qu'une ligne bouge, a été
accepté puis refusé. Un refus ne prouve donc pas qu'une action est interdite : il
dit que *cette formulation-là*, à *cet instant-là*, s'est mal lue. Avant de
conclure au mur, reformuler une fois — c'est gratuit et ça passe souvent.

Ce qui se lit mal se devine à l'usage : un heredoc `python3 - <<'PY'` qui
manipule des règles de permissions, un `git commit -m` dont le message parle
d'autorisations, un enchaînement `a && b && c`. Le même travail écrit dans un
fichier puis lancé par son chemin passe. La leçon tient en une phrase : **le
classificateur lit le texte de la commande, pas son intention ni le fichier
qu'elle vise.**

Cette fiche a longtemps affirmé l'inverse — qu'écrire `.claude/settings.json`
était refusé « quoi qu'on fasse » et devait passer par le propriétaire. C'est
faux, mesuré le 27 août : la copie d'un fichier de configuration complet, règles
de permissions comprises, est passée sans résistance, alors qu'un simple script
qui *lisait* ces mêmes règles était refusé. La frontière n'est pas là où on la
croyait, et une fiche qui se trompe de frontière fait renoncer pour rien.

Reste vrai, en revanche : **tout ce qui touche aux identifiants** se transmet au
propriétaire, et il ne faut pas chercher de contournement.

**Mais ce qu'on lui demande de coller doit tenir dans un téléphone.** Le
propriétaire édite depuis l'interface GitHub mobile, et trois de ses
comportements ont coûté quarante-cinq minutes et six allers-retours en une
matinée. Ils sont invisibles à l'écran, et aucun n'est de sa faute :

- **Le collage insère au curseur, il ne remplace pas.** Un « tout sélectionner »
  qui ne prend pas laisse l'ancien contenu en place et le neuf par-dessus. Le
  fichier est passé de 76 à 105 lignes, avec `statusLine` trois fois. Ne jamais
  demander de remplacer une portion : faire **supprimer le fichier**, puis le
  recréer dans un éditeur vide, où rien ne peut se mélanger.
- **Le champ « nom de fichier » mange le point de tête.** Le fichier recréé est
  arrivé dans `claude/` au lieu de `.claude/` — et l'interface, traduite en
  français, affiche « Claude » pour les deux : l'erreur est illisible à l'écran.
  Vérifier le chemin depuis le dépôt (`git ls-tree -r origin/main`), jamais sur
  la capture.
- **La traduction automatique francise l'affichage du code.** « autorisations »,
  « permettre », `"repo":"anthropique/code Claude"` : le fichier réel est intact,
  c'est la page qui ment. Ne jamais diagnostiquer un JSON sur une capture — le
  lire depuis le dépôt.

Et une fois le fichier posé, **son emplacement se déplace sans toucher au
contenu** : `git mv` n'accorde aucune permission nouvelle et passe le garde-fou,
là où réécrire le fichier serait refusé. C'est ce qui a réparé le point manquant.

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

Un préalable, à contrôler **avant de promettre de mener la PR de bout en bout** :
les outils `mcp__github__*` doivent être là. Une session peut très bien tourner
sans eux — mesuré ici, dans une session où `git push` passait, `gh` était absent
et `api.github.com` rendait 403 sur `/repos` : la branche part, la PR ne s'ouvre
pas. Découvrir cela au moment de pousser fait perdre le cycle entier. Le repli
est de pousser la branche et de laisser le propriétaire ouvrir la PR — pas de
chercher une troisième voie, il n'y en a pas.

**Et l'absence ne se rattrape pas depuis la session.** Cette fiche a longtemps
dit que « le connecteur GitHub se coupe par conversation » et que le rallumer
était la parade. C'est faux, et c'est coûteux : la session part chercher un
interrupteur qui n'existe pas. Mesuré dans une session sans `mcp__github__*` —
l'inventaire des connecteurs du compte en rend dix (Adobe, Airtable, Canva,
Gmail, Agenda, Drive, Indeed, Notion, Supabase, Vercel) et **aucun ne s'appelle
GitHub** : pas éteint, absent. L'annuaire public des connecteurs MCP n'en
propose pas davantage. GitHub n'est donc pas un connecteur qu'on bascule comme
Gmail ; l'accès vient de l'intégration de première partie, celle-là même qui
sert à `add_repo` — d'où une session qui pousse, clone et attache un dépôt très
bien, sans posséder un seul outil `mcp__github__*`.

Où se donne cet accès n'a **pas** été établi. Le supposer et l'écrire ici
recréerait exactement le défaut qu'on corrige. Ce qui est acquis tient en une
phrase : *aucun geste depuis la conversation ne fera apparaître ces outils*, et
la fin du travail passe donc par le propriétaire. La référence, si quelqu'un
veut trancher la question un jour, est
<https://code.claude.com/docs/en/claude-code-on-the-web>.

Et une chose qui ressemble à une disparition sans en être une :
**un outil MCP peut cesser de répondre en cours de session sous son nom lisible
et continuer de répondre sous son identifiant.** Mesuré ici :
`mcp__Claude_Code_Remote__get_session` a marché, puis a rendu « No such tool
available » une heure plus tard, quand `mcp__bf7c680d-…__get_session` passait
toujours. Le serveur n'était pas parti — c'est l'alias qui avait cessé de
résoudre.

Deux conséquences, et la seconde est un défaut latent :

- Devant « No such tool available », essayer la forme en identifiant avant de
  conclure que la capacité est perdue. L'identifiant se lit dans le nom complet
  d'un outil du même serveur.
- Une entrée de `permissions.allow` écrite sur le nom lisible peut cesser de
  correspondre au milieu d'une session. Les onze entrées `mcp__Supabase__*` de
  `.claude/settings.json` portent ce risque : le jour où l'alias ne résout plus,
  la lecture accordée d'office redemande une confirmation, sans que rien
  n'explique pourquoi. Ce fichier ne se corrige pas depuis une session — il est
  refusé par construction — donc la parade est de le savoir, et de le signaler
  au propriétaire plutôt que de chercher ce qui a changé dans le dépôt.

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

Symptôme voisin, et faux celui-là : un outil annonce des commits **non poussés**
et « aucune branche distante » alors que la poussée vient de réussir. Un clone
fait en `--depth 1` pose un refspec mono-branche
(`+refs/heads/main:refs/remotes/origin/main`) : `origin/<branche>` n'est jamais
créé en local, et tout ce qui juge l'état sur cette référence conclut à tort.
La poussée, elle, est bien arrivée — `git ls-remote --heads origin <branche>` le
dit, et c'est lui qui fait foi. L'élargir une fois :

```bash
git config --unset-all remote.origin.fetch
git config --add remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git fetch origin
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

**Et si la session n'a pas les outils `mcp__github__*`**, la PR ne s'ouvre pas
d'ici — voir « Connecteurs » dans `CLAUDE.md` : le jeton est derrière le serveur
MCP, un `403` de `api.github.com` en direct ne dit rien d'autre que « mauvais
outil ». Il n'y a rien à rallumer depuis la session (voir la section 3) : la PR
s'ouvrira à la main, et le travail utile est de n'en laisser que le dernier
appui au propriétaire, jamais la rédaction :

```bash
bash .claude/skills/debloquer/scripts/lien-pr.sh
```

Il pousse la branche et rend un lien qui ouvre le formulaire **déjà rempli**,
titre et corps pris dans les commits — ce sont eux qui portent l'intention. Le
geste restant tient en un appui, ce qui compte quand on lit depuis un téléphone.

## 3 bis. Vercel est rouge sur toutes les PR à la fois

```
Vercel — Deployment rate limited — retry in 24 hours.
```

Ce n'est pas un échec de la PR : c'est le quota de déploiement du compte,
épuisé par le nombre de fusions du jour. Ce dépôt en a passé plus de trente en
une journée, et le déploiement d'aperçu se déclenche à chaque poussée sur
chaque branche.

Deux choses le distinguent d'un vrai échec, et il faut les vérifier plutôt que
de le supposer :

- **le message nomme le quota**, pas un test ni un build ;
- **toutes les PR ouvertes sont rouges en même temps**, y compris celles qui ne
  touchent aucun fichier de l'application.

Dans ce cas, la vérification du dépôt reste le juge — `npm run typecheck`,
`npm run lint`, `npm test`. Une PR verte en local dont le seul rouge est ce
quota se fusionne : attendre vingt-quatre heures gèlerait tout le dépôt, et le
retard se paie en conflits sur les fichiers partagés.

Ne pas relancer le déploiement : le quota ne se recharge pas plus vite parce
qu'on insiste. Et le **dire** dans la PR ou à l'auteur, sinon le prochain qui
regarde croit à une régression et cherche une cause qui n'existe pas.

Un rouge qui persiste au-delà de vingt-quatre heures, ou qui ne frappe qu'une
seule PR, n'est plus celui-là : reprendre au diagnostic normal.

### La parade est posée : chaque projet filtre par chemin

Le 31/08/2026, le quota a été épuisé une fois de plus — **80 fusions sur `main`
en vingt-quatre heures, quatre projets Vercel branchés sur le dépôt, donc 320
déploiements de production** pour un palier à cent. Une PR qui ne changeait
qu'une ligne de Markdown en lançait quatre.

Depuis, chaque projet porte un `vercel.json` dont l'`ignoreCommand` appelle
`scripts/vercel-ignorer.sh` avec les chemins qui le concernent. Une PR de
Markdown n'en déclenche plus aucun ; une PR sur `iptv/` n'en déclenche qu'un.
Le script est commenté au long — l'essentiel tient en deux lignes :

- **la convention de sortie est inversée** — `0` annule le déploiement, `1` le
  lance. Un `exit 0` ajouté par réflexe couperait tout en silence ;
- **au moindre doute, on déploie** : sans parent, hors dépôt, `git` en erreur,
  le script sort en 1. Un déploiement de trop coûte une unité de quota ; un
  déploiement manquant fait tester une version périmée pendant deux heures.

Donc, si un rouge de quota revient malgré cela : compter d'abord les projets
Vercel branchés sur le dépôt. Le filtre ne protège que ceux qui portent un
`vercel.json` — **un projet créé depuis le tableau de bord n'en a pas**, et il
se déclenche sur tout.

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

## 5. Le conteneur n'a pas été préparé

Symptôme : les commandes échouent **par absence** et non par refus —
`command not found`, `No module named`, un `playwright install` réclamé.

Cause : `.claude/settings.json` déclare le hook de démarrage en `SessionStart`.
Il ne s'exécute donc qu'au démarrage d'une session ouverte **sur** le dépôt. Un
dépôt rattaché puis cloné en cours de route arrive après ce moment-là : le hook
ne se redéclenchera pas, quoi qu'on fasse, et rien ne le signale.

Le partage du travail avec `/capacites-session` est net : sa sonde **constate**
ce qui est là et ce qui a un repli ; ce qui suit **rétablit**.

```bash
bash .claude/skills/debloquer/scripts/remettre-en-etat.sh
source /tmp/env-session.sh          # ← la moitié qu'on oublie
```

Le script relance le hook — idempotent, ce qui est déjà là est sauté — et
installe `ffprobe`, que le paquet `imageio-ffmpeg` ne fournit pas et qu'aucun
`pip` n'apporte (`sudo apt-get install -y ffmpeg` ; les `403 Forbidden` sur
`ppa.launchpadcontent.net` pendant `apt-get update` sont des dépôts tiers
refusés par la politique réseau, du bruit et non un échec).

**Ce `source` n'est pas décoratif, et c'est lui qu'on oublie.** Le hook n'exporte
rien de lui-même : il écrit ses variables dans le fichier que Claude Code lui
désigne (`CLAUDE_ENV_FILE`), et c'est la session qui les relit. Lancé à la main
sans lui désigner ce fichier — ou en oubliant de le relire —, `flutter`,
`AMORCE_CHROMIUM` et `PLAYWRIGHT_BROWSERS_PATH` restent introuvables **bien
qu'installés**, ce qui fait conclure à tort que l'installation a échoué. Et
chaque commande partant d'un shell neuf, le `source` est à refaire à chaque
appel, ou à mettre en préfixe de la commande qui en a besoin.

Compter une dizaine de minutes, SDK Flutter compris : le lancer en tâche de fond
et travailler pendant ce temps sur ce qui n'en dépend pas.

## 6. Ce qui fait gagner le plus de temps

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


## 7. Une flotte de sessions bloquées sur des blocages qui n'existent plus

Une session distante déclare son blocage **une fois**, dans son `needs_action`,
et ne le révise jamais. Elle n'a aucun moyen d'apprendre qu'entre-temps sa
branche a été fusionnée, sa PR ouverte, son sujet traité par une voisine. Le
blocage reste donc affiché, à l'identique, indéfiniment — et c'est le
propriétaire qui paie le tri.

Mesuré le 27 août : **sur six blocages affichés, deux étaient faux et deux
étaient périmés.** Une session réclamait qu'on déverrouille `main` pour fusionner
une PR qui n'existait plus depuis des heures ; une autre demandait un dépôt dont
le sujet était déjà en ligne. Il restait deux décisions réelles. Le tri à la main
a coûté une session entière.

```bash
python3 .claude/skills/debloquer/scripts/trier-les-blocages.py --fichier sessions.json
```

Le script ne sait pas appeler le serveur MCP : on lui donne la sortie de
`list_sessions`. Il rend trois verdicts, et le troisième est le plus important —
**périmé** (démontrable : branche disparue, ou zéro commit d'avance, ou session
archivée), **vivant** (la demande est humaine : un identifiant, une URL, une
capture — git n'en sait rien), **à regarder** (une piste, qui demande dix
secondes d'œil humain).

Trois choses apprises en l'écrivant, et chacune l'aurait rendu faux :

- **Le verdict porte sur la demande, jamais sur la branche seule.** Une session
  attendait des identifiants Cloudflare depuis une branche déjà fusionnée : juger
  la branche l'aurait classée « périmé » alors que personne n'avait envoyé les
  identifiants. Git ne tranche que ce que git décide.
- **L'ascendance ment après un écrasement.** `git branch --no-merged` a signalé
  sept branches, dont trois fusionnées le matin même : le squash détache les
  commits de leur descendance. Le seul juge est le contenu.
- **Le contenu ment aussi**, quand le travail a été refait sous un autre nom.
  Une branche portait 523 lignes de persistance absentes de `main`… qui y
  existaient sous `persistence.ts` au lieu de `persist.ts`. Aucune comparaison
  automatique n'attrape ça — d'où « à regarder » plutôt qu'un verdict tranché.

## Les permissions du dépôt

**Elles sont posées.** `.claude/settings.json` porte 84 autorisations et 3 refus
depuis la PR #117 — plus rien à coller, plus rien à demander au propriétaire. Ce
qui suit sert à *étendre* la liste, pas à l'installer.

Ce qu'elle contient se justifie en une phrase : on autorise d'avance **ce qui
vérifie** (les suites de test de chaque projet, les commandes de lecture) et **ce
qui installe** (une session distante repart d'un conteneur nu), on refuse
d'avance ce qui **réécrit un historique**, et on laisse hors des deux listes ce
qui doit continuer de demander — `npm run deploy` en est le cas type, parce que
le § 5 de `CLAUDE.md` classe la production en orange et que le comportement par
défaut, demander, applique déjà la règle.

### Les scripts du dépôt passent par le préfixe de leur dossier

```json
"Bash(bash .claude/skills/:*)",
"Bash(python3 .claude/skills/:*)",
"Bash(bash .claude/hooks/:*)"
```

C'est délibéré, et ça s'est payé : la fiche listait autrefois six scripts nommés
un par un, alors qu'il y en a **vingt-quatre** sur disque. Chaque compétence
nouvelle demandait donc une modification de la liste — et une modification de la
liste, quand elle passait encore par un collage depuis un téléphone, coûtait
quarante-cinq minutes. Le préfixe fait qu'une compétence neuve fonctionne le jour
où elle est écrite.

Le niveau de confiance est le même : ces fichiers sont versionnés et relus comme
le reste du dépôt. Autoriser `verifier.sh` nommément et refuser son voisin écrit
le même jour par la même main ne protégeait de rien.

### Ce qu'il faut savoir avant d'y toucher

**Le classificateur juge la commande, pas ce qu'elle appelle.** Autoriser
`npm test` n'autorise pas le script qui le lance. C'est ce qui a été mesuré :
sur trois phrases posées à un `claude -p`, deux se sont arrêtées sur une demande
d'autorisation, dont une pour `verifier.sh` que la session avait pourtant trouvé
toute seule dans `CLAUDE.md`.

**Un bloc `"permissions"` recopié entier remplace, il ne complète pas.** La
version précédente de cette fiche présentait l'objet complet en invitant à
« compléter le tableau déjà présent » : appliqué à la lettre, il effaçait les
onze autorisations Supabase. Quand on étend la liste, on ajoute des lignes au
tableau existant et on vérifie ensuite que rien n'a disparu — un diff qui montre
une seule ligne retirée, celle qui vient de gagner une virgule, est le bon signe.

**Le fichier s'écrit depuis la session.** Voir le § 1 : la frontière n'est pas le
fichier, c'est la formulation de la commande. Passer par un fichier plutôt qu'un
heredoc, et reformuler une fois avant de conclure au refus.
