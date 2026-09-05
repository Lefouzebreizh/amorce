# Ce moteur est une assurance, pas un moteur de performance

Mesuré le 05/09/2026 sur NexusCrypto, en lui donnant enfin l'épreuve qui
manquait à toutes les précédentes : **un actif qui ne remonte jamais.**

Les leçons des 04 et 05/09 concluaient que le DCA aveugle bat la stratégie sur
toutes les fenêtres mesurées. C'est vrai, et incomplet : les trois actifs
mesurés — BTC, ETH, LINK — ont **tous survécu**. Le témoin n'avait jamais
rencontré celui qui va à zéro.

## L'épreuve

FTT, le jeton de FTX. Données CoinMetrics réelles, 2 469 jours de prix, sommet
à **80,56 $** en septembre 2021, **0,33 $** à la fin — **−99,60 %**.

Rejeu 2019-09 → 2026, 10 000 $ de capital, 200 $ par semaine :

| | perte finale | gain/douleur | capital engagé |
| --- | --- | --- | --- |
| stratégie, stop 4 ATR | **−18,2 %** | **−0,18** | 4 549 $ |
| stratégie, sans stop | −26,2 % | −0,26 | 3 259 $ |
| *témoin, DCA plat* | *−75,3 %* | *−0,76* | *9 817 $* |

**La stratégie divise la perte par quatre.**

## Le mécanisme, et c'est le même dans les deux sens

Elle engage **4 549 $ au lieu de 9 817**. C'est exactement ce que les leçons
précédentes décrivaient comme son défaut — retenir du capital que le témoin
engage. Sur un actif qui monte, retenir coûte le rendement de l'intervalle.
Sur un actif qui meurt, retenir **est** le gain.

Un seul mécanisme, deux signes selon ce que fait le sous-jacent. Il n'y a donc
pas de réglage qui rende la stratégie bonne partout : la temporisation est un
**pari sur la direction**, et son signe suit celui du pari.

Le stop bascule pareil : **+8 points** ici (−18,2 contre −26,2 sans lui), quand
il n'en valait que 0,43 sur le panier de survivants. Le garde-fou qui ne servait
à rien est celui qui rembourse.

## Pourquoi ça ne se voyait pas dans le panier

| panier | stratégie | témoin |
| --- | --- | --- |
| BTC + ETH + LINK | 12,07 | **15,25** |
| + FTT à 5 % de l'allocation | 9,91 | **12,90** |

Ajouter le cadavre ne renverse rien : à 5 % du portefeuille, il est noyé par
trois survivants qui pèsent quinze fois plus. **Une assurance ne se voit que
lorsque le sinistre pèse** — et sur un panier de grandes capitalisations, il ne
pèse jamais assez.

## La règle

**Un dispositif de protection ne se juge pas sur un échantillon qui n'a pas
subi le sinistre.** Trois jours de mesures ont conclu « la protection ne paie
pas son prix » sur trois actifs qui n'ont jamais eu besoin d'elle. La phrase
était exacte et le protocole ne pouvait rendre qu'elle.

Le corollaire est une question à se poser avant de bâtir un banc : **le
scénario contre lequel cet outil existe est-il dans mes données ?** Si non, le
banc mesure sa prime et jamais son remboursement.

## Ce que ça change pour l'usage

Ce moteur n'est pas fait pour accumuler du BTC — un virement permanent y fait
mieux, et c'est mesuré trois fois. Il est fait pour le cas où **l'actif peut
aller à zéro**, ce qui est le cas courant d'un jeton de faible capitalisation,
c'est-à-dire précisément ce que le radar de pépites ramène.

Le classer comme un moteur de performance et le juger là-dessus, c'est ce que
faisaient toutes les mesures précédentes.

## Ce qui ne se conclut pas de là

**Qu'il faille lui confier des pépites.** Ce rejeu porte sur un jeton coté sur
une plateforme majeure, avec des données quotidiennes propres sur sept ans. Un
jeton de faible capitalisation meurt en heures, pas en mois, sur une liquidité
qui disparaît avant le prix — et ni CoinMetrics ni ce rejeu ne savent
représenter ça.

**Ni qu'un seul cadavre fasse une preuve.** Un actif, une trajectoire. FTT est
mort d'une fraude soudaine ; un jeton qui s'éteint lentement n'aurait pas
déclenché les mêmes signaux, et rien ici ne dit lequel des deux est
représentatif.
