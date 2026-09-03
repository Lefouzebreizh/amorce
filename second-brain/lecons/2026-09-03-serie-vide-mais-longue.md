# Une série longue peut n'avoir aucun prix, et sa longueur le cache

Mesuré le 03/09/2026 sur le jeu communautaire CoinMetrics, en montant le rejeu
du portefeuille complet de NexusCrypto sur données réelles.

Le fichier `sol.csv` fait **2 235 lignes, du 11/04/2020 au 24/05/2026** : par sa
taille et par ses dates, il a tout d'une série exploitable. Il n'a **aucune
colonne `PriceUSD`**, et sa colonne de repli n'est remplie que sur **7 lignes**.

Le rejeu a donc échoué sur « aucune ligne avec un prix dans la fenêtre
demandée » — un message juste, que l'on lit d'abord comme une erreur de fenêtre
et non comme un fichier sans prix.

## Le piège, et il vaut au-delà de cette source

**Compter les lignes ne dit rien du remplissage d'une colonne.** Un fichier
volumineux, aux dates continues et à l'en-tête riche, peut n'avoir aucune valeur
là où on la cherche. Les trois signaux qui rassurent — taille, plage de dates,
nombre de colonnes — sont exactement ceux qui ne mesurent pas ce dont on a
besoin.

## La fausse bonne idée qu'il a fallu écarter

`sol.csv` porte une colonne `ReferenceRate` que le chargeur ne connaît pas — il
ne lit que `PriceUSD` puis `ReferenceRateUSD`. L'ajouter en troisième repli
paraissait être le correctif évident.

**Vérifié avant de l'écrire : `ReferenceRate` n'est remplie que sur 7 lignes, et
dans *tous* les fichiers, BTC compris.** Ce n'est pas une colonne alternative,
c'est un ajout récent de la source. Le correctif n'aurait donc rien débloqué —
tout en ayant l'apparence d'un progrès, en passant les tests, et en ajoutant du
code au chargeur.

Contrôle utile au passage, pour qui voudra s'en servir un jour : sur la journée
où les deux existent, `ReferenceRate` vaut 77 497 $ là où `PriceUSD` vaut
76 976 $ — même ordre, même devise. La colonne est juste, elle est seulement
vide.

## Le geste qui coûte trois secondes

Avant de bâtir sur une série, compter les valeurs **par colonne**, pas les
lignes :

```python
{c: sum(1 for l in lignes if l.get(c)) for c in colonnes_candidates}
```

Et le savoir avant de promettre : le portefeuille cible de NexusCrypto porte
quatre lignes, **trois seulement sont mesurables** sur données réelles ici —
BTC, ETH et LINK. Toute mesure « du portefeuille complet » sur cette source est
donc impossible, et dire trois là où le produit en annonce quatre est plus utile
que de laisser croire le contraire.
