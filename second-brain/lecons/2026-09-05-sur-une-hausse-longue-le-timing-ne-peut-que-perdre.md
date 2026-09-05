# Sur une hausse longue, aucun timing ne bat celui qui engage le plus tôt

Mesuré le 05/09/2026 sur NexusCrypto, en achevant le balayage de ses réglages.
Cette leçon **corrige** celle du 04/09
(`2026-09-04-le-dca-aveugle-gagne-sur-trois-fenetres.md`), qui nommait la bonne
cause au mauvais endroit.

## Les quatre balayages, sur toute leur plage autorisée

BTC + ETH + LINK, trésorerie partagée, 2018 → 2026, témoin en DCA plat à 15,25.

| levier | plage complète | ce qu'il déplace |
| --- | --- | --- |
| `atr_multiple_stop` | 4 → 12, et sans stop | 0,43 pt |
| `influence_score` | 0 → 0,333 (plafond du validateur) | 0,42 pt |
| `plancher_enveloppe` | 0,15 → 1,0 | 0,30 pt |
| **multiplicateurs de zone** | livrés → tous neutralisés | **2,48 pt** |

**Trois réglages sur quatre ne font rien**, et le quatrième fait tout ce que le
moteur sait faire. La modulation par zone de valorisation — ×2,0 en peur
extrême, ×0 en avidité extrême — vaut à elle seule dix fois le stop, le score
et le plancher réunis.

## Ce que la leçon du 04/09 disait de faux

Elle concluait : « le déficit vient du fait de retenir du capital que le témoin
engage ». C'est **faux**, et le balayage du plancher le montre en une colonne :

| | capital engagé |
| --- | --- |
| stratégie, plancher à 0,15 | 9 784 $ |
| stratégie, plancher à 1,0 | 9 851 $ |
| témoin | 9 986 $ |

**La stratégie engage 98 % de ce que le témoin engage.** Deux pour cent d'écart
de capital ne peuvent pas produire vingt et un pour cent d'écart de résultat.
Ce n'est donc pas *combien* elle engage — c'est **quand**.

L'erreur venait d'un chiffre juste lu au mauvais endroit : sans stop du tout,
le moteur n'engage que 6 397 $, et cette valeur-là avait servi à généraliser.
Elle décrivait un cas extrême, pas le régime ordinaire.

## Le mécanisme, et pourquoi il est structurel

Neutraliser la zone fait **tomber** le capital engagé à 8 316 $ — ce qui
surprend jusqu'à ce qu'on relise les multiplicateurs : `peur_extreme: 2.0`
achète le **double** de l'enveloppe dans les creux. La modulation ne fait pas
que retenir, elle avance aussi. C'est ce qui lui vaut ses 2,5 points.

Reste que les trois configurations se rangent dans l'ordre du capital engagé :

| | engagé | gain/douleur |
| --- | --- | --- |
| zone neutralisée | 8 316 $ | 9,59 |
| stratégie livrée | 9 784 $ | 12,07 |
| témoin plat | 9 986 $ | **15,25** |

Sur un panier en hausse séculaire, **celui qui engage le plus tôt gagne**, et le
DCA plat *est* la stratégie qui engage le plus tôt possible : toute l'enveloppe,
chaque semaine, sans condition. Un timing ne peut donc que retarder, et tout
retard coûte le rendement de l'intervalle.

Le dépôt le savait déjà par phase de marché — son README écrit que la stratégie
« bat un DCA aveugle quand le marché baisse, et perd quand il monte ». Ce que
la mesure ajoute est l'**addition** : sur une fenêtre longue où la hausse
domine, les phases gagnantes ne compensent jamais les perdantes.

## La règle, qui dépasse la crypto

**Contre un actif dont on croit qu'il monte à long terme, le timing est une
dépense, pas un revenu.** Il ne se justifie que si l'on doute de la hausse — et
c'est un pari sur la direction, jamais une optimisation du même pari.

Corollaire pour qui règle un moteur : **avant de tourner un bouton, mesurer sa
plage entière contre le témoin.** Quatre balayages ici ; trois ne pouvaient
rien changer, et rien ne le disait avant de les avoir faits. Des jours de
réglage se dépensent sur des vis qui ne tiennent rien.

## Ce que ça ne dit pas

**Que le moteur soit à jeter, ni que le DCA plat soit la bonne réponse.** Les
trois actifs mesurés ont tous survécu ; le témoin n'a jamais rencontré celui
qui ne remonte pas, et c'est exactement contre celui-là que la zone, le score
et le stop existent. Sur un jeton de faible capitalisation — ce que le radar
cherche — l'actif qui ne remonte jamais est le cas **courant**, pas
l'exception.

**Et que le banc fabriqué se soit trompé ici.** Le tableau inscrit dans la
configuration, mesuré sur six marchés fabriqués, annonçait que monter le
plancher dégrade la performance relative — de +13,0 % à 15 % jusqu'à +11,1 % à
40 %. Le rejeu réel dit la même chose, dans le même sens : 12,07 puis 11,77. La
leçon du 04/09 sur les bancs fabriqués reste juste — ils *peuvent* mesurer leur
auteur — mais elle ne dit pas qu'ils le font toujours, et celui-ci tombe juste.

**Enfin, la source reste quotidienne** : CoinMetrics ne publie qu'une clôture
par jour, donc tout ce qui se joue en séance est sous-estimé, stops touchés
compris.
