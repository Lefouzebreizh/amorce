---
name: demarrer-projet-client
description: "Fabriquer un nouveau projet client de l'agence à partir du socle `agence/` — copie, renommage, branchements à la racine, intégration continue, en une commande vérifiée. À utiliser dès qu'un projet client démarre pour de bon : « on lance le projet pour Boulangerie Martin », « crée-moi l'appli pour ce client », « on attaque le dev », « mets en place le projet », « il faut un espace client pour X », ou juste après un cadrage validé avec `/cadrage-brief-client`. Ne surtout pas recopier `agence/` à la main : trois branchements à la racine se voient seulement quand la vérification casse, chez quelqu'un d'autre. Pour l'ordre de travail une fois le projet créé, enchaîner sur `/stack-agence-supabase`."
---

# Démarrer un projet client

Le socle `agence/` est une application complète et vérifiée : authentification,
profils, RLS durcie, CRUD sous session, espace d'administration, tests, contrôle
des politiques. Un nouveau client part de là — jamais d'une page blanche, jamais
d'une copie approximative.

## La commande

```bash
.claude/skills/demarrer-projet-client/scripts/nouveau-client.sh <nom-technique> "Nom affiché"
```

Exemple réel :

```bash
.claude/skills/demarrer-projet-client/scripts/nouveau-client.sh boulangerie-martin "Boulangerie Martin"
```

Le nom technique devient le dossier, le paquet npm et le préfixe des journaux
serveur ; le nom affiché est ce que lit l'utilisateur dans l'interface. Le
second argument est facultatif — `boulangerie-martin` donne « Boulangerie
Martin » — mais un client dont le nom porte une apostrophe, un accent ou une
majuscule interne mérite qu'on l'écrive.

Compter **une minute** : la vérification complète tourne par défaut —
installation, lint, types, toute la suite de tests du socle, et build. `--sans-verification` la saute et
rend la main en une fraction de seconde, à réserver au moment où l'on veut
seulement voir la forme du projet.

## Ce que la commande fait, et pourquoi personne ne devrait le refaire à la main

| Étape | Ce qui casse si on l'oublie |
| --- | --- |
| Copie depuis `git ls-files` | Une copie du dossier emporte `node_modules`, `.next` et, un jour, un `.env.local` avec la clé d'un autre client. |
| Renommage des deux identités | Le client lit « Socle Agence » sur sa page d'accueil, et ses journaux serveur portent le nom d'un autre projet. |
| `eslint.config.mjs` de la racine | La configuration d'Amorce analyse le projet client et signale des erreurs sur du code qui a ses propres règles. |
| `tsconfig.json` de la racine | Il compile `**/*.ts` et fait pointer `@/…` vers le `src/` d'Amorce : `npm run typecheck` échoue à la racine sur **chaque** import du client. C'est le piège qui a coûté un aller-retour à la création du socle. |
| Hook de session | Chaque session distante redémarre sur un dossier sans `node_modules`, et la première commande échoue. |
| Workflow d'intégration continue | Le projet n'est vérifié que sur le poste de celui qui l'écrit. |

Les trois branchements à la racine sont l'unique cas où une modification touche
légitimement plusieurs projets : c'est de la configuration qui doit connaître
ses voisins.

## Deux déclarations que le script ne fait pas

Un projet de ce dépôt se déclare à six endroits — c'est `/nouveau-projet` qui
les tient. Le script en couvre mécaniquement ce qui est propre à un projet
TypeScript (les deux configurations de la racine, le hook, le workflow). Restent
deux gestes d'écriture, que personne ne peut faire à votre place parce qu'ils
demandent une phrase juste :

- **`CLAUDE.md`, la phrase d'en-tête** : y ajouter le projet et son dossier, et
  **recompter** — le nombre est écrit en toutes lettres. Sans cela, les sessions
  suivantes ignorent son existence.
- **`.claude/skills/verifier/SKILL.md`** : sa séquence de vérification et ce
  qu'elle ne couvre pas. Sans cela, personne ne sait comment savoir si c'est
  vert. Pour un projet issu du socle, la séquence est celle d'`agence/` —
  `npm run lint|typecheck|test|build`, plus `test:rls` pour les politiques.

## Après la commande

Le projet tourne, mais il parle à une base qui n'existe pas encore. Dans
l'ordre :

1. **Une base.** Créer le projet Supabase et y appliquer
   `<nom>/supabase/schema.sql`, puis éprouver les politiques avec
   `<nom>/supabase/verifier-rls.sql` — sur une base jetable, jamais sur celle du
   client : il écrit dans `auth.users`. Une fois le projet livré, c'est
   `<nom>/supabase/etat-rls.sql` qui prend le relais : il ne fait que lire les
   catalogues et dit si la base ressemble encore à ce que le dépôt décrit. Voir
   `/supabase-en-direct` si le serveur Supabase est connecté à la session —
   sinon l'éditeur SQL du tableau de bord fait le même travail.
2. **Les clés.** `cp <nom>/.env.example <nom>/.env.local`, puis les trois
   variables. Rien d'autre n'est à configurer.

   Avant de montrer quoi que ce soit, `<nom>/supabase/demo.sql` remplit les
   écrans : dix projets rattachés à votre propre compte, parce que la RLS ne
   montre un projet qu'à son propriétaire. Un tableau de bord à zéro ne se juge
   pas, et c'est pourtant ce que voit le client au premier rendez-vous.
3. **Le domaine du client.** Le schéma livré contient deux tables de
   démonstration (`profiles`, `projects`). Les remplacer est le vrai travail :
   `/cadrage-brief-client` pour le périmètre écrit, `/stack-agence-supabase`
   pour l'ordre de réalisation et les règles de sécurité — c'est elle qui décrit
   en prose ce que ce script exécute, et elle reste la référence dès qu'on
   s'écarte du chemin mécanique.

## Ce que le script ne fait pas, volontairement

- **Il ne renomme pas les tables.** Un schéma se conçoit à partir du besoin du
  client, pas par substitution de chaînes sur celui d'un autre.
- **Il ne crée pas la base.** Créer un projet Supabase engage un compte et une
  région ; c'est une décision, pas une étape mécanique.
- **Il ne committe rien.** Le diff mérite d'être relu : il touche à trois
  fichiers partagés, et c'est exactement là que les conflits tombent dans ce
  dépôt (voir `/steward`).

## Si quelque chose résiste

**« existe déjà »** — le dossier ou le nom est pris. Le script s'arrête sans
rien toucher ; choisir un autre nom.

**Le socle a des modifications non committées** — le script prévient et copie
quand même la version committée. C'est délibéré : le socle livré est celui que
tout le monde voit, pas un état de travail. Committer d'abord si les
modifications doivent partir chez le client.

**La vérification échoue** — elle échoue alors aussi dans `agence/`, puisque
c'est le même code. Corriger dans le socle, pas dans la copie, sinon la
correction manquera au client suivant.
