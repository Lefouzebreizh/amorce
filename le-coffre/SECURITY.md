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
gère qui peut se connecter (identifiant public + mot de passe de compte, sans
exposer l'adresse e-mail à l'écran de connexion). La phrase secrète du coffre
reste un secret entièrement différent, qui n'atteint jamais ce service —
perdre l'un ne compromet pas l'autre, et retrouver l'accès au compte ne redonne
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

## Mode privé par défaut, IA seulement sur une action explicite

Depuis le 25/09/2026, l'import classique reste privé par défaut, tandis que
trois actions clairement nommées réactivent l'assistance intelligente :
« Photographier et ranger », « Analyser un dossier complet » et l'envoi d'une
question au copilote.

Lors d'un import classique, le navigateur attribue seulement une catégorie générale
selon le type MIME (`Papiers`, `Images`, `Vidéos`, `Audio`, `Autre`). Il ne lit
pas le contenu pour deviner un émetteur, un montant ou une échéance. Ces champs
restent donc à confirmer ou compléter par l'utilisateur.

« Photographier et ranger » envoie uniquement la photo qui vient d'être prise à
`classer-document`. La fonction la transmet à Gemini 2.5 Flash pour proposer
un nom, une catégorie et une éventuelle échéance. La fonction Supabase ne la
conserve pas. Sur le niveau gratuit retenu pour éviter tout abonnement, Google
indique cependant pouvoir utiliser les données transmises pour améliorer ses
produits ; l'interface le signale avant le choix de la fonction. Si la
lecture est incertaine ou échoue, le fichier revient dans une fiche à vérifier ;
il n'est jamais rangé au hasard. S'il est lisible, il est chiffré dans le
navigateur puis stocké dans le dossier proposé.

« Analyser un dossier complet » applique le même traitement, fichier par
fichier, aux PDF, images et textes compatibles. Le chemin relatif est transmis
comme indice faible afin de mieux conserver le contexte d'un dossier, sans
remplacer la lecture du contenu. Gemini peut proposer une catégorie existante
ou un nouveau nom de dossier court ; le serveur rejette les noms vides, trop
longs ou contenant des caractères de chemin. Un format non pris en charge, une
lecture incertaine ou une erreur rejoint « À vérifier ». Le lot entier reste à
confirmer avant chiffrement et stockage.

Quand l'utilisateur envoie une question au copilote, `assistant-coffre` reçoit
la question et l'historique de cette conversation pour en garder le contexte.
Il ne reçoit aucun index, identité ou fichier du coffre par défaut. Les
documents disponibles n'entrent dans le contexte qu'après sélection explicite ;
le navigateur les déchiffre alors et transmet leur contenu à Gemini avec la
demande. Les pièces jointes sont limitées aux PDF, PNG/JPEG/WebP et texte,
cinq fichiers et 4 Mo cumulés par message. Le navigateur n'envoie jamais la
phrase secrète ni la clé de chiffrement. Une erreur Gemini est affichée : le
copilote ne simule pas une réponse de LLM par la recherche locale.

Gemini peut rechercher une information à jour, expliquer et comparer les
documents choisis, rédiger, retrouver un CERFA et proposer des actions. Toute
modification ou suppression reste confirmée avant exécution. Pour remplir un
formulaire, les champs sont lus dans le navigateur et les suggestions sont
présentées et modifiables avant la génération du PDF. Les données envoyées à
Google suivent les conditions de confidentialité du palier associé à la clé.

L'import privé classique, le classement manuel et la recherche locale restent
disponibles sans transmettre de document à Gemini. Si une fonction IA est
indisponible, cette panne apparaît dans l'interface et le parcours local reste
accessible ; aucun document n'est perdu.

## Fonctions IA : exposition limitée et garde-fous

`classer-document`, `assistant-coffre` et `suggerer-champs-formulaire` ne sont
jamais appelées au chargement, à l'ouverture d'un dossier ou pendant un import
privé. Elles ne le sont qu'après un clic ou un envoi explicite dont l'interface
explique les données concernées. Les trois fonctions exigent en plus une vraie
session Supabase vérifiée auprès de `/auth/v1/user` ; la clé publique anonyme ne
suffit pas à les appeler.

Trois gardes-fous resteront alors indispensables :

1. Le serveur ne retient une action que si son `nom` figure mot pour mot dans
   les pièces jointes de ce message — un nom halluciné ou approché est rejeté
   avant même de sortir de la fonction.
2. `nom` reste le nom affiché, jamais la clé opaque de stockage. Le navigateur
   refuse d'exécuter une action si plusieurs fichiers portent le même nom, au
   lieu d'en choisir un ou d'en modifier plusieurs au hasard.
3. Une suppression ne s'exécute jamais si plusieurs documents partagent le
   même nom affiché — l'ambiguïté est signalée plutôt que résolue en
   devinant lequel des deux effacer.
4. Une catégorie créée par Gemini est normalisée et limitée à 60 caractères ;
   les caractères de contrôle et de chemin sont rejetés.

## La lettre de résiliation : un gabarit fixe, jamais du texte deviné

Ajoutée le 04/09/2026, en version volontairement simplifiée par rapport à
`paper-manager/core/resiliation.py` (voir ce fichier pour la version
complète — quatre gabarits selon la situation juridique, calcul du préavis,
fondement légal précis). Le Coffre n'a que ce qu'une photo laisse voir :
catégorie, émetteur, référence client si visible, date d'échéance. Pas de
date d'engagement, pas de durée de préavis — donc pas de calcul de date
d'effet fiable, et un seul gabarit générique, jamais un article de loi cité.

**Le texte du gabarit est fixe, écrit dans le code — jamais généré librement
par Gemini.** En mode privé par défaut, les champs sensibles utiles à cette
lettre (émetteur, référence, date) doivent venir de l'utilisateur ou d'une
fiche déjà validée, jamais d'une lecture IA automatique. La formulation
elle-même ne varie pas. C'est le même principe que `paper-manager` : *le
gabarit garantit le fond, jamais le modèle.*

`emetteur`, `referenceClient`, `montant` et `texteExtrait` restent dans l'index
chiffré comme le reste quand ils existent. Aucun ne part vers une table en clair
(contrairement à la date d'échéance, seule donnée qui sort pour permettre
l'alerte).

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
service tiers. Une intégration calendrier **stockerait** le rendez-vous chez
ce tiers en continu, ce qui dépasse la promesse privée du produit. Écartée
pour cette raison.

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

- **Le mot de passe du compte et la phrase secrète restent deux secrets
  séparés** : un compte compromis permet de se connecter à l'espace, mais pas
  de lire le coffre sans la phrase secrète — cohérent avec la séparation des
  deux secrets ci-dessus, à garder en tête si l'un des deux est un jour
  affaibli.
