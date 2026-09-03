# Un outil qui note tout sauf lui-même

**Mesuré le 01/09/2026** sur le radar `pepites/`, trouvé par une question du
propriétaire — « est-ce que la pépite a vraiment pété ? » — et par rien d'autre.

## Ce qui a été mesuré

Le radar écrit `prix_usd` et `note` dans sa table `releves`, pour chaque jeton,
**à chaque tour, depuis le premier jour**. La matière de son propre bulletin
était donc en base depuis le début.

Aucune commande ne la relisait. Aucune ne pouvait répondre à « qu'est-ce que
mes pépites sont devenues ».

Ce qui était vérifié à sa place : qu'il ne plante pas, qu'il rende un entonnoir
plausible, et que ses 150 tests passent. Les trois étaient vrais. Aucun des
trois ne dit si le radar a **raison**.

Second manque, découvert dans le même geste : le **symbole** du jeton n'entrait
que dans la table `alertes`, donc uniquement au-dessus du seuil d'alerte. Une
pépite notée entre 55 et 70 perdait son nom au scan suivant, ne laissant qu'une
adresse. C'est arrivé à la première pépite réelle du radar, notée 65 — et ce
sont précisément les quasi-manqués qu'on voudrait étudier pour régler un seuil.

## La leçon

**Un instrument qui produit des verdicts n'est presque jamais noté sur ses
verdicts.** Il l'est sur son exécution, parce que c'est ce que les tests savent
voir — et l'exécution est verte bien avant que le fond soit juste.

Ce n'est pas la même chose que « un rapport bâti sur zéro mesure rend le verdict
le plus rassurant », déjà écrit dans `../lecons.md`. Là-bas, un calcul juste
s'applique à un ensemble vide et le neutre mathématique fait la bonne nouvelle.
Ici, **rien n'est mal calculé** : c'est la boucle de retour entière qui manque,
et son absence ne produit aucun symptôme. Un outil sans bulletin ressemble trait
pour trait à un outil qui a un bon bulletin.

Le détail qui rend le défaut coûteux : **la matière était déjà enregistrée.**
Il ne manquait ni donnée, ni accès, ni réseau — seulement quelqu'un pour ouvrir
le fichier. Un outil qui journalise son propre score et ne le lit jamais est le
cas le plus fréquent, parce que chaque moitié paraît faite.

## Les deux questions qui l'attrapent

À poser sur n'importe quel outil de ce dépôt qui classe, note, filtre ou
recommande :

1. **Qu'est-ce que cet outil enregistre et ne relit jamais ?** La réponse est
   presque toujours son propre bulletin.
2. **Sur quoi a-t-il été jugé — tourner, ou avoir raison ?** Si la seule preuve
   est une suite verte, il n'a été jugé que sur la première.

Elles valent au-delà du radar : `nexuscrypto/` archive ses rejeux, la chaîne
`kdp/` ses neuf contrôles, `annuaire-ia/` ce que son auto-pilote a publié.
Chacun garde de quoi se noter.

## Ce que le bulletin doit refuser de dire

Écrire la boucle ne suffit pas : un bulletin qui conclut sur rien est pire que
pas de bulletin, puisqu'il porte un chiffre. Quatre refus ont été nécessaires
dans `pepites/bilan.py`, et ils se transposent :

- **un seul relevé rend « indécidable », jamais « 0 % »** — l'un dit « je ne
  sais pas », l'autre « ça n'a pas bougé », qui est une mesure que personne n'a
  faite ;
- **deux relevés trop rapprochés** affichent leur écart marqué « trop tôt » : il
  est vrai, le verdict qu'on en tirerait ne l'est pas ;
- **un dénominateur nul** interdit le calcul — le cas n'arrive jamais, et c'est
  pour ça qu'une division par zéro y passerait inaperçue ;
- **sous vingt cas jugeables, aucun taux global** : sur cinq, trois réussites
  font « 60 % » et ne disent rien du réglage, seulement du hasard de la semaine.

Et une médiane plutôt qu'une moyenne, toujours : un cas extrême tire une moyenne
et donne un bulletin flatteur que dix-neuf lignes perdantes ne corrigent pas.

## Ce qui n'a pas été fait

Le radar n'a **toujours pas** de note. Vingt jetons jugeables se comptent en
semaines de scans, et la commande existe pour le dire plutôt que pour l'inventer.

C'est la bonne fin : écrire la boucle et **avouer qu'elle est encore vide** vaut
mieux que la remplir d'un chiffre tiré de trois lignes. L'outil qui manquait
n'était pas un score, c'était de quoi refuser d'en donner un.
