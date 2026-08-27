---
name: dependance-indisponible
description: Livrer quand ce dont le code a besoin n'est pas là — clé d'API absente, GPU manquant, logiciel propriétaire non installé, réseau filtré, poids de modèle introuvables, service payant, appareil physique. Donne l'échelle de repli qui permet d'écrire et d'éprouver le code entier malgré l'absence, et de dire exactement où s'arrête ce qui a été vérifié. À utiliser dès qu'une tâche bute sur quelque chose d'extérieur : « je n'ai pas la clé », « ça demande un GPU », « le proxy bloque », « il faut Photoshop / DaVinci / Excel », « le lien de téléchargement est mort », « ça marche pas sans abonnement », « je peux pas tester ça ici » — et aussi, sans qu'on le dise, dès qu'on s'apprête à écrire du code contre une API, un modèle lourd, un logiciel de bureau ou un appareil qu'on n'a pas sous la main. Ne pas attendre le mot « bloqué » : le moment utile est *avant* d'avoir écrit, pas après avoir renoncé.
---

# Livrer sans la dépendance

Une dépendance absente déplace la frontière de ce qui est vérifiable. Elle ne
la supprime pas.

C'est la distinction qui tient toute cette compétence. « Je ne peux pas tester
ça ici » n'est presque jamais vrai pour la totalité du travail : il l'est pour
une couche, et cette couche est en général mince. Le reste — la décision de
lancer ou non, le tri des erreurs, l'ordre des appels, le nettoyage après
échec, le message affiché — est du code ordinaire, entièrement vérifiable, et
c'est là que vivent la plupart des bogues.

Le réflexe à combattre est de traiter l'absence comme un mur, de livrer un
squelette et d'écrire « à tester chez vous ». Ce qui revient alors n'est pas un
retour d'expérience, c'est un rapport de bogue sur du code que personne n'a
jamais exercé.

## D'abord : est-elle vraiment absente ?

Mesurer avant de conclure. Le temps que ça coûte est dérisoire devant celui
qu'on perd à contourner un obstacle imaginaire.

```bash
shutil.which("ffmpeg")            # l'outil est-il sur le PATH ?
python -c "import torch; print(torch.cuda.is_available())"
pip download <paquet> --no-deps -d /tmp/x    # la bibliothèque est-elle atteignable ?
curl -sS -o /dev/null -w "%{http_code}" --max-time 20 -r 0-1023 "<url>"
```

Trois conclusions différentes se cachent derrière « ça ne marche pas », et
elles n'appellent pas les mêmes replis :

- **absent de la machine** — installable, ou remplaçable par un équivalent ;
- **absent du réseau** — un miroir existe peut-être, l'adresse est peut-être
  morte pour tout le monde ;
- **absent du compte** — clé, quota, abonnement, matériel. Rien ne le remplace,
  mais tout le code autour reste vérifiable.

Nommer laquelle des trois avant d'aller plus loin évite de fabriquer une parade
au mauvais problème.

## L'échelle de repli

Descendre jusqu'au premier barreau qui tient. Ne pas sauter directement au
dernier : chaque barreau vérifie strictement plus que le suivant.

**1. Substituer par un équivalent local.** Un modèle de synthèse indisponible
peut souvent être remplacé par un plus modeste pour éprouver la tuyauterie ; un
service en ligne, par un fichier déposé à la main. Ce n'est pas la même qualité
de résultat, mais c'est le même chemin de code.

**2. Doubler ce qui coûte cher, et tester la décision plutôt que le calcul.**
Remplacer l'étape lourde par une doublure qui compte ses appels et dépose un
fichier. On ne vérifie alors ni la voix, ni le rendu, ni l'inférence — hors de
portée — mais *quand* ils sont lancés, dans quel ordre, avec quels arguments,
et ce qui se passe quand ils échouent. C'est en général là qu'est le défaut.

**3. Éprouver le contrat sans la vraie réponse.** Fabriquer l'objet d'erreur
que le service renverrait et vérifier ce qu'on en fait. Un tri de codes HTTP se
teste entièrement sans réseau, et il ne se teste que comme ça — le jour où le
quota s'épuise pour de bon, personne n'a envie de découvrir que le message
parle d'une clé invalide.

**4. Donner un mode qui dit ce qui manque.** Un `--check` qui contrôle outils,
matériel, poids et fichiers d'entrée, puis s'arrête. Sur une tâche qui dure une
heure, découvrir au bout de quarante minutes qu'il manque un fichier de 86 Mo
est le scénario que ce mode existe pour supprimer. Il donne aussi à qui a la
dépendance un moyen de dire en une commande si son installation est complète.

**5. Dire ce qui n'a pas tourné.** Le dernier barreau n'est pas un aveu
d'échec, c'est une partie du livrable. Nommer précisément le chemin non exercé
vaut mieux qu'un silence qui laisse croire à une couverture complète.

## Ce qui ne se fait jamais

Ces quatre-là partagent une propriété : ils transforment une absence visible en
défaut invisible, ce qui est toujours pire.

- **Coder en dur une adresse qu'on n'a pas pu joindre.** Un lien mort dans le
  code produit un message plein d'assurance qui envoie l'utilisateur dans le
  vide. Nommer le fichier attendu, sa taille et son emplacement ; laisser une
  variable d'environnement à qui a un miroir. Les liens des modèles de
  recherche se déplacent tous les six mois.
- **Faire passer une absence pour un succès.** Une découverte qui ne trouve
  rien, une liste vide, un flux de zéro octet : traiter ces cas comme des
  réussites produit un vert qui ne garde rien. Ils doivent échouer bruyamment.
- **Écrire un secret ailleurs que dans l'environnement.** Jamais en argument de
  ligne de commande — l'historique du shell et la liste des processus sont
  lisibles par n'importe quel programme de la machine. Ne jamais le réafficher,
  pas même tronqué.
- **Annoncer vérifié ce qui ne l'a pas été.** C'est ce qui détruit le plus vite
  la valeur de tout le reste du rapport.

## Rendre l'absence lisible pour celui qui l'a

Le code sera exécuté sur une machine qui a la dépendance, par quelqu'un qui n'a
pas lu son source. Ce qu'il verra en cas de manque est donc une partie du
travail, pas une politesse.

Un message utile nomme **ce qui manque**, **où le mettre**, et **la commande
qui l'obtient**. « 401 » n'est pas actionnable ; « clé refusée, vérifier
ELEVENLABS_API_KEY » l'est.

Et le programme rend un code de retour non nul, pour que les maillons d'une
chaîne s'enchaînent avec `&&` sans traiter un fichier absent.

## Ce qu'on écrit en rendant le travail

Trois lignes, séparées et sans les mélanger :

- ce qui a **tourné pour de vrai**, et sur quoi ;
- ce qui est **éprouvé par doublure** — donc la décision, pas le calcul ;
- ce qui **n'a jamais été exécuté**, nommément, et ce qu'il faudrait pour le
  faire — une clé, un GPU, une machine avec tel logiciel.

Cette troisième ligne est celle qu'on est tenté de laisser tomber quand tout le
reste est vert. C'est précisément celle qui a de la valeur : elle dit où
regarder en premier le jour où ça casse.
