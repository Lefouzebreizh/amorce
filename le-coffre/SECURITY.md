# Sécurité — Le Coffre, version hébergée

Ce document adapte `life-organizer/SECURITY.md` (la version locale) au cas
hébergé multi-utilisateurs. Ce qui suit part de ce que ce document-là établit
déjà sur le chiffrement lui-même ; seul ce qui change avec l'hébergement est
détaillé ici.

## Ce qui ne change pas

Le modèle de chiffrement est identique, primitive pour primitive : PBKDF2-HMAC-
SHA256 (600 000 itérations) pour dériver une clé AES-256-GCM non extractible à
partir de la phrase secrète, entièrement dans `crypto.subtle` du navigateur.
Aucune bibliothèque de chiffrement tierce, aucun code de chiffrement côté
serveur. Voir `src/lib/crypto.ts`, porté ligne à ligne depuis
`life-organizer/modules/coffre/stockage.py` et le module `LOCoffre`.

## Ce qui change avec l'hébergement

**« Rien ne sort de ton appareil » devient « rien de lisible ne sort de ton
appareil ».** En local, les octets chiffrés ne quittent jamais la machine. Ici,
ils partent vers Supabase (Storage pour les documents, Postgres pour l'index et
les informations de clé) — c'est le prix de l'accès depuis n'importe quel
navigateur, sans rien installer. Ce qui ne change pas : ces octets restent
inexploitables sans la phrase secrète, qui elle ne part jamais.

**L'isolement entre comptes est appliqué par des policies, pas par un dossier
séparé.** En local, un seul utilisateur ; l'isolement n'avait pas de sens. Ici,
Row Level Security Postgres (`auth.uid() = user_id` sur `coffre_cles` et
`coffre_index`) et une policy Storage équivalente sur `storage.objects`
(`(storage.foldername(name))[1] = auth.uid()::text`) empêchent un compte de
lire ou d'écrire les lignes ou les objets d'un autre — vérifiées à chaque
requête, côté serveur, jamais laissées à la bonne volonté du client.

**Un compte technique s'ajoute, distinct de la phrase secrète.** Supabase Auth
gère qui peut se connecter (lien magique par e-mail, pas de mot de passe de
compte). La phrase secrète du coffre reste un secret entièrement différent, qui
n'atteint jamais ce service — perdre l'un ne compromet pas l'autre, et
retrouver l'accès au compte (en cas d'e-mail changé, par exemple) ne redonne
jamais accès au contenu si la phrase secrète est oubliée.

## Ce que Supabase peut voir, techniquement

Le fournisseur d'hébergement a un accès infrastructure au disque qui porte la
base de données et le stockage — c'est vrai de tout hébergeur, ce point ne peut
pas être éliminé sans opérer soi-même l'infrastructure. Ce que le chiffrement
côté client empêche : que ce dernier lise le **contenu**, y compris avec cet
accès infrastructure. Ce qu'il ne cache pas, comme en local (voir
`life-organizer/SECURITY.md`) : le nombre et la taille des objets, les dates de
dépôt, et — nouveau ici — l'adresse e-mail associée au compte (nécessaire pour
l'authentification, jamais liée au contenu déchiffré).

## Le classement automatique : une exception explicite à « rien de lisible ne sort »

Depuis l'ajout de la fonction `classer-document` (04/09/2026), un document
déposé est envoyé **en clair** à cette fonction Supabase, qui le transmet à
l'API Claude (lecture en vision) pour proposer une catégorie, un nom, et une
échéance éventuelle — avant chiffrement. C'est la seule exception à « ce
serveur ne voit jamais le contenu en clair » de tout ce projet, et elle est
volontaire : impossible de proposer un classement sans lire le document.

Ce qui limite cette exception : la fonction ne conserve rien (pas d'écriture
disque, pas de trace en base — voir le commentaire en tête de
`supabase/functions/classer-document/index.ts`), le fichier est chiffré côté
navigateur juste après comme avant, et **rien n'est jamais appliqué sans
validation explicite** — l'utilisateur voit la proposition (catégorie, nom,
échéance) avant que le dépôt n'ait lieu, jamais après coup.

**Le modèle peut se tromper, et l'a fait à l'essai** : testé sur une image
sans contenu, `claude-sonnet-4-5` a d'abord inventé une catégorie, un nom de
fichier et une échéance avec « confiance haute » — un vrai risque pour une
fonctionnalité dont le métier est justement d'annoncer des dates limites.
Corrigé en ajoutant un champ `lisible` explicite au format attendu, une
consigne stricte de ne jamais deviner, et `temperature: 0`. Revérifié ensuite
sur la même image : plus aucune invention. Cela ne garantit pas l'absence
totale d'erreur sur un vrai document ambigu — d'où l'obligation de validation
humaine avant tout dépôt, qui reste la vraie garde-fou, pas le prompt.

## L'assistant conversationnel : une deuxième exception, plus étroite

Depuis l'ajout de la fonction `assistant-coffre` (06/09/2026), une question posée
dans le panneau « Demander au coffre » part vers cette fonction, qui la transmet
à l'API Claude — **jamais les fichiers eux-mêmes**, seulement un résumé par
document (`digestIndex` dans `src/lib/coffre.ts`) : nom, catégorie, type,
émetteur, montant, libellé et date d'échéance, et jusqu'à 200 caractères du
`texteExtrait` (lui-même déjà plafonné à 500 caractères à l'analyse — voir plus
bas). C'est plus étroit que l'exception de `classer-document` : celle-là voit le
document entier une fois, à l'instant du dépôt ; celle-ci ne voit jamais que ce
résumé, à chaque question posée, aussi longtemps que le panneau reste ouvert.

**Ce que ça permet** : retrouver un papier par une question en langage courant
(« mes photos », « le papier de la mutuelle »), et — via l'outil de recherche
web hébergé par Claude, plafonné à trois recherches par question
(`RECHERCHES_WEB_MAX`) — répondre à une vraie question générale (démarche
administrative, définition) qui déborde de la paperasse personnelle. La
fonction ne conserve rien, comme `classer-document`, et la réponse précise
elle-même si elle s'appuie sur une recherche web (`rechercheWebEffectuee`)
plutôt que de laisser confondre les deux sources.

**Ce que le prompt interdit explicitement** : citer un document (`documentsCites`)
qui n'est pas dans la liste transmise, ou deviner un fait sur un papier plutôt
que de répondre qu'il ne le trouve pas. Le client revérifie quand même côté
navigateur (`nomExistant` dans `AssistantCoffre.tsx`) avant d'afficher un lien
cliquable vers un document cité — une garantie de plus, indépendante du prompt,
si jamais Claude recopiait mal un nom.

## La lettre de résiliation : un gabarit fixe, jamais du texte deviné

Ajoutée le 04/09/2026, en version volontairement simplifiée par rapport à
`paper-manager/core/resiliation.py` (voir ce fichier pour la version
complète — quatre gabarits selon la situation juridique, calcul du préavis,
fondement légal précis). Le Coffre n'a que ce qu'une photo laisse voir :
catégorie, émetteur, référence client si visible, date d'échéance. Pas de
date d'engagement, pas de durée de préavis — donc pas de calcul de date
d'effet fiable, et un seul gabarit générique, jamais un article de loi cité.

**Le texte du gabarit est fixe, écrit dans le code — jamais généré librement
par Claude.** Seuls les champs (émetteur, référence, date, identité)
viennent du modèle ou de l'utilisateur ; la formulation elle-même ne varie
pas. C'est le même principe que `paper-manager` : *le gabarit garantit le
fond, jamais le modèle.*

`emetteur`, `referenceClient`, `montant` et, depuis le même jour,
`texteExtrait` (jusqu'à 500 caractères du texte lisible sur le document)
sont désormais aussi demandés à `classer-document`, dans le même appel que
la catégorie et l'échéance — pas un second moment d'exposition. La
consigne de ne jamais deviner s'applique pareil : `null` plutôt qu'un
champ recalculé ou déduit. Tous restent dans l'index chiffré comme le
reste ; aucun ne part vers une table en clair (contrairement à la date
d'échéance, seule donnée qui sort pour permettre l'alerte).

`texteExtrait` sert uniquement à `rechercheCorrespond` (`src/lib/coffre.ts`) :
une recherche filtre les documents déjà déchiffrés, entièrement côté
navigateur, sur leur nom, catégorie, émetteur et ce texte — jamais une
requête envoyée où que ce soit. Il n'est jamais affiché tel quel dans
l'interface, seulement comparé.

**Toujours présentée comme un brouillon** : la fonction qui compose la
lettre (`composerLettreResiliation`, purement côté navigateur, aucun appel
serveur) liste explicitement les mentions manquantes (référence client non
lue, notamment) plutôt que de les taire — contrairement à `paper-manager`
qui refuse de produire un courrier incomplet, ici on préfère montrer un
brouillon imparfait à corriger plutôt que rien.

L'identité de l'utilisateur (nom, adresse) est chiffrée dans l'index comme
le reste — ne sert qu'à remplir l'en-tête de la lettre, jamais transmise
ailleurs.

## L'alerte proactive : la date seule sort en clair, rien d'autre

Décision tranchée le 04/09/2026 : plutôt que de garder l'échéance entièrement
chiffrée (ce qui interdirait toute alerte tant que personne n'a rouvert
l'application), sa **date seule** part aussi, en clair, vers une table séparée
(`coffre_echeances` : `user_id`, `date`, et le nom opaque de l'objet — déjà
sans signification, utile seulement pour retirer la ligne si le document est
supprimé). Le nom du document, sa catégorie et son libellé restent
exclusivement dans l'index chiffré, comme avant.

Ce que ce compromis expose : qu'une échéance existe, à telle date, pour tel
compte — rien sur sa nature. Ce qu'il permet : une fonction serveur
(`envoyer-alertes-echeances`), programmée une fois par jour via `pg_cron`,
qui cherche les échéances proches non encore signalées et envoie un e-mail
via Resend (domaine `erwannchevallier.com`, vérifié) — sans jamais nommer le
document dans le message. Protégée par un secret partagé (`x-cron-secret`,
distinct de la vérification JWT standard) : rien d'autre que la tâche
planifiée ne peut la déclencher.

**Vérifié de bout en bout, pas seulement en théorie** : la fonction a été
testée avec une vraie échéance insérée directement en base, un vrai envoi via
l'API Resend, et une vraie réception confirmée dans la boîte mail cible —
pas seulement une réponse API à 200.

Comme pour `service_role`, un même piège de GRANT manquant a été retrouvé et
corrigé sur `coffre_echeances` (la clé service_role contourne RLS mais pas
les droits de base sur la table) :

```sql
grant select, insert, update, delete on public.coffre_echeances to service_role;
```

## Le calendrier : un fichier .ics local, jamais une intégration Google/Apple

Ajouté le 06/09/2026, à la demande d'Erwann : pouvoir mettre un rendez-vous
dans le calendrier du téléphone, avec un rappel avant l'heure. Deux voies
existaient — une vraie intégration à un service de calendrier (Google
Agenda, iCloud), ou un fichier généré localement. La première aurait exigé
d'envoyer le libellé du rendez-vous (« Dentiste, cabinet Martin ») à un
service tiers, ce que rien d'autre dans ce projet ne fait — la seconde
exception explicite, après le classement automatique et l'assistant, mais
plus large qu'elles deux : celles-ci ne gardent rien après lecture, une
intégration calendrier **stockerait** le rendez-vous chez le tiers en
continu. Écartée pour cette raison.

`genererICS` (dans `coffre.ts`) construit donc un fichier iCalendar
(RFC 5545) **entièrement dans le navigateur**, à partir de ce que
l'utilisateur voit déjà à l'écran — aucun appel réseau, aucune clé, aucun
compte. Le fichier est téléchargé (`ajouterAuCalendrier` dans `page.tsx`,
même mécanique que le téléchargement d'un document) et c'est l'utilisateur
qui l'ouvre ensuite avec l'application calendrier de son choix : Le Tiroir
Secret ne sait pas laquelle, et n'a pas besoin de le savoir.

L'heure d'un rendez-vous suit exactement la même règle que son libellé :
stockée uniquement dans l'index chiffré, jamais transmise en clair à
Supabase (seule la date l'est déjà, voir la section précédente sur
l'alerte proactive). Sans heure, l'export produit un événement en journée
entière, sans rappel — une alarme relative à minuit n'aurait aucun sens.

## Suppression : une garantie plus faible qu'en local, à le dire

La version locale écrase le contenu du fichier (deux passes aléatoires puis des
zéros) avant de l'effacer — voir `life-organizer/SECURITY.md`, section
« Suppression réelle et irréversible ». **Cette étape n'existe pas ici** :
`supprimerFichier` appelle `storage.remove()`, l'API standard de Supabase
Storage, qui ne propose pas d'écrasement en place. L'objet cesse d'être
accessible immédiatement par l'API, mais son effacement physique réel côté
infrastructure S3-compatible de Supabase n'est pas une garantie que ce projet
peut vérifier ni tenir — exactement le même aveu que la version locale fait déjà
pour un SSD, un cran plus loin puisque l'infrastructure elle-même échappe à ce
dépôt.

## Deux bugs de configuration réels, trouvés et corrigés (03/09/2026)

Ni l'un ni l'autre n'est un défaut de conception documenté ci-dessus — deux
erreurs de configuration Supabase, distinctes du modèle de chiffrement, qui
ont chacune rendu l'application totalement inutilisable jusqu'à leur
correction. À vérifier explicitement si la base ou le projet Auth sont un
jour recréés.

**GRANT manquant sur `coffre_cles` et `coffre_index`.** Les policies RLS
(`auth.uid() = user_id`) étaient correctement écrites, mais Postgres exige en
plus un droit de base sur la table pour le rôle `authenticated` — sans lui,
toute requête échoue en « permission denied » avant même que RLS n'entre en
jeu. Repéré en interrogeant `information_schema.role_table_grants`, avant
qu'aucun test de bout en bout n'ait réussi passé la connexion. Corrigé par :

```sql
grant select, insert, update on public.coffre_cles to authenticated;
grant select, insert, update on public.coffre_index to authenticated;
```

**Site URL / Redirect URLs pointaient vers un autre projet.** Le projet
Supabase « LIFE ORGANIZER » héberge plusieurs sites (dont un IPTV, sans
rapport). L'URL de redirection par défaut de Auth (Authentication → URL
Configuration) était restée réglée sur ce second site : après avoir cliqué
sur le lien magique, un utilisateur de Le Coffre atterrissait sur l'IPTV —
la connexion elle-même réussissait (session créée), seule la redirection
était fausse. Corrigé en réglant Site URL sur
`https://coffre-puce.vercel.app` et en ajoutant
`https://coffre-puce.vercel.app/**` aux Redirect URLs.

## Limite de taille, quota par compte et limite de tentatives (05/09/2026, revu le 07/09/2026)

**Taille des dépôts et espace total** : demande explicite du propriétaire le
07/09/2026 — raisonner en gigaoctets, voire en téraoctets, pas remonter le
chiffre existant. Le vrai garde-fou n'est donc plus seulement
`storage.buckets.coffre-objets.file_size_limit`, qui ne protège qu'un fichier
à la fois : un trigger Postgres (`coffre_verifier_quota`, voir
`supabase/schema.sql` §6) refuse tout dépôt qui ferait dépasser 100 Go par
compte, calculé sur ce qui est déjà présent. Le contrôle client dans
`surDepot` donne un message immédiat pour les deux limites, sans même
tenter le chiffrement — voir `TAILLE_MAX_OCTETS` (5 Go, plafonné par la
mémoire du navigateur qui chiffre le fichier entier d'un bloc) et
`QUOTA_TOTAL_OCTETS` (100 Go, extensible au téraoctet en changeant ce seul
chiffre) dans `src/app/coffre/page.tsx`. Les trois doivent rester
synchronisés : le trigger, le réglage de bucket et les deux constantes.

**Ça ne prend effet qu'après deux gestes que seul le propriétaire peut
faire** : passer l'organisation Supabase au palier Pro (25 $/mois — le
palier gratuit plafonne tout upload à 50 Mo quel que soit
`file_size_limit`, mesuré le 07/09/2026 via `get_organization`), et
appliquer la migration de `supabase/schema.sql` §6 sur le projet en
production. Écrire dans une base de production est une action rouge de
`CLAUDE.md` §5 : une session ne l'exécute pas seule.

**Tentatives de déverrouillage** : le serveur ne voit jamais la phrase
secrète, donc jamais si une tentative a réussi au moment où elle a lieu —
mais `deverrouillerCoffre` journalise le résultat juste après
(`coffre_tentatives`), et refuse d'aller plus loin au-delà de 10 échecs
récents (15 minutes glissantes). Un vérificateur à 600 000 itérations
PBKDF2 est déjà lent à attaquer ; ce compteur ajoute une barrière côté
serveur, indépendante du temps de calcul côté client.

## Tests automatisés (05/09/2026)

`src/lib/crypto.test.ts` et `src/lib/coffre.test.ts` (`npm run test`,
Vitest) — chiffrement/déchiffrement, dérivation de clé, empaquetage du
vérificateur, `iterationsSures` (jamais crue à la baisse), et
`composerLettreResiliation` (mentions obligatoires). **Un vrai bug trouvé à
l'écriture des tests** : le contrôle des mentions cherchait le mot
« confirmation », mais le gabarit écrivait « confirmer » — la lettre était
correcte, mais se signalait elle-même à tort comme incomplète. Corrigé dans
le même geste. Pas de test pour `src/app/coffre/page.tsx` (React, demande
un harnais différent) ni pour les fonctions Supabase (dépendent d'un
environnement Deno + réseau).

**Complété le même jour** : `statutEcheance` (les cinq bornes du badge
urgent/bientôt/calme) et une régression sur la fusion de l'index — Supabase
est simulé (`vi.mock('./supabase', ...)`) pour observer ce que
`deposerFichier`, `supprimerFichier`, `ajouterRendezVous` et
`supprimerRendezVous` écrivent réellement, sans réseau ni projet réel.

## Ce qui reste fragile — non corrigé pour l'instant

- **Le lien magique de connexion expire et se régénère par e-mail** : un compte
  e-mail compromis permet de se reconnecter, mais pas de lire le coffre sans la
  phrase secrète — cohérent avec la séparation des deux secrets ci-dessus, à
  garder en tête si l'un des deux est un jour affaibli.
