# Sécurité — le dépôt de documents, et le coffre chiffré

Ce document explique ce qui a été ajouté avec `modules/depot/` et
`modules/coffre/` (l'interface web de dépôt), pourquoi, et ce que ça couvre ou
pas.

---

## Texte de document envoyé en clair à l'API de vision

**Avant** : `modules/depot/traitement.py` envoyait jusqu'à 6000 caractères du
texte extrait d'un PDF déposé, tel quel, à l'API de vision distante — y compris
un IBAN ou un numéro de sécurité sociale s'il y en avait un, comme
`noyau/modele.py` le documentait déjà explicitement.

**Après** : `noyau/redaction.py` (nouveau) reconnaît par expression régulière
la forme d'un IBAN et d'un NIR (numéro de sécurité sociale), et les remplace
par un jeton neutre (`[IBAN MASQUÉ]`, `[NUMÉRO DE SÉCURITÉ SOCIALE MASQUÉ]`).
`preparer_contenu()` l'appelle sur le texte complet **avant** de le tronquer à
6000 caractères — dans cet ordre précisément, parce que tronquer d'abord
risquerait de couper un motif en deux et de le laisser passer à moitié.

**Ce que ça couvre** : les deux appels réseau du module (`classifier`,
`identifier_champs`) passent par `preparer_contenu()`, donc les deux en
bénéficient sans code dupliqué.

**Ce que ça ne couvre pas** — à lire avant de considérer la faille éteinte :

- **C'est un filet par motif, pas une preuve d'absence.** Un IBAN mal segmenté
  par l'OCR (un retour à la ligne au milieu, un chiffre mal reconnu), écrit
  dans une langue ou un format qui ne suit pas la forme attendue, ou tout autre
  identifiant sensible qui n'est ni un IBAN ni un NIR (un numéro de contrat,
  une adresse, un nom), continue de partir tel quel. Le module ne devine pas ce
  qu'est « sensible » en général, seulement ces deux formes précises.
- **L'image ou la frame vidéo n'est pas concernée.** Le masquage ne s'applique
  qu'à la branche « texte » (documents). Une photo ou une vidéo déposée part
  toujours en image vers l'API — c'est le comportement documenté du projet
  depuis l'origine (« une image ou un texte extrait part vers le modèle de
  vision, jamais le fichier entier », `organizer.py`), pas quelque chose que ce
  correctif change. Un IBAN visible à l'œil sur une photo d'un document (plutôt
  qu'un PDF) n'est donc pas masqué : le masquage travaille sur du texte, pas
  sur une image.
- **Vérifiable** par `tests/test_redaction.py`, qui couvre la forme espacée et
  collée d'un IBAN, la forme vue sur un vrai document de paie pour un NIR
  (groupes collés, barre avant la clé), et l'ordre masquage-puis-troncature.

## Ce qui a changé, en un coup d'œil

| Fichier | Changement |
|---|---|
| `noyau/redaction.py` | Nouveau — masquage IBAN/NIR par expression régulière |
| `modules/depot/traitement.py` | `preparer_contenu()` masque le texte avant de le tronquer et de l'envoyer |
| `tests/test_redaction.py` | Nouveau — 7 tests |

---

# Le coffre — stockage chiffré de bout en bout

Section ajoutée sur un périmètre différent du masquage IBAN/NIR ci-dessus :
pas un correctif sur l'existant, une nouvelle capacité — `modules/coffre/`, les
routes `/api/coffre/*` de `interface_web/serveur.py`, et le module `LOCoffre`
de `interface_web/index.html`. Elle répond à un besoin
explicite : un espace où déposer des documents sensibles (papiers
administratifs, photos) avec la garantie que ni ce serveur, ni un accès direct
au disque ou au compte Google Drive qui l'héberge, ne peuvent lire leur
contenu sans la phrase secrète choisie par l'utilisateur.

## Ce qui est chiffré, et comment

**Chiffrement entièrement côté client**, avec l'API Web Crypto du navigateur
(`crypto.subtle`) — aucune bibliothèque de chiffrement tierce, aucun code de
chiffrement côté serveur :

- **Dérivation de clé** : PBKDF2-HMAC-SHA256, 600 000 itérations, sel aléatoire
  de 16 octets propre à ce coffre. La clé dérivée est une `CryptoKey`
  **non extractible** : même la console du navigateur ne peut pas en sortir
  les octets bruts, seulement l'utiliser pour chiffrer/déchiffrer.
- **Chiffrement du contenu** : AES-256-GCM (chiffrement authentifié — toute
  altération du texte chiffré fait échouer le déchiffrement plutôt que de
  rendre un contenu corrompu sans le dire), IV aléatoire de 12 octets par
  fichier, jamais réutilisé.
- **Vérification de la phrase secrète** : un texte constant, chiffré une fois
  à la création du coffre, est le seul « vérificateur ». Retaper la phrase
  secrète tente de le déchiffrer ; l'échec de l'authentification GCM (pas une
  comparaison de mot de passe) dit si elle est correcte. Le sel et ce
  vérificateur chiffré sont les deux seules choses que le serveur stocke à
  propos de la phrase secrète — comparables à un hachage de mot de passe
  classique : ils ne permettent de retrouver ni la phrase, ni la clé.
- **Noms opaques** : chaque document est stocké sous un identifiant aléatoire
  de 32 caractères hexadécimaux (`modules/coffre/stockage.py:nom_opaque`),
  sans extension ni rapport avec le nom d'origine. Le nom réel, la catégorie et
  la date de dépôt vivent **uniquement** dans un index, lui-même chiffré de la
  même façon (AES-256-GCM) et stocké comme un blob opaque (`_index.enc`) — le
  serveur ne le déchiffre jamais, il ne fait que le stocker et le rendre tel
  quel.

**Ce que ça veut dire concrètement** : un accès direct au dossier
`coffre.dossier` (`G:/Mon Drive/Life-Organizer/Coffre` par défaut) — depuis
l'Explorateur, un accès au compte Google Drive qui le synchronise, ou une
inspection du disque — ne montre que des noms de fichiers aléatoires et des
octets sans structure reconnaissable. Vérifié en pratique lors de la mise en
place : un document de 625 octets déposé produit un blob de 653 octets (625 +
12 d'IV + 16 d'étiquette d'authentification GCM) dont les premiers octets ne
correspondent à aucune signature de fichier connue.

## Ce que l'administrateur peut et ne peut pas voir

**Ne peut pas voir**, y compris moi (Claude) en tant que constructeur de ce
système, y compris Erwann en tant qu'administrateur de cette machine, sans la
phrase secrète :
- Le contenu d'aucun document déposé dans le coffre.
- Le nom d'origine, la catégorie ou la date de dépôt d'aucun document (tout
  vit dans l'index chiffré).
- La phrase secrète elle-même, ni la clé qui en dérive : aucun des deux
  n'atteint jamais ce serveur, sous aucune forme, à aucun moment.

**Peut voir**, sans avoir besoin de la phrase secrète :
- Le nombre de documents présents dans le coffre et leur taille en octets
  (une simple liste de fichiers sur le disque, via `lister_blobs`).
- Les dates de modification des fichiers au niveau du système de fichiers.
- Que le coffre existe et a été initialisé (`_cle.json` présent) — pas son
  contenu.

**Exception ponctuelle et documentée — l'analyse par l'IA** : le classement
automatique d'un fichier déposé (`/api/depot/analyser`) et la lecture des
champs d'un document administratif (`/api/depot/champs`) continuent de lire le
contenu **en clair**, exactement comme pour un dépôt non chiffré — c'est un
choix explicite (l'alternative aurait supprimé ces deux fonctionnalités pour
tout fichier passé par le coffre). Ce moment est :
- **transitoire** : le fichier n'est jamais écrit en clair sur disque à cette
  étape (il vit en mémoire côté navigateur jusqu'au chiffrement, et dans
  `interface_web/_depot_temp/` en clair uniquement le temps de l'appel à
  l'API de vision, comme pour tout dépôt — purgé sous 24h par
  `_purger_depot_temp`, indépendamment du coffre) ;
- **signalé à l'utilisateur** : la case « Stocker chiffré dans le coffre »
  affiche, dès qu'elle est cochée, la phrase *« Le contenu a été lu
  brièvement, en clair, par l'analyse ci-dessus pour proposer une catégorie —
  il n'est jamais conservé en clair : seule la version chiffrée sera
  stockée. »* — jamais une case cochée en silence sans que l'utilisateur sache
  ce qui se passe réellement ;
- **partiellement atténué pour les PDF** par le masquage IBAN/NIR ci-dessus : le texte
  extrait d'un PDF est masqué (IBAN, NIR) avant cet envoi. Une **photo** d'un
  document administratif (pas un PDF) part en image vers l'API sans ce
  masquage — le masquage par expression régulière ne s'applique qu'au texte,
  pas à ce qu'une IA de vision « lit » sur une image.

Ce que ce projet **ne fait pas** : un chiffrement homomorphe ou une analyse
qui se ferait sans jamais voir le clair. Ça n'existe pas de façon praticable
pour une classification d'image par un grand modèle de vision distant
aujourd'hui — le dire clairement plutôt que de prétendre un « bout en bout »
qui aurait une exception cachée.

## Suppression réelle et irréversible

`modules/coffre/stockage.py:supprimer_definitivement` écrase le contenu du
fichier (deux passes aléatoires puis une passe de zéros, par blocs d'un
mégaoctet) avant de l'effacer — la seule fonction de tout le projet, avec
`noyau.fichiers.purger_quarantaine`, autorisée à appeler `Path.unlink()`. Le
reste du projet ne supprime jamais rien (tout passe par la quarantaine,
`noyau/fichiers.py`) ; ce choix ne change pas cette règle pour le dépôt
normal, il ouvre une exception volontaire et isolée pour un document que
l'utilisateur choisit consciemment de détruire dans le coffre.

**Ce que « irréversible » couvre, précisément, et ce qu'il ne couvre pas :**

- **Sur le disque local, contenu mécanique (HDD)** : l'écrasement rend le
  contenu antérieur non relisible par une lecture standard du secteur.
- **Sur un SSD** (le cas le plus probable sur une machine récente) :
  l'écrasement **ne garantit rien**. Le contrôleur du SSD répartit les
  écritures sur des blocs physiques différents de ceux d'origine (usure
  répartie, *wear leveling*) — le système de fichiers voit le même fichier
  écrasé, mais les cellules physiques d'origine peuvent rester intactes
  ailleurs sur la puce jusqu'à leur propre effacement par le contrôleur. Ni ce
  projet, ni aucun logiciel au-dessus du système de fichiers, ne peut garantir
  l'effacement physique réel sur un SSD sans passer par une commande
  spécifique au contrôleur (`ATA Secure Erase`, `TRIM` massif) — hors du
  périmètre d'un outil applicatif.
- **Google Drive garde sa propre corbeille et son propre historique de
  versions**, côté serveur, hors de portée de ce projet. Le dossier
  `coffre.dossier` étant synchronisé par Google Drive Desktop, supprimer un
  blob localement le fait disparaître du dossier synchronisé, mais une
  version antérieure peut rester récupérable depuis la corbeille Drive ou
  l'historique de versions de Google, pendant la durée que Google retient —
  aucune API Drive n'est utilisée par ce projet pour vider cette corbeille-là.
  **Pour une suppression réellement complète, vider aussi la corbeille du
  compte Google Drive concerné, manuellement.**
- Ce que ce mécanisme garantit sans réserve : le fichier n'est plus lisible
  par le système de fichiers normal, immédiatement, et son entrée disparaît de
  l'index chiffré (donc de tout ce que l'interface peut retrouver).

## Sauvegarde séparée

Un bouton « Créer une sauvegarde » (panneau « Le coffre ») copie l'état actuel
du coffre — chaque blob déjà chiffré, tel quel, plus l'index chiffré — dans un
dossier daté sous `coffre.dossier_sauvegarde` (configuré dans
`organizer_config.json` / le `config.json` personnel). Aucun chiffrement
supplémentaire n'est appliqué à cette étape : chaque fichier copié est déjà
indéchiffrable sans la phrase secrète, une copie verbatim suffit.

**Option retenue, et le compromis, honnêtement** : la demande initiale
voulait un hébergement *physiquement séparé* du stockage principal — un
second compte ou un second service. Je n'ai pas de moyen de créer un second
compte cloud ou d'y obtenir des identifiants sans une action de l'utilisateur
lui-même (création de compte, ce qui reste une décision et un geste qui lui
appartiennent). Le réglage par défaut,
`coffre.dossier_sauvegarde: "~/Life-Organizer/CoffreSauvegardes"`, pointe donc
vers **un dossier local, distinct du dossier Drive principal, mais sur le
même disque physique et la même machine.**

Ce que ça protège : une erreur ou une corruption limitée au dossier principal
(un fichier écrasé par erreur, un souci de synchronisation Drive). Ce que ça
**ne** protège **pas** : la perte, le vol ou la destruction physique de cette
machine — les deux copies partagent le même sort dans ce cas. Pour une vraie
séparation, changer `coffre.dossier_sauvegarde` vers un disque externe
débranché entre deux sauvegardes, ou vers un second compte cloud distinct,
dès que l'un des deux existe — le mécanisme de copie ne change pas, seul le
chemin de destination compte.

## Mot de passe perdu : aucune récupération possible

Choix explicite et assumé : si la phrase secrète est oubliée, **rien n'est
récupérable**, par personne, y compris l'administrateur de cette machine. Il
n'existe ni clé de secours, ni porte dérobée, ni contournement. C'est le prix
d'un chiffrement où la clé ne dépend que d'un secret que seul l'utilisateur
connaît — toute porte de récupération serait, par construction, une porte que
quelqu'un d'autre pourrait aussi utiliser. Le formulaire de création du
coffre affiche cet avertissement explicitement avant la création, pas en
petit caractère après coup.

## Ce qui reste fragile — à lire avant de faire confiance à ce système

- **Le champ de mot de passe est un simple `<input type="password">`, pas un
  gestionnaire de mots de passe.** Un keylogger, une extension de navigateur
  malveillante, ou un accès physique à la machine pendant la saisie
  contournent entièrement ce chiffrement — comme pour toute saisie de mot de
  passe dans un navigateur.
- **La clé dérivée reste en mémoire JavaScript pendant toute la session**
  (jusqu'à la fermeture ou le rechargement de l'onglet). Un outil capable
  d'inspecter la mémoire du processus navigateur pendant que le coffre est
  déverrouillé pourrait théoriquement y accéder — hors de portée d'une page
  web ordinaire, mais pas nul pour un attaquant avec un accès complet à la
  machine à ce moment précis.
- **Aucune protection contre un mot de passe faible.** Seule contrainte
  appliquée : 10 caractères minimum. Rien n'empêche une phrase secrète
  devinable.
- **Pas de vérification d'origine sur les nouvelles routes `/api/coffre/*`
  en lecture (GET)** : cohérent avec le choix déjà fait pour `/api/depot/*`
  (seules les méthodes qui modifient quelque chose sont protégées par le
  contrôle `Origin`/`Referer`, voir `_refuser_hors_origine` dans
  `interface_web/serveur.py`) — mais un GET renvoie ici un blob chiffré, pas
  un contenu exploitable sans la clé, donc l'exposition réelle est plus
  faible que pour les autres routes.
- **Pas de limite de taille sur les documents envoyés au coffre ni sur
  `/api/depot/analyser`** — non corrigé ici.
- **Le coffre n'a été vérifié que sur un petit fichier de test** (dépôt,
  liste, téléchargement avec comparaison octet à octet de l'empreinte
  SHA-256, suppression réelle avec vérification sur disque) — pas sur des
  volumes réels ni sur des fichiers volumineux (vidéos). Le chiffrement
  AES-GCM du navigateur charge tout le fichier en mémoire d'un coup : un très
  gros fichier (plusieurs centaines de Mo) pourrait ralentir ou bloquer
  l'onglet, sans mécanisme de découpage en morceaux pour l'instant.
- **Pas de tests automatisés** pour `modules/coffre/` (contrairement à
  `tests/test_redaction.py` pour le masquage IBAN/NIR ci-dessus) — seulement
  la vérification manuelle décrite ci-dessus.
