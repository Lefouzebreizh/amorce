---
name: sortir-les-fichiers
description: Mettre à l'abri ce qu'une session distante contient et que le dépôt Git ne porte pas — planches, rushes, PDF de dépôt, exports, captures — avant que le conteneur soit effacé, en distinguant ce qui est irremplaçable de ce qui se refabrique. Dit quel canal accepte quoi, avec ses limites réelles (30 Mio par envoi, et les connecteurs qui ne peuvent pas transporter de binaire), et comment scinder ou reconstruire quand ça ne passe pas. À utiliser dès qu'une demande parle de récupérer, sauvegarder, télécharger, exporter ou mettre quelque part des fichiers, dès qu'on demande « où sont mes dossiers », « je les retrouve comment », « envoie-moi tout », « mets ça sur mon Drive », « je vais perdre mon travail ?», et **à soulever de soi-même** dès qu'une session a produit des images, des PDF ou des médias que le dépôt ignore — l'auteur ne sait pas que le conteneur disparaît. Concerne les fichiers produits ou reçus dans la session, pas le code, qui part par git.
---

# Sortir les fichiers d'une session éphémère

Une session distante travaille dans un conteneur reclamé après une période
d'inactivité. Le dépôt Git porte les **programmes** et les **décisions** ; il
ignore volontairement les images, les PDF et les médias. Tout ce qui est dans
`.travail/`, `/tmp/` ou un dossier ignoré disparaît avec la session, sans
avertissement.

L'auteur ne le sait généralement pas. **Le soulever fait partie du travail**,
même quand personne ne demande rien.

## D'abord : trier, pas tout sauvegarder

La question n'est pas « qu'est-ce qui est gros » mais « qu'est-ce qui ne se
refait pas ».

| | Exemples | À sauvegarder |
| --- | --- | --- |
| **Irremplaçable** | images fournies par l'auteur, rushes, enregistrements, fichiers reçus dans la conversation | **oui, toujours** |
| **Dérivé par script** | planches normalisées, PDF assemblés, exports, vignettes | non — les programmes sont dans Git |
| **Déjà versionné** | code, documents, notes, décisions | non, c'est fait |

Sauvegarder un dérivé, c'est garder le gâteau en plus de la recette : plus lourd,
et périmé dès la prochaine correction. Dans un projet où la chaîne complète est
versionnée, **sources + dépôt = tout**, et l'écart de volume est souvent d'un
facteur dix.

Vérifier que la chaîne reconstruit vraiment avant de s'appuyer dessus : si une
correction a été faite à la main, hors script, alors son résultat est
irremplaçable lui aussi.

## Le canal, et ses limites réelles

**La conversation** transporte les binaires, à **30 Mio par envoi**. Au-delà,
l'envoi est refusé — scinder en archives numérotées, chacune portant la même
notice de reconstruction, pour qu'aucune ne soit inutile isolément.

```bash
tar czf sortie/SOURCES-1sur2.tgz -C .travail rushes
```

**Un connecteur de stockage** (Drive et semblables) prend très bien le texte,
mais fait passer les binaires **par la mémoire de travail** : quelques mégaoctets
la saturent. Y déposer les images est donc impossible en pratique. Ce qu'il
accueille utilement, c'est **la notice** — où est quoi, comment tout
refabriquer, quelles commandes. Créer le dossier, y écrire la notice, et laisser
l'auteur y faire glisser les archives reçues dans la conversation.

Le dire franchement plutôt que d'essayer et d'échouer à moitié : le canal ne
peut pas, ce n'est pas un réglage à trouver.

## La notice compte autant que les fichiers

Une archive sans mode d'emploi est retrouvée dans deux ans sans qu'on sache
quoi en faire. Joindre à chaque envoi un `LISEZ-MOI.txt` disant :

- ce que contient l'archive, et ce qu'elle **ne contient pas**, avec la raison ;
- où sont les programmes — l'adresse du dépôt, pas « sur GitHub » ;
- **la commande exacte** qui reconstruit tout, et celle qui vérifie le résultat ;
- ce qu'il reste à faire, s'il reste quelque chose.

## Le réflexe, à chaque fin de tâche

Trois questions, dans cet ordre :

1. Cette session a-t-elle **reçu** un fichier de l'auteur ? Il est irremplaçable.
2. A-t-elle **produit** quelque chose qu'aucun script ne refait ? Idem.
3. L'auteur a-t-il ces fichiers **de son côté** ? S'il les a envoyés depuis son
   téléphone, souvent oui — le demander avant de tout renvoyer.

Si les trois réponses sont rassurantes, ne rien envoyer : un envoi inutile coûte
de l'attention. Sinon, envoyer maintenant, pas à la fin de la conversation — une
session peut être coupée entre deux messages.
