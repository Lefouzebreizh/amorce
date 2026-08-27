---
name: prepresse-kdp
description: Règles de préparation d'un livre illustré pour l'impression à la demande KDP — résolution, fond perdu, zone de sécurité, calcul de tranche, compte de pages, et la boucle de validation. À charger avant de fabriquer, d'assembler ou de contrôler un PDF intérieur ou une couverture, et dès qu'il est question de DPI, de massicot, de bord perdu, de tranche, d'épreuve ou de dépôt.
---

# Prépresse KDP

Les erreurs de prépresse ne se voient qu'imprimées, chez le lecteur. Chaque
règle ci-dessous a coûté un aller-retour sur le Tome 1 de *Roussy & Zéphy*.

## Mesurer avant d'affirmer

Ne jamais qualifier une planche à l'œil. Ouvrir le fichier, relever les pixels,
diviser par la largeur de page en pouces. Un rapport qui dit « ça a l'air bon »
ne vaut rien ; `kdp/kdp.py controler` en donne un qui vaut.

## Résolution

- **300 DPI** est la cible. Sur une page de 8,625 po, cela fait **2600 px** de côté.
- **L'agrandissement interpole, il ne crée pas de détail.** Il rend conforme, pas
  net. Toujours le dire quand on y recourt, et donner le facteur : au-delà de
  ×2, le trait fin et la calligraphie décrochent visiblement.
- Ne jamais recompresser une illustration de façon destructive. Un JPEG au bon
  rapport se recopie tel quel dans le PDF (flux DCTDecode), le reste passe par un
  PNG. En revanche, un fond fabriqué par le script — aplat, grain calculé — se
  met en JPEG de haute qualité sans état d'âme : la règle protège le dessin de
  l'auteur, pas ce qu'on génère soi-même.

## Géométrie

| | |
| --- | --- |
| Page intérieure avec fond perdu | trim + 0,125 po **en haut, en bas et côté tranche extérieure** — jamais côté reliure, d'où une page plus haute que large |
| Zone de sécurité | rien de signifiant à moins de **0,375 po** du bord rogné |
| Couverture à plat | 2 × trim + tranche + 2 × 0,125 po de large, trim + 0,25 po de haut |
| Tranche, papier couleur | **nombre de pages × 0,002252 po** |

La tranche se calcule sur le nombre de pages **du PDF final**, pas sur le nombre
d'illustrations. C'est l'erreur qui fait revenir une couverture de l'imprimeur.

## Compte de pages

Minimum **24 pages**, et un **nombre pair**. Retirer une page d'un volume pair
le rend impair : il faut alors en retirer deux, ou en ajouter une. Le compte se
vérifie avant de toucher au sommaire, pas après.

## Les quatre contrôles, et ce que chacun voit

| Commande | Ce qu'elle seule voit |
| --- | --- |
| `kdp/kdp.py controler --source DOSSIER` | résolution et rapport, page par page, selon la charte du tome — la référence |
| `kdp/planches.py DOSSIER` | le **texte des bulles** : hauteur d'œil en millimètres imprimés, épaisseur du trait, netteté des glyphes. Se lance sur n'importe quel dossier, hors charte comprise |
| `kdp/vignette.py --source COUVERTURE --vers vignette.png` | la couverture réduite à 150 px, mesurée : contraste, détachement du sujet, masses distinctes |
| `kdp/reprise.py --avant ANCIEN --apres NOUVEAU` | ce qui a **dérivé** entre deux versions d'une planche, et dans quelle zone |

Les deux premiers se recoupent sur le DPI, et c'est voulu : `controler` juge le
volume attendu, `planches` juge un dossier quelconque.

`reprise.py` sert au moment où l'on régénère : le générateur redessine, il ne
grandit pas. Sur vingt planches reprises, les trois qui ont bougé ne se voient
pas à l'œil.

## Le seul test qui compte pour une couverture

Réduire le projet à **150 pixels** et regarder. `kdp/vignette.py` le fait et
mesure ce qu'il en reste, mais **regarder la vignette reste le contrôle** : la
mesure ne dit rien de la lisibilité du titre. Repère relevé sur le Tome 1 : un
texte sous **5 % de la hauteur** de la couverture ne survit pas à la réduction —
le titre à 7 % passe, le sous-titre à 2,5 % disparaît. Si on ne reconnaît pas le sujet
à cette taille, la couverture est ratée quelle que soit sa beauté en grand :
c'est la vignette d'une liste marchande, pas l'affiche.

Corollaire : **ne jamais faire générer le texte dans l'image**. Un titre
vectoriel est net en vignette et se corrige en une ligne ; un titre pixellisé
impose de tout régénérer.

## Les codes imprimés

Un QR code engage pour la vie du tirage.

- Il ne pointe **que vers un domaine qu'on possède**, qui sert d'aiguillage.
- C'est la **taille du plus petit carré** qui décide de la lecture, pas la taille
  du code : sous **0,6 mm**, la lecture devient incertaine.
- La correction d'erreur maximale (H) est faite pour les surfaces abîmées ; sur
  une page propre elle ne fait que multiplier les modules, donc les rétrécir.
  **Q suffit** et sauve souvent le seuil.

## La boucle

Fabriquer, **valider**, corriger, revalider. Le validateur sort en erreur —
un rapport qui finit toujours en vert ne sert à rien. Et il ne remplace pas
l'épreuve papier : la finesse des titres et ce que le massicot emporte
réellement ne se jugent qu'imprimés.
