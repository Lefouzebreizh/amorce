# Rétrospective — ce qui a coûté, du 3 au 6 septembre 2026

Écrit le 10/09/2026, à la demande du propriétaire.

## Ce que ce fichier couvre, et ce qu'il ne couvre pas

**Il couvre un seul fil de travail** : celui qui a enchaîné la restriction de
`src=groupe`, le garde-fou des liens morts d'Annuaria, les tests de
`dernierImport`, la clôture du constat SSRF dans `AUDIT.md`, le script
`demarrer.sh` et l'accord des compteurs d'IPTV. Douze pull requests, du 03/09 à
01 h 23 au 06/09 à 18 h 07.

**Il ne couvre pas** le travail des autres sessions de la même période, qui est
pourtant abondant — le dépôt porte une soixantaine de leçons datées du 03 au
07/09. Les auditer d'ici reviendrait à reconstruire ce que je n'ai pas vécu, et
`second-brain/lecons/2026-09-03-…` contient précisément la leçon qui dit qu'un
constat tiré d'une reconstruction ne dit rien du fichier. Deux problèmes des
autres sessions figurent quand même ci-dessous, et seulement parce qu'ils ont
un chiffre publié : le radar arrêté cinq jours, et la page d'Artisan Express
périmée trois jours.

## Comment les durées ont été obtenues

Deux unités, et elles ne se mélangent pas.

**Mesuré** — horodatage de fusion relevé dans `git log`, ou nombre relevé dans
un fichier du dépôt. Ces lignes portent une date et une heure.

**Compté en allers-retours** — pour ce qui s'est passé à l'intérieur d'un
échange, où aucune horloge n'existe. L'unité est le **tour perdu** : un tour où
la session a produit quelque chose de faux, ou le propriétaire a dû redemander.
C'est aussi l'unité que le §3 de `CLAUDE.md` retient déjà (« ce qui a coûté un
aller-retour »), et convertir ces tours en minutes serait une invention.

**Ce qui n'est pas mesurable et n'est donc pas chiffré** : le temps réel passé
par le propriétaire à relire, sur un téléphone, pendant une nuit.

---

## La chronologie

### 1. Le test qui encodait l'ancien comportement

**Quand** : 03/09, avant 01 h 23 (fusion #589).
**Coût** : 1 tour.

Restreindre `src=groupe` à un porteur de jeton a fait rougir un test qui
affirmait l'accès libre. Le test n'était pas faux : il décrivait fidèlement le
code d'avant.

**Pourquoi pas plus tôt** : il avait été écrit en même temps que le code qu'il
gardait, donc il documentait l'**implémentation** et non l'intention. Rien ne
distingue à la lecture un test qui protège une décision d'un test qui recopie
une ligne.

**Règle** : un test qui devient rouge parce qu'une **règle de produit** change
n'est pas un test cassé, c'est un test qui gardait l'implémentation. On le
réécrit en cas nommés — ici : prouver, ne pas prouver de trois façons, et le
repli — jamais en ajustant l'attente.

### 2. Le focus qui échouait sans rien dire

**Quand** : 03/09, lot du garde-fou d'Annuaria (#594, fusionné à 00 h 21
d'après le relevé du §10 de `CLAUDE.md`).
**Coût** : 1 tour de navigateur réel, après une vérification déjà verte.

`modale.querySelector('[data-action="fermer"]')` rendait le fond de la modale —
un `<div>` qui porte le même attribut et vient en premier — et non le bouton.
`focus()` sur un `<div>` sans `tabindex` **ne marche pas et ne lève pas**.

**Pourquoi pas plus tôt** : aucune mesure ne portait sur « où est le focus ».
Le sélecteur était plausible, le code compilait, les contrôles passaient. Il a
fallu interroger `document.activeElement` dans un vrai Chromium.

**Règle** : un sélecteur d'attribut qui doit désigner un élément interactif
porte son nom de balise — `button[data-action="fermer"]`, jamais
`[data-action="fermer"]`. Et tout déplacement de focus se vérifie en lisant
`document.activeElement` après le geste : `focus()` est la seule fonction
courante qui échoue en silence.

### 3. La bande morte de 33 px

**Quand** : même lot.
**Coût** : 1 tour.

Cacher le `<a>` du lien affilié laissait la bordure et le fond du `<footer>` —
33 px de bande vide sous une modale, mesurés au `getBoundingClientRect()`.

**Pourquoi pas plus tôt** : « cacher un élément » se lit comme « il ne prend
plus de place », ce qui est vrai de l'élément et faux de son conteneur.

**Règle** : après avoir caché un élément, on mesure la **hauteur de son
conteneur**, pas la visibilité de l'élément. Zéro est le seul résultat
acceptable ; sinon c'est le conteneur qu'il faut cacher.

### 4. J'ai affaibli un contrôle qui marchait

**Quand** : même lot.
**Coût** : rattrapé dans le même tour, mais c'est la faute la plus grave de la
série.

Le contrôle « lien affilié en `rel="sponsored"` » est devenu rouge parce que
mon changement retirait certains liens. Mon premier réflexe a été de le
détendre.

**Pourquoi pas plus tôt** : un contrôle rouge après un changement se lit comme
un obstacle, alors que c'est une question. La relecture du diff l'a rattrapé,
pas la barrière.

**Règle** : un contrôle qu'un changement fait rougir ne se détend jamais. Il se
rend **bilatéral** — il couvre l'ancien régime *et* le nouveau — ou il est la
preuve que le changement est faux. Détendre un contrôle pour passer au vert est
la seule opération qui rende une suite de tests inutile d'un coup.

### 5. Playwright irrésolvable depuis `/tmp`

**Quand** : 03/09, deux fois.
**Coût** : 2 tours.

`ERR_MODULE_NOT_FOUND` sur `playwright`, parce que le script de sonde vivait
dans `/tmp` : Node résout depuis le dossier du script, et `node_modules` est à
la racine du dépôt.

**Pourquoi pas plus tôt** : écrire un script jetable dans `/tmp` est un réflexe,
et le message d'erreur accuse le paquet, pas l'emplacement.

**Règle** : un script jetable qui importe une dépendance du dépôt s'écrit et se
lance **depuis la racine du projet concerné**, jamais depuis un dossier
temporaire. Le brouillon va dans le répertoire de travail temporaire ; ce qui
importe du `node_modules` n'y va pas.

### 6. Le vérificateur de cohérence qui crie sur sa propre documentation

**Quand** : 03/09, deux fois de plus dans ce fil.
**Coût** : 2 tours de reformulation.

`/coherence-depot` lit toute barre oblique suivie d'un nom, entre accents
graves, comme une compétence. Deux phrases parfaitement justes — l'une citant
une action GitHub, l'autre une porte d'authentification — le faisaient donc
crier.

**Pourquoi pas plus tôt** : `CLAUDE.md` documente le piège **trois fois**, et
chaque fois au moment d'écrire. Le déclenchement, lui, se produit à la
**relecture**, sur de la prose que personne ne relit en pensant à un
vérificateur.

**Règle** : ce piège ne se règle pas par une note de plus. Le contrôle doit
apprendre à ne pas se déclencher — au minimum, ignorer ce qui est précédé d'un
verbe HTTP ou d'un article, et accepter une liste d'exceptions déclarée dans le
fichier lui-même. Tant qu'il n'est pas corrigé, toute alerte qu'il produit sur
`CLAUDE.md` est suspecte avant d'être vraie.

### 7. Un constat de sécurité annoncé ouvert pendant 2 jours et 15 heures

**Quand** : la faille est fermée le **03/09 à 00 h 55** (commit `4d2c6e5`,
PR #577). `AUDIT.md` ne l'a dit que le **05/09 à 15 h 55** (PR #744).
**Coût** : **2 j 15 h** — mesuré, et c'est la plus longue dérive du fil.

Pendant deux jours et demi, le document d'audit d'IPTV a annoncé un SSRF
critique ouvert alors qu'il était corrigé et fusionné.

**Pourquoi pas plus tôt** : la consigne d'origine était juste — « ne modifie
aucun fichier de code, seulement `AUDIT.md` » — et elle a créé un document sans
propriétaire. Le correctif est parti dans une autre PR, écrite par un autre
fil, qui n'avait aucune raison de connaître le document. Rien ne reliait un
constat à sa fermeture.

C'est le cas exact que le §3 appelle « une règle périmée est pire qu'une règle
absente », appliqué à de la sécurité : une session qui lit cet `AUDIT.md`
pendant ces deux jours part corriger une faille qui n'existe plus, ou pire,
tient le projet pour vulnérable dans un compte rendu.

**Règle** : tout document de constats — `AUDIT.md`, `SECURITY.md`, une liste de
dettes — porte en tête **la date de son dernier recoupement** et, pour chaque
constat, le commit qui le ferme quand il est fermé. Et la symétrique, qui est
celle qui coûte : **une PR qui ferme un constat écrit cite le document et le
constat dans son propre diff.** Fermer une faille sans toucher au fichier qui
l'annonce laisse le mensonge en place.

### 8. `dernierImport` existait déjà

**Quand** : 03/09, avant 03 h 29 (fusion #606).
**Coût** : zéro — évité par un `grep` de trente secondes.

La demande disait « tranche et écris la méthode sur `Depot` ». La méthode
existait, et pilotait déjà l'écran d'entretien. Ce qui manquait était ses
tests.

**Pourquoi ça a failli passer** : l'instruction était explicite et légitime. Un
ordre direct désarme la vérification bien plus sûrement qu'un doute.

**Règle** : le `grep` avant d'écrire vaut **aussi, et surtout, quand la demande
est explicite**. Une instruction de créer n'est pas une preuve d'absence. Si la
chose existe, le livrable change — et le compte rendu dit ce qui a changé et
pourquoi, au lieu de livrer un doublon poliment.

### 9. Un compte rendu que le propriétaire n'a pas compris

**Quand** : 05/09 — « ou en est l'iptv », puis « Du coup, je n'ai pas tout
compris. Il en est où les p t v exactement ? »
**Coût** : 2 tours, dont un entièrement perdu.

Mon premier état d'IPTV était juste et illisible : trop de noms de fichiers,
trop de mécanique, aucune phrase disant ce que le produit fait.

**Pourquoi pas plus tôt** : `CLAUDE.md` §9 donne un gabarit pour le « bonjour »
— où on en est, ce qui bloque, le contournement — mais il est écrit pour une
**ouverture de fil**. Aucune règle ne couvre l'état demandé **en cours de
travail**, et c'est là qu'on répond dans le vocabulaire de la session au lieu de
celui du propriétaire.

**Règle** : un état demandé en cours de fil s'ouvre par trois phrases sans
aucun nom de fichier — ce que c'est, si ça marche, ce qui manque — et la
mécanique vient après, pour qui la veut. Le nom d'un fichier n'entre dans un
compte rendu que s'il est **cliquable** ou s'il faut le taper.

### 10. « TU ES EN LOCAL FAIS CE QUIL FAUT »

**Quand** : 05/09.
**Coût** : 2 tours, et une réponse fausse assénée avant d'être vérifiée.

J'ai affirmé tourner à distance sans le montrer. Il a fallu son message en
majuscules pour que je mesure enfin — `get_session` rendant
`environment_kind: anthropic_cloud`, origine `android` — puis essayer quatre
chemins avant de conclure.

**Pourquoi pas plus tôt** : `CLAUDE.md` §7 porte **la table exacte** qui tranche
la question en une ligne. Je la connaissais. Je ne l'ai pas exécutée, parce
qu'une affirmation sur soi-même ne se ressent pas comme une affirmation à
prouver.

**Règle** : toute phrase sur **où tourne la session** — « je suis en local »,
« je ne peux pas ouvrir cette adresse », « c'est sur ta machine » — s'accompagne
dans le **même message** de la ligne de `get_session` ou `list_sessions` qui la
prouve. Sans cette ligne, la phrase ne s'écrit pas. C'est le seul sujet où la
session est à la fois l'objet mesuré et le mesureur, et c'est exactement là
qu'elle se croit sur parole.

### 11. `pkill -f` a tué mon propre shell

**Quand** : 06/09.
**Coût** : 1 tour, et un diagnostic parti dans la mauvaise direction — j'ai
d'abord lu le silence comme un plantage du serveur.

Mesuré : `bash -c '… pkill -f "next dev" …'` rend **`Terminated`, code 143**,
soit le SIGTERM que `pkill` s'envoie à lui-même, la ligne de commande du shell
contenant le motif cherché.

**Pourquoi pas plus tôt** : **le symptôme ment sur sa victime.** Une commande
qui meurt sans rien afficher se lit comme « la chose que je voulais tuer a
planté », et on part lire un journal vide et normal.

**Règle** : un processus qu'on a lancé soi-même se coupe par son **PID** gardé
au lancement et un `trap`, jamais par un motif. Quand un motif est inévitable,
on le brise par une classe d'un caractère — `n[e]xt dev` — parce qu'une session
passe toujours ses commandes à `bash -c "<texte>"`, texte qui devient lui-même
une ligne de commande candidate. Écrit dans
`second-brain/lecons/2026-09-06-pkill-tue-le-shell-qui-lappelle.md`.

### 12. Un port ouvert n'est pas une page servie

**Quand** : 06/09, trouvé **avant** de livrer.
**Coût** : zéro pour ce lot — mais c'est la forme de défaut la plus chère du
dépôt, et elle n'avait jamais été chiffrée.

Mesuré, cache de construction vide : le port accepte la connexion à
**0,659 s**, la page rend 200 à **3,451 s**. Près de trois secondes où le
serveur est joignable et où aucune page n'existe.

**Pourquoi ça n'avait jamais été relevé** : personne n'annonce une adresse
depuis la machine qui l'héberge — on met plus de trois secondes à changer de
fenêtre. Le défaut n'existe que pour celui qui tape l'adresse sur un autre
appareil, et il accuse alors l'adresse.

**Règle** : rien qui dépend d'un service ne s'annonce sur la foi de son
**lancement**. On attend une vraie réponse — `curl -sf` en boucle, avec une
sortie par le haut si le processus meurt — et jamais un `sleep` d'un nombre
écrit à la main, qui est faux dans les deux sens et vieillit avec le projet.
Écrit dans
`second-brain/lecons/2026-09-06-un-port-qui-accepte-nest-pas-une-page-qui-repond.md`.

### 13. « 1 séries » — un défaut qu'aucune vérification ne pouvait voir

**Quand** : trouvé le 06/09. Présent depuis l'écriture des écrans.
**Coût** : le défaut lui-même a vécu des semaines. Le corriger a pris deux PR
et environ 2 h 20 (#749 fusionnée à 15 h 45, #756 à 18 h 07).

Neuf compteurs d'écran, puis quatorze messages de la ligne de commande,
écrivaient leur pluriel en dur.

**Pourquoi pas plus tôt** — et c'est la meilleure trouvaille du fil : le projet
n'a que **deux** jeux de données. `iptv demo` en charge **6**, un vrai
abonnement en a **120 000**. Le défaut n'existe qu'à **1**, c'est-à-dire
exactement l'état de quelqu'un qui vient d'importer une chaîne pour essayer —
le seul état que ni la démonstration ni la production ne produisent jamais.
`verifier.sh` était vert avant comme après : un pluriel dans une chaîne de
caractères ne casse aucun type et ne fait échouer aucune assertion.

**Règle** : le **jeu de démonstration d'un produit fixe un plancher**, et rien
en dessous n'est jamais regardé. Tout affichage qui dépend d'un nombre se
regarde à **zéro, un et beaucoup** — et en français zéro est un singulier, ce
qui rend le test `n > 1` juste et `n !== 1` faux. Écrit dans
`second-brain/lecons/2026-09-06-le-jeu-de-demonstration-fixe-un-plancher.md`.

### 14. Le lot s'est élargi deux fois après le feu vert

**Quand** : 06/09, entre le « go » et #756.
**Coût** : aucun retard, aucune reprise — mais le « go » ne couvrait pas ce qui
est parti.

Le menu annonçait « neuf compteurs d'écran, aucune fonction nouvelle ». Sont
partis : les neuf, plus l'accord d'une proposition entière, plus trois comptes
par genre passés en constantes, plus cinq messages de la ligne de commande
(#749) — puis une seconde PR avec quatorze messages de plus **et un raccourci
`s(compte)` local**, c'est-à-dire précisément la fonction nouvelle que le menu
excluait.

**Pourquoi** : les cas supplémentaires ont tous été trouvés **en regardant**,
ce que le §8 exige. Le processus a donc produit lui-même l'élargissement. Ce
n'est pas une négligence, c'est une contradiction non résolue entre deux règles
justes.

**Règle** : ce qu'on découvre **en regardant** ne rentre pas dans le menu déjà
validé. Deux issues, et il faut choisir explicitement dans le message qui livre :
soit on livre le menu **tel qu'annoncé** et le reste part en second lot nommé,
soit on l'inclut et **le compte rendu ouvre sur ce qui a été ajouté**, avant de
dire ce qui a été fait. Ce qui est interdit est la troisième voie, celle qui a
été prise : livrer plus large et le mentionner en bas.

### 15. Deux tours passés à demander où j'en étais

**Quand** : 06/09 — « ou en es tu », puis « tu as encore quelque chose à faire
ou pas ».
**Coût** : **2 tours**, et c'est le coût de processus le plus net du fil.

Le correctif du pluriel était cartographié, chiffré, prêt. Il a attendu un mot
pendant que je publiais le menu **trois fois** dans trois messages successifs.

**Pourquoi ça a traîné** : `CLAUDE.md` porte deux règles, toutes deux vraies,
qui se contredisent exactement sur ce cas.

| Ce que dit le §0 bis, règle 3 | Ce que dit la section Git |
| --- | --- |
| Toute écriture sur de l'existant annonce son menu **puis attend le feu vert** | « Une correction de bogue, du texte, un ajustement de présentation » se fait et se fusionne seule ; « **demander est la faute, pas la prudence** » |

Un pluriel figé dans une chaîne d'affichage tombe dans les deux à la fois : il
touche à de l'existant, et c'est le cas d'école du changement mineur. Le fichier
ne dit pas lequel gagne, donc j'ai pris le plus prudent — et le plus prudent est
justement celui que la section Git nomme comme la faute.

**Règle** : le §0 bis règle 3 doit dire ce qu'il **ne** couvre pas. Proposition
concrète : le menu et l'attente valent pour ce qui **change un comportement, une
signature, une donnée ou une décision de produit**. Ce qui ne touche qu'à du
**texte affiché, un accord grammatical, un espacement, un libellé** relève de
la section Git — on fait, on vérifie, on fusionne, on annonce au passé. Le
critère n'est ni la taille ni le nombre de fichiers : c'est **est-ce qu'une
personne peut se tromper sur ce que je vais faire ?** Un « 1 séries » qui
devient « 1 série » ne laisse aucune place au malentendu, donc aucune place au
menu.

### 16. Annuaria sert un instantané d'avant son propre correctif

**Quand** : le dépôt de fichiers Vercel date du **02/09 à 22 h 54**. Le
garde-fou des liens morts a été fusionné le 03/09 à 00 h 21. Nous sommes le
10/09.
**Coût** : **huit jours**, et le compteur tourne.

Mesuré aujourd'hui : **404 occurrences** de `exemple-affiliation` subsistent
dans `annuaire-ia/`. Mesuré le 06/09 : le projet Vercel porte toujours
`ssoProtection: all_except_custom_domains`, donc **personne d'extérieur ne voit
rien** — le risque est nul tant que le mur tient, et entier le jour où il tombe.

**Pourquoi ça traîne** : la vraie tâche — les 69 inscriptions aux programmes
d'affiliation — n'appartient qu'au propriétaire. Aucune session ne peut la
faire, donc aucune session ne la porte, donc personne ne la rappelle. Elle n'est
inscrite nulle part comme une tâche datée : elle vit dans des comptes rendus,
qui se périment.

**Règle** : une tâche que **seul le propriétaire** peut faire s'écrit dans un
fichier daté du dépôt au moment où elle est identifiée — pas dans un message.
Un message se perd au fil suivant ; un fichier se relit par `/etat-du-depot`.
Et toute session qui rend un état inclut ces tâches-là avec **le nombre de
jours écoulés**, parce que c'est le seul chiffre qui fait bouger quelque chose.

---

## Les deux dérives des autres sessions, citées pour leur chiffre

Elles ne sont pas de ce fil, mais elles portent la même signature et leur durée
est publiée dans le dépôt.

| Ce qui a traîné | Combien | La cause, telle qu'écrite |
| --- | --- | --- |
| Le radar de pépites, fini et vert, **à l'arrêt** | **5 jours** | Une conséquence fausse tirée d'une mesure juste : « il faut le PC », alors que le runner GitHub a du réseau (`CLAUDE.md` §7) |
| La page publique d'Artisan Express servant un tarif déjà corrigé | **3 jours** | Un projet Vercel en dépôt de fichiers ne se met pas à jour au commit ; douze SMS de prospection allaient partir vers cette adresse (`second-brain/lecons/2026-09-06-une-correction-fusionnee-nest-pas-une-correction-en-ligne.md`) |

Les deux ont la même forme que le n° 7 de ce fil : **quelque chose était vrai,
quelque chose l'a cessé, et rien dans le processus ne le relit.**

---

## Les déviations par rapport à la priorité annoncée

Quatre priorités ont été posées dans ce fil. Deux ont été tenues, deux non.

**Tenue — « Annuaria seul, les dix autres en pause ».** Aucun autre site n'est
parti. La question ne s'est même pas posée : le réseau se déploie comme un seul
site GitHub Pages, ce qui a été vérifié plutôt que supposé.

**Tenue, et c'est celle qui comptait — « Ne modifie aucun fichier de code,
seulement AUDIT.md ».** La contrainte de la tâche d'audit a été respectée d'un
bout à l'autre, y compris au moment de solder le constat I-1 : `AUDIT.md` a
reçu un bloc de clôture citant le commit, et le texte d'origine avec ses
numéros de ligne a été **conservé** sous ce bloc plutôt qu'effacé. C'est le seul
endroit du fil où une consigne aurait pu être « améliorée » et ne l'a pas été.

**Déviation assumée et annoncée — « écris la méthode `dernierImport` ».** Elle
existait. J'ai écrit ses tests à la place, et je l'ai dit avant de livrer. La
déviation est justifiée, mais elle reste une déviation : le propriétaire a
demandé A et reçu B.

**Déviation non annoncée avant coup — le périmètre du lot des pluriels.** Décrite
au n° 14. Le « go » portait sur neuf compteurs et l'absence de fonction
nouvelle ; ont été livrés une trentaine de messages et un raccourci local. Rien
n'a été cassé, tout a été dit — mais après.

---

## Ce qui, dans le processus actuel, a permis que ça traîne

Quatre causes, et elles se recoupent.

**1. Un menu qui attend, dans un dépôt piloté depuis un téléphone.** C'est le
n° 15, et c'est la plus chère. Le §0 bis protège de l'écrasement, ce qui est
juste ; mais appliqué à un accord grammatical il produit exactement le temps
mort que le §0 interdit en propres termes. Deux règles justes, aucune frontière
écrite entre elles.

**2. Rien ne relit un document de constats.** C'est le n° 7 et les deux dérives
citées. Le dépôt a une barrière de vérification remarquable pour le **code** —
`verifier.sh`, `/coherence-depot`, les agents de relecture — et **aucune** pour
ses propres affirmations d'état : un audit, un décompte de projets Vercel, une
page déployée. `/coherence-depot` compare le dépôt à ce qu'il dit de lui-même,
mais il ne sait rien de ce qui est **en ligne** ni de ce qui est **fermé**.

**3. Les tâches du propriétaire ne vivent nulle part.** C'est le n° 16. Elles
sont mentionnées dans des messages, donc elles disparaissent au fil suivant, et
la session d'après ne peut ni les rappeler ni les dater. Huit jours passent sans
que ce soit la faute de personne.

**4. Le « regardé » du §8 crée l'élargissement qu'il faut ensuite justifier.**
C'est le n° 14. Regarder trouve toujours plus que ce que le menu annonçait —
c'est le but. Mais aucune règle ne dit quoi faire de ce surplus, alors chacun
improvise, et l'improvisation la plus tentante est de le glisser dans le lot en
cours.

---

## Les seize règles, rassemblées

À ajouter à `CLAUDE.md`. Elles ne le sont **pas** : modifier `CLAUDE.md` touche
à de l'existant, donc au §0 bis, et ce fichier-ci est le menu.

| N° | Où | La règle, en une phrase |
| --- | --- | --- |
| 1 | §8 | Un test rouge après un changement de **règle** gardait l'implémentation : on le réécrit en cas nommés, jamais en ajustant l'attente. |
| 2 | §10, pièges | Un sélecteur d'attribut visant un élément interactif porte son nom de balise, et tout `focus()` se vérifie par `document.activeElement` — c'est la seule fonction courante qui échoue sans lever. |
| 3 | §10, pièges | Après avoir caché un élément, mesurer la hauteur de son **conteneur** ; zéro ou rien. |
| 4 | §8 | Un contrôle qu'un changement fait rougir se rend **bilatéral** ou prouve que le changement est faux. Le détendre est interdit. |
| 5 | §7 | Un script jetable qui importe une dépendance du dépôt se lance depuis la racine du projet, jamais depuis un dossier temporaire. |
| 6 | §10 | Corriger le vérificateur de cohérence au lieu de contourner sa fausse alerte une quatrième fois ; d'ici là, toute alerte sur `CLAUDE.md` est suspecte avant d'être vraie. |
| **7** | **§8** | **Un document de constats porte la date de son dernier recoupement, et une PR qui ferme un constat cite ce document dans son propre diff.** |
| 8 | §0 bis, règle 1 | Le `grep` avant d'écrire vaut **surtout** quand la demande est explicite : un ordre de créer n'est pas une preuve d'absence. |
| 9 | §9 | Un état demandé en cours de fil s'ouvre par trois phrases sans nom de fichier — ce que c'est, si ça marche, ce qui manque. |
| 10 | §7 | Toute phrase sur l'endroit où tourne la session s'accompagne, dans le même message, de la ligne de `get_session` qui la prouve. |
| 11 | §7 | Un processus lancé par la session se coupe par son PID et un `trap`, jamais par un motif — `pkill -f` tue le shell qui l'appelle. |
| 12 | §8 | Rien qui dépend d'un service ne s'annonce sur son lancement : on attend une vraie réponse, jamais un `sleep`. |
| 13 | §8 | Tout affichage qui dépend d'un nombre se regarde à **zéro, un et beaucoup** ; le jeu de démonstration fixe un plancher sous lequel personne ne regarde. |
| **14** | **§0 bis, règle 3** | **Ce qu'on trouve en regardant ne rentre pas dans le menu déjà validé : soit second lot nommé, soit le compte rendu ouvre sur l'ajout.** |
| **15** | **§0 bis, règle 3** | **Le menu couvre ce qui change un comportement, une signature, une donnée ou une décision de produit. Le texte affiché, un accord, un libellé relèvent de la section Git : on fait, on fusionne, on annonce au passé.** |
| 16 | §9 | Une tâche que seul le propriétaire peut faire s'écrit dans un fichier daté, jamais dans un message — et tout état la rappelle avec son nombre de jours. |

Les trois en gras sont celles qui ont réellement coûté du temps mesurable dans
ce fil. Les treize autres coûtent un tour chacune, ce qui est peu — mais c'est
la treizième qui a laissé « 1 séries » à l'écran pendant des semaines.
