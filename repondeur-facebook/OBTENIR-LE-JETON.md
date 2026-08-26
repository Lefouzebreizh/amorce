# Obtenir le jeton de Page permanent

Cette fiche existe parce que la permission d'**écrire** — `pages_manage_engagement`,
celle qui autorise à répondre et à aimer — ne se redemande pas. Meta la propose
une fois. Si elle est refusée, ou simplement laissée décochée dans la liste,
l'écran d'autorisation ne la remontre plus jamais : les autorisations suivantes
passent sans poser de question, le jeton obtenu lit la Page très bien, et
l'écriture échoue avec un message qui parle de permissions manquantes sans dire
lesquelles ni comment les récupérer.

La sortie est toujours la même : **repartir de zéro**, en révoquant tout, puis
en réautorisant. Les six étapes ci-dessous se suivent d'une traite, depuis un
téléphone, en une dizaine de minutes.

> **Aucun jeton, aucune clé secrète ne sort de ce parcours autrement que dans
> `config.env`.** Ni dans une capture d'écran, ni dans une conversation, ni
> dans un message. Un jeton qui a été vu ailleurs est un jeton à refaire — et
> refaire, c'est reprendre cette fiche au début.

## Ce qu'il faut sous la main

- Le tableau de bord de l'application : <https://developers.facebook.com/apps/>
- L'explorateur d'API Graph : <https://developers.facebook.com/tools/explorer/>
- Le débogueur de jeton : <https://developers.facebook.com/tools/debug/accesstoken/>
- L'identifiant de la Page (déjà dans `config.env`, `FB_GROUP_ID`).

Trois permissions sont visées, et pas deux :

| Permission | Pourquoi |
| --- | --- |
| `pages_show_list` | Sans elle, `me/accounts` ne renvoie aucune Page — donc pas de jeton de Page à l'étape 4. |
| `pages_read_engagement` | Lire le fil et les commentaires. |
| `pages_manage_engagement` | Répondre et aimer. **C'est celle qui manque.** |

## Étape 0 — Vérifier que la permission est seulement *déclarée*

Avant d'accuser un refus, écarter le cas plus bête et plus fréquent : une
permission que l'application ne demande pas n'apparaît **jamais** dans l'écran
d'autorisation, quel que soit le nombre de révocations.

Tableau de bord de l'application → **Cas d'utilisation** → « Tout gérer sur
votre Page » → **Personnaliser**. La liste des permissions s'affiche ; chacune
porte un bouton *Ajouter*. Vérifier que les trois du tableau ci-dessus sont
bien dans l'état « Ajoutée ». Si `pages_manage_engagement` ne l'est pas, c'est
toute l'explication : l'ajouter, et l'étape 1 devient inutile.

## Étape 1 — Révoquer

Le plus fiable depuis un téléphone passe par Facebook, pas par l'explorateur :

**Facebook** → Menu → Paramètres et confidentialité → Paramètres →
**Applications et sites web** → « Répondeur Amorce » → **Supprimer**.

L'équivalent côté explorateur, si l'application n'apparaît pas dans cette
liste : y sélectionner l'application, générer un jeton utilisateur (même
incomplet), passer la méthode de `GET` à `DELETE`, chemin `me/permissions`,
puis **Envoyer**. La réponse attendue est `{"success": true}`.

Dans les deux cas, tous les jetons émis jusque-là cessent de fonctionner. C'est
l'effet recherché.

## Étape 2 — Réautoriser, en lisant l'écran

Explorateur d'API Graph → application « Répondeur Amorce » → menu **Jeton
d'accès utilisateur** → **Générer un jeton d'accès utilisateur**.

L'écran d'autorisation revient au complet, puisque plus rien n'est accordé.
Deux choses s'y jouent :

1. **Ne rien décocher.** L'écran « Choisir ce que vous autorisez » liste les
   Pages et les actions. Une case décochée ici est un refus définitif, et on
   retourne à l'étape 1.
2. **Cocher la Page « Apprivoiser l'IA »** quand la liste des Pages s'affiche.
   Une autorisation accordée sans Page sélectionnée donne un jeton valide qui
   ne voit rien.

Le jeton obtenu est un **jeton utilisateur de courte durée** : il meurt dans
deux heures. Il ne va pas dans `config.env` — il ne sert qu'aux deux étapes
suivantes.

Vérifier tout de suite le résultat, avant d'aller plus loin : dans
l'explorateur, chemin `me/permissions`, méthode `GET`. La réponse liste chaque
permission avec `"status": "granted"`. Si `pages_manage_engagement` y est
absente ou `declined`, inutile de continuer : reprendre à l'étape 0.

## Étape 3 — Étendre le jeton utilisateur à 60 jours

Un jeton de Page hérite de la durée de vie du jeton utilisateur dont il est
tiré. Tiré d'un jeton de deux heures, il dure deux heures. Tiré d'un jeton
longue durée, il ne **périme jamais** — c'est toute l'astuce, et c'est
pourquoi cette étape ne se saute pas.

Débogueur de jeton → coller le jeton de l'étape 2 → **Déboguer** → tout en bas,
bouton **Étendre le jeton d'accès** (le mot de passe Facebook est redemandé).
Le nouveau jeton s'affiche sous le bouton : expiration à environ 60 jours.

En secours, si le bouton reste inopérant, l'échange se fait par une requête —
en remplaçant les trois valeurs :

```
https://graph.facebook.com/v26.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=IDENTIFIANT_DE_L_APPLICATION
  &client_secret=CLE_SECRETE
  &fb_exchange_token=JETON_DE_L_ETAPE_2
```

La clé secrète se lit dans Tableau de bord → Paramètres → Général. **Cette
URL contient un secret** : elle reste dans l'historique du navigateur, ne se
partage pas, et ne se photographie pas.

## Étape 4 — Tirer le jeton de Page

Explorateur d'API Graph, avec le jeton **long** de l'étape 3 collé dans le
champ du jeton : chemin `me/accounts`, méthode `GET`.

La réponse liste les Pages administrées. Celle qui porte l'identifiant de
`FB_GROUP_ID` contient un champ `access_token` : **c'est lui**, et lui seul,
qui va dans `config.env`.

## Étape 5 — Vérifier qu'il ne meurt jamais

Débogueur de jeton → coller le jeton de Page → **Déboguer**. Trois lignes à
lire, dans cet ordre :

- **Type** : `Page` (et non `User` — sinon c'est le jeton de l'étape 3 qui a
  été copié).
- **Expire** : `Jamais`. Si une date s'affiche, l'étape 3 a été sautée ou le
  jeton de Page a été tiré du jeton court.
- **Autorisations** : les trois permissions du tableau doivent y figurer.

## Étape 6 — Deux essais réels, dans le bon ordre

Le débogueur dit ce que le jeton *prétend* pouvoir faire. Seul un appel dit ce
qu'il fait vraiment, et il vaut mieux l'apprendre sur une publication de test
que sur le fil de la communauté.

1. **Lire** — explorateur, chemin `IDENTIFIANT_DE_LA_PAGE/feed`, méthode `GET`.
   Un JSON avec des publications : la lecture est bonne (elle l'était déjà).
2. **Écrire** — publier sur la Page une publication de test, la commenter
   soi-même, relever l'identifiant du commentaire dans le `feed`, puis :
   - `IDENTIFIANT_DU_COMMENTAIRE/likes`, méthode `POST` → `{"success": true}` ;
   - `IDENTIFIANT_DU_COMMENTAIRE/comments`, méthode `POST`, paramètre
     `message` → un identifiant de réponse.

   Puis **supprimer la publication de test**. Tant que le second appel ne
   répond pas, le répondeur ne peut rien publier, et c'est bien la permission
   d'écriture qui manque encore.

## Ranger, et seulement là

Dans `config.env`, sur le téléphone :

```
FB_ACCESS_TOKEN=le jeton de Page de l'étape 4
FB_GROUP_ID=l'identifiant de la Page
FB_API_VERSION=v26.0
```

`config.env` est ignoré par git, et c'est le seul endroit où un jeton a le
droit d'exister. Un premier essai se fait ensuite **sans** `--publier` : rien
ne part, et le journal ne bouge pas.

## Quand ça se remet à échouer

- **`(#200) Permissions error`** — le jeton n'a pas la permission, ou l'appel
  vise un **groupe** et non une Page : le fil d'un groupe passe par l'API
  Groups, réservée aux applications approuvées par Meta, et aucun jeton n'y
  changera rien.
- **Code `190`** — jeton expiré ou révoqué. Reprendre à l'étape 2 ; l'étape 1
  n'est nécessaire que si une permission manque.
- **Réponse HTML plutôt que JSON** — l'adresse visée est `facebook.com` au lieu
  de `graph.facebook.com`. L'erreur ressemble à un problème de jeton et n'en
  est pas un.
- **`200 OK` mais rien de publié** — le corps de la requête est parti en JSON.
  L'API Graph attend un formulaire ; `core/facebook.py` envoie `data=`, jamais
  `json=`.
- **Codes `4`, `17`, `32`, `613`** — ce sont les quotas, et ils veulent dire
  « stop », pas « réessaie ». Attendre.
- **Un blocage temporaire de l'espace développeur** — il se lève seul, en
  général en quelques heures. Rien à réparer.
