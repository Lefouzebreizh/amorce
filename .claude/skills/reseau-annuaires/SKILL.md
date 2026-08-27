---
name: reseau-annuaires
description: >-
  Travailler sur le réseau d'annuaires d'outils IA (`annuaire-ia/`) — onze sites
  de niche qui partagent un gabarit, une feuille de style compilée et un
  auto-pilote qui publie tout seul tous les deux jours. Dit où atterrit chaque
  fichier, quelle commande vérifie quoi, les huit invariants qui empêchent onze
  sites de tomber ensemble, et les pièges déjà payés — dont celui qui rendait
  les pages illisibles sans qu'aucun test ne le voie. À utiliser dès qu'une
  demande touche à `annuaire-ia/`, à l'auto-pilote, à une niche, à un outil
  d'affiliation, à un sitemap, à la réserve, à un site qui ne s'affiche plus —
  et aussi quand elle dit seulement « ajoute un outil », « il faut réalimenter
  la réserve », « crée un site pour les [métier] », « le site est cassé »,
  « prépare le déploiement », « pourquoi Google ne l'indexe pas », ou qu'un
  billet parle de réserve presque vide. Ne pas attendre le mot « annuaire ».
---

# Le réseau d'annuaires IA

Onze sites d'affiliation, un par métier, qui partagent **le code et
l'automatisation** mais **aucune ligne de contenu**. C'est la condition pour
qu'un réseau ne se fasse pas déclasser pour contenu dupliqué : ce qui est
commun est technique, ce qui est visible est propre à chaque niche.

Ni serveur, ni base de données, ni étape de compilation au déploiement. Un
dossier déposé sur un hébergement statique, et le site tourne.

## La carte

```
annuaire-ia/
  index.html            le gabarit unique — se configure sur la niche demandée
  styles.src.css        la source de la feuille ; styles.css est compilé
  niches/<id>.json      une base par site : identité, charte, outils, avis
  auto-pilot.js         publie un outil par niche ; contient la réserve (BACKLOG)
  valider.js            la seule définition de ce qu'est une base valide
  verifier.mjs          le parcours en vrai navigateur
  construire-styles.mjs compile styles.src.css → styles.css
  construire-sites.js   dist/<niche>/ prêt à déposer sur son domaine
  generate-sitemap.js   sitemaps/sitemap-<niche>.xml, versionnés
  nouvelle-niche.js     dégrossit un douzième site
  alerte-reserve.js     rédige le billet quand la réserve s'épuise
```

Le travail programmé est à `.github/workflows/autopilot.yml`, la barrière à
`.github/workflows/annuaire-ia.yml`.

**L'auto-pilote passe `verifier.mjs` avant de pousser** — cinq minutes, tous les
deux jours. C'est le seul endroit où le parcours en navigateur est obligatoire,
et la raison tient à ce qui distingue cette exécution de toutes les autres :
elle écrit sur `main` sans qu'un humain relise, et sa poussée ne redéclenche
aucun workflow. Sans cette étape, rien ne regarde jamais la page publiée. Un
parcours rouge ne publie rien : ne rien publier est visible et réversible,
publier onze pages cassées ne l'est pas.

## Vérifier — dans cet ordre

```bash
cd annuaire-ia
npm run valider     # les données : instantané, à lancer tout le temps
npm run styles      # après toute classe Tailwind ajoutée, y compris dans le JS
npm run verifier    # le vrai navigateur : le seul qui voit le rendu
npm run sites       # la construction finale, si le déploiement approche
```

`valider.js` distingue deux niveaux, et la distinction est le cœur de l'outil :
une **erreur** casse un site et arrête tout ; une **alerte** coûte du trafic
mais pas le site, elle s'affiche et laisse passer. Bloquer une publication sur
une longueur de balise reviendrait à préférer un site figé à un site imparfait.

`npm run verifier` accepte une niche en argument (`npm run verifier btp`) pour
isoler un défaut sans rejouer les onze.

## Les invariants

Chacun est justifié en tête de son fichier ; relire le commentaire avant d'y
toucher.

1. **Aucune dépendance externe au chargement, hors polices.** La feuille est
   compilée et servie depuis le même domaine. La première version chargeait
   Tailwind depuis un CDN : mesuré dans un vrai navigateur, sans le script
   distant **aucune utilitaire n'était appliquée** — pas de grille, pas de
   cartes, une loupe de six cents pixels et des boutons de dix-neuf. Un réseau
   d'entreprise qui filtre jsdelivr, une panne de quelques minutes, et onze
   sites deviennent illisibles au moment où le visiteur arrive. Les polices
   restent distantes parce que leur absence fait retomber sur la pile système :
   ça enlaidit, ça ne casse rien.
2. **Les couleurs de niche passent par deux variables CSS**, jamais par des
   classes fabriquées en JavaScript. Une classe construite à la volée n'est pas
   dans la feuille compilée : elle n'existe tout simplement pas.
3. **Toute adresse porte `?niche=<id>`**, y compris l'accueil d'un domaine qui
   sert déjà cette niche. C'est la forme qu'écrit la balise canonique et celle
   du sitemap ; deux formes concurrentes pour la même page, ce sont deux pages
   en double aux yeux de Google.
4. **Les fiches s'adressent en `?outil=<id>`, jamais en `#id`.** Un fragment
   n'est pas une URL distincte pour un moteur : le sitemap n'aurait qu'une
   adresse par site, et les recherches par nom d'outil — l'essentiel du trafic
   qualifié d'un annuaire — n'atteindraient rien.
5. **La description longue est du texte, convertie en nœuds DOM.** Jamais
   d'`innerHTML` : chaque fiche, et donc chaque outil publié automatiquement,
   deviendrait une porte d'entrée pour du script injecté.
6. **`lastmod` est la vraie date d'ajout, jamais celle du jour.** Un sitemap
   qui déclare tout modifié à chaque passage cesse d'être cru par le moteur,
   qui arrête alors de s'y fier pour prioriser son exploration — soit
   exactement ce qu'on lui demande.
7. **La réserve est écrite à la main, dans le script.** Le travail programmé
   pousse sur `main` sans relecture : la réserve est le point où cette
   relecture a eu lieu. Générer le texte au moment de publier reviendrait à
   mettre en ligne ce que personne n'a lu, sur des sites qui vivent d'être
   crédibles.
8. **Un `?niche=` inconnu retombe sur la niche du domaine.** Le panneau
   d'erreur est réservé au cas où c'est cette base-là qui manque ; un visiteur
   arrivé par un lien mal recopié doit voir le site, pas un message technique.

## Les pièges déjà payés

- **Les apostrophes françaises dans la réserve.** Les champs de `BACKLOG` sont
  en accents graves (`` ` ``), pas en apostrophes simples : `'L'IA du chantier'`
  casse le fichier, et le fichier fait mille cinq cents lignes. Écrire en
  accents graves dès la première ligne, pas en réparation.
- **Un parcours aux attentes écrites en dur.** La première version de
  `verifier.mjs` affirmait « trois cartes » ; l'auto-pilote en a publié une
  quatrième le lendemain et le parcours est passé au rouge sans qu'aucun défaut
  n'existe. **Toute attente se calcule sur la base** — nombre d'outils, nom de
  catégorie, titre — et le filet survit alors aux publications.
- **Les alertes qui se noient.** Tant que les liens d'affiliation sont ceux de
  démonstration, cette alerte sort cent fois ; sans regroupement par genre, les
  deux qui comptent disparaissent dedans. `rendreCompte` groupe et n'affiche
  que trois exemples par famille.
- **Un `<style type="text/tailwindcss">` n'est pas une feuille de style.** Il
  compte pour zéro dans `document.styleSheets` : c'est ce qui a permis de
  diagnostiquer le premier piège en une mesure.
- **Vérifier le comportement n'est pas vérifier le rendu.** Vingt-sept
  contrôles verts — titres, filtres, modale, adresses — sur une page sans la
  moindre mise en page. Quand une demande touche à l'apparence, **prendre une
  capture et la regarder**, `verifier.mjs` ne le fera pas à votre place.

## Les recettes

### Ajouter un outil à une niche

Une entrée dans le tableau `outils` de sa base, et rien d'autre : ni le
gabarit ni le script ne connaissent la liste, et les boutons de filtre se
construisent sur les catégories présentes. Champs obligatoires : `id` (adresse
définitive, ne plus le changer une fois indexé), `nom`, `categorie`, `prix`,
`description_courte`, `description_longue`, `lien_affiliation`, `score_avis`,
`date_ajout`.

L'avis suit toujours quatre sections — `## Notre verdict`, `## Points forts`,
`## Points faibles`, `## Idéal pour` — parce que c'est ce que trace le gabarit
et ce que `valider.js` réclame. Un avis sans points faibles ne convainc
personne et se repère à dix mètres.

L'ordre du tableau est l'ordre d'affichage : c'est le levier éditorial pour
mettre en avant ce qui convertit.

### Réalimenter la réserve

C'est ce que demande le billet ouvert automatiquement, et **le seul travail du
réseau qui ne s'automatise pas**. Cinq outils par niche à sec, dans `BACKLOG`
de `auto-pilot.js`, au format des entrées voisines et **sans `date_ajout`** —
elle est posée à la publication.

Les outils doivent être **réels, actuels et pertinents pour le métier**. Un
annuaire qui recommande un outil mort ou hors sujet perd la seule chose qu'il
vend. En cas de doute sur l'existence ou le prix d'un outil, chercher plutôt
que supposer : c'est du contenu qui partira en ligne sans relecture.

### Créer un douzième site

```bash
node nouvelle-niche.js transport "IA Transport" 🚚 https://ia-transport.fr \
  --metier "transporteurs et logisticiens"
```

Le script pose le bloc `niche`, choisit une teinte encore libre, refuse un
domaine déjà pris, et écrit une base valide mais vide — `valider.js` la signale
alors « en chantier », sans bloquer la chaîne. Reste le travail éditorial :
accroches, slogan, balises, trois outils, cinq en réserve.

### Déployer

```bash
npm run styles && npm run sites
```

`dist/<niche>/` contient tout ce qu'il faut : un `index.html` dont la tête est
**déjà remplie** (titre, description, balises sociales, canonique, couleurs),
la feuille, la base de cette seule niche, le sitemap et le robots.txt. Déposer
le contenu à la racine du domaine, puis déclarer le sitemap dans Search
Console — c'est ce qui déclenche l'exploration en heures plutôt qu'en semaines.

La tête pré-remplie n'est pas cosmétique : le gabarit se configure en
JavaScript, et les aperçus de liens des messageries et des réseaux sociaux ne
l'exécutent pas. Sans cette étape, un partage affiche « Chargement… ».

### Un site s'affiche mal ou pas du tout

Dans cet ordre, parce que chaque étape élimine une famille de causes :

1. `npm run valider` — une base cassée donne le panneau d'erreur.
2. La feuille est-elle à jour ? `node construire-styles.mjs --verifier`. Une
   classe ajoutée sans recompiler n'existe pas dans le CSS en ligne.
3. `npm run verifier <niche>` — puis **une capture d'écran**, parce que le
   parcours voit le DOM et pas la mise en page.
4. La console du navigateur : le gabarit journalise la niche qu'il n'a pas pu
   charger avant de retomber sur celle du domaine.

## Ce qui demande une main humaine

Trois choses, et il vaut mieux les dire que les découvrir :

- **Réalimenter la réserve**, tous les dix passages environ. Le billet arrive
  deux passages avant la fin.
- **Poser les vrais liens d'affiliation.** Tant qu'ils sont en
  `exemple-affiliation.com`, `valider.js` le rappelle à chaque exécution et le
  réseau ne rapporte rien.
- **Acheter les domaines.** Ils sont écrits dans les bases (`niche.domaine`) et
  servent à fabriquer les sitemaps ; rien ne vérifie qu'ils existent.
