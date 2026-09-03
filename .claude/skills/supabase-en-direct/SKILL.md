---
name: supabase-en-direct
description: "Piloter un projet Supabase depuis la session, quand le serveur MCP Supabase est connecté — appliquer le schéma en migration, éprouver les politiques RLS sur la vraie base, lire les advisors de sécurité, récupérer l'URL et la clé publique pour `.env.local`, générer les types TypeScript. À utiliser dès qu'une tâche bute sur « il faudrait une base » : appliquer un schéma, vérifier des politiques, brancher un projet client, diagnostiquer une requête qui renvoie zéro ligne, ou remplir un `.env.local`. Sert aussi à savoir quoi faire quand le serveur MCP est absent ou tombe en cours de route — l'éditeur SQL du tableau de bord fait le même travail, et ce fichier dit lequel des deux chemins a réellement été éprouvé."
---

# Piloter Supabase depuis la session

Sans serveur MCP, un schéma se termine par « il vous reste à créer le projet et
à coller ce fichier dans l'éditeur SQL ». Avec, la chaîne se ferme dans la
session : la base existe, le schéma s'applique, les politiques s'éprouvent, les
clés reviennent. C'est la différence entre livrer un fichier et livrer quelque
chose qui marche.

## D'abord : le serveur répond-il ?

```
mcp__Supabase__list_projects
```

Une réponse donne le `ref` du projet (`bmxgincsjvezpuoffrho`, par exemple) —
c'est l'identifiant que réclament tous les autres outils. Une erreur, ou
l'absence des outils `mcp__Supabase__*`, signifie que le serveur n'est pas
connecté à cette session : passer à la section « Sans le serveur ».

**Le serveur peut tomber en cours de session.** C'est arrivé, entre deux appels,
sans rien annoncer. Ne pas conclure qu'une manipulation a échoué : vérifier
d'abord que les outils répondent encore, et ne jamais présenter comme fait ce
qui n'a pas rendu de résultat.

## L'ordre de travail

### 1. Le projet — la seule étape qui se demande

`create_project` engage un compte et une facturation. `CLAUDE.md` réserve
l'aller-retour à trois cas, et « ce qui engage de l'argent » en fait partie :
demander avant, même quand tout le reste se décide sans demander. `get_cost`
puis `confirm_cost` disent le prix ; `list_organizations` donne l'organisation
d'accueil.

Un projet existant se rattache sans rien créer : `list_projects` puis
`list_tables` pour voir où il en est.

### 2. Le schéma — en migration, jamais en requête libre

```
apply_migration(project_id, name: "socle_initial", query: <contenu de supabase/schema.sql>)
```

`apply_migration` versionne : `list_migrations` en garde la trace, et le projet
raconte son histoire. `execute_sql` ne laisse rien — c'est le bon outil pour
regarder, le mauvais pour construire.

### 3. Les politiques — les éprouver, pas les relire

`supabase/verifier-rls.sql` tente depuis chaque rôle ce qui doit être refusé.
Il s'envoie par `execute_sql` et **pas** par `apply_migration` : ce n'est pas un
changement de schéma, c'est une transaction qui se termine par `rollback`.

Puis les advisors, qui regardent la base telle qu'elle est déployée :

```
get_advisors(project_id, type: "security")
```

Les deux sont complémentaires et aucun ne remplace l'autre : les advisors
signalent une table sans RLS ou une fonction `security definer` sans
`search_path` ; le script, lui, essaie les attaques et vérifie qu'elles
échouent.

Sur une base **déjà livrée**, ni l'un ni l'autre : `supabase/etat-rls.sql` ne
lit que les catalogues, sans rien écrire, et répond à la question qui se pose
après coup — la base ressemble-t-elle encore à ce que le dépôt décrit ? Un
schéma se modifie aussi facilement qu'il s'applique, un soir de débogage.

### 4. Les clés — et celle qu'on ne prend jamais

`get_project_url` et `get_publishable_keys` donnent les deux variables de
`.env.local`. La clé `service_role` contourne la RLS : elle n'a rien à faire
dans le dépôt, ni dans un fichier, ni dans un message.

### 5. Les types

`generate_typescript_types` produit `Database` depuis la base réelle. Le socle
`agence/` tient ses types à la main et l'explique dans `src/lib/types.ts` : deux
tables ne justifient pas une étape de génération à ne jamais oublier. Dès qu'un
projet client dépasse quelques tables, la génération devient le bon choix — et
le fichier écrit à la main doit alors disparaître, pas cohabiter.

## Ce qui a été éprouvé, et ce qui ne l'a pas été

Cette distinction vaut mieux qu'une confiance mal placée :

- **Vérifié en session** : `list_projects` et `list_tables` répondent, et
  montrent le projet `socle-agence-banc-essai` (PostgreSQL 17, `eu-west-1`) avec
  le schéma du socle déjà appliqué — `profiles` et `projects`, RLS active.
- **Non vérifié** : le passage de `verifier-rls.sql` par `execute_sql`. Le
  serveur s'est déconnecté avant l'essai. Le script est en revanche prouvé sur
  un PostgreSQL réel (localement et en intégration continue), y compris par
  mutation. Ce qui reste inconnu est le comportement de `execute_sql` face à un
  script multi-instructions encadré par `begin`/`rollback`.

En conséquence : **l'éprouver d'abord sur un projet jetable**, jamais
directement sur la base d'un client. S'il ressort une erreur de transaction
plutôt qu'un verdict, passer par l'éditeur SQL — chemin éprouvé — et le noter
ici.

## Sans le serveur

Rien n'est perdu, tout prend quelques minutes de plus. Dans le tableau de bord
du projet :

1. **SQL Editor > New query** : coller `supabase/schema.sql`, exécuter.
2. Même chose avec `supabase/verifier-rls.sql`. Aucun message signifie que tout
   est conforme ; un contrôle qui échoue dit lequel, en français.
3. **Advisors** pour la relecture automatique du schéma déployé.
4. **Project Settings > API** pour l'URL et la clé publique.
5. **Authentication > URL Configuration** : l'adresse du site et
   `…/auth/confirmer` dans les redirections autorisées — sans quoi le lien de
   confirmation renvoie l'utilisateur vers `localhost` depuis la production.

Ce dernier point n'a pas d'équivalent MCP et s'oublie systématiquement : c'est
lui qui fait qu'une inscription « ne marche pas » sans autre indice qu'une page
de connexion qui revient.
