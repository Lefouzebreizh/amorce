# Socle Agence

Le point de départ de toute application client de l'agence : authentification,
espace privé, données cloisonnées par utilisateur, et un premier module métier
complet (des fiches projet) qui sert autant de démonstration que de modèle à
copier.

Concrètement, ce dépôt évite de réécrire à chaque mission les mêmes quatre
journées : la connexion, la création de profil, les droits d'accès, la coque
d'interface et les formulaires qui rendent leurs erreurs proprement.

**Pile technique** — Next.js 16 (App Router, Server Actions), React 19,
TypeScript strict, Tailwind CSS v4, composants dans la convention Shadcn/ui,
Supabase (PostgreSQL, Auth, RLS).

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis renseigner les trois variables
npm run dev                    # http://localhost:3000
```

Entre les deux, il faut un projet Supabase :

1. Créer un projet sur <https://supabase.com/dashboard>.
2. Ouvrir **SQL Editor > New query**, y coller `supabase/schema.sql` en entier,
   exécuter. Le script est rejouable : il ne casse pas un projet où il a déjà
   tourné.
3. Copier l'URL du projet et la clé publique (**Project Settings > API**) dans
   `.env.local`.
4. **Authentication > URL Configuration** : renseigner l'URL du site et
   `…/auth/confirmer` dans les URL de redirection autorisées, sinon le lien de
   confirmation renvoie l'utilisateur vers `localhost` depuis la production.

Pour tester sans boîte mail, désactiver la confirmation par courriel dans
**Authentication > Providers > Email**. En production, la laisser active.

## Le parcours

| Écran | Chemin | Ce qu'on y fait |
| --- | --- | --- |
| Accueil | `/` | Vitrine publique, aiguillage vers la connexion |
| Inscription | `/inscription` | Création du compte ; le profil est créé par un trigger PostgreSQL |
| Connexion | `/connexion` | Ouverture de session ; retour à la page demandée |
| Tableau de bord | `/tableau-de-bord` | Indicateurs et cinq derniers projets |
| Projets | `/projets` | Liste filtrable par statut, filtre porté par l'URL |
| Fiche projet | `/projets/[id]` | Modification et suppression |
| Mon compte | `/compte` | Nom, entreprise, rôle attribué |

## Trois barrières, pas une

La sécurité de ce socle ne repose pas sur le code de l'interface. Trois
mécanismes indépendants la portent, et chacun suffirait à bloquer l'accès aux
données d'un autre client si les deux autres tombaient :

1. **La RLS de PostgreSQL** (`supabase/schema.sql`). L'application parle à la
   base avec la clé publique et le jeton de l'utilisateur : ce sont les
   politiques qui décident de ce qui est lu et écrit. Une faille d'interface ne
   peut pas exposer la ligne d'un autre compte.
2. **`exigerSession()` dans chaque action et chaque page privée**
   (`src/lib/supabase/session.ts`). Une Server Action est une route POST
   publique, atteignable sans passer par l'écran : elle redemande la session au
   serveur d'authentification, elle ne fait pas confiance au formulaire.
3. **Le garde de `src/proxy.ts`**, qui redirige un visiteur non connecté avant
   le rendu — un confort de navigation, jamais un contrôle d'accès.

Deux points méritent d'être connus avant de reprendre le schéma sur un autre
projet :

- **Un utilisateur ne peut pas s'accorder un rôle.** La RLS filtre les lignes,
  pas les colonnes : avec un simple `grant update` sur `profiles`, « je modifie
  mon profil » permet d'écrire `role = 'admin'`. Les privilèges sont donc
  redonnés colonne par colonne.
- **Les fonctions `SECURITY DEFINER` fixent leur `search_path`.** Sans cela,
  une fonction qui s'exécute avec les droits du propriétaire résout ses tables
  via le chemin de recherche de l'appelant — c'est une élévation de privilège.

Aucune clé n'est écrite dans le code : tout passe par `.env.local`, et la clé
`service_role`, qui contourne la RLS, n'est lue nulle part.

## Carte du code

```
supabase/schema.sql      tables, RLS, privilèges de colonnes, triggers
src/proxy.ts             rafraîchissement de session (ex-middleware, renommé en Next.js 16)
src/app/                 routes — (auth) public, (prive) sous session, auth/confirmer
src/components/ui/       briques d'interface (Shadcn/ui, écrites à la main)
src/components/          composants métier : formulaires, listes, navigation
src/lib/actions/         Server Actions — les seules écritures
src/lib/supabase/        clients serveur, session, proxy
src/lib/                 types de la base, validation Zod, formats d'affichage
```

La règle de découpage : **l'interface ne parle jamais à la base.** Un composant
appelle une Server Action ou reçoit ses données d'un composant serveur ; il
n'ouvre pas de client Supabase.

## Ajouter une table

Le module « projets » est fait pour être recopié. Dans l'ordre :

1. Écrire la table, ses index et ses politiques dans `supabase/schema.sql`,
   puis rejouer le script.
2. Refléter les colonnes dans `src/lib/types.ts` — c'est le miroir du schéma,
   rien ne le génère.
3. Ajouter le schéma Zod correspondant dans `src/lib/validation.ts`.
4. Écrire les actions dans `src/lib/actions/`, chacune ouverte par
   `exigerSession()` et fermée par `revalidatePath()`.
5. Écrire les écrans. Les formulaires passent par `<Champ>` : il câble
   `aria-describedby`, `aria-invalid` et le message d'erreur d'un seul geste.

## Vérifier

```bash
npm run lint        # ESLint, `any` interdit
npm run typecheck   # tsc --noEmit
npm run build       # build de production
```

Les trois doivent passer avant toute livraison. Le build a besoin des variables
d'environnement : les valeurs de `.env.example` suffisent à le faire aboutir,
elles ne suffisent évidemment pas à faire fonctionner l'application.

## Déployer

N'importe quel hébergeur Node ou Vercel. Les trois variables de `.env.example`
sont à déclarer côté hébergeur, et `NEXT_PUBLIC_SITE_URL` doit porter l'adresse
publique réelle — c'est elle qui construit le lien de confirmation envoyé par
courriel.

## Annexe — cadrage client

Les cinq questions à poser avant d'écrire la première ligne. Les réponses se
traduisent directement : les rôles deviennent des politiques RLS, les données à
stocker deviennent des colonnes, les actions indispensables deviennent des
Server Actions.

1. **L'objectif** — en une phrase, à quoi sert l'application ? Quel problème
   majeur résout-elle ?
2. **Les utilisateurs** — qui se connecte ? Y a-t-il des rôles différents
   (administrateur, client, employé de terrain) ?
3. **Les fonctionnalités clés** — les 3 à 5 actions indispensables (créer un
   devis, déposer une facture, consulter un graphique, recevoir une alerte).
4. **Les données** — quelles informations stocker, et lesquelles sont
   sensibles ?
5. **Design et inspiration** — charte graphique, logo, sites dont le style
   plaît.
