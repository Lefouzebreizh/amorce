---
name: kdp-niche-validator
description: Valider un mot-clé KDP avant d'écrire le livre — dit si une niche vend assez (BSR), si la place est prenable (nombre d'avis) et si la marge existe (prix), rend un verdict, une note sur 100 et un rapport Markdown de recommandations. Outillé par `kdp/kdp_niche_validator.py`. À utiliser dès qu'il est question d'une niche, d'un mot-clé, d'un créneau, d'un BSR, d'un « Best Sellers Rank », de concurrence sur Amazon, de rentabilité d'un livre, ou dès qu'on demande « est-ce que ça vaut le coup d'écrire sur X », « ce sujet est-il saturé », « quelle niche choisir », « ce créneau est-il rentable » — y compris quand le mot « niche » n'est pas prononcé et qu'on hésite simplement entre deux idées de livres.
---

# Le mot-clé se choisit avant d'écrire, pas après

Un livre KDP qui ne se vend pas est presque toujours un bon livre posé sur un
mauvais mot-clé. Le pari se joue des mois avant l'écriture, sur une page de
résultats Amazon, et les trois chiffres qui le tranchent sont gratuits : le BSR
des trois premiers livres, leur nombre d'avis, leur prix.

Ce qui rend l'exercice piégeux, c'est que **chacun de ces trois chiffres ment
tout seul** :

- Un **BSR bas** dit qu'on achète. Il ne dit rien de votre capacité à entrer.
- **Peu d'avis** dit que la place est libre. Sur une niche morte, c'est parce
  que personne ne passe.
- Un **prix élevé** dit que la marge existe. Sur un rang à 400 000, la marge
  s'applique à zéro vente.

D'où l'outil : il les lit ensemble, et il rend un document qu'on relit dans six
mois — pas une impression.

## L'outil

```bash
python3 kdp/kdp_niche_validator.py --mot-cle "carnet de gratitude" \
        --bsr 38000 --avis 120 --prix 12.99

# Marché américain, rapport rangé ailleurs
python3 kdp/kdp_niche_validator.py --keyword "low content journal" \
        --bsr 45000 --reviews 80 --price 8.99 \
        --devise '$' --vers .travail/journal.md
```

Le rapport part dans `rapport_niche.md` par défaut. Le script **sort en erreur
(code 1) sur une niche disqualifiée** : c'est ce qui permet d'en enchaîner
plusieurs dans une boucle et de ne garder que celles qui passent.

Les options portent un nom français et un alias anglais (`--avis`/`--reviews`,
`--prix`/`--price`) parce que les chiffres se relèvent sur une boutique qui,
elle, est en anglais.

## Relever les trois chiffres : là où tout se joue

**Le piège numéro un : le BSR de sous-catégorie.** Une fiche produit affiche
souvent deux rangs — celui de la boutique entière (« n° 38 452 dans Livres ») et
celui d'une sous-catégorie (« n° 12 dans Journaux intimes »). **Les seuils de ce
script sont ceux du rang de boutique.** Prendre le rang de sous-catégorie fait
passer n'importe quel désert pour une mine d'or, et c'est l'erreur qui coûte le
plus cher parce qu'elle est invisible : les deux chiffres se ressemblent.

Le reste du relevé :

- **Les trois premiers**, ce sont les trois premiers *résultats organiques* —
  pas les encarts sponsorisés, qui disent seulement qui a payé.
- **Un livre sans BSR affiché n'a pas encore vendu.** Il ne compte pas dans la
  moyenne ; descendez au suivant plutôt que de compter zéro.
- **Le BSR est un instantané**, il bouge d'heure en heure. Relever les trois
  livres dans la même session, et se méfier d'un relevé fait un jour de
  promotion.
- **Le prix à retenir est le broché**, le format que vous produirez, pas la
  version Kindle affichée en tête.

## Lire le verdict

Cinq verdicts, du meilleur au pire. Les deux extrêmes sont les règles de
décision fournies avec le script ; les trois du milieu comblent l'intervalle
pour qu'aucune saisie ne reste sans réponse.

| Verdict | Condition | Ce qu'on en fait |
| --- | --- | --- |
| Excellente | BSR < 50 000 **et** avis < 300 | Écrivez. C'est la configuration qu'on cherche, et elle ne dure pas. |
| Forte demande, concurrence installée | BSR < 50 000 | Entrer de face demande un budget d'avis. Chercher l'angle que les trois premiers ne couvrent pas. |
| Correcte | BSR 50 000–150 000, avis < 300 | Revenu de fond, pas de lancement spectaculaire. Ça s'accumule. |
| Moyenne | BSR 50 000–150 000, avis ≥ 300 | À garder en réserve derrière une meilleure piste. |
| Trop faible demande | BSR > 150 000 | Changez de mot-clé. Rien ne rattrape une absence d'acheteurs. |

Les seuils sont **stricts** : un BSR pile à 50 000 n'est pas « inférieur à
50 000 », et un BSR pile à 150 000 ne disqualifie pas. C'est délibéré et testé.

## Lire la note sur 100

Le verdict tranche, la note nuance. Deux niches également « Excellentes » ne le
sont pas également : un BSR de 8 000 face à un BSR de 49 000 sépare une niche
qu'on attaque d'une niche qu'on surveille.

| Axe | Poids | Pourquoi ce poids |
| --- | ---: | --- |
| Demande (BSR) | 50 | Sans acheteurs, ni la concurrence ni le prix ne comptent. |
| Concurrence (avis) | 30 | C'est le mur à franchir, mais il se contourne. |
| Rentabilité (prix) | 20 | La seule des trois qu'on décide soi-même, après coup. |

Les deux premières échelles sont **logarithmiques**, parce que le BSR et les avis
le sont : entre 5 000 et 10 000 il y a le même écart de réalité qu'entre 100 000
et 200 000. Une échelle linéaire écraserait tout le haut du classement dans le
même point.

Le prix suit une courbe à palier : elle monte jusqu'à la zone confortable des
brochés (9,99–19,99), puis **redescend**. Au-delà d'une vingtaine d'euros,
l'acheteur d'un livre indépendant sans auteur connu se cabre — le gain de marge
est payé par une perte de conversion.

## Ce que dit le rapport, et ce qu'il ne dit pas

Le rapport porte le verdict, la décomposition de la note, un ordre de grandeur du
marché et quatre recommandations calées sur les faiblesses constatées. Il se
termine par une section « Ce que ce rapport ne dit pas », qui est **la partie la
plus importante à lire à voix haute** :

- **La saisonnalité.** Un BSR relevé en décembre sur un livre de fêtes ne vaut
  rien en mars.
- **La profondeur.** Trois best-sellers peuvent masquer une page vide dès le
  quatrième rang. La consigne finale du rapport — relever les mêmes chiffres sur
  les rangs 4 à 10 — sert exactement à ça.
- **Le coût d'impression**, qui dépend du nombre de pages et de la couleur, et
  qui peut annuler la redevance affichée.
- **Les droits.** Personnages, marques et méthodes déposées se croisent souvent
  dans les niches les plus tentantes.

L'estimation de ventes est un **ordre de grandeur, jamais une prévision**. Elle
répond à « est-ce que ça vaut le coup », pas à « combien je vais gagner ».

## Recalibrer, et sur quoi

Trois familles de constantes, en tête de `kdp/kdp_niche_validator.py`, qui n'ont
pas le même statut :

- **Les règles de verdict** (`BSR_FORTE_DEMANDE`, `BSR_DEMANDE_MORTE`,
  `AVIS_FAIBLE_CONCURRENCE`) sont des décisions, pas des réglages. Les toucher
  change ce que l'agent recommande d'écrire.
- **Le barème** (poids, bornes des échelles, `COURBE_PRIX`) est un jugement
  provisoire, posé sans bibliothèque de niches réelles. Quand une niche notée
  haut se révèle mauvaise sur le terrain, **c'est ici qu'on corrige**, avec la
  raison en commentaire.
- **`VENTES_PAR_JOUR_A_RANG_UN`** est le premier chiffre à recaler : la
  conversion rang → ventes dépend de la boutique et de la catégorie. Le défaut
  suit le repère usuel (rang 10 000 ≈ 10 ventes/jour, rang 100 000 ≈ 1). Un seul
  livre à vous, dont vous connaissez les ventes réelles, suffit à le corriger.

Après toute modification : `python3 -m unittest discover -s kdp/tests`. Les tests
des règles de verdict signalent une régression ; ceux du barème vérifient les
propriétés qui doivent survivre à un recalibrage (bornes, monotonie, couverture
complète des cas), pas des valeurs exactes.

## Où cela s'insère

En amont de tout le reste. La chaîne pré-presse (`kdp/kdp.py`, `kdp/vignette.py`)
prépare un livre qu'on a décidé d'écrire ; ce script décide s'il faut l'écrire.

```
kdp_niche_validator.py   → faut-il écrire ce livre ?
        ↓
   écriture, illustration
        ↓
kdp/kdp.py controler|interieur|couverture   → le fichier est-il déposable ?
kdp/vignette.py                             → l'acheteur verra-t-il quelque chose ?
```

Comparer plusieurs mots-clés est le vrai usage : lancez-le sur trois ou quatre
candidats, rangez les rapports dans `.travail/` (ignoré par git), et choisissez
sur les documents plutôt que sur le souvenir de la page de résultats.
