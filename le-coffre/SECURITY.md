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
