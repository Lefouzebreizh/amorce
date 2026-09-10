# Post-mortem — session `ensemble-mdph`, 08 au 10/09/2026

Ce fichier répond à une demande explicite du propriétaire : la liste
chronologique des problèmes rencontrés pendant le travail sur
`ensemble-mdph` (site d'accompagnement aux démarches administratives,
dépôt GitHub séparé d'Amorce), combien de temps chacun a coûté, pourquoi il
n'a pas été vu plus tôt, s'il y a eu une déviation par rapport à ce qui
était annoncé, ce qui dans le processus a permis que ça traîne, et une
règle concrète par problème.

**Sur le temps perdu** : ce dépôt ne donne pas d'horodatage par message,
seulement des dates de commit et des changements de journée signalés par le
système. Le temps est donc compté en **allers-retours** (un message du
propriétaire + une reprise de travail), pas en minutes inventées — c'est la
même unité que celle déjà utilisée ailleurs dans `CLAUDE.md` pour chiffrer
le coût d'un défaut.

**Ce que ce fichier n'est pas** : une liste de fautes du propriétaire. Les
problèmes 1, 2 et 3 sont du côté de la ou des sessions qui ont travaillé
sur ce dépôt (celle-ci comprise) ; le 4 est une prémisse de la demande qui
s'est trouvée fausse sans faire perdre de temps parce qu'elle a été
vérifiée avant d'agir — il est gardé ici parce que la question posée
couvre explicitement les déviations, pas seulement les défauts de code.

---

## 1. Confusion entre deux projets sans rapport, dépôt réel jamais attaché à la session

**Ce qui s'est passé.** La tâche était configurée sur `lefouzebreizh/amorce`,
branche `claude/ensemble-mdph-corrections-pdg3y8` — mais le site
"Ensemble face aux démarches" n'a jamais vécu dans ce dépôt : c'est
`Lefouzebreizh/ensemble-mdph`, un dépôt GitHub séparé, jamais attaché à la
session au démarrage. Une partie de la conversation qui précède ce
post-mortem s'est déroulée en confondant ce projet avec un site vitrine du
studio hébergé sur `lefouzebreizh.github.io` (dans `amorce`), au point que
le propriétaire a dû corriger frontalement : *« Tu bosses que sur MDPHA. »*
Et une session antérieure avait déjà passé trois messages à redemander
confirmation avant d'agir, alors qu'elle avait retrouvé le bon dossier.

**Coût mesuré.** Au moins trois allers-retours de confirmation évitables
(reconnus tels quels dans le résumé transmis à cette session), plus le
risque bien réel — concrétisé une fois — de continuer à travailler sur le
mauvais dépôt.

**Pourquoi ça n'a pas été détecté plus tôt.** Rien dans la configuration de
la tâche ne dit explicitement « ce sujet vit ailleurs » : le nom de branche
contient le mot « ensemble-mdph », ce qui suggère fortement qu'il s'agit du
sujet à traiter, mais le dépôt réellement attaché ne le contient nulle
part. Il a fallu chercher (`list_repos`) pour s'en apercevoire, et rien ne
pousse à faire cette recherche par défaut.

**Déviation par rapport à la priorité annoncée.** Oui : la priorité
annoncée (traiter les corrections d'ensemble-mdph) a été retardée par des
allers-retours de confirmation, alors que l'autonomie du §0 d'Amorce
aurait dû pousser à agir dès le bon dossier identifié — sauf que cette
règle vit dans `amorce/CLAUDE.md`, jamais lu par une session qui pense
travailler sur un site vitrine.

**Ce qui, dans le processus, a permis que ça traîne.** Le branchement
d'une tâche sur un dépôt et une branche suppose implicitement que le sujet
demandé y vit. Rien ne vérifie cette hypothèse avant de commencer, et une
session qui ne trouve pas le sujet dans les fichiers ouverts a plus de
chances de conclure « ce n'est pas encore fait » que « ce n'est pas le bon
endroit ».

**Règle proposée pour `CLAUDE.md`.**
> Avant le premier geste sur un sujet nommé par une branche ou une tâche,
> vérifier qu'il vit bien dans le dépôt attaché à la session — un grep sur
> son nom (fichiers, palette, textes cités) qui ne rend rien est le signal
> pour appeler `list_repos` **avant** de continuer, jamais après plusieurs
> messages de confirmation ou une session entière passée sur le mauvais
> projet.

---

## 2. Un chevauchement « corrigé » deux fois sans jamais l'être, jusqu'à ce que le propriétaire le voie

**Ce qui s'est passé.** Le commit `812df1e` (08/09/2026, 22 h 04) annonçait
en toutes lettres corriger le chevauchement du bouton de chat flottant sur
le texte des cartes de démarches. Cette session, en reprenant le dépôt le
même soir, a fait sa propre vérification automatisée et conclu à zéro
chevauchement — **à tort** : le script ne testait le recouvrement qu'avec
les éléments interactifs des cartes (boutons, liens), jamais avec le
paragraphe de texte lui-même, qui est justement l'élément le plus large de
chaque carte. Le défaut réel — jusqu'à 59 px de recouvrement selon la
carte, mesuré le lendemain — a survécu aux deux vérifications, jusqu'à ce
que le propriétaire signale « le texte semble coupé » sur la carte
« démarche médicale ».

**Coût mesuré.** Un commit entier (`812df1e`) qui n'a pas réglé ce qu'il
annonçait, une vérification automatisée de cette session qui l'a confirmé
à tort, et un aller-retour complet avec le propriétaire (son message, le
diagnostic, le correctif, la nouvelle vérification) pour un défaut qui
aurait dû être détecté à la première mesure.

**Pourquoi ça n'a pas été détecté plus tôt.** La mesure automatisée
cherchait le chevauchement au mauvais endroit : elle testait les cibles
cliquables, jamais le texte courant. Un chevauchement purement visuel
(rien n'est caché du point de vue fonctionnel, le texte reste entier dans
le DOM) ne casse aucun test et ne se voit que sur une vraie capture, au
bon moment du défilement.

**Déviation par rapport à la priorité annoncée.** Oui, indirectement : la
session qui a écrit `812df1e` a annoncé un problème réglé sans que sa
propre mesure le prouve — exactement le type de « c'est bon qui n'en est
pas un » que les quatre règles de méthode du §8 d'Amorce (posées le
29/08/2026) visent à éliminer. Mais `ensemble-mdph` ne porte pas ce
`CLAUDE.md` et n'a donc jamais hérité de cette discipline.

**Ce qui, dans le processus, a permis que ça traîne.** `ensemble-mdph` est
un dépôt à part, sans son propre fichier de mémoire : aucune leçon
n'y est écrite, donc rien n'empêche une deuxième session (celle-ci) de
répéter l'erreur d'une première (mesurer le mauvais objet) sans même
savoir qu'elle vient de rejouer un défaut déjà annoncé réglé.

**Règle proposée pour `CLAUDE.md`.**
> Une vérification de chevauchement visuel doit toujours tester le **plus
> grand élément** de la zone concernée (un paragraphe de texte courant,
> pas seulement les boutons et les liens) : c'est presque toujours lui qui
> déborde en premier, et un script qui ne regarde que les cibles
> cliquables peut rendre vert un écran où le texte est visuellement
> recouvert.
>
> Et, plus large : tout projet distinct qui reçoit du travail sur plus
> d'une session doit se doter d'un fichier de mémoire minimal (même trois
> lignes) listant les pièges déjà rencontrés — sans quoi chaque session y
> repart de zéro et un défaut « corrigé » peut ressurgir identique.

---

## 3. Le site était en ligne, mais cliniquement invisible pour son public

**Ce qui s'est passé.** Le projet Vercel `ensemble-mdph` portait
`ssoProtection: all_except_custom_domains` depuis sa création — un réglage
qui met l'adresse `.vercel.app` derrière l'authentification du compte
Vercel. Concrètement : un site destiné à des personnes en détresse
administrative n'était visible que du propriétaire connecté, tous les
autres tombant sur un mur de connexion. Ce n'est cette session qui l'a
trouvé, en vérifiant la configuration du déploiement (`get_project_
deployment_protection`) plutôt qu'en se fiant à un appel authentifié qui
rendait 200 — puis corrigé dans la foulée (`ssoProtection.enabled: false`).

**Coût mesuré.** Le site a existé, invisible pour quiconque hors du
compte, depuis sa création (07/09/2026, d'après `list_projects`) jusqu'à
la correction (08/09/2026) — au moins une journée entière pendant laquelle
une adresse partagée n'aurait montré qu'un mur de connexion. Aucun message
du propriétaire ne l'a signalé : c'est une vérification proactive qui l'a
trouvé, pas un rapport de panne.

**Pourquoi ça n'a pas été détecté plus tôt.** C'est exactement le piège
déjà écrit dans `amorce/CLAUDE.md` à propos d'un autre projet
(Artisan Express, `amorce-51up`) : *« un 200 obtenu par un outil
authentifié ne dit rien de ce que voit un inconnu ».* La leçon existait
déjà — mais dans le dépôt Amorce, jamais lue par une session qui ouvre
`ensemble-mdph` sans savoir que ce piège a déjà coûté cher ailleurs.

**Déviation par rapport à la priorité annoncée.** Non : ce défaut
préexistait, sans mandat explicite pour le chercher au moment où il a été
trouvé.

**Ce qui, dans le processus, a permis que ça traîne.** La mémoire du
studio est fragmentée par dépôt, alors que l'outil qui porte le défaut
(Vercel) et la personne qui en subit les conséquences (Erwann) sont
partagés entre tous ses projets. Une leçon écrite dans `amorce/CLAUDE.md`
ne protège que les sessions qui lisent ce fichier-là.

**Règle proposée pour `CLAUDE.md`.**
> Sur **tout** projet Vercel nouvellement lié — quel que soit le dépôt —
> vérifier `get_project_deployment_protection` avant d'annoncer une
> adresse comme publique, en geste systématique de mise en ligne et pas en
> réflexe qui dépend de la mémoire d'une session en particulier. Ce
> réflexe vaut pour tout outil partagé entre plusieurs dépôts (Vercel,
> GitHub…) : une leçon qui ne vit que dans un seul `CLAUDE.md` ne protège
> qu'un seul dépôt.

---

## 4. Une demande de correction dont la prémisse était fausse — sans coût, parce que vérifiée avant d'agir

**Ce qui s'est passé.** Le propriétaire a demandé de « remplacer le fond
bleu-gris actuel par #0F1115 » et d'harmoniser les cartes sur
`#202430` / `#40E0D0` / `#7C3AED` — or ces quatre valeurs exactes étaient
déjà en place dans `css/style.css` depuis un commit antérieur (« Palette
fixée définitivement »), simplement posées à plat plutôt qu'en dégradé.

**Coût mesuré.** Aucun : la couleur réelle a été vérifiée avant toute
écriture, et le travail s'est concentré sur ce qui manquait vraiment
(dégradé, glow, cascade) plutôt que de réécrire des variables déjà
justes.

**Pourquoi ça n'a pas été détecté plus tôt.** Ce n'est pas un défaut du
dépôt — c'est un écart entre ce que le propriétaire se souvient avoir vu
et l'état réellement déployé, probablement parce qu'il n'a pas rouvert le
site depuis la dernière refonte de palette.

**Déviation par rapport à la priorité annoncée.** Non.

**Ce qui, dans le processus, aurait pu laisser traîner ça.** Si la couleur
annoncée dans la demande avait été prise pour argent comptant, la session
aurait pu écraser des valeurs déjà correctes en croyant les corriger — un
risque réel, juste non concrétisé ici.

**Règle proposée pour `CLAUDE.md`.**
> Avant d'exécuter une demande de correction qui décrit un défaut (« le
> fond est en bleu-gris », « les couleurs sont plates »), vérifier l'état
> réel du fichier concerné en premier geste — jamais supposer que la
> description du défaut est exacte, même quand elle vient du propriétaire.
> C'est la même discipline que « mesurer avant de conclure », appliquée
> cette fois à la prémisse d'une demande plutôt qu'au résultat d'un test.

---

## 5. Le titre du héro oublié dans une passe qui devait pourtant couvrir « toute la page »

**Ce qui s'est passé.** La demande de refonte visuelle (dégradé, icônes,
glow, cascade) ne listait pas d'exclusion : elle parlait de « ce projet »
dans son ensemble. Le travail a couvert le fond des cartes, le bandeau du
haut, les badges d'icône, le halo au survol et l'animation d'entrée — mais
a laissé le `<h1>` du héro, l'élément le plus visible de toute la page, en
blanc plat. Il a fallu un message dédié du propriétaire (« Pas de version
blanche, le dégradé est obligatoire sur ce titre ») pour que ce soit
corrigé.

**Coût mesuré.** Un aller-retour complet — et c'est un cas où le
chronométrage réel est instructif : le commit du correctif (`6bdba84`,
19 h 58 min 45 s) est arrivé cinq minutes après celui de la passe censée
tout couvrir (`80b78d6`, 19 h 53 min 33 s). Le retard n'est donc pas resté
longtemps *dans les faits*, mais l'aller-retour, lui, était évitable à
100 % : le titre était visible, en blanc, sur les deux captures que cette
session avait elle-même envoyées comme preuve de vérification.

**Pourquoi ça n'a pas été détecté plus tôt.** La vérification faite après
coup regardait ce qui avait été **touché** (cartes, icônes) pour confirmer
que le changement demandé y était visible — elle ne s'est jamais demandée
ce qui, dans la même consigne, aurait dû changer et n'avait pas bougé. Le
défaut était pourtant visible à l'œil nu sur les captures envoyées : il
n'a simplement pas été cherché là.

**Déviation par rapport à la priorité annoncée.** Oui : la consigne parlait
du dégradé « à ce projet » sans exception, et le titre est l'élément le
plus emblématique porteur de ce dégradé sur les autres vitrines du
studio — l'oublier est une déviation de fait, même sans intention.

**Ce qui, dans le processus, a permis que ça traîne.** Une vérification
qui part de « qu'est-ce que j'ai changé » au lieu de « qu'est-ce que la
consigne demandait au juste » ne peut jamais détecter un oubli — elle ne
regarde que ce qu'elle sait déjà avoir fait.

**Règle proposée pour `CLAUDE.md`.**
> Après une demande d'habillage visuel qui dit « toute la page » ou « ce
> projet » sans lister exhaustivement les éléments concernés, relire la
> capture de vérification en se demandant explicitement quels éléments
> visibles ne portent **pas encore** le changement demandé — pas
> seulement si ce qu'on a touché est correct. La checklist se construit à
> partir de la consigne, jamais à partir du diff qu'on vient d'écrire.

---

## Le fil commun

Les problèmes 2, 3 et 5 partagent la même racine : une vérification qui a
mesuré un périmètre plus étroit que le risque réel — les boutons plutôt
que le texte, un appel authentifié plutôt que le réglage d'accès, le diff
écrit plutôt que la consigne d'origine. Aucune de ces trois vérifications
n'était fausse sur ce qu'elle mesurait ; chacune mesurait la mauvaise
chose. C'est exactement la phrase déjà présente dans `amorce/CLAUDE.md` à
propos d'un tout autre projet : *« une mesure disait vert et le fichier
était faux »*.

Le problème 1 et une partie du problème 2 et 3 partagent une seconde
racine : `ensemble-mdph` est un dépôt sans mémoire propre, qui ne peut
hériter ni des leçons d'Amorce (fragmentées par dépôt) ni de ses propres
erreurs passées (aucun fichier ne les garde).

**Mise à jour du 10/09/2026 : les cinq règles sont insérées.** Le propriétaire
a validé le menu ci-dessus et demandé l'insertion directe. Chacune vit
désormais au plus près de la section qu'elle concerne plutôt qu'en bloc à
part : §9 (dépôt réel avant le premier geste), §3 (mémoire minimale pour un
projet séparé), §10 « Modifier ce dépôt » (vérifier avant de corriger), §10
Vercel (généralisation du piège `ssoProtection` à tout dépôt) et §8 bis (les
deux pièges de vérification — le mauvais objet, la checklist qui vient du
diff plutôt que de la consigne).
