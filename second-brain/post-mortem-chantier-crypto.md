# Post-mortem du chantier crypto — radar `pepites/` et `nexuscrypto/`

*Écrit le 10/09/2026. Couvre du 25/08 (premier commit du radar) au 10/09, tour 29.*

**Ce que ce fichier est.** La liste datée de ce qui a coincé sur ces deux
projets, ce que chaque chose a coûté en délai, pourquoi elle n'a pas été vue
plus tôt, et une règle par problème — prêtes à coller dans `CLAUDE.md`.

**Ce qu'il n'est pas.** Un décompte d'heures de travail : rien ne les
enregistre. Partout où j'écris « coût », c'est un **délai écoulé** entre le
moment où la chose est devenue vraie et le moment où elle a été corrigée,
mesuré sur les dates de commits, de runs et de fichiers. Quand une chose n'est
toujours pas corrigée, le délai court encore et je l'écris ainsi.

---

## 0. Le fait qui domine tout le reste

**Le radar s'est prononcé, et le verdict n'a été lu par personne.** Relevé
aujourd'hui dans le journal du tour 29 (10/09, 04h51) :

> **40 % de hausses** sur 25 jetons jugeables, médiane **−7,0 %**.
> **Témoin** — les jetons écartés par les filtres : **33 % de hausses sur 69**,
> médiane **−1,3 %**. Le radar fait **−5,7 point(s)** de médiane.

Il gagne 7 points sur le **taux de hausses** et perd 5,7 points sur la
**médiane**. Autrement dit : il désigne un peu plus souvent des jetons qui
montent, et ceux qu'il désigne perdent davantage. Sur ces deux mesures, à ce
stade, **il ne bat pas ce qu'il jette**.

Le seuil de vingt a été franchi entre le tour 21 (08/09, 18 jugeables) et le
tour 29. Je n'ai pas cherché le tour exact — et c'est précisément le symptôme :
**personne ne regardait**. La priorité annoncée le 07/09 était, mot pour mot,
« relire le bulletin bilan une fois les vingt jetons atteints, pour savoir si le
radar bat vraiment son témoin ». Le compteur les a atteints, le bulletin s'est
écrit tout seul à chaque tour, et il a fallu une demande d'état des lieux pour
que quelqu'un l'ouvre.

---

## 1. Chronologie

| # | Quoi | Apparu | Corrigé | Délai |
| --- | --- | --- | --- | --- |
| P1 | Le radar fini, vert, et à l'arrêt | 30/08 | 04/09 | **5 j** |
| P2 | Doublon : la commande `pepites` de NexusCrypto | 28/08 | 08/09 | **11 j** |
| P3 | Seuil d'alerte inatteignable + aucun jeton Telegram | 04/09 | **ouvert** | **6 j** |
| P4 | Cadence annoncée fausse (« toutes les trois heures ») | 04/09 | 08/09 | **4 j** |
| P5 | Biais du comptage : les effondrés sortent en silence | 03/09 | nommé 08/09, **code inchangé** | **7 j** |
| P6 | Cette session privée de GitHub sur les trois chemins | 04/09 | 08/09 | **4 j** |
| P7 | `2>/dev/null` masquant un échec d'authentification | 07/09 | 07/09 | même séance |
| P8 | Deux extrapolations fausses du compteur, en sens contraires | 07 et 08/09 | 10/09 | **3 j** |
| P9 | « WHX n'existe pas », affirmé sur une capture tronquée | 08/09 | 08/09 | même séance |
| P10 | Le changement de direction jamais écrit dans `CLAUDE.md` | 07/09 | **ouvert** | **3 j** |
| P11 | Le verdict tombé et non lu | ~09/09 | **ouvert** | **~1 j** |
| P12 | Node.js 20 obsolète sur les quatre actions | 07/09 | **ouvert** | **3 j** |

---

## 2. Chaque problème, et la règle qui en sort

### P1 — Le radar est resté cinq jours fini, vert et à l'arrêt

**Ce qui s'est passé.** Le radar était complet et testé depuis le 30/08. Il n'a
commencé à tourner que le 04/09, à l'ouverture de `radar-pepites.yml`.

**Pourquoi personne ne l'a vu.** Une phrase du dépôt disait qu'il fallait « une
machine du propriétaire, allumée et planifiée ». Elle était **attachée à une
mesure juste** — les neuf hôtes de marché rendent `000` depuis une session
distante — et une conséquence fausse collée à une mesure juste se relit comme si
elle avait été mesurée elle aussi. Le runner GitHub existait depuis le premier
jour et n'a jamais été essayé.

**Ce que le processus a permis.** Le dépôt oblige à mesurer avant d'affirmer. Il
n'oblige nulle part à **re-mesurer une conclusion** quand seule la mesure a été
faite.

> **Règle P1.** Une mesure d'impossibilité s'écrit avec **la liste de ce qui n'a
> pas été essayé**. Trois environnements existent — session distante, runner du
> dépôt, machine du propriétaire — et un mur mesuré dans l'un n'est un mur que
> dans celui-là. Avant d'écrire qu'une tâche est bloquée, dire lequel des trois
> a été sondé et lesquels ne l'ont pas été.

### P2 — Onze jours de doublon entre NexusCrypto et le radar

**Ce qui s'est passé.** `nexuscrypto/main.py` portait une sous-commande
`pepites` qui scannait DexScreener — la même source, le même but que le projet
`pepites/`, créé trois jours plus tôt. Retirée le 08/09.

**Pourquoi personne ne l'a vu.** Le §0 bis règle 4 arrête le geste quand on
s'apprête à **écrire** un composant qui en dédouble un autre. Ici, personne
n'écrivait un doublon : deux projets voisins ont grandi chacun de son côté, et
le recouvrement s'est formé sans qu'aucune session ne pose une ligne en double.

**Ce que le processus a permis.** La règle du doublon se déclenche au niveau du
fichier, jamais au niveau du **projet**.

> **Règle P2.** À la création d'un projet, et à chaque commande ajoutée à un
> projet existant, chercher le doublon **par la source de données et par le
> verbe**, pas par le nom : « qui d'autre ici appelle cette API », « qui d'autre
> répond à cette question ». Deux outils qui interrogent le même hôte pour le
> même usage sont un doublon même s'ils ne partagent pas une ligne.

### P3 — Le radar ne peut alerter personne, et c'est le plus grave

**Ce qui s'est passé, mesuré aujourd'hui.** Le seuil d'alerte vaut **70/100**
(`pepites/config/reglages.yaml:261`). La meilleure note finale jamais atteinte
en 29 tours est **60**. Et le workflow ne déclare **aucun secret** : sur le
runner, `TELEGRAM_BOT_TOKEN` est vide et `Messager.envoyer` rend `False` sans
même essayer.

Deux verrous indépendants, chacun suffisant. **Zéro alerte en six jours**, et
aucune n'était possible.

**Pourquoi personne ne l'a vu.** Le rapport écrit « 0 alerté » à chaque tour, à
la même place que « 943 paires » et « 16 candidats ». Un zéro dans une ligne de
comptage se lit comme un fait de marché — *rien ne méritait de déranger* — et
jamais comme un aveu d'incapacité. Il faut aller lire le seuil dans un fichier
de configuration, et l'absence de bloc `env:` dans un workflow, pour que le zéro
change de sens.

**Ce que le processus a permis.** Rien, dans ce dépôt, ne demande à un outil de
prouver qu'il **peut** produire sa sortie principale. On vérifie qu'il ne plante
pas, qu'il rend un entonnoir plausible, et depuis le 03/09 qu'il se note
lui-même. Sa raison d'être — prévenir — n'a jamais été éprouvée une seule fois.

> **Règle P3.** Tout outil dont la raison d'être est de **produire un
> événement** — une alerte, un envoi, une notification, un dépôt — doit avoir
> produit cet événement **au moins une fois pour de vrai** avant d'être déclaré
> en service. Tant que ce n'est pas fait, sa fiche dans `CLAUDE.md` porte la
> mention « n'a jamais alerté » et le compte rendu ne dit pas qu'il tourne, mais
> qu'il observe.
>
> **Corollaire, qui vaut seul :** un compteur à zéro sur la sortie principale
> d'un outil n'est jamais une information tant qu'on n'a pas vérifié que le
> chemin qui mène à un non-zéro est **ouvert de bout en bout** — seuil
> atteignable, secret présent, destinataire joignable.

### P4 — Quatre jours à annoncer une cadence qui n'existait pas

**Ce qui s'est passé.** `CLAUDE.md` disait que le radar tourne « toutes les
trois heures ». Mesuré sur les dix-huit premiers tours : cinq par jour au lieu
de huit, 4 h 41 d'intervalle moyen, des retards de 2 à 150 minutes. Corrigé le
08/09.

**Pourquoi personne ne l'a vu.** L'écriture du cron et l'observation de son
résultat sont séparées de plusieurs jours, et la phrase avait été écrite le jour
de l'ouverture — donc avant qu'un seul tour planifié n'ait eu lieu. Elle
décrivait une **intention**, et rien ne l'a jamais confrontée à sa trace.

> **Règle P4.** Ce qu'on demande à une planification s'écrit au futur ou au
> conditionnel tant que sa trace n'a pas été relue. Une cadence, un délai, un
> quota se réécrivent **après le premier cycle complet**, avec le nombre observé
> à côté du nombre demandé. Un cron « demande » un tour ; il ne l'« obtient »
> qu'une fois mesuré.

### P5 — Le biais du comptage, nommé mais toujours dans le code

**Ce qui s'est passé.** Un jeton n'est jugeable qu'en repassant l'entonnoir six
heures plus tard. Or l'entonnoir écarte par le bas : au tour 18, 37 rejets sous
le plancher de liquidité contre un seul pour « déjà parti ». Un jeton qui
s'effondre en sort et se fige en `indécidable` **sans jamais compter comme une
perte**. Nommé le 08/09 dans
`second-brain/lecons/2026-09-08-un-jeton-qui-seffondre-sort-du-comptage.md`.
**Le code n'a pas bougé** : le taux publié aujourd'hui — 40 % — porte encore ce
biais, et le témoin aussi.

**Pourquoi personne ne l'a vu.** `bilan.py` documente en tête **quatre** refus
de conclure, tous des refus de **taille** d'échantillon. Celui-ci est un défaut
de **composition**. Une liste soignée de garde-fous donne le sentiment que le
sujet est couvert, et c'est ce sentiment qui a tenu lieu de vérification.

> **Règle P5.** Devant un taux calculé sur un sous-ensemble, la question n'est
> pas « combien » mais « **qu'a-t-il fallu réussir pour entrer dans le
> calcul** ». Si la condition d'entrée est la survie de ce qu'on mesure, le
> résultat flatte, et aucun volume ne le corrige. Compter et afficher les
> **exclus** à côté du taux, toujours.

### P6 — Quatre jours sans pouvoir rien pousser depuis ce fil

**Ce qui s'est passé.** Du 04 au 08/09, cette session a perdu GitHub sur les
trois chemins : connecteur non autorisé, `git fetch` refusant l'authentification,
`api.github.com` en 403. Sa copie de travail est restée figée à un commit du
04/09 pendant que `main` prenait 230 commits d'avance.

**Pourquoi ça a duré.** Seul le propriétaire peut réautoriser le connecteur, et
il ne pouvait pas le savoir : la session a continué de répondre normalement.
Rien ne signale de l'extérieur qu'un fil est devenu incapable d'écrire.

> **Règle P6.** Une session qui perd l'écriture le dit **en tête de sa réponse
> suivante**, avec la date de sa copie de travail et le geste exact qui la
> débloque — pas en fin de message parmi les points ouverts. Et elle livre en
> fichier téléchargeable ce qu'elle ne peut pas pousser, pour qu'un autre fil le
> reprenne.

### P7 — Une redirection d'erreur a produit deux affirmations fausses

**Ce qui s'est passé.** `git fetch … 2>/dev/null` a renvoyé un code d'échec
silencieux. J'en ai conclu « retard sur main : 0 », puis annoncé que `main`
n'avait pas bougé et qu'aucune autre session n'avait publié. **Les deux étaient
faux.** Sans la redirection : `could not read Username`, sortie 128.

> **Règle P7.** Ne jamais rediriger `stderr` vers le néant dans une commande
> dont on va **lire le résultat pour en tirer une conclusion**. Un `2>/dev/null`
> transforme un échec en réponse vide, et une réponse vide se lit comme un zéro.
> Vérifier le code de sortie avant d'interpréter la sortie.

### P8 — Deux extrapolations fausses du même compteur, en sens contraires

**Ce qui s'est passé.** Le 07/09 j'ai annoncé le verdict « pour demain matin »,
sur un rythme d'un jugeable par tour. Le 08/09, après avoir mesuré 16 → 17 en
trois tours, j'ai annoncé « un jour et demi à deux jours » sur 0,33 par tour.
La réalité mesurée entre les tours 21 et 29 : **18 → 25, soit 0,9 par tour**.
Trois fois trop rapide, puis presque trois fois trop lent.

**Pourquoi.** Le rythme de ce compteur dépend de la persistance des jetons dans
l'entonnoir, qui dépend du marché. Il n'est pas linéaire, et trois points ne
suffisent pas à le dire.

> **Règle P8.** Une date annoncée à partir d'un compteur qu'on a vu bouger moins
> de cinq fois est une opinion. Donner l'**état** (« 17 sur 20 ») et le **signal
> à surveiller**, jamais la date — ou alors avec la fourchette et le nombre de
> points sur lequel elle repose.

### P9 — « WHX n'existe pas »

**Ce qui s'est passé.** J'ai contredit le propriétaire sur un jeton absent de ses
captures d'écran. Il existait, à la ligne suivante, sous le bord de l'image :
`WHX`, note 63, +10,5 %. Sa liste était juste, la mienne fausse.

**Pourquoi.** J'ai traité l'absence dans une capture tronquée comme une absence
dans les données.

> **Règle P9.** Une capture d'écran est un extrait, jamais un ensemble. Ce qui
> n'y figure pas n'est pas « inexistant » mais « hors cadre ». On ne contredit
> une observation du propriétaire qu'après avoir consulté **la source**, pas
> l'image qu'il en a envoyée.

### P10 — Le changement de direction n'est toujours pas écrit

**Ce qui s'est passé.** Le 07/09, décision explicite : NexusCrypto cesse d'être
l'axe principal et devient un filet de sécurité ; le radar devient l'outil de
gain. Vérifié à l'instant — `grep` sur « filet de sécurité », « axe principal »
dans `CLAUDE.md` : **zéro occurrence**. Trois jours plus tard, le cerveau du
dépôt décrit encore l'ancienne hiérarchie.

**Pourquoi.** La décision a été notée comme une tâche en attente dans la
conversation, et la conversation ne transporte que l'état. Deux séances
l'ont recopiée d'un résumé à l'autre sans que personne l'écrive.

> **Règle P10.** Une décision de direction — ce qui devient principal, ce qui
> devient secondaire, ce qu'on arrête — s'écrit dans `CLAUDE.md` **dans la
> séance où elle est prise**, avant tout travail de code qu'elle motive. Le code
> qui la met en œuvre peut attendre ; la phrase, non. Une session qui commence
> par retirer un doublon sans avoir écrit pourquoi laisse le prochain lecteur
> devant un retrait sans motif.

### P11 — Le verdict est tombé et personne ne l'a lu

Décrit en tête de ce fichier. **Pourquoi personne ne l'a vu :** le bulletin
s'écrit dans le résumé d'un run parmi vingt-neuf, tous verts, tous identiques de
l'extérieur. Rien ne distingue le tour où le compteur franchit son seuil du tour
précédent : ni le titre du run, ni son statut, ni sa durée.

> **Règle P11.** Un outil qui attend un seuil doit **changer de comportement
> visible** quand il le franchit : titre du run, échec volontaire, billet ouvert,
> fichier écrit. Un résultat qui n'apparaît que dans le corps d'un rapport
> identique aux vingt précédents n'est pas publié, il est archivé. Et une session
> qui annonce « on relira quand X sera atteint » pose le moyen de le savoir dans
> la même séance, ou n'annonce rien.

### P12 — Node.js 20

Signalé le 07/09, toujours là au tour 29 : `actions/cache@v4`,
`actions/checkout@v4`, `actions/setup-python@v5`, `actions/upload-artifact@v4`
sont forcées sur Node 24 par GitHub. Rien ne casse aujourd'hui. Classé « pas
prioritaire » par le propriétaire, et `.github/workflows/**` est zone sensible :
il attend son accord. **Ce n'est donc pas une dérive**, c'est une dette datée —
elle figure ici pour ne pas être redécouverte le jour où GitHub coupera.

---

## 3. Les déviations par rapport à la priorité annoncée

Trois, et une seule est franche.

1. **La lecture du verdict.** Annoncée le 07/09 comme la prochaine étape. Le
   seuil est franchi, le verdict est écrit, personne ne l'a ouvert avant
   aujourd'hui. **Déviation nette.**
2. **L'écriture de la nouvelle direction.** Annoncée le 07/09, jamais faite,
   alors que la conséquence *technique* de cette décision — retirer la commande
   doublon — a été exécutée le 08/09. **On a fait le geste et sauté la phrase**,
   ce qui est l'ordre inverse de celui que le dépôt prescrit.
3. **Node.js 20.** Déclassé explicitement par le propriétaire. **Pas une
   déviation**, une dette assumée.

**Ce qui n'est pas une déviation, et mérite d'être dit** : les six PR fusionnées
sur ce chantier entre le 04 et le 08/09 correspondent toutes à une demande
explicite. Le travail n'est pas parti dans une direction que personne n'a
choisie. Ce qui a manqué n'est pas la discipline d'exécution, c'est la
**clôture** : ouvrir ce qu'on avait dit qu'on ouvrirait.

## 4. Ce qui, dans le processus actuel, a permis que ça traîne

Quatre causes, et elles se recoupent.

**a) Le dépôt vérifie qu'une chose est juste, jamais qu'elle sert.** Tous les
garde-fous portent sur l'exactitude : tests verts, cohérence de la
documentation, invariants, agents de relecture. Aucun ne demande « cet outil
a-t-il produit ce pour quoi il existe ». P3 a vécu six jours dans cet angle
mort, P5 y vit encore.

**b) Un zéro ne réveille personne.** Zéro alerte, zéro position, zéro euro : ces
trois-là s'affichent comme des états normaux. Un dépôt qui n'a que du vert et du
rouge n'a pas de couleur pour « ça tourne et ça ne sert à rien ».

**c) La conversation transporte l'état, le dépôt transporte la mémoire — et les
tâches en attente vivent dans la conversation.** P10 en est la démonstration
directe : recopiée trois fois d'un résumé à l'autre, jamais écrite, donc perdue
pour toute autre session.

**d) Rien ne suit un seuil.** P11 n'est pas un oubli d'une personne, c'est
l'absence d'un mécanisme : vingt-neuf runs verts et indiscernables, dont un
seul portait un événement.

## 5. Ce qu'il faut faire maintenant, dans cet ordre

1. **Lire le verdict pour de bon et décider.** Le radar fait −5,7 points de
   médiane contre son témoin. Trois issues : régler les seuils, changer ce
   qu'on mesure, ou constater que l'anomalie de volume ne prédit rien. C'est une
   décision de produit.
2. **Trancher le seuil d'alerte** (P3). Soit on l'abaisse au niveau que les
   notes atteignent réellement, soit on assume que le radar n'alerte pas et on
   le dit dans sa fiche. L'état actuel — un seuil que rien n'atteint — est le
   seul qui ne veut rien dire.
3. **Écrire la direction du 07/09 dans `CLAUDE.md`** (P10). Une phrase.
4. **Afficher les exclus à côté du taux** (P5), sans quoi le verdict du point 1
   se lit sur des chiffres qui penchent.

---

*Couvre `pepites/` et `nexuscrypto/`, du 25/08 au 10/09/2026. Ne couvre pas les
autres projets du dépôt. Les délais sont des durées écoulées mesurées sur les
dates du dépôt et des runs, jamais des heures de travail.*
