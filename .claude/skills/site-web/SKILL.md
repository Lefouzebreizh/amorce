---
name: site-web
description: Construire un site vitrine d'une seule page pour un client — thérapeute, coach, commerce, association, indépendant, profession libérale — de la structure au fichier livrable. **Si le client est un artisan, c'est `web-artisan` qui prime**, pas celle-ci : elle porte le gabarit réel, la table des métiers et ses tests ; celle-ci porte la méthode générale, pour les activités qui n'y figurent pas. Dit les cinq blocs qui tiennent debout sur un téléphone, comment choisir la teinte et le ton d'après l'activité **sans inventer une couleur qui échoue au contraste**, comment rendre le téléphone et le courriel réellement cliquables, quand livrer un seul fichier HTML autonome plutôt qu'un projet, et les pièges déjà payés — le mur d'authentification qui rend une page invisible, la promesse « pas en ligne » qui devient fausse dès qu'on héberge, les conflits Git quand deux sessions écrivent le même jour. À utiliser dès qu'une demande dit « fais un site à X », « une page vitrine », « un site simple pour mon client », « une landing », « il me faut un site pour ma boîte », « une page de présentation », « un mini-site » — et aussi quand elle décrit seulement le client sans prononcer le mot site. Ici on **construit** ; pour mesurer ensuite si la page vend, c'est `page-qui-vend`, et si elle s'utilise au pouce, `epreuve-du-pouce`. Les trois s'enchaînent dans cet ordre.
---

# D'où vient ce qui est écrit ici, et ce qu'elle ne refait pas

**`/web-artisan` existe, et cette compétence se pose au-dessus d'elle.** Le
premier jet de ce fichier affirmait le contraire — « il n'existe pas, vérifié le
03/09/2026 » — et c'était vrai à la seconde où le `grep` a tourné : la
compétence a été fusionnée sur `main` à **07:25 le même matin**, par une session
parallèle, pendant que celle-ci l'écrivait. La leçon vaut plus que la
correction, et c'est le §10 bis de `CLAUDE.md` mot pour mot : dans ce dépôt,
`main` a bougé depuis la dernière lecture, et c'est le cas normal. **Une absence
constatée est datée à la minute, pas acquise.**

Le partage est donc celui-ci, et il tient en une phrase : **`/web-artisan` est
la spécialisation, celle-ci est la méthode.**

| | `/web-artisan` | `/site-web` |
| --- | --- | --- |
| pour qui | un artisan, 300 €, livré en 48 h | n'importe quel client — thérapeute, coach, commerce, association, indépendant |
| la teinte | une table fermée, du métier vers l'accent | la **mesure** qui a produit cette table, appliquée à une activité qui n'y figure pas |
| le détail | le gabarit réel, ses tests, ses valeurs | l'ordre des décisions, et ce qui change d'un client à l'autre |

Ce qui est écrit là-bas n'est **pas recopié ici** : la table des cinq métiers,
le piège `wa.me/0`, le filet de 3 px, les emplacements photo en base64, le mur
Vercel. Deux fichiers qui disent la même chose se contredisent au premier
changement, et c'est le moins bon qui est lu une fois sur deux (§0 bis, règle 4).
Quand le client est un artisan, `/web-artisan` prime et celle-ci ne sert à rien.

Les trois sources d'origine restent les mêmes, et elles valent pour les deux :

| Où | Ce qu'on y apprend |
| --- | --- |
| `artisan-express/public/exemple.html` | la page autonome livrable — 13 796 octets, un seul `<style>`, **zéro feuille externe** |
| `titan-builder/src/lib/charte.ts` | les surfaces, la palette fermée, et ce qui fait la patte |
| `artisan-express/src/components/` | le découpage réel en blocs : `Hero`, `Offre`, `CeQueTuAs`, `AvantApres`, `FormulaireDevis`, `BarreAction` |

# La structure : cinq blocs, et le téléphone décide

Un site vitrine d'une page tient en cinq blocs. Aucun n'est décoratif, et
l'ordre compte parce qu'il suit la question que se pose le visiteur.

1. **L'entête** — qui vous êtes, ce que vous faites, où. Et **l'appel à l'action
   dans le premier écran**, pas plus bas. Un visiteur qui doit défiler pour
   trouver comment vous joindre est un visiteur qui repart.
2. **La présentation** — ce que vous proposez, en trois à cinq points. Pas un
   paragraphe : une liste que l'œil parcourt en deux secondes.
3. **La preuve** — avis, réalisations, avant/après, années d'expérience,
   certifications. Ce qui rend crédible sans se vanter.
4. **Le rappel d'action** — le même appel qu'en haut, une fois que la personne
   est convaincue. Elle ne remontera pas.
5. **Le pied** — coordonnées complètes, horaires, zone d'intervention, mentions.

**Ce qui n'est pas réglé disparaît de la page.** Règle d'`artisan-express`, et
elle vaut partout : pas de téléphone confirmé, pas de bloc téléphone. Un numéro
inventé ou un « à compléter » sur le site d'un client coûte plus qu'une section
manquante.

**Mobile d'abord n'est pas une intention, c'est un ordre d'écriture.** On écrit
la colonne unique, puis on élargit — jamais l'inverse. Le terrain de référence
du dépôt est le Redmi Note 12 Plus à 393 × 873, et le §2 de `CLAUDE.md`
s'applique d'office : 18 px minimum, cibles ≥ 44 px, `100dvh` et non `100vh`.

# La couleur : ce qui se choisit, et ce qui se mesure

**La teinte suit l'activité. La contrainte, elle, ne se négocie pas.**

Deux règles, et la seconde est celle qu'on oublie :

- **≥ 7:1 sur la surface la plus claire du site**, pas sur le fond. C'est le
  pire cas, celui qui décide. Le §2 bis de `CLAUDE.md` porte le plancher et la
  raison : ces pages se lisent dehors, sur un téléphone, à une main.
- **Assez loin de l'ambre d'avertissement et du rouge de danger** pour qu'aucun
  des trois ne prenne le sens d'un autre.

**Pourquoi une teinte se mesure au lieu de se dériver.** La démonstration
complète est dans `/web-artisan` — l'orange à 4,6:1, la barre prise sur le fond
au lieu de la surface la plus claire, et deux teintes devenues indiscernables à
force d'être éclaircies ensemble. Elle n'est pas recopiée ici. Ce qu'il faut en
retenir tient en une ligne : **remonter automatiquement une teinte jusqu'à 7:1
la déplace**, parfois jusqu'à ramener celle qu'on venait d'écarter. Une palette
de produit est donc **choisie**, pas calculée — et c'est pourquoi la table des
cinq métiers de là-bas est une commodité, pas la règle.

Ce que ça donne comme méthode, pour n'importe quel client :

1. Partir de l'activité pour l'**angle de teinte** — froid pour ce qui rassure
   et technique, chaud pour ce qui accueille, sourd pour ce qui est haut de
   gamme.
2. Calculer le contraste **contre la surface la plus claire du site**, avant
   d'écrire la moindre classe. Trois lignes de calcul.
3. Si ça ne passe pas, **monter la clarté sans changer l'angle**. Si deux
   teintes se rapprochent au point de se confondre, **réécarter les angles**
   avant de remonter — sinon la garde de contraste se satisfait de cinq nuances
   identiques.

Quatre teintes du dépôt sont déjà mesurées et passent : lavande `#c0abff`
(7,4:1), sauge `#7fd68a` (8,3:1), corail `#ff9c7a` (7,2:1), citron `#d9e34a`
(10,6:1). Les reprendre coûte zéro mesure.

**Et la couleur n'est pas ce qui fait reconnaître un site.** C'est la leçon la
plus contre-intuitive de `charte.ts` : ce qui se reconnaît d'un site à l'autre,
ce sont les **formes** — filet vertical sous chaque titre, entête en halo plutôt
qu'en aplat, prestations en liste fléchée, un bouton plein contre un bouton
contour, signature en pied. La teinte ne dit que le métier. Un même gabarit en
cinq couleurs reste reconnaissable ; cinq gabarits d'une même couleur ne le sont
pas.

# Le ton : il se règle sur le client, jamais sur soi

Le ton n'est pas une préférence d'écriture, c'est une lecture du métier. Trois
questions suffisent à le fixer :

- **Qui paie, et dans quel état ?** Une fuite d'eau à 22 h et un projet de
  cuisine dans six mois ne se parlent pas pareil. L'urgence appelle des phrases
  courtes et un numéro ; le projet appelle des exemples et du temps.
- **Ce client vend-il un prix ou une tranquillité ?** Un prix se dit en chiffres
  et se compare. Une tranquillité se dit en preuves — délai tenu, assurance,
  années.
- **Qu'est-ce qui le décrédibiliserait ?** Un thérapeute avec un compte à
  rebours, un artisan avec du jargon, une association avec du vocabulaire de
  start-up. Ce qui blesse la crédibilité varie plus que ce qui la construit.

Et le §1 de `CLAUDE.md` borne tout : **zéro procédé qui manipule**, zéro fausse
urgence, zéro faux témoignage. Ce ne sont pas des scrupules, c'est ce qui
distingue une page qu'on recommande d'une page qu'on subit.

# Les contacts : cliquables, ou ils n'existent pas

Un numéro écrit en texte sur un téléphone est un numéro qu'on ne compose pas.

```html
<a href="tel:+33297000000">02 97 00 00 00</a>
<a href="mailto:contact@exemple.fr">contact@exemple.fr</a>
<a href="https://wa.me/33297000000?text=Bonjour%2C%20je%20vous%20contacte%20depuis%20votre%20site.">WhatsApp</a>
```

Trois points que la page d'exemple montre et qui ne s'inventent pas :

- **Le format international dans le `href`, le format lisible dans le texte.**
  `tel:+33297000000` compose, `tel:02 97 00 00 00` échoue sur certains
  appareils. Ce que l'utilisateur lit et ce que le lien porte sont deux choses.
- **WhatsApp veut le numéro sans `+` ni espaces**, et son `text=` doit être
  encodé — un espace non encodé casse le message pré-rempli sans rien signaler.
  Le piège précis, `wa.me/0…`, et le test qui le refuse sont dans
  `/web-artisan` : c'est un bouton mort qui a l'air de marcher.
- **`exemple.html` ne porte aucun `mailto:`**, et c'est délibéré : il propose
  `tel:` et WhatsApp. Sur un métier d'urgence, un courriel est une voie morte.
  Le canal se choisit par activité, comme la couleur.

# Le fichier autonome : quand, et ce qu'il coûte

`artisan-express/public/exemple.html` fait **13 796 octets**, porte **un seul
bloc `<style>`**, et ne charge **aucune feuille externe**. C'est un fichier
qu'on envoie par courriel, qu'on ouvre sans serveur, et qui s'affiche identique
partout.

**Quand c'est le bon format** : une démonstration à envoyer, une page nominative
pour un prospect, un livrable que le client doit pouvoir héberger n'importe où,
un site qui ne bougera pas.

**Quand ça ne l'est pas** : dès qu'il faut un formulaire qui envoie vraiment, une
base, plusieurs pages, ou une mise à jour régulière. Là, un projet.

**Ce que l'autonomie coûte, et il faut le savoir avant** : aucune police
distante, aucune bibliothèque, aucune image liée. Les polices tombent sur la
pile système, et les images doivent être **encodées en `data:` dans le fichier**
ou pesées avec soin. Une police Google ajoutée « juste pour le titre » annule
l'autonomie et fait attendre la page sur un réseau lent.

Le rappel qui vient du réseau d'annuaires : **un CDN injoignable ne dégrade pas
une page, il la détruit**. Mesuré dans un vrai navigateur — sans le script
distant, aucune classe utilitaire n'était appliquée : pas de grille, pas de
cartes, une loupe de six cents pixels de haut. Ce qui est embarqué ne peut pas
manquer.

# Les images

- **Une image qui ne sert pas la décision alourdit la page.** Une photo de
  chantier réelle vaut dix banques d'images.
- **Un format moderne et une taille réelle** : ne jamais servir un 4000 px pour
  un affichage de 400.
- **`alt` toujours rempli**, en décrivant ce que l'image montre — pas « photo ».
- **En fichier autonome, l'image s'encode** ou n'existe pas. Une image en
  `data:` gonfle vite : au-delà de quelques dizaines de kilo-octets, la question
  est de savoir si elle mérite d'être là.

# Les pièges, tous payés au moins une fois

**Le mur d'authentification, trois fois sur trois projets.** Un projet Vercel
neuf naît avec `ssoProtection: all_except_custom_domains` : **toutes** les
adresses en `.vercel.app` passent derrière l'authentification du compte, et
**ça ne se voit pas en ouvrant l'adresse**, puisque le navigateur du
propriétaire est connecté. Le contrôle qui vaut n'est jamais « j'ouvre le lien,
ça marche » — c'est la **lecture du réglage**. Le déroulé et le dossier `public/`
oublié au premier dépôt sont dans `/web-artisan`.

**Une page qui promet « elle n'est en ligne nulle part » devient fausse dès
qu'on l'héberge.** La mention était vraie d'un fichier envoyé en conversation.
Hébergée, la même phrase ment au prospect. Une page nominative en ligne doit
dire le vrai : adresse donnée à lui seul, `noindex`, et **retrait sur un mot** —
mettre le nom et le numéro de quelqu'un en ligne sans le lui avoir demandé
oblige à pouvoir le défaire.

**Les coordonnées d'un tiers ne se committent pas.** Nom, téléphone, métier
d'une entreprise réelle restent hors de Git. Un dépôt de fichiers envoie ce qui
est sur le disque, pas ce qui est commité : rien n'oblige à les versionner.

**Deux sessions, un même fichier, le même jour.** Ce dépôt reçoit plusieurs
sessions en parallèle, et une charte qui vit dans deux projets se désaccorde au
premier changement. Trois gestes, dans cet ordre :

1. **`git fetch` avant d'écrire**, jamais après. `main` a bougé : c'est le cas
   normal, pas l'exception.
2. **Fusionner, jamais rebaser** la branche d'une autre session, et **garder ses
   phrases** en ajoutant les siennes à côté.
3. **Relire ce que la fusion a produit.** Git peut coudre deux textes sans
   marqueur de conflit et rendre un document qui se contredit — mesuré le
   03/09/2026 sur `CLAUDE.md`, où un paragraphe orphelin et une règle inversée
   sont passés sans qu'aucun outil ne bronche. Une fusion propre n'est pas un
   texte cohérent.

Le cas concret : la charte d'`artisan-express` vit dans **deux projets npm
distincts**, qui ne peuvent pas s'importer. `artisan-express/tests/charte.test.ts`
relit donc le fichier voisin **en texte** et refuse qu'ils s'écartent. Quand une
valeur doit exister à deux endroits, c'est un test qui les tient — pas la
vigilance.

# Ce que cette compétence ne fait pas

Elle **construit**. Elle ne juge pas.

- La page vend-elle ? → `/page-qui-vend`, qui conduit un vrai navigateur et rend
  six contrôles bloquants. Attention : son contrôle « le prix est dit avant le
  premier bouton » n'a de sens que sur une page qui affiche un prix — sur un site
  d'artisan, c'est une observation, pas un défaut.
- S'utilise-t-elle au pouce ? → `/epreuve-du-pouce`, qui mesure débordement,
  cibles de 44 px et contrastes sur le rendu réel.
- Les jetons de thème eux-mêmes → `/usine-a-themes`.
- **Le client est un artisan ?** → `/web-artisan`, qui fabrique *et* vérifie,
  avec le gabarit réel, la table des métiers et ses tests. Celle-ci n'a alors
  rien à ajouter.

Les trois se lancent après celle-ci, jamais à sa place.
