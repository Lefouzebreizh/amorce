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
   propres commentaires, ceux sous lesquels tu as déjà répondu, et les « 👍 »
   tout seuls.
3. Pour chaque commentaire restant, du plus ancien au plus récent, elle demande
   au modèle **soit** une réponse, **soit** de le laisser de côté.
4. Elle publie les réponses, met un « j'aime », et s'arrête au bout de cinq.
5. Elle fait vibrer ton téléphone : d'abord ce qui t'attend, ensuite ce qui a
   été fait.

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

## Réglages

| Option | Par défaut | Ce qu'elle change |
| --- | --- | --- |
| `--publier` | absent | Publie réellement. Sans elle, simulation. |
| `--publications N` | 5 | Nombre de publications récentes examinées. |
| `--maximum N` | 5 | Nombre maximum de réponses en une exécution. |
| `--journal chemin` | `journal.jsonl` | Où est rangée la mémoire. |

Trois secondes séparent deux publications : une rafale se voit, et se signale.

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
