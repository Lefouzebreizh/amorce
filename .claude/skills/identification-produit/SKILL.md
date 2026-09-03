---
name: identification-produit
description: "Corriger ce que Look & Find affiche après un scan — trancher d'abord entre une erreur du modèle et une erreur de lecture avec la réponse brute, puis corriger l'invite (`gemini_prompt.dart`) ou le DTO (`product_dto.dart`) sans jamais désynchroniser les deux. Couvre aussi les scans qui échouent avant toute fiche (modèle Gemini retiré, clé refusée, photo bloquée) et l'outillage qui remplace un aller-retour par l'APK. À utiliser dès qu'une fiche produit paraît fausse ou incomplète — prix fantaisiste ou à 0 €, marchand inventé, lien mort, dimensions absurdes, mauvaise catégorie, objet non reconnu, modèle 3D absent, prix en dollars — dès qu'on colle une réponse JSON de Gemini, dès qu'on veut retoucher l'invite ou éprouver l'identification sur une photo, et dès que tous les scans échouent d'un coup. Ne pas attendre les mots « invite » ou « prompt » : « il s'est trompé d'objet », « ça affiche n'importe quoi », « le prix est bidon », « le lien marche pas » sont exactement le cas d'usage."
---

# Corriger ce que le modèle raconte

Tout le reste de Look & Find est verrouillé par des tests. L'identification, non :
elle dépend de ce qu'un modèle de langage voit sur une photo réelle. C'est le seul
endroit de l'application où l'on corrige sans pouvoir tout prévoir — d'où cette
recette, qui remplace l'intuition par deux mesures.

Lire `look_and_find/CLAUDE.md` pour les invariants ; ce document ne les répète pas.
Pour faire faire l'essai au propriétaire plutôt que le décrire à chaque fois,
`look_and_find/ESSAI-APPAREIL.md` est le protocole prêt à suivre — y renvoyer
plutôt que réexpliquer où trouver l'APK ou quoi scanner.

## 1. Trancher avant de corriger

Une fiche fausse a deux causes possibles, et **elles n'ont pas le même correctif** :

- le modèle s'est trompé → l'invite, `lib/features/scanner/data/datasources/gemini_prompt.dart` ;
- le modèle avait raison et on l'a mal lu → la lecture, `lib/features/product_detail/data/models/product_dto.dart`.

Corriger sans savoir laquelle, c'est une chance sur deux de durcir une invite déjà
correcte — et de rendre l'identification pire pour tous les autres objets.

La réponse brute tranche. Elle est dans l'application : icône `{}` en tête de fiche,
bouton « Copier ». Elle ne survit pas à la fermeture de l'application, donc **la
demander tôt**, avant de discuter du symptôme.

Une fois la réponse en main, ne pas la lire à l'œil — la faire passer par la vraie
lecture, qui dit mécaniquement ce qui se perd en chemin :

```bash
cd look_and_find
dart run tool/rejouer.dart reponse.json     # ou : … rejouer.dart - pour lire l'entrée standard
```

Le verdict qu'il rend est la réponse à la question ci-dessus. Ce qu'il liste sous
« ce qui s'est perdu » est imputable à la lecture ; ce qui reste faux après ce
filtre est imputable au modèle.

**Si la réponse brute n'est plus disponible** (application fermée, scan trop
ancien), ne pas rester bloqué : la même photo rejouée sur le banc d'essai (§5) rend
une réponse équivalente en cinq secondes. À défaut de photo, le tableau du §2 suffit
à décider dans la plupart des cas — mais il décide moins bien, et il faut le dire.

## 2. Le symptôme dit rarement le coupable

| Ce qu'on voit | Ce que ça vaut | Où corriger |
| --- | --- | --- |
| Prix moyen à 0 € | Le modèle a écrit « sur devis », « variable » ou une fourchette | Invite : exiger un nombre, jamais une plage |
| Prix en dollars | L'invite le dit déjà, le modèle l'a ignoré | Invite : répéter la devise **dans la description du champ** du schéma, pas seulement dans le texte |
| Marchand inexistant, lien mort | Le modèle fabrique des références produit | Invite : pointer la page de recherche du site, pas la fiche |
| Marchands manquants dans la fiche mais présents dans la réponse | Prix mal typé, `name` absent | Lecture : `_merchant` les écarte, `rejouer` dit lequel |
| Dimensions absurdes | Mesurées sur la photo au lieu du produit réel | Invite |
| Dimensions ignorées, projection AR sans repère | Unité inattendue (`in`, `"cm"` dans un texte) | Lecture : `_dimensions` |
| Catégorie « Autre » | Valeur hors énumération | Lecture d'abord (`ProductCategory.parse` retombe déjà), invite si c'est systématique |
| Pas de 3D alors qu'une URL est renvoyée | URL relative ou inventée | Les deux : l'invite ne doit demander une URL que si le modèle en connaît une réellement, et `_url` a raison de l'écarter |
| Alternatives plus chères que le produit | Consigne mal suivie | Invite |
| « Objet non identifié » sur une photo nette | `title` vide : le modèle a refusé | Invite, ou photo (cadre, lumière) |

Le tableau oriente ; il ne dispense pas du §1. Deux symptômes identiques ont déjà eu
deux causes différentes.

## 3. Corriger l'invite

Ce qui marche, dans cet ordre d'efficacité :

1. **Enrichir la `description` d'un champ du schéma.** Une contrainte posée à côté du
   champ est respectée bien plus souvent que la même phrase noyée dans l'instruction.
   C'est le levier le moins cher et le plus fiable.
2. **Ajouter une règle impérative** à `instruction`, formulée par la négative quand
   c'est un travers à empêcher (« n'invente jamais une référence exacte »).
3. **Restreindre le schéma** (`enum`, `required`) : ce que le schéma interdit, le
   modèle ne peut pas le renvoyer. Une contrainte structurelle bat toujours une
   consigne rédigée.

Ce qui ne marche pas : allonger l'invite. Chaque phrase ajoutée dilue les
précédentes, et les consignes déjà présentes ont chacune été payée d'un défaut
constaté — leur bloc de commentaire le dit. Avant d'ajouter, vérifier qu'aucune ne
couvre déjà le cas et n'est simplement mal placée.

**Éprouver le changement avant de le pousser** (§5) : une invite retouchée sans essai
sur une photo réelle est une hypothèse, pas un correctif.

## 4. Corriger la lecture

Deux règles tiennent tout `product_dto.dart`, et les deux sont des décisions, pas des
détails d'implémentation :

- **La lecture ne lève jamais sur un champ.** Refuser toute la fiche pour un prix
  marchand mal typé perdrait les six marchands corrects. Un champ illisible devient
  `null` ou une valeur de repli ; seule l'absence de `title` est fatale.
- **Ce qui est douteux est écarté, pas affiché.** Une URL sans schéma `http(s)` casse
  `url_launcher` ou fait tourner un chargement 3D sans fin. Assouplir un filtre
  demande de savoir ce qu'il protégeait.

Tout assouplissement s'écrit avec son test dans `test/features/product_dto_test.dart`,
**avec la forme réellement reçue en commentaire**. Ce fichier est la mémoire de ce que
le modèle renvoie vraiment ; une forme rencontrée puis oubliée reviendra.

## 5. Boucler sans passer par le téléphone

L'aller-retour complet — pousser, attendre l'APK, installer, rescanner — coûte vingt
minutes. Deux outils le raccourcissent, et **au moins un des deux est toujours
disponible** :

```bash
cd look_and_find

# Sans clé, sans réseau : une réponse déjà obtenue, rejouée par la lecture.
dart run tool/rejouer.dart reponse.json

# Avec une clé dans l'environnement : l'invite éprouvée sur une vraie photo, en 5 s.
export GEMINI_API_KEY=…
dart run tool/banc_invite.dart photo.jpg --brut reponse.json
dart run tool/banc_invite.dart --modeles
```

Le banc lit l'invite, le schéma, le modèle et la compression **dans les constantes du
dépôt** : ce qu'il montre est ce que l'application montrera. Ne jamais y recopier une
invite « pour essayer » — un banc qui diverge du code ne mesure plus rien.

La clé se demande au propriétaire, et **ne s'écrit ni dans le dépôt, ni dans un
secret GitHub** : une clé compilée est en clair dans le binaire, et c'est la raison
pour laquelle il n'y en a pas. Un `export` dans la session suffit et ne survit pas.

## 6. Quand il n'y a pas de fiche du tout

Un scan qui échoue avant toute fiche ne relève ni de l'invite ni de la lecture. Le
message affiché nomme déjà le cas (`app_exception.dart`) :

- **« Le modèle … n'est plus servi par Google »** — Google arrête ses modèles à date
  annoncée, et tous les scans tombent alors ensemble, sur tous les appareils, sans
  qu'une ligne du dépôt ait bougé. `dart run tool/banc_invite.dart --modeles` dit ce
  qui est servi ; le correctif est `AppConfig.geminiModel`. Depuis un téléphone, sans
  outil : ouvrir `https://generativelanguage.googleapis.com/v1beta/models?key=LA_CLÉ`
  dans le navigateur donne la même liste.
- **« Clé d'API refusée »** — clé expirée, restreinte à un autre domaine, ou API
  Generative Language non activée sur le projet. Se ressaisit dans « Ma liste » ▸ 🔑.
- **« Cette photo a été refusée par le service »** — filtres de sécurité (visage,
  document personnel). Reprendre la même photo échouera toujours ; le dire, plutôt
  que proposer « Réessayer ».
- **« Trop de scans en peu de temps »** — quota par minute de la clé gratuite.

## 7. Le pacte entre l'invite et la lecture

`gemini_prompt.dart` déclare ce que le modèle doit renvoyer, `product_dto.dart` ce
qu'on sait en lire. **Modifier l'un sans l'autre fait disparaître un champ en
silence** : soit le modèle le renvoie et personne ne le regarde, soit la fiche
l'attend et il n'arrive jamais. Aucun test métier ne peut le voir, puisque chacun
choisit son propre JSON d'exemple.

`test/features/contrat_invite_lecture_test.dart` le vérifie mécaniquement : il
fabrique un JSON depuis le schéma, le fait passer par la lecture et le ré-sérialise.
Un champ qui ne revient pas est un champ oublié, et le message nomme les deux
fichiers. Ajouter un champ, c'est donc : le schéma, sa lecture dans `toEntity`, son
écriture dans `fromEntity`, son affichage — et ce test qui redevient vert sans qu'on
l'ait touché. S'il faut le modifier pour le faire passer, c'est le signe qu'on
contourne le pacte plutôt que de le tenir.

## 8. Terminer

`/verifier` (analyse, tests, code généré), puis `/steward` pour mener la PR. Deux
points qui ont déjà coûté du temps ici :

- La CI ne se déclenche **pas** à l'ouverture d'une PR, seulement à une poussée. Et un
  commit poussé après un déclenchement manuel invalide le verdict — ou ne relance rien
  s'il ne touche pas `look_and_find/**`. Vérifier le verdict sur l'empreinte exacte qui
  sera fusionnée.
- L'APK de debug est publié en artéfact de chaque exécution (`look-and-find-debug-apk`).
  C'est le chemin le plus court d'une branche à un téléphone, et il ne demande rien
  d'installé localement.
