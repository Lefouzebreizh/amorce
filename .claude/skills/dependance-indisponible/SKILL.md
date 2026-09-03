---
name: dependance-indisponible
description: "Livrer quand ce dont le code a besoin n'est pas là — clé d'API absente, GPU manquant, logiciel propriétaire non installé, réseau filtré, poids de modèle introuvables, service payant, appareil physique. Donne l'échelle de repli qui permet d'écrire et d'éprouver le code entier malgré l'absence, et de dire exactement où s'arrête ce qui a été vérifié. À utiliser dès qu'une tâche bute sur quelque chose d'extérieur : « je n'ai pas la clé », « ça demande un GPU », « le proxy bloque », « il faut Photoshop / DaVinci / Excel », « le lien de téléchargement est mort », « ça marche pas sans abonnement », « je peux pas tester ça ici » — et aussi, sans qu'on le dise, dès qu'on s'apprête à écrire du code contre une API, un modèle lourd, un logiciel de bureau ou un appareil qu'on n'a pas sous la main. Ne pas attendre le mot « bloqué » : le moment utile est *avant* d'avoir écrit, pas après avoir renoncé. Ici on **livre malgré** l'absence ; pour savoir ce que la session sait faire — binaire, hôte, modèle — c'est `capacites-session` qui sonde, et `debloquer` quand c'est un refus qu'il faut lever."
---

# Livrer sans la dépendance

Une dépendance absente **déplace** la frontière de ce qui est vérifiable. Elle
ne la supprime pas.

C'est toute la compétence. « Je ne peux pas tester ça ici » n'est presque
jamais vrai pour la totalité du travail : il l'est pour une couche, et cette
couche est mince. Le reste — la décision de lancer, le tri des erreurs, l'ordre
des appels, le nettoyage après échec, le message affiché — est du code
ordinaire, entièrement vérifiable, et c'est là que vivent la plupart des bogues.

Le réflexe à combattre est de traiter l'absence comme un mur, de livrer un
squelette et d'écrire « à tester chez vous ». Ce qui revient alors n'est pas un
retour d'expérience, c'est un rapport de bogue sur du code que personne n'a
jamais exercé.

Sonder d'abord avec `capacites-session` : les trois causes — absent de la
machine, absent du réseau, absent du compte — n'appellent pas les mêmes replis,
et fabriquer une parade au mauvais problème coûte le double.

## L'échelle de repli

Descendre jusqu'au premier barreau qui tient. Chaque barreau vérifie
strictement plus que le suivant.

1. **Substituer par un équivalent local.** Un modèle indisponible se remplace
   souvent par un plus modeste pour éprouver la tuyauterie ; un service en
   ligne, par un fichier déposé à la main. Pas la même qualité de résultat, mais
   le même chemin de code.
2. **Doubler ce qui coûte cher, et tester la décision plutôt que le calcul.**
   Une doublure qui compte ses appels et dépose un fichier ne vérifie ni la
   voix, ni l'inférence — hors de portée — mais *quand* elles sont lancées, dans
   quel ordre, avec quels arguments, et ce qui se passe quand elles échouent.
3. **Éprouver le contrat sans la vraie réponse.** Fabriquer l'objet d'erreur que
   le service renverrait et vérifier ce qu'on en fait. Un tri de codes HTTP se
   teste entièrement hors ligne, et il ne se teste que comme ça — le jour où le
   quota s'épuise, personne n'a envie de découvrir que le message parle d'une
   clé invalide.
4. **Donner un mode qui dit ce qui manque.** Un `--check` qui contrôle outils,
   matériel, poids et fichiers d'entrée, puis s'arrête. Sur une tâche d'une
   heure, découvrir au bout de quarante minutes qu'il manque un fichier de
   86 Mo est le scénario que ce mode supprime.

## Les quatre gestes qui rendent l'absence invisible

Ils partagent une propriété : ils transforment un manque **visible** en défaut
**invisible**, ce qui est toujours pire.

- **Coder en dur une adresse qu'on n'a pas pu joindre.** Un lien mort produit un
  message plein d'assurance qui envoie l'utilisateur dans le vide. Nommer le
  fichier attendu, sa taille, son emplacement ; laisser une variable
  d'environnement à qui a un miroir. Les poids des modèles de recherche se
  déplacent tous les six mois.

  **Mais chercher d'abord sur les objets de release GitHub.** Deux capacités ont
  été déclarées hors de portée dans ce dépôt — la synthèse vocale, puis les
  poids Wav2Lip — et les deux fois la sortie était là. Hugging Face, les sites
  d'éditeurs et les CDN de banques de sons sont refusés par le mandataire ;
  `release-assets.githubusercontent.com` répond. Un dépôt qui republie les
  poids en release suffit, et il en existe presque toujours un.
- **Faire passer une absence pour un succès.** Découverte qui ne trouve rien,
  liste vide, flux de zéro octet : traités comme des réussites, ils produisent
  un vert qui ne garde rien. Ils doivent échouer bruyamment.
- **Sortir un secret de l'environnement.** Jamais en argument de ligne de
  commande — l'historique du shell et la liste des processus sont lisibles par
  n'importe quel programme de la machine. Ne jamais le réafficher, pas même
  tronqué.
- **Annoncer vérifié ce qui ne l'a pas été.** C'est ce qui détruit le plus vite
  la valeur de tout le reste du rapport.

## Ce qu'on écrit en rendant le travail

Trois lignes, sans les mélanger : ce qui a **tourné pour de vrai** ; ce qui est
**éprouvé par doublure**, donc la décision et non le calcul ; ce qui **n'a
jamais été exécuté**, nommément, et ce qu'il faudrait pour le faire.

La troisième est celle qu'on laisse tomber quand tout le reste est vert. C'est
précisément celle qui a de la valeur : elle dit où regarder en premier le jour
où ça casse.
