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

**Ce que ça n'inclut pas encore** : aucune alerte proactive (e-mail avant
l'échéance). L'échéance détectée est chiffrée comme le reste de l'index —
visible seulement une fois le coffre déverrouillé. Un serveur ne peut donc
pas savoir qu'il faut prévenir quelqu'un sans que cette personne ait d'abord
rouvert l'application. Décision de périmètre à trancher séparément :
chiffrer la date (comme aujourd'hui, pas d'alerte proactive possible) ou la
stocker en clair sans le contenu du document (alerte proactive possible, au
prix d'exposer qu'une échéance existe à telle date).

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

## Ce qui reste fragile — non corrigé pour l'instant

- **Pas de limite de taille sur les dépôts** : un fichier de plusieurs centaines
  de Mo peut ralentir ou bloquer l'onglet (chiffrement en mémoire, sans
  découpage), même limite connue que la version locale.
- **Pas de tests automatisés** pour `src/lib/coffre.ts` ni `src/lib/crypto.ts` —
  seulement la vérification manuelle faite à l'écriture (création de compte,
  création de coffre, dépôt, liste).
- **Le lien magique de connexion expire et se régénère par e-mail** : un compte
  e-mail compromis permet de se reconnecter, mais pas de lire le coffre sans la
  phrase secrète — cohérent avec la séparation des deux secrets ci-dessus, à
  garder en tête si l'un des deux est un jour affaibli.
- **Aucune limite de débit sur les tentatives de déverrouillage** posée côté
  application : rien n'empêche aujourd'hui un grand nombre de tentatives de
  phrase secrète contre le vérificateur chiffré stocké dans `coffre_cles` — à
  poser avant un vrai lancement public (limite de tentatives, ou repli sur les
  quotas par défaut de l'API Supabase).
