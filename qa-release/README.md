# Le sas de sortie

Ce dossier sert de dernier contrôle avant de montrer, vendre ou publier un site. Il ouvre le vrai site dans plusieurs tailles d’écran, prend des captures et cherche les défauts qu’un simple « build vert » ne voit pas.

Il ne modifie jamais le site et ne le publie pas.

## Ce qu’il vérifie

- quatre écrans : mobile étroit, Redmi Note 12 Plus, tablette et ordinateur ;
- page vide, erreur du navigateur, ressource ou requête cassée ;
- débordement horizontal ;
- texte inférieur à 18 px ;
- boutons, liens et champs inférieurs à 44 × 44 px ;
- images sans texte alternatif ;
- champs sans libellé ;
- titres mal ordonnés ;
- liens internes cassés et liens externes injoignables ;
- navigation au clavier et focus visible ;
- animations qui continuent malgré la préférence « réduire les animations » ;
- lecture audio ou vidéo automatique ;
- accessibilité WCAG avec Axe quand il est installé ;
- captures complètes et rapport détaillé conservés comme preuves.

Les seuils viennent de la charte du dépôt. Le Redmi 393 × 873 est l’écran de référence, le corps de texte reste à 18 px minimum, les cibles à 44 px minimum et l’accent principal doit atteindre 7:1 sur la surface la plus claire.

## Première installation

Depuis ce dossier :

```bash
npm install
npm run install:browsers
```

Cette installation ne se fait qu’une fois par machine.

## Vérifier un projet

Le site doit déjà être accessible, soit en local, soit à sa vraie adresse en ligne.

```bash
npm run qa -- --project artisan-express --url http://localhost:3000
```

Pour une adresse en ligne, l’option `--cache-bust` évite de juger une ancienne page encore en cache :

```bash
npm run qa -- --project artisan-express --url https://exemple.fr --cache-bust
```

Pour un site qui n’est pas encore dans le manifeste :

```bash
npm run qa -- --name nouveau-site --url https://exemple.fr --routes /,/contact,/mentions-legales
```

Pour ajouter WebKit, qui rapproche la vérification du moteur de Safari :

```bash
npm run qa -- --project artisan-express --url https://exemple.fr --browsers chromium,webkit
```

WebKit sous Linux n’est pas un véritable iPhone ou Mac. Une sortie importante doit encore être regardée dans Safari réel.

## Lire le résultat

Les preuves apparaissent dans `artifacts/` :

- un PNG complet pour chaque page et chaque écran ;
- `report.json` pour les machines et les futurs workflows ;
- `report.md` pour une lecture humaine rapide.

Le verdict a trois formes :

- **À CORRIGER AVANT LANCEMENT** : au moins un défaut ou un contrôle bloqué ;
- **CONFORME SUR LES CONTRÔLES EXÉCUTÉS — AXE NON EXÉCUTÉ** : les mesures disponibles passent, mais l’audit Axe manque ;
- **PRÊT POUR LA REVUE HUMAINE FINALE** : l’automatisation passe, les captures doivent maintenant être regardées.

Le dernier verdict ne signifie jamais « prêt à publier » à lui seul. La règle du dépôt reste prioritaire : une personne doit regarder le rendu complet, essayer les parcours métier et confirmer que le résultat est vraiment bon.

## Adapter les projets

`projects.json` contient les routes, les écrans et les seuils. Les adresses non confirmées restent volontairement vides : une URL approximative est plus dangereuse qu’une URL absente. On passe donc l’adresse exacte avec `--url`, ou on l’inscrit seulement lorsqu’elle a été confirmée.

Les adresses déjà confirmées de Lefouzèbreizh Studio, Orientation Express, Artisan Express, Ensemble face aux démarches et Rénov Facile sont enregistrées. Pour elles, `--url` n’est plus nécessaire :

```bash
npm run qa -- --project orientation-express --cache-bust
```

Pour mesurer le contraste renforcé de l’accent maison, marquer les actions principales avec `data-qa-accent`. Tant que ce marqueur manque, le rapport produit un avertissement au lieu d’inventer une mesure.

## Ce que ce MVP ne prétend pas faire

- il ne remplit pas les formulaires et ne déclenche aucune action métier ;
- il ne vérifie pas une base Supabase ni ses règles RLS ;
- il ne mesure pas encore Lighthouse ou les performances sous forte charge ;
- il ne remplace pas Safari réel, un téléphone réel ni la revue humaine finale ;
- il ne clique pas automatiquement sur une action pouvant envoyer un message, payer, supprimer ou publier.

Ces limites sont intentionnelles : le sas donne un verdict honnête sur ce qu’il a réellement mesuré.
