---
name: stack-agence-supabase
description: Réaliser une application client sur la stack standardisée de l'agence — Next.js 16 (App Router, React 19), TypeScript strict, Tailwind + shadcn/ui, Supabase PostgreSQL avec RLS, Server Actions. Donne l'ordre de travail (schéma → SQL d'initialisation → actions serveur → interface), un script SQL durci prêt à l'emploi, et les règles de sécurité qui séparent une démo d'une application livrable. À utiliser dès qu'on code un projet client, qu'on parle de Supabase, de RLS, de politique de sécurité, d'authentification, de Server Action, de shadcn, de tableau de bord client, ou qu'on démarre une application avec base de données dans ce dépôt. Ne s'applique pas au studio Amorce, qui n'a ni serveur ni base.
---

# Réaliser une application client

Cette compétence couvre les projets clients de l'agence. Le cadrage se fait
avant, avec `cadrage-brief-client` : coder sans schéma validé, c'est refaire
les écrans une deuxième fois.

## Portée — lire ceci avant de créer un fichier

Ce dépôt héberge plusieurs projets sans code commun. **Le studio Amorce, à la
racine, n'a ni serveur, ni base, ni route d'API, et c'est délibéré** : tout s'y
exécute dans le navigateur, aucun fichier de l'utilisateur ne part ailleurs. Ne
jamais y ajouter Supabase, une Server Action ou une route serveur.

Un projet client vit dans **son propre dossier à la racine** — `client-xyz/` —
au même titre que les autres projets du dépôt, qu'énumère `CLAUDE.md` (les
citer ici ferait une seconde liste, qui se périmerait au projet suivant).
Quatre branchements sont à faire à la création, faute de quoi l'outillage
commun casse :

| Fichier | Ce qu'il faut y ajouter | Pourquoi |
| --- | --- | --- |
| `eslint.config.mjs` | `client-xyz/**` dans `globalIgnores` | La configuration de la racine est celle d'Amorce. Appliquée au projet client, elle signale des erreurs sur un code qui a ses propres règles. Le projet client lance son propre `npm run lint` depuis son dossier. |
| `.claude/hooks/session-start.sh` | l'installation de ses dépendances | Sans quoi chaque session distante redémarre sur un dossier sans `node_modules`. |
| `tsconfig.json` | `client-xyz` dans `exclude` | Celui de la racine compile `**/*.ts` et fait pointer `@/…` vers `src/` d'Amorce. Sans l'exclusion, `npm run typecheck` à la racine échoue sur chaque import du projet client. |
| `.gitignore` | `client-xyz/.env.local` | Une clé poussée est une clé à révoquer, et l'historique la garde. |

## Une implémentation de référence existe

`agence/` est un projet client complet et vérifié, écrit sur cette stack :
authentification, profils créés par trigger, mot de passe oublié, CRUD sous
RLS, espace d'administration, tests unitaires et contrôle des politiques.
**Le lire avant d'écrire vaut mieux que le reconstruire** — notamment
`src/lib/supabase/` (les clients et le garde de session), `src/lib/actions/`
(la forme d'état que tous les formulaires partagent) et `supabase/schema.sql`,
qui est le même socle durci que `assets/init.sql`, appliqué à un domaine réel.

Ce qu'il ne dispense pas de faire : le cadrage, le schéma du client, et
l'adaptation des contrôles de sécurité à son domaine. Un socle recopié sans
ces trois-là donne une démo, pas une livraison.

## L'ordre de travail

Il n'est pas décoratif : chaque étape ferme des questions que la suivante
poserait. Remonter d'une étape coûte une réécriture.

1. **Le schéma**, en français d'abord, relu par le client (`cadrage-brief-client`).
2. **Le SQL d'initialisation**, avec la sécurité au niveau ligne. Partir de
   `assets/init.sql`, qui est un socle durci et rejouable — le lire avant de
   l'adapter, ses commentaires expliquent ce que chaque garde évite.
3. **Les types**, générés depuis la base réelle, jamais écrits à la main.
4. **Les Server Actions**, avec session, validation, puis écriture.
5. **L'interface**, une fois seulement que les données circulent.

Le squelette complet et fonctionnel de chaque étape — clients Supabase, proxy,
types, action, page, formulaire — est dans `references/server-actions.md`.
L'ouvrir au moment d'écrire le code plutôt que de reconstruire de mémoire :
plusieurs de ces fichiers ont un piège de version.

## Les cinq règles de sécurité

Elles ne se négocient pas parce qu'aucune ne se rattrape après la mise en
ligne : une donnée lue par la mauvaise personne l'est définitivement.

**1. La RLS est activée sur chaque table, dès sa création.** Une table sans
`enable row level security` est lisible par tout porteur de la clé publique,
qui est dans le paquet JavaScript de chaque visiteur. Activer la RLS *après*
avoir écrit les écrans, c'est découvrir tard que la moitié des requêtes en
dépendaient.

**2. Les droits d'écriture se donnent colonne par colonne.** Une policy choisit
les *lignes* accessibles, jamais les *colonnes*. « L'utilisateur modifie son
profil » inclut donc « l'utilisateur choisit son rôle » — c'est le défaut le
plus courant des schémas de démarrage. La parade est dans `assets/init.sql` :
`revoke all`, puis `grant update (colonnes explicites)`.

**3. La session se vérifie dans chaque action et chaque page.** Une Server
Action est un point d'entrée HTTP public : son identifiant est dans le paquet
envoyé au navigateur et n'importe qui peut la poster, bouton visible ou non. Le
proxy ne protège rien — la documentation de Next.js le dit explicitement, il
sert à des contrôles optimistes, pas d'autorisation.

**4. `getUser()`, jamais `getSession()`, côté serveur.** Le premier revalide le
jeton auprès de Supabase ; le second relit un cookie, que le client écrit.

**5. Aucune clé en dur, et `NEXT_PUBLIC_` veut dire public.** Ce préfixe inscrit
la valeur en clair dans le paquet du navigateur. Il convient à l'URL et à la
clé anonyme, qui sont faites pour être publiques puisque la RLS les encadre. La
clé `service_role` ignore toutes les politiques : elle ne porte jamais ce
préfixe et ne s'importe jamais depuis un composant client.

## Ce que la qualité veut dire ici

- **`any` est interdit**, et `as` presque toujours de trop. Un type qui résiste
  signale un modèle de données bancal — le corriger plutôt que le contourner.
  Pour ce qui vient réellement d'ailleurs, `unknown` puis une validation.
- **Un `try/catch` autour de chaque appel réseau**, avec deux destinataires
  distincts : le détail technique dans `console.error`, une phrase actionnable
  à l'écran. Un message de PostgreSQL montré à l'utilisateur décrit le schéma à
  qui ne devrait pas le connaître.
- **Trois états par écran, toujours** : chargement, vide, erreur. L'état vide
  n'est pas un écran raté, c'est le premier que voit tout nouveau client — il
  dit quoi faire, avec le bouton pour le faire.
- **Logique métier hors des composants.** Les Server Actions et `lib/` d'un
  côté, l'affichage de l'autre. Un composant qui appelle Supabase directement
  ne se teste plus et se duplique au troisième écran.

## Structure d'un projet client

```
client-xyz/
├── app/
│   ├── (auth)/connexion, inscription
│   ├── (app)/…                 pages protégées, une action.ts par domaine
│   └── layout.tsx
├── components/ui/              shadcn, non modifiés
├── components/                 composants métier
├── lib/
│   ├── supabase/{client,server,proxy}.ts
│   ├── database.types.ts       généré
│   └── types.ts                alias et constantes métier
├── supabase/migrations/        le SQL, versionné et rejouable
├── proxy.ts
└── .env.example                les clés attendues, valeurs vides
```

Le SQL est versionné dans le dépôt, pas seulement appliqué dans la console
Supabase. Une base dont le schéma n'existe que sur le serveur ne se recrée pas,
ne se relit pas en revue, et diverge silencieusement entre la préproduction et
la production.

## Accessibilité, sans y passer la journée

Les composants shadcn/ui sont accessibles au départ ; l'essentiel du travail
consiste à ne pas le défaire. Quatre points couvrent presque tout : un `Label`
relié à chaque champ, les messages d'erreur en `role="alert"` et référencés par
`aria-describedby`, un contraste d'au moins 4,5:1 sur le texte, et une cible
tactile d'au moins 44 px (`min-h-11`) partout où l'on clique.

## Vérifier

Depuis le dossier du projet client :

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Puis, dans le tableau de bord Supabase, l'onglet **Advisors** : il relit le
schéma et signale les tables sans RLS et les fonctions `security definer` sans
`search_path` fixé. C'est le seul contrôle qui regarde la base telle qu'elle est
réellement déployée, et non telle que le script prétend l'avoir faite.

Ce qu'aucune de ces commandes ne dit : si les politiques laissent passer ce
qu'elles devraient refuser. Cela se joue sur une vraie base, en tentant les
violations — et donc jamais sur celle du client :

```bash
.claude/skills/stack-agence-supabase/assets/bac-a-sable.sh
```

Le script monte un PostgreSQL jetable, y simule le schéma `auth` de Supabase,
applique `init.sql` deux fois (le rejeu prouve l'idempotence) puis joue les
treize contrôles de `assets/tests-rls.sql` : chacun rejoue une attaque depuis
le rôle qui la tenterait en production. Adapter les cas au domaine du client
fait partie du travail, au même titre que le schéma.

Le cas 5 mérite d'être connu avant d'écrire la moindre policy : sur le schéma
de démarrage habituel — celui que produisent la plupart des générateurs — il
échoue, et Alice devient administratrice en une requête.

Tant que ces contrôles n'ont pas tourné, la sécurité du projet est supposée et
non constatée. Le dire fait partie du compte rendu de livraison.
