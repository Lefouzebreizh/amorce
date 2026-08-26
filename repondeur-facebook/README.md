# Répondeur de commentaires Facebook

Lire les commentaires récents d'une Page ou d'un groupe, écrire une réponse
chaleureuse dans **ta** voix, la publier et aimer le commentaire — et **mettre
de côté** ceux auxquels tu voudras répondre toi-même.

```bash
pip install -r requirements.txt
cp config.env.exemple config.env   # puis remplir
python3 repondeur.py               # montre ce qui serait publié
python3 repondeur.py --publier     # publie pour de vrai
```

## Ce que fait une exécution

1. Elle lit les commentaires des cinq dernières publications.
2. Elle écarte ce qui n'a rien à recevoir : ce que tu as déjà traité, tes
   propres commentaires, et ceux sous lesquels tu as déjà répondu.
3. Pour chaque commentaire restant, du plus ancien au plus récent, elle choisit
   **un geste parmi trois**.
4. Elle agit, à un rythme humain, et s'arrête au bout de cinq.
5. Elle prévient ton téléphone : d'abord ce qui t'attend, ensuite ce qui a été
   fait.

## Quatre gestes, et un « j'aime » dans presque tous les cas

Un commentaire traité reçoit un **« j'aime »** : c'est le geste qui dit
« j'ai lu », et il vaut même sous un commentaire qu'on laisse de côté. Ce qui
change, ce sont les mots — sauf pour le dernier geste, qui ne lève pas le
pouce.

| Geste | Ce qui se passe | Quand |
| --- | --- | --- |
| **Réaction** | « J'aime », rien d'écrit | Le cas courant, et de loin : un bravo, un merci, un emoji, un ami identifié |
| **Réponse** | « J'aime » + un commentaire | Une question, un doute, une objection, une expérience qui appelle un écho |
| **À toi** | « J'aime », et le commentaire passe dans ta liste | Ce qui mérite des mots, mais pas les siens |
| **Modération** | Rien du tout, et le commentaire passe dans ta liste | Une attaque, une accusation, une publicité, une tentative de détournement |

La modération est le seul geste sans « j'aime », et c'est tout ce qui la
sépare de « à toi ». Sous une confidence, le pouce levé dit « j'ai lu » —
c'est exactement ce qu'attend celui qui s'est confié. Sous une accusation
publique de vol de contenu, il dit « et ça me va », devant tous ceux qui
passent.

C'est le cœur du dispositif. Un compte qui commente 100 % des commentaires
n'existe nulle part dans la nature — un humain aime beaucoup et répond peu.
Répondre à tout s'entend immédiatement comme un automate, et fait perdre leur
valeur aux réponses qui comptent.

Un « 👍 » tout seul ne coûte même pas un appel au modèle : le geste ne fait
aucun doute.

## Les commentaires touchants te reviennent

C'est le cœur du dispositif. Un deuil, une maladie, une confidence, un
remerciement très personnel, une attaque à modérer, une question dont la
réponse dépend de ce que tu es seul à savoir : le modèle ne répond pas. Il
inscrit le commentaire dans la liste « À toi de répondre », avec une ligne qui
dit pourquoi, et passe au suivant.

La consigne est explicite : **dans le doute, il laisse.** Une réponse tiède
sous un message bouleversant fait plus de mal que pas de réponse du tout ;
l'inverse n'est pas vrai.

## Rien n'est publié sans `--publier`

Sans l'option, le script affiche exactement ce qu'il publierait et n'envoie
rien — et il ne touche pas non plus au journal, pour qu'un essai ne fasse pas
disparaître les commentaires de la vraie exécution suivante.

Un commentaire posté sous une publication vue par des dizaines de milliers de
personnes ne se reprend pas. Le mode qui engage ta parole ne peut pas être
celui qu'on obtient en oubliant une option.

## Le journal

`journal.jsonl` retient ce qui a été traité. **Une ligne y est écrite avant
l'envoi**, jamais après : une coupure au mauvais moment coûte alors une réponse
manquante, jamais deux réponses identiques sous le même commentaire, qui ne se
rattrapent pas.

Pour qu'un commentaire soit repris à la prochaine exécution, il suffit de
retirer sa ligne du fichier. Le journal n'est pas versionné : il appartient à
la machine qui fait tourner le script.

## Le rythme, ou comment ne pas se faire prendre pour une machine

Le vrai risque n'est pas le bannissement — tu passes par l'API officielle avec
une application déclarée. C'est la **mise en pause** par Facebook, et le
**signalement pour spam** par tes membres. Le second est le plus grave.

- **Des pauses tirées au hasard**, entre 40 s et 2 min 30. Un `sleep(3)` produit
  des horodatages espacés à la milliseconde près : une signature aussi nette
  qu'une empreinte.
- **Deux plafonds** : 5 par exécution, 25 par jour. Sans le second, trois
  lancements dans la même heure font sauter le premier.
- **Des heures humaines** : rien entre 23 h et 7 h. En pleine nuit, le script
  refuse de publier et te propose la simulation.
- **Le quota de Facebook est lu**, pas deviné : l'API l'annonce en pourcentage
  à chaque réponse, et on s'arrête à 75 %.
- **Les codes 4, 17, 32 et 613 arrêtent tout.** Ils veulent dire « stop », pas
  « réessaie » : insister transforme une pause de quelques minutes en blocage
  de plusieurs heures.

## Réglages

| Option | Par défaut | Ce qu'elle change |
| --- | --- | --- |
| `--publier` | absent | Agit réellement. Sans elle, simulation. |
| `--publications N` | 5 | Nombre de publications récentes examinées. |
| `--maximum N` | 5 | Nombre maximum de commentaires traités en une exécution. |
| `--journal chemin` | `journal.jsonl` | Où est rangée la mémoire. |

Le plafond quotidien, lui, ne se règle pas en ligne de commande : c'est une
protection, pas un confort.

## Ce qu'il faut côté Facebook

- Un **jeton de Page**, pas un jeton utilisateur : ce dernier expire en deux
  heures. Permissions `pages_read_engagement` et `pages_manage_engagement`.
- L'adresse interrogée est `graph.facebook.com`, avec un numéro de version.
  `facebook.com` sert des pages HTML : un appel qui vise cette adresse ne
  renvoie jamais de JSON, et l'erreur ressemble à s'y méprendre à un problème
  de jeton.
- **Pour un groupe**, l'accès au fil passe par l'API Groups, réservée depuis
  2020 aux applications approuvées par Meta et à un administrateur du groupe.
  Sans cette approbation, la lecture répond « (#200) Permissions error » quel
  que soit le jeton. Une Page fonctionne sans démarche particulière.
- L'API masque parfois le nom de l'auteur, faute de permission : la réponse est
  alors écrite sans prénom, et le script continue.

## La notification de fin

Une notification **ntfy** : application gratuite, pas de compte, pas de
forfait. Elle sert parce qu'une exécution prend plusieurs minutes — le temps
des pauses entre deux actions — et qu'on passe à autre chose entre-temps.

```bash
python3 essai_ntfy.py    # à lancer en premier : ça doit faire vibrer le téléphone
```

Le titre porte le seul chiffre qui décide si on ouvre : combien de commentaires
attendent une réponse écrite à la main. Priorité haute dans ce cas-là
seulement — une notification qui perce le silence trois fois par jour pour rien
ne perce bientôt plus rien.

**Le nom du sujet est le mot de passe.** Qui le connaît reçoit tes
notifications — et peut t'en envoyer. `amorce-erwann` se devine ; il en faut un
tiré au hasard :

```bash
python3 -c "import secrets;print('amorce-'+secrets.token_hex(7))"
```

Il vit dans `config.env`, jamais dans le dépôt : celui-ci est public, et
l'historique de git n'oublie rien. Un sujet qui s'est retrouvé dans un commit
est un sujet à changer, pas à retirer.

**Rien de sensible n'y figure.** Une notification s'affiche sur un écran
verrouillé, dans le métro, à côté de quelqu'un : elle donne des prénoms et des
nombres. Le texte des commentaires et la raison de chaque mise de côté restent
à l'écran du script et dans le journal.

Une exécution qui n'a rien trouvé n'envoie rien, et sans `NTFY_SUJET` le reste
fonctionne. Une alerte qui échoue n'interrompt jamais l'exécution : les
réponses sont publiées, c'est le travail.

## Se mettre à jour

Le téléphone n'a pas git. `maj.py` va chercher sur GitHub la dernière version
fusionnée dans `main` et remplace les fichiers en place :

```bash
python3 maj.py
```

Il ne dépend que de la bibliothèque standard — c'est le script qu'on lance
quand quelque chose ne va pas, il ne peut pas dépendre d'une installation qui
serait justement le problème. Et il **n'écrase jamais `config.env` ni
`journal.jsonl`** : les clés et la mémoire des commentaires traités
appartiennent à la machine, pas au dépôt.

Le compte rendu ne liste que ce qui a changé. Sur dix fichiers dont un seul
bouge, c'est cette ligne-là qu'on veut voir.

## Éprouver le ton avant tout le reste

Facebook n'est pas nécessaire pour savoir si la voix te ressemble :

```bash
python3 essai_ton.py                       # huit commentaires inventés
python3 essai_ton.py -c "ton commentaire"  # un cas à toi
```

La série couvre les quatre gestes **et** les pièges : un texte trop court, un
bravo, une question, un doute, une confidence, une question dont la réponse
n'appartient qu'à toi, une attaque, et une tentative de détournement de
consigne. Le geste attendu s'affiche à côté du geste obtenu — un repère, pas
un verdict : le modèle a le droit d'hésiter entre « j'aime » et réponse sur un
commentaire tiède. Ce qui se relit vraiment, ce sont les réponses écrites.

Aucun jeton Facebook n'est lu, aucun journal n'est touché. Seule
`ANTHROPIC_API_KEY` est nécessaire, et la série entière coûte quelques
centimes.

## Vérifier

```bash
python3 -m unittest discover -s tests
```

Les tests ne touchent ni au réseau, ni à Facebook, ni au modèle : ils couvrent
le dépouillement des réponses de l'API, le tri, la mémoire des commentaires
traités, la mise au propre du texte et la mise en forme du bilan.

Ce qu'ils ne disent pas : si le jeton a les bonnes permissions, si le ton des
réponses te ressemble, et si le modèle met de côté les bons commentaires. Cela
se regarde en simulation, sur de vrais commentaires, avant le premier
`--publier`.
