# Retour arrière : le traducteur de chat, du 03 au 05/09/2026

Demandé par le propriétaire le 10/09/2026, après cinq jours de chantier qui ont
livré une application en ligne — et lui ont coûté sept messages qui n'auraient
pas dû exister.

**Ce fichier n'est pas un récit.** Il compte, il date, et il finit sur des
règles. Ce qui s'y trouve est mesuré sur l'historique Git quand c'est possible,
et signalé comme venant du fil de discussion quand ça ne l'est pas.

## Les deux unités, et pourquoi pas « le temps perdu »

Le propriétaire a demandé « combien de temps chacun a fait perdre ». La réponse
honnête commence par dire que **je ne sais pas mesurer son temps** : je ne vois
ni quand il ouvre un message, ni combien de fois il rouvre un fil sur un
téléphone. Inventer des minutes donnerait un tableau d'apparence rigoureuse et
faux de bout en bout.

Deux grandeurs se mesurent vraiment, et elles disent l'essentiel :

- **La latence** — de l'instant où le défaut entre dans le dépôt à l'instant où
  il en sort, lue sur les horodatages des commits. C'est le temps pendant lequel
  une chose fausse était traitée comme vraie.
- **Les allers-retours** — le nombre de messages que le propriétaire a dû
  écrire et qui n'existaient que parce que j'avais eu tort, ou m'étais mal
  expliqué. C'est ce qui lui coûte réellement, depuis un téléphone.

Sept allers-retours sur ce chantier. C'est le chiffre qui compte.

## Chronologie

### 1. La mesure ne descendait pas dans les sous-dossiers

| | |
| --- | --- |
| **Introduit** | 03/09 00:55 — `mesurer_corpus.py`, à sa naissance |
| **Corrigé** | 04/09 20:41 (`3f8012b`) |
| **Latence** | 44 h, dont **23 minutes** de nuisance réelle |
| **Allers-retours** | 0 |

`iterdir` au lieu de `rglob`. Un dossier de corpus parfaitement rempli rendait
« aucun son », parce que le corpus étiqueté range ses fichiers **par intention,
en sous-dossiers**, là où ESC-50 est plat.

**Pourquoi pas plus tôt :** le défaut n'existait pas au moment où le code a été
écrit. Il est né 44 heures plus tard, quand la forme du corpus a changé. C'est
le cas le plus fréquent de ce chantier et le plus mal couvert : **un outil juste
devient faux sans être modifié.**

### 2. La mesure du corpus ne mesurait que la porte — facteur dix

| | |
| --- | --- |
| **Introduit** | 03/09 00:55, même commit |
| **Corrigé** | 05/09 03:23 (`b469ad5`) |
| **Latence** | **50 h 28** |
| **Allers-retours** | 0 — et c'est le problème |

`mesurer_corpus.py` faisait tourner l'étage de veto et **jamais la tête
acoustique**. Sur quarante vrais chats il rendait donc `indecis` presque
partout. J'ai rapporté au propriétaire que **37 chats sur 40 verraient « je n'ai
pas compris »**, et j'ai ajouté que ça devait peser sur sa décision de
déploiement.

Le vrai chiffre est **31 sur 40 nommés**. Je me suis trompé d'un facteur dix,
sur le seul nombre qui décrivait la qualité du produit, et je le lui ai donné
comme une raison de renoncer.

**Pourquoi pas plus tôt :** parce que le résultat faux était **plausible**. « Un
produit jeune comprend peu » ne surprend personne, donc personne ne vérifie. Un
résultat aberrant se fait attraper en une seconde ; un résultat décevant se fait
croire.

Et parce que rien ne comparait l'outil de mesure au produit. Deux chemins
existaient — celui du banc et celui de l'application — et **aucun test ne les
obligeait à rendre le même verdict sur le même fichier.**

### 3. ffmpeg absent du PATH pour yt-dlp

| | |
| --- | --- |
| **Introduit** | 04/09 20:18 (`a5aedbb`), avec le script de téléchargement |
| **Corrigé** | 04/09 21:07 (`4d83f36`) |
| **Latence** | 49 minutes |
| **Allers-retours** | 0 |

`imageio-ffmpeg` pose un vrai ffmpeg 7.0.2 dans son dossier de paquet et
**jamais sur le PATH**. Les 28 téléchargements auraient été refusés sur une
machine parfaitement équipée.

**Pourquoi pas plus tôt :** le script a été écrit contre une commande supposée,
pas contre la machine réelle. `/api-tierce-verifiee` dit exactement de ne pas
faire ça, pour les bibliothèques ; personne n'avait écrit que ça vaut aussi pour
**un binaire qu'on croit installé**.

### 4. Trois consignes inexécutables d'affilée

| | |
| --- | --- |
| **Quand** | 04/09, après la livraison de la liste des 28 |
| **Allers-retours** | **3** — « je fais quoi et où », « je ne comprends pas ce que je dois télécharger », « il faut que j'écoute quelle vidéo en priorité, je ne peux pas toutes les regarder » |

Trois messages du propriétaire, chacun disant la même chose sous un angle
différent : ce que je lui demandais de faire n'était pas faisable en l'état.

**Pourquoi pas plus tôt :** j'ai livré une **liste** là où il fallait un
**geste**. Vingt-huit vidéos, aucune priorité, aucune commande à copier. Le §0
de `CLAUDE.md` dit déjà qu'un fichier se livre et ne se décrit pas ; il ne dit
nulle part qu'une **consigne** obéit à la même règle.

### 5. Dérive de périmètre vers `le-coffre/`

| | |
| --- | --- |
| **Quand** | 05/09, après « go pour la 710 » |
| **Allers-retours** | **1** — « Mais on est sur la session traducteur d'animaux là. » |

« Go pour la 710 » voulait dire : fusionne cette PR. J'en ai tiré l'autorisation
d'arbitrer le cadre de test d'un autre projet.

**Pourquoi pas plus tôt :** le §0 bis fixe le sens de « go » — *feu vert sur ce
qui a été proposé* — et j'ai lu ce mot-là comme une ouverture générale. La règle
existait, elle n'a pas mordu.

### 6. Un compte annoncé de mémoire

| | |
| --- | --- |
| **Quand** | 05/09 |
| **Allers-retours** | **1** — « De quoi tu parles des six demandes. » |

J'ai écrit « six » là où il y en avait sept, deux fois, sans recompter.

**Pourquoi pas plus tôt :** `/etat-du-depot` existe précisément pour ça et
s'applique aux chiffres sur le dépôt. Un compte **à l'intérieur d'une
discussion** n'était couvert par rien.

### 7. Une trouvaille sur le ronronnement, sur-dramatisée

| | |
| --- | --- |
| **Quand** | 05/09 |
| **Allers-retours** | 0 — il a corrigé sans avoir à revenir |

J'ai qualifié de « défaut sérieux, plus grave à laisser » le fait que la carte
lise un ronronnement en contentement. Le propriétaire a rappelé que le domaine
n'est pas une science établie. Il avait raison : la réparation juste était un
mot, pas une alarme.

**Pourquoi pas plus tôt :** rien dans le dépôt ne borne **le registre d'une
alerte**. Un défaut réel décrit trop fort fait dépenser une décision qui ne
valait qu'une phrase.

### 8. Le test « à zéro euro » qui coûtait son domicile

| | |
| --- | --- |
| **Écrit** | 05/09 13:07 (`ff7dd2d`), fusionné en #732 |
| **Refusé** | 05/09, dans l'heure |
| **Corrigé** | 05/09 13:32 (`d6db62e`) |
| **Allers-retours** | **1** — « Non, je ne publie pas de vidéo de moi avec mon chat comme ça. En plus, c'est le bordel. » |

Tout un livrable — la vidéo, le mixage, la légende, le fichier de test avec son
hypothèse — construit autour d'un geste qu'il n'allait pas faire. Le plan
demandait de montrer son intérieur et son animal à quarante-huit mille
personnes, et je l'avais chiffré à **zéro**.

**Pourquoi pas plus tôt :** j'ai compté ce qui se facture. Le coût réel était
d'une autre nature, et **il ne devient visible que si on décrit le geste demandé
au lieu de le nommer.** « Publier une vidéo » se lit comme gratuit ; « te filmer
chez toi et le montrer à 48 000 personnes » se lit pour ce que c'est.

### 9. Les étiquettes du modèle oubliées du dossier déposé

| | |
| --- | --- |
| **Introduit** | 05/09 13:47, premier jet de `assembler.mjs` |
| **Corrigé** | même heure, avant toute poussée |
| **Latence** | quelques minutes |
| **Allers-retours** | 0 |

`donnees/etiquettes.json` porte les 521 classes et se charge par `fetch`, **pas
par une balise** : invisible quand on lit `index.html` pour lister ce qu'il faut
copier. Sans lui, la page se charge, le bouton répond, et le premier son reste
sans verdict **pour toujours, sans une seule erreur**.

**Pourquoi pas plus tôt :** aucun test ne pouvait le voir. Le serveur d'épreuve
existant **reconstitue** les chemins depuis `node_modules` : il est plus capable
qu'un hébergeur. C'est l'épreuve écrite ce jour-là — servir le dossier à plat et
compter les 404 — qui l'a sorti au premier passage.

C'est le seul de la liste attrapé par un garde-fou construit **avant** la
livraison, et pas après une plainte.

### 10. L'écran d'accueil vide

| | |
| --- | --- |
| **Introduit** | 04/09 18:41 (`edad1b1`), avec la page elle-même |
| **Signalé** | 05/09 17:49 heure locale, par capture d'écran |
| **Corrigé** | 05/09 15:55 UTC (`789fedc`) |
| **Latence** | **21 heures**, corrigé en moins d'une heure une fois vu |
| **Allers-retours** | **1** — « je pensais qu'on verrait chaque miaulement expliqué […] ça fait vide » |

Un titre, deux boutons, « Prêt. », et six cents pixels de noir. La page ne disait
ni ce que l'outil cherche, ni ce qu'il s'autorise à dire.

**Pourquoi pas plus tôt :** **toutes les mesures étaient vertes.** L'épreuve
conduisait un vrai Chromium à la taille exacte de son téléphone, comparait 521
scores au bit près, vérifiait que le bouton d'enregistrement tenait dans le
premier écran. Aucune ne pouvait dire que l'écran ne promettait rien — parce
qu'aucune ne **regardait**.

Le §8 dit « regardé, pas seulement mesuré » depuis le 29/08. La règle était là.
Ce qui manquait, c'est le moment où elle se déclenche.

### 11. La carte illisible en vignette

| | |
| --- | --- |
| **Introduit** | 05/09, en posant les tiroirs |
| **Corrigé** | 05/09, dans la même heure |
| **Latence** | minutes |
| **Allers-retours** | 0 |

La carte fait 1080 × 1920 avec son texte entre 12 et 45 % de hauteur, le reste
étant le vide réservé à la vidéo. Réduite à la largeur d'un téléphone : titre
sous huit pixels, au-dessus d'une grande zone morte.

**Pourquoi pas plus tôt :** il n'y avait pas de « plus tôt ». Ce défaut est
sorti d'une capture d'écran regardée **avant** de livrer, ce qui est exactement
le geste que le §8 réclame. Il figure ici comme le contre-exemple des dix
autres : le regard a coûté une capture et a évité un aller-retour.

### 12. La mauvaise adresse donnée pour aller voir

| | |
| --- | --- |
| **Quand** | 05/09, juste après la poussée des tiroirs |
| **Corrigé** | par moi, au message suivant |
| **Allers-retours** | 0, de justesse |

J'ai écrit « rafraîchis dans deux minutes » en donnant l'adresse de production.
Une poussée sur une branche produit un **aperçu** ; la production ne bouge qu'à
la fusion. Il aurait ouvert la page et retrouvé exactement l'écran vide qu'il
venait de signaler.

**Pourquoi pas plus tôt :** j'ai annoncé une adresse sans la **demander**. Le
connecteur Vercel sait la lire en une seconde, et c'est ce qui a rattrapé le
coup au message suivant. `CLAUDE.md` porte déjà la phrase exacte — « la seule
mesure d'une adresse est une requête dessus » — dans le paragraphe sur
`amorce-51up`, où personne ne va la chercher au moment de donner un lien.

### 13. Le mur d'authentification, quatrième fois

| | |
| --- | --- |
| **Quand** | 05/09, à la création du projet Vercel |
| **Corrigé** | avant toute annonce |
| **Allers-retours** | 0 |

Un projet Vercel neuf naît avec `ssoProtection: all_except_custom_domains` :
l'application était en ligne et invisible à tout autre que lui.

**Pourquoi pas plus tôt :** il n'y a pas de « pas plus tôt » ici non plus. Le
dépôt avait déjà payé ce piège trois fois et l'avait écrit ; la règle a mordu au
bon moment. C'est le second contre-exemple, et il dit ce qui distingue une règle
qui sert d'une règle qui dort : **elle nomme le geste** (« lire *Deployment
Protection* »), pas seulement le danger.

## Les déviations par rapport à la priorité annoncée

### La consigne qui n'a jamais été refermée

Le propriétaire a écrit, le 04/09 :

> Avant de dépenser plus de crédits sur une catégorie, je veux d'abord écouter
> le lot de vingt-huit une fois téléchargé en local, pour vérifier que
> l'étiquetage et la qualité tiennent la route. On rediscute des crédits
> restants une fois ce contrôle fait.

Une porte, avec sa condition de sortie. **Elle n'a jamais été franchie.** Trois
vidéos sur vingt-huit ont été écoutées ; le corpus étiqueté n'a jamais été
téléchargé en entier ni mesuré. `CORPUS.md` l'écrit noir sur blanc depuis le
04/09 : « Le propriétaire a tranché l'ordre : écouter les vingt-huit d'abord ».

Ce qui s'est passé à la place, dans l'ordre : la vidéo de son chat, le mixage,
le plan commercial, le test à zéro euro, le déploiement, les tiroirs. Six lots,
tous utiles, **aucun sur le chemin qu'il avait désigné.**

Conséquence concrète, et elle n'est pas cosmétique : **la tête acoustique n'a
toujours aucune vérité de terrain.** Ses deux frontières — 400 Hz et 0,7 s —
restent des hypothèses de vulgarisation, et c'est pour ça que sa confiance est
plafonnée à 0,5. Le corpus qui les trancherait est identifié depuis six jours et
n'a pas été écouté.

### La dérive de « go »

Décrite au point 5. Un mot qui refermait un menu a été lu comme une ouverture.

### Ce qui n'est pas une déviation

Le déploiement et les tiroirs ont été **demandés explicitement**, l'un par
« go », l'autre par « ça fait vide ». Les compter comme des dérives serait
malhonnête : ce sont des changements de cap du propriétaire, pas de moi.

## Ce qui, dans le processus, a permis que ça traîne

Quatre causes, et elles ne sont pas de même nature.

**1. Le vert est traité comme une preuve de qualité.** Il ne prouve qu'une
chose : ce qui a été mesuré rend ce qu'on attendait. Les points 2 et 10 sont les
deux faces du même défaut — un banc qui mesure le mauvais étage, une épreuve qui
ne regarde pas l'écran. Dans les deux cas **aucun test n'était rouge**, et dans
les deux cas le produit était faux.

**2. Un outil de mesure vieillit sans qu'on le touche.** Point 1 et point 2. Ni
l'un ni l'autre n'était faux à l'écriture. Le corpus a changé de forme, puis de
nature, et l'outil est resté. Rien dans le dépôt ne déclenche une relecture d'un
outil de mesure quand **ce qu'il mesure** change.

**3. Un résultat plausible n'est jamais vérifié.** C'est la cause la plus chère
du lot — 50 heures sur le point 2. Un nombre aberrant se fait attraper ; un
nombre décevant se fait croire, surtout quand il flatte la prudence.

**4. Les règles existent et ne se déclenchent pas.** C'est la découverte de ce
retour arrière, et elle change ce qu'il faut en faire. Sur les treize points,
**cinq étaient déjà couverts par une phrase de `CLAUDE.md`** — « regardé, pas
seulement mesuré », le sens de « go », « la seule mesure d'une adresse est une
requête dessus », `/api-tierce-verifiee`, `/etat-du-depot`. Elles n'ont pas
mordu parce qu'elles sont écrites comme des **principes** et lues au démarrage,
alors que le défaut arrive au milieu d'un lot, deux heures plus tard.

Les deux points où une règle **a** mordu — le mur d'authentification, l'épreuve
du dossier à plat — ont ceci en commun : elles nomment **un geste attaché à un
moment** (« à la création d'un projet Vercel, lire *Deployment Protection* » ;
« avant de déposer, servir à plat et compter les 404 »). Pas une vertu, une
commande et son déclencheur.

**Ajouter treize principes à `CLAUDE.md` ne réparerait rien.** Le fichier fait
déjà deux mille lignes ; le dix-neuvième paragraphe sur la vérification se lit
comme les dix-huit autres. Les règles ci-dessous sont donc écrites en gestes,
avec leur moment de déclenchement, et plusieurs remplacent une phrase existante
au lieu de s'ajouter à côté.

## Les règles à ajouter à `CLAUDE.md`

Treize points, **neuf règles** : quatre défauts partagent une cause avec un
autre, et les fusionner vaut mieux que les répéter. Chacune est proposée avec sa
section d'accueil.

### R1 — Un outil de mesure se rejoue contre le produit *(§8, points 1 et 2)*

> **Un banc de mesure et le produit doivent rendre le même verdict sur le même
> fichier, et un test doit l'exiger.** Tout script qui produit un chiffre sur la
> qualité d'un produit passe par la même couture que le produit, ou un test
> compare les deux sorties. Sans ça, les deux chemins divergent en silence et
> c'est le banc qu'on croit.

C'est la règle la plus rentable du lot : elle attrapait à elle seule le facteur
dix, en 2 heures au lieu de 50.

### R2 — Un corpus qui change de forme périme son outil *(§8, point 1)*

> **Quand ce qu'un outil mesure change de nature — un corpus qui gagne des
> sous-dossiers, des étiquettes, une source —, l'outil se relit avant d'être
> relancé.** Il n'était pas faux à l'écriture : c'est précisément pour ça que
> personne ne le soupçonne.

### R3 — Un résultat plausible se vérifie deux fois *(§8, point 2)*

> **Un chiffre décevant se vérifie plus qu'un chiffre aberrant.** Un résultat
> absurde s'attrape tout seul ; un résultat qui confirme ce qu'on craignait
> passe sans contrôle. Avant d'annoncer une mesure qui *justifie de renoncer*,
> la refaire par un autre chemin.

### R4 — Une consigne se livre en geste, comme un fichier *(§0, point 4)*

> **Le §0 dit qu'un fichier se livre et ne se décrit pas. Une consigne obéit à
> la même règle.** Ce qu'on demande au propriétaire se donne en un geste
> nommé — la commande exacte, le premier élément à traiter, le critère d'arrêt.
> Une liste de vingt-huit éléments sans priorité n'est pas une consigne, c'est
> un inventaire, et il coûtera trois allers-retours depuis un téléphone.

### R5 — Un geste demandé se décrit avant d'être chiffré *(§6, point 8)*

> **« Ça ne coûte rien » ne vaut que pour l'argent.** Avant de chiffrer une
> tâche à zéro, écrire en toutes lettres ce qu'elle demande au propriétaire de
> *faire* — pas de décider. « Publier une vidéo » se lit comme gratuit ; « te
> filmer chez toi et le montrer à 48 000 personnes » se lit pour ce que c'est.
> Un prix qui ne se chiffre pas reste un prix.

### R6 — Un binaire supposé se sonde comme une API *(§7, point 3)*

> **`/api-tierce-verifiee` vaut aussi pour les exécutables.** Avant d'écrire une
> commande qui appelle un binaire, vérifier qu'il répond *à ce nom-là* :
> plusieurs paquets Python en posent un dans leur dossier et jamais sur le PATH
> (`imageio-ffmpeg`). Le code doit savoir le désigner et se replier.

### R7 — Un compte s'écrit après avoir été recompté *(§8, point 6)*

> **Aucun nombre ne s'écrit de mémoire, y compris à l'intérieur d'une
> discussion.** `/etat-du-depot` couvre les chiffres sur le dépôt ; la règle
> vaut pour tout compte qu'on répète — le nombre d'intentions, de vidéos, de
> cas. Recompter coûte une commande ; un compte faux répété deux fois coûte un
> aller-retour et de la confiance.

### R8 — Une alerte se règle sur ce qu'elle fait dépenser *(§1, point 7)*

> **Le registre d'une trouvaille se choisit sur la décision qu'elle appelle.**
> Un défaut qui se répare par un mot s'annonce comme un mot. Le décrire en
> « défaut sérieux » fait dépenser un arbitrage de produit là où une phrase
> suffisait — et sur un sujet que la science ne tranche pas, ça fait porter au
> propriétaire une gravité qui n'existe pas.

### R9 — Une adresse s'ouvre avant d'être donnée, et un aperçu n'est pas la production *(§10 Vercel, points 12 et 13)*

> **Aucune adresse ne se donne sans avoir été demandée dans la même minute**, et
> le connecteur Vercel sait le faire malgré le mandataire. Deux pièges y sont
> attachés, et chacun a déjà coûté :
> une poussée sur une branche produit un **aperçu** — l'adresse de production ne
> bouge qu'à la fusion, et pointer l'une pour l'autre renvoie le propriétaire
> sur l'écran qu'il vient de signaler ; et un projet neuf naît avec
> `ssoProtection: all_except_custom_domains`, donc en ligne et invisible à tout
> autre que lui. **Lire le réglage, jamais l'affichage.**

## La règle qui les rend applicables

Les neuf ci-dessus ne serviront à rien si elles se lisent comme les deux mille
lignes qui les précèdent. La cause 4 le dit : ce qui a mordu, ce sont les règles
qui nomment un geste attaché à un moment.

> **Toute règle de vérification s'écrit avec son déclencheur et sa commande.**
> Pas « il faut regarder » mais « avant d'annoncer un écran, en tirer une
> capture à 393 × 873 et la regarder ». Une règle sans moment ne se déclenche
> jamais ; une règle sans commande se contourne par bonne foi. Une règle
> existante qui n'a pas mordu se **réécrit** sous cette forme, elle ne se double
> pas d'une seconde.

## Ce que ce retour arrière ne dit pas

- **Le temps du propriétaire.** Aucune des durées ci-dessus ne le mesure. Les
  sept allers-retours sont ce qui s'en approche le mieux.
- **Les défauts encore là.** Un retour arrière ne trouve que ce qui est sorti.
  Le plus probable est du même genre que le point 2 : une mesure verte sur le
  mauvais objet, qui attend son corpus pour se révéler.
- **Si le produit est juste.** Rien dans ces cinq jours n'a comparé un verdict à
  ce que le chat voulait vraiment dire. C'est exactement ce que le contrôle des
  vingt-huit devait commencer à établir, et il n'a pas eu lieu.
