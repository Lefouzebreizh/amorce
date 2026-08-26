---
name: stack-agence-supabase
description: Réaliser une application client sur la stack standardisée de l'agence — Next.js 16 (App Router, React 19), TypeScript strict, Tailwind + shadcn/ui, Supabase PostgreSQL avec RLS, Server Actions. Dit où partir (le socle `agence/`, déjà écrit et vérifié), ce qu'on n'a plus à réécrire, et les deux règles que le socle ne peut pas faire respecter tout seul. À utiliser dès qu'on code un projet client, qu'on parle de Supabase, de RLS, de politique de sécurité, d'authentification, de Server Action, de shadcn, de tableau de bord client, ou qu'on démarre une application avec base de données dans ce dépôt. Ne s'applique pas au studio Amorce, qui n'a ni serveur ni base.
---

# Réaliser une application client

## Deux réflexes, avant tout le reste

**Ne pas ajouter Supabase à Amorce.** Le studio, à la racine, n'a ni serveur,
ni base, ni route d'API, et c'est délibéré : tout s'y exécute dans le
navigateur, aucun fichier de l'utilisateur ne part ailleurs. Une Server Action
ou une route serveur y contredirait la promesse faite à l'utilisateur.

**Ne pas repartir de zéro.** Le socle est écrit, testé et vérifié en
intégration continue : c'est `agence/`. Authentification, mot de passe oublié,
espace privé, rôles, RLS durcie, coque d'interface, formulaires qui rendent
leurs erreurs, et un module métier complet fait pour être recopié. Réécrire
tout cela « proprement » produit un second socle qui divergera du premier.

## Où tout est déjà écrit

`agence/README.md` est la source. Le lire plutôt que de reconstruire de
mémoire — il couvre le démarrage, le parcours utilisateur, les trois barrières
de sécurité, la nomination d'un administrateur, la carte du code, la recette
pour ajouter une table, la vérification et le déploiement.

Les décisions de sécurité sont justifiées à leur emplacement : `supabase/schema.sql`
en tête de fichier, `src/lib/supabase/session.ts` et `src/proxy.ts` dans leurs
blocs de commentaires. Ces blocs portent le *pourquoi* — les relire avant de
toucher à ce qu'ils protègent.

## Ce que le socle ne peut pas faire respecter tout seul

**Le cadrage précède le code.** Un socle ne devine pas qui a le droit de voir
quoi. Passer par `cadrage-brief-client`, et n'écrire la première table qu'une
fois le schéma relu par le client en français.

**Un nouveau projet client se clone depuis `agence/`**, dans son propre dossier
à la racine — `client-xyz/` — et jamais en modifiant le socle pour un client
donné : ce qui est spécifique à une mission ne remonte pas dans ce dont
héritera la suivante. Trois branchements accompagnent la création du dossier,
sans quoi l'outillage commun casse :

| Fichier | Ce qu'il faut y faire | Pourquoi |
| --- | --- | --- |
| `eslint.config.mjs` et `tsconfig.json` de la racine | y exclure `client-xyz/**` | Ce sont ceux d'Amorce. Appliqués au projet client, ils signalent des erreurs sur un code qui a ses propres règles — `agence/` est exclu pour exactement cette raison. |
| `.claude/hooks/session-start.sh` | y installer ses dépendances | Sans quoi chaque session distante redémarre sur un dossier sans `node_modules`. |
| `.github/workflows/` | lui donner son workflow, sur le modèle d'`agence.yml` | La racine ne vérifie que ce qu'elle connaît : sans workflow propre, rien ne vérifie le projet. |

## Vérifier

Depuis le dossier du projet, jamais depuis la racine — les cinq commandes sont
listées dans son `README`. `npm run test:rls` est celle qu'on oublie et la
seule qui voie ce qu'aucune ligne de TypeScript ne peut dire : ce que
PostgreSQL accepte de servir, et à qui.

Elle monte au besoin un PostgreSQL jetable, et fonctionne donc aussi bien en
session distante que sur un poste ou en intégration continue. Une politique de
sécurité se relit trop bien pour qu'une relecture tienne lieu de contrôle.
