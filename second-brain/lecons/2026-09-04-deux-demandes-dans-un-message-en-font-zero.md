# Deux demandes dans un message en font zéro

*04/09/2026 — mesuré sur un aller-retour, dans le fil du traducteur de chat.*

## Ce qui s'est passé

Une session termine un compte rendu par un paragraphe qui contient **deux**
sollicitations : une décision de produit, et une commande à lancer sur la
machine du propriétaire. La décision est formulée en langage de code — « une
carte "il demande quelque chose", ou deux cartes qu'on ne saura jamais
départager ? ».

Réponse reçue, en une phrase : **« Je n'ai pas compris ce que tu attends de
moi. »**

Coût : un aller-retour complet, depuis un téléphone. La décision attendait
depuis deux jours et aurait pu être prise au premier message.

## La cause, et elle n'est pas le jargon

Le vocabulaire n'aidait pas, mais ce n'est pas lui qui bloque. Ce qui bloque
est **arithmétique** : deux demandes dans un même paragraphe obligent le
lecteur à trancher *laquelle compte* avant de pouvoir répondre à l'une ou à
l'autre. Ce tri-là n'est écrit nulle part, donc il retombe sur lui — et c'est
exactement le travail que le §0 dit de ne jamais lui faire porter.

Le piège est que la session, elle, voyait deux choses de rangs différents :
une vraie question et une simple suggestion. Rien dans la mise en forme ne le
disait. **Une demande et une proposition écrites côte à côte se lisent comme
deux demandes.**

## Ce qui a débloqué, et qui vaut d'être repris

Reformuler en prose n'aurait pas suffi. Ce qui a marché, en un seul tour :

1. **Séparer explicitement ce qui est attendu de ce qui est offert.** La
   phrase « ce que j'attends de toi : rien » a fait plus que la reformulation
   de la question.
2. **Sortir la vraie question de la prose** et la poser en choix formel
   (`AskUserQuestion`), trois options en langage courant, chacune disant ce
   qu'on gagne *et* ce qu'on perd. Répondu en un clic.
3. **Ne jamais laisser une option implicite.** Le troisième choix proposé —
   demander à l'utilisateur final de trancher dans l'application — n'avait
   jamais été formulé dans les deux jours précédents. Une question posée en
   prose tend à n'offrir que les deux issues auxquelles son auteur a pensé.

## La règle qui en sort

**Un message se termine par au plus une chose à faire.** S'il y en a deux, la
seconde n'est pas une demande : c'est une proposition, et elle s'écrit comme
telle — au passé, sans point d'interrogation, avec « pas urgent, pas
bloquant » en toutes lettres.

Et quand la chose à faire est un *choix*, elle ne s'écrit pas en prose. Le §0
demande de poser la question et de continuer ; il ne dit pas sous quelle
forme, et la forme décide ici du nombre d'allers-retours. Un choix posé en
options cliquables coûte un geste au propriétaire ; le même choix noyé dans un
paragraphe lui en coûte deux, dont un de diagnostic.
