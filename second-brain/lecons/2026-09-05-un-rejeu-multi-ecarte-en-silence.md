# Un rejeu multi-actifs écarte en silence ce qui n'est pas dans l'allocation

Mesuré le 05/09/2026 sur NexusCrypto, en essayant d'ajouter un actif mort à un
panier. Le défaut a produit un tableau de chiffres crédibles pour un panier qui
n'était pas celui demandé.

## Ce qui se passe

`rejeu --multi` accepte autant de `SYMBOLE=CSV` qu'on veut. En interne,
`config_portefeuille_reel` **ne garde que les symboles présents dans
l'allocation** du portefeuille, puis renormalise les poids.

Un actif fourni en ligne de commande mais absent de l'allocation est donc
**silencieusement écarté**. Quatre fichiers passés, trois mesurés, aucun
message.

Le résultat n'est ni vide ni faux en lui-même — il est **juste, pour un autre
panier que celui qu'on croit mesurer**. C'est la forme la plus coûteuse d'un
défaut : il ne ressemble pas à un défaut, il ressemble à un résultat.

## Ce qui a sauvé la mesure

Le rejeu du même actif **seul** a levé une exception franche :

```
ValueError: Aucun des symboles ['FTT/USDT'] n'est dans l'allocation.
```

Le cas où *rien* ne reste est traité ; le cas où *une partie* disparaît ne l'est
pas. Sans ce second rejeu, le tableau à quatre actifs serait parti tel quel dans
un compte rendu.

## La règle

**Une fonction qui filtre une entrée de l'utilisateur doit dire ce qu'elle a
retiré.** Refuser le vide ne suffit pas : c'est le retrait *partiel* qui trompe,
parce qu'il laisse un résultat plausible à la place de l'erreur.

Et le contrôle qui l'attrape de l'extérieur ne coûte rien : **compter ce que
la sortie nomme.** Le rejeu affiche les symboles dans son intitulé de ligne —
`BTC/USDT + ETH/USDT + LINK/USDT` là où quatre avaient été passés. Lire cet
intitulé, au lieu de sauter à la colonne du résultat, aurait suffi.

## Le correctif

Une ligne d'avertissement dans `config_portefeuille_reel`, sur le modèle de
celui qui existe déjà pour les données on-chain absentes — le rejeu sait déjà
dire « sans données on-chain : LINK/USDT », il lui manque « symbole ignoré,
absent de l'allocation : FTT/USDT ».
