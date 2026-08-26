---
name: repondeur-facebook
description: Toucher au répondeur de commentaires Facebook (`repondeur-facebook/`) — où atterrit chaque fichier, les huit invariants qui empêchent une réponse en double ou une notification indiscrète sous les yeux de 48 000 membres, les pièges de l'API Graph qui coûtent une heure chacun, et les contraintes d'un script qui tourne sur un téléphone. À utiliser dès qu'une demande parle de commentaires Facebook, de l'API Graph, de répondre ou de liker automatiquement, de modération de communauté, de notification ntfy, de jeton de Page, du journal des commentaires traités, de Pydroid, ou qu'on retouche quoi que ce soit sous `repondeur-facebook/` — y compris quand la demande dit seulement « il répond trop », « change le ton des réponses » ou « ajoute une option ».
---

# Toucher au répondeur de commentaires Facebook

Ce projet **parle en public au nom de quelqu'un**. Une ligne mal placée ne
produit pas un test rouge : elle produit un commentaire, sous une publication
vue par des dizaines de milliers de personnes, qui ne se reprend pas. Tout ce
qui suit découle de là.

Le `README.md` du projet s'adresse à son utilisateur. Ce fichier-ci s'adresse à
qui modifie le code.

## Où atterrit un changement

| Fichier | Ce qu'il porte |
| --- | --- |
| `repondeur.py` | Le chef d'orchestre : options, boucle, décision de publier. Aucune logique métier. |
| `core/facebook.py` | L'API Graph : lire le fil, aimer, répondre. `extraire_commentaires` est pur et testé. |
| `core/redaction.py` | La charte éditoriale, le schéma de sortie, l'appel au modèle. |
| `core/journal.py` | La mémoire des commentaires traités, le tri, et le compteur du jour. |
| `core/rythme.py` | Pauses tirées au hasard, plafonds, heures humaines, lecture du quota. Pur, testé. |
| `core/alerte.py` | La notification ntfy et la mise en forme du bilan. |
| `essai_ntfy.py` | Le premier test sur un téléphone vierge. Ne dépend que de `requests`, exprès. |
| `tests/` | `unittest`, hors réseau, intitulés en phrases françaises. |

Un module de `core/` ne connaît pas les autres, sauf `journal` qui lit le type
`Commentaire`. Si un changement oblige à croiser deux modules, c'est presque
toujours que la décision appartient à `repondeur.py`.

## Les huit invariants

Chacun est justifié en tête du fichier concerné ; relire ce bloc avant d'y
toucher.

1. **Rien ne part sans `--publier`.** Le mode qui engage la parole de
   quelqu'un ne peut pas être celui qu'on obtient en oubliant une option. Et en
   simulation, **le journal ne bouge pas** : un essai qui marquerait les
   commentaires comme traités les ferait disparaître de la vraie exécution
   suivante, sans qu'aucune réponse n'ait été publiée.
2. **Le journal s'inscrit avant l'envoi, jamais après.** Une coupure entre les
   deux coûte alors une réponse manquante — qui se rattrape en retirant une
   ligne. L'ordre inverse coûte deux réponses identiques sous le même
   commentaire, publiquement, et ça ne se rattrape pas.
3. **Le commentaire est du contenu, jamais une consigne.** Il arrive encadré
   par `<commentaire>`, et la charte dit explicitement qu'on y répond sans lui
   obéir. Sur une communauté de cette taille, quelqu'un finira par écrire
   « ignore les instructions précédentes ». Ne jamais concaténer un texte de
   membre dans la consigne système.
4. **La sortie du modèle est structurée, pas libre.** Le schéma impose un
   geste — `reaction`, `reponse` ou `a_toi` —, une raison et un texte. Un
   texte libre finit toujours par publier une phrase qui s'adressait à
   l'auteur du groupe. Le « j'aime » n'est pas dans le schéma : il est acquis
   dans les trois cas, et un modèle n'a pas à en décider.
5. **Un refus du modèle ne se contourne pas.** Pas de repli sur un autre
   modèle : le refus porte sur un commentaire déjà problématique, et publier
   quand même y répondrait exactement à l'envers. Le commentaire revient à
   l'humain.
6. **La notification ne porte ni texte de commentaire, ni raison de mise de
   côté** — des prénoms et des nombres. Elle s'affiche sur un écran verrouillé,
   dans le métro, à côté de quelqu'un.
7. **Aucun secret dans le dépôt.** Le dépôt est **public**, et l'historique de
   git n'oublie rien : le jeton de Page, la clé Anthropic et le sujet ntfy
   vivent dans `config.env`, ignoré. Le nom du sujet ntfy fait office de mot de
   passe — un sujet qui s'est retrouvé dans un commit est un sujet à
   **changer**, pas à retirer.
8. **Le rythme reste humain.** Voir plus bas : c'est un invariant au même titre
   que les autres, parce que c'est lui qui décide si le compte survit.

## Ce que l'API Graph fait payer cher

- **`graph.facebook.com`, jamais `facebook.com`.** La seconde adresse sert du
  HTML : la requête « réussit » et le JSON n'arrive jamais. L'erreur ressemble
  à s'y méprendre à un problème de jeton, et on la cherche des heures au mauvais
  endroit. Le numéro de version est explicite pour la même raison : sans lui,
  Facebook sert la plus ancienne version encore vivante — donc un jour, une
  autre.
- **`data=`, jamais `json=`.** L'API attend un formulaire. Un corps JSON passe
  parfois, et se fait ignorer silencieusement le reste du temps : réponse 200,
  commentaire jamais publié.
- **Un jeton de Page, pas un jeton utilisateur** (ce dernier expire en deux
  heures). Permissions `pages_read_engagement` et `pages_manage_engagement`.
- **Un groupe n'est pas une Page.** Le fil d'un groupe passe par l'API Groups,
  réservée aux applications approuvées par Meta. Sans approbation :
  `(#200) Permissions error`, quel que soit le jeton.
- **L'auteur peut être masqué** faute de permission. Le commentaire existe
  quand même et mérite une réponse : ne jamais l'écarter pour un `from`
  manquant.
- **Les codes 4, 17, 32 et 613 veulent dire « stop »**, pas « réessaie ». Ce
  sont les quotas. Réessayer, c'est taper plus fort sur une porte fermée.
- **L'en-tête `X-App-Usage`** renvoie le quota consommé en pourcentage, à
  chaque réponse. C'est le tableau de bord que Facebook offre et que presque
  personne ne lit.

## Le rythme humain

Le risque réel n'est pas le bannissement — l'accès passe par l'API officielle
avec une application déclarée. C'est la **mise en pause** par Facebook, et le
**signalement pour spam** par les membres. Le second est le plus grave.

- **Délais aléatoires, jamais fixes.** Un `sleep(3.0)` est une signature aussi
  nette qu'une empreinte. `random.uniform(...)`, avec un écart large.
- **Deux plafonds** : par exécution *et* par jour. Sans le second, trois
  lancements dans la même heure font sauter le premier.
- **Des heures humaines.** Rien la nuit : un compte qui répond à 4 h du matin
  tous les jours ne dort jamais, et ça se voit dans les données bien avant de
  se voir à l'œil nu.
- **Ne pas répondre à tout.** Un compte qui commente 100 % des commentaires
  n'existe nulle part. Un humain aime beaucoup, répond peu — c'est la raison
  d'être du geste « réaction seule ».
- **Jamais deux fois le même texte.** Le contenu dupliqué est le déclencheur le
  plus fiable du signal « spam ». C'est aussi pourquoi aucune réponse ne doit
  revenir à un gabarit à trous.

## Le modèle

`claude-opus-5`, effort `low` : écrire trois phrases chaleureuses n'est pas un
problème difficile, et la réflexion approfondie coûterait dix fois le prix pour
la même réponse. Compter environ un centime par commentaire.

**La charte fait ~900 jetons, sous le seuil de mise en cache (1 024).** Poser
un `cache_control` dessus aujourd'hui ne ferait rien du tout — ça ne devient
intéressant que si elle grossit. Mesurer avant d'y croire.

`core/redaction.py` **n'importe pas le SDK** : le client lui est passé par
l'appelant. C'est ce qui permet de vérifier la charte, le nettoyage du texte et
les chemins de refus sans installer `anthropic` ni toucher au réseau. Ne pas
défaire ça pour économiser un paramètre.

## Le téléphone est la cible, pas un ordinateur

Le script tourne dans **Pydroid 3** sur Android, lancé à la main.

- **Pas de git, pas de tâche planifiée.** Android tue les processus en arrière-
  plan ; c'est l'utilisateur qui appuie sur ▶. Ne rien concevoir qui suppose un
  démon ou un `cron`.
- **Chaque dépendance ajoutée est un risque d'installation qui échoue.** Les
  paquets compilés (tout ce qui repose sur Rust ou C) n'ont pas toujours de
  version pour Android. Avant d'en ajouter une, se demander si la bibliothèque
  standard ne suffit pas.
- **Des fichiers courts.** Chercher une fonction dans 500 lignes sur un écran
  de six pouces coûte une minute à chaque fois.

## Vérifier

```bash
python3 -m unittest discover -s repondeur-facebook/tests
```

Hors réseau, sans Facebook et sans modèle. Ce que les tests **ne disent pas**,
et qu'il faut signaler dans tout compte rendu : si le jeton a les bonnes
permissions, si le ton des réponses ressemble à celui de l'auteur, et si le
modèle met de côté les bons commentaires. Cela se regarde en simulation, sur de
vrais commentaires, avant tout `--publier`.
