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
| Mot de passe oublié | `/mot-de-passe-oublie` | Envoi du lien de récupération |
| Nouveau mot de passe | `/nouveau-mot-de-passe` | Choix du mot de passe, sous la session ouverte par le lien |
| Tableau de bord | `/tableau-de-bord` | Indicateurs et cinq derniers projets |
| Projets | `/projets` | Liste filtrable par statut, filtre porté par l'URL |
| Fiche projet | `/projets/[id]` | Modification et suppression |
| Mon compte | `/compte` | Nom, entreprise, rôle attribué |
| Administration | `/administration` | Réservé au rôle `admin` : comptes, projets, montants |

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

Deux conséquences visibles à l'usage :

- **« Mot de passe oublié » répond la même chose dans tous les cas.** Dire
  « compte inconnu » transformerait le formulaire en outil de vérification
  d'adresses : on saurait, sans mot de passe, qui est client de l'agence.
- **`/administration` renvoie un 404 à qui n'est pas administrateur**, et non un
  refus : un refus confirmerait que la page existe et inviterait à insister.

## Montrer l'application à un client

Le socle démarre vide, et un tableau de bord à zéro ne se juge pas. Une fois
votre compte créé par le formulaire d'inscription :

```sql
set demo.compte = 'vous@exemple.fr';
\i supabase/demo.sql
```

Dix projets répartis sur les trois statuts, avec des montants et des dates
plausibles. Les données sont rattachées à **votre** compte, et pas à des
utilisateurs fictifs : la RLS ne montre un projet qu'à son propriétaire, donc
de faux comptes ne rempliraient l'écran de personne — et il faudrait leur
inventer un mot de passe, qui finirait versionné ici.

Le script refuse de s'exécuter sur une base qui porte d'autres comptes que le
vôtre : c'est le signe le plus simple qu'on n'est pas sur une base de
démonstration. Tout se retire d'une ligne, donnée en fin de fichier.

## Ce qu'exige une livraison en France

L'application collecte un nom, une entreprise et une adresse électronique. Trois
choses en découlent, et aucune n'est optionnelle.

**L'effacement du compte s'exerce depuis l'application.** L'article 17 du RGPD
donne droit à l'effacement ; le mettre derrière un courriel au support
reviendrait à ne pas l'accorder. La page « Mon compte » efface définitivement le
compte, le profil et tous les projets.

Techniquement, c'est le point le plus intéressant du socle. Supprimer un compte
touche `auth.users`, que la clé publique n'atteint pas — la voie habituelle est
d'appeler `auth.admin.deleteUser()` avec la clé `service_role`, celle qui
contourne toute la RLS. Loger ce passe-partout dans le serveur applicatif pour
un geste que l'utilisateur déclenche lui-même est un mauvais échange. La
fonction `public.supprimer_mon_compte()` fait le même travail depuis le schéma :
elle **ne prend aucun paramètre**, si bien que viser le compte d'un autre n'est
pas refusé — c'est impossible à formuler. Le reste part par les clés étrangères.

**Deux pages sont obligatoires**, et elles sont livrées en gabarit :
`/mentions-legales` (article 6-III de la LCEN) et `/confidentialite`
(articles 13 et 14 du RGPD). Ce qui dépend du client y est marqué **« à
compléter » en jaune, visible à l'écran** : un gabarit qui se déguise en page
finie part en production tel quel. Ce qui décrit le socle lui-même — les données
collectées, l'hébergement, l'effacement — y est en revanche affirmé, parce que
c'est constatable dans le code.

**Livrer avec un « à compléter » restant est un défaut de livraison.** C'est le
dernier contrôle à faire avant de rendre les clés.

## Nommer un administrateur

Le rôle ne se change pas depuis l'application — c'est tout l'objet des
privilèges de colonnes posés par le schéma. Il se donne depuis l'éditeur SQL de
Supabase :

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'vous@exemple.fr');
```

L'espace d'administration apparaît alors dans la navigation, en lecture seule :
les politiques `Un administrateur lit …` ouvrent la lecture, jamais l'écriture.
Modifier la fiche d'un client se fait avec lui, pas à sa place.

## Carte du code

```
supabase/schema.sql      tables, RLS, privilèges de colonnes, triggers
supabase/verifier-rls.sql  contrôle des politiques, sur une base jetable (CI)
supabase/demo.sql        dix projets de démonstration, pour un écran qui se juge
supabase/etat-rls.sql    contrôle de dérive, en lecture seule, sur la base d'un client
src/proxy.ts             rafraîchissement de session (ex-middleware, renommé en Next.js 16)
src/app/                 routes — (auth) public, (prive) sous session, auth/confirmer
src/components/ui/       briques d'interface (Shadcn/ui, écrites à la main)
src/components/          composants métier : formulaires, listes, navigation
src/lib/actions/         Server Actions — les seules écritures
src/lib/supabase/        clients serveur, session, proxy
src/lib/                 types de la base, validation Zod, formats d'affichage
src/lib/__tests__/       tests unitaires (node:test)
tests/                   résolveur d'alias et harnais du contrôle RLS
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
npm test            # tests unitaires (node --test, sans dépendance ajoutée)
npm run build       # build de production
npm run test:rls    # politiques de sécurité, sur un vrai PostgreSQL
```

Les cinq doivent passer avant toute livraison, et le workflow
`.github/workflows/agence.yml` les rejoue sur chaque poussée qui touche
`agence/`.

Le `build` n'est pas facultatif : il est le seul à voir ce que `tsc` laisse
passer dans une application App Router — une directive `'use client'`
manquante, une fonction passée en propriété d'un composant serveur, un export
non asynchrone dans un fichier `'use server'`. Il réclame les variables
d'environnement ; les valeurs de `.env.example` suffisent à le faire aboutir,
elles ne suffisent évidemment pas à faire fonctionner l'application.

Les tests unitaires couvrent ce qui se calcule hors navigateur et hors base :
validation des formulaires, statistiques du tableau de bord, rapprochement des
fiches clients, formats d'affichage, et le filtre anti-redirection ouverte.

### Les politiques de sécurité

Ni TypeScript, ni les tests unitaires, ni le build ne voient une politique RLS.
Une politique trop large ne se remarque qu'en production, et par la mauvaise
personne. `supabase/verifier-rls.sql` est le seul endroit où la question « qui
peut lire quoi » reçoit une réponse vérifiée : il crée trois comptes, tente
depuis chacun ce qui doit être refusé, et annule tout à la fin.

**Sur le projet du client** : coller le fichier dans l'éditeur SQL de Supabase
et l'exécuter. Aucun message signifie que tout est conforme ; un contrôle qui
échoue dit lequel, en français. Rien n'est laissé derrière — la transaction est
annulée.

**En local ou en intégration continue** : le même fichier tourne sur un
PostgreSQL ordinaire, `tests/rls/socle-supabase.sql` fournissant ce que Supabase
apporte d'office (rôles, `auth.users`, `auth.uid()`, privilèges par défaut).

```bash
docker run --rm -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 --name pg postgres:16
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:rls
```

Les vingt contrôles ont été éprouvés par mutation : en rendant à `authenticated`
le privilège d'écriture sur toute la table `profiles` — le schéma d'origine du
cahier des charges — le script s'arrête sur *« FAILLE : un utilisateur peut
s'accorder le rôle administrateur »*. En élargissant la politique des projets à
`using (true)`, il s'arrête sur *« Alice voit des projets qui ne sont pas les
siens »*. Un contrôle qui ne casse jamais ne prouve rien.

## Sauvegarder la base d'un client

La sauvegarde d'un hébergeur protège de la panne, jamais de l'hébergeur. Un
projet suspendu pour impayé, une carte qui expire, un compte fermé — et les
données du client sont derrière une porte que personne n'ouvre. La copie qu'on
détient soi-même est la seule qui reste quand le fournisseur *est* le problème.

```bash
npm run sauvegarder -- "postgresql://postgres:MDP@db.PROJET.supabase.co:5432/postgres"
npm run restaurer -- ~/sauvegardes-agence/2026-09-04-1530
```

La première commande écrit quatre fichiers dans `~/sauvegardes-agence/<horodatage>` :
le schéma en clair (comparable à `supabase/schema.sql`, donc lisible comme un
relevé de dérive), les données au format propriétaire de PostgreSQL, les comptes
`auth` à part, et un **manifeste** qui compte les lignes table par table.

La seconde restaure dans une base locale jetable et **vérifie** : les comptes
reviennent-ils, la RLS est-elle réactivée, les politiques sont-elles là. C'est
la moitié qui manque partout — une sauvegarde planifiée jamais relue reste verte
pendant deux ans sur une base vidée par une migration ratée. `npm run
test:sauvegarde` joue l'aller-retour complet sur un PostgreSQL local : on
sauvegarde, **on détruit la base**, on restaure, on compte.

### Trois choses que ce chemin a apprises, et qu'il coûte cher de redécouvrir

**`pg_dump --schema=public` laisse dehors le déclencheur d'inscription.** Il vit
sur `auth.users`, un schéma que Supabase gère, mais il appelle une fonction de
`public` : sans lui, une base restaurée accepte de nouveaux comptes **sans jamais
leur créer de profil**, et rien ne le signale avant la première inscription
réelle. `sauvegarder.sh` le reprend explicitement, `restaurer.sh` exige sa
présence.

**Restaurer les comptes réveille ce déclencheur**, qui fabrique un profil vide
par compte — lesquels entrent aussitôt en collision avec les vrais profils de la
sauvegarde (`duplicate key value violates unique constraint`). L'ordre est
contraint : les comptes d'abord, puisque `profiles.id` les référence. On efface
donc ce que le déclencheur vient d'inventer avant de poser ce que la sauvegarde
contient. Chaque moitié est juste ; c'est leur enchaînement qui casse.

**`pg_dump` refuse un serveur plus récent que lui**, et les projets Supabase de
ce compte tournent en **PostgreSQL 17** (mesuré le 04/09/2026) quand cette
machine porte un client **16.13**. Le script s'arrête donc net avec le remède
plutôt que de laisser lire une erreur anglaise au milieu d'une sortie longue.
Concrètement : la sauvegarde d'un vrai projet demande un client PostgreSQL 17,
ou un `docker run --rm postgres:17`. L'aller-retour, lui, est éprouvé de bout en
bout en 16 — c'est le mécanisme qui est prouvé, pas la connexion à Supabase.

Deux refus de plus, chacun payé une fois : le **pooler** (port 6543) ne sait pas
servir `pg_dump`, et une sauvegarde **n'entre jamais dans un dépôt Git** — elle
porte les données personnelles des utilisateurs du client. Le script vérifie les
deux avant d'écrire quoi que ce soit.

### Ce que la sauvegarde ne contient pas

Les fichiers du stockage Supabase, les fonctions edge et leurs secrets, les
variables d'environnement de l'hébergeur, et les réglages du projet
(fournisseurs d'authentification, SMTP). Le manifeste le répète dans chaque
sauvegarde, pour qu'on ne l'apprenne pas le jour de la restauration.

## Déployer

N'importe quel hébergeur Node ou Vercel. Les trois variables de `.env.example`
sont à déclarer côté hébergeur.

**`NEXT_PUBLIC_SITE_URL` mérite sa propre ligne**, parce que c'est la seule dont
l'oubli ne se voit nulle part. Les deux variables Supabase manquantes font
échouer la construction, avec leur nom dans le message ; celle-ci se repliait
sur `localhost`, et le site se construisait, se déployait et s'affichait
normalement — pendant que **chaque courriel de confirmation et de
réinitialisation envoyait le client vers sa propre machine**. Personne ne
pouvait créer de compte ni récupérer le sien, et aucune page ne le montrait.

Elle lève donc désormais en production, et sa valeur est normalisée :

| Valeur déclarée | Ce qui se passe |
| --- | --- |
| absente ou vide | l'inscription échoue en nommant la variable |
| `https://client.fr/` | la barre finale est retirée — sinon `//auth/confirmer`, que la liste blanche de Supabase refuse au caractère près |
| `https://client.fr/espace?utm=1` | ramenée à l'origine seule |
| `client.fr` | refusée : sans protocole, le lien du courriel est relatif, donc mort |

Le pendant côté Supabase se règle dans **Authentication → URL Configuration** :
la même adresse en *Site URL*, et `https://client.fr/auth/confirmer` dans les
*Redirect URLs*. Les deux listes doivent dire la même chose.

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
