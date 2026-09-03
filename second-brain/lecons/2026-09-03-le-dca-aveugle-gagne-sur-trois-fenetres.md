# Le DCA aveugle bat la stratégie sur les trois fenêtres réelles mesurées

Mesuré le 03/09/2026 sur NexusCrypto, en achevant le balayage du stop laissé
inachevé la veille. La question de départ était petite — 4 ATR ou 6 ATR ? — et
la réponse en a renversé une plus grande.

## Ce qui est mesuré

Rejeu multi-actifs BTC + ETH + LINK (CoinMetrics), trésorerie partagée,
10 000 $ de capital et 200 $ par semaine. Le témoin est le même moteur en DCA
plat : il achète l'enveloppe entière, chaque semaine, sans score et sans stop.
**Même dénominateur des deux côtés.**

| fenêtre | stratégie | témoin | écart |
| --- | --- | --- | --- |
| 2018 → 2026 | 11,77 | **15,25** | −23 % |
| 2018 → 2022 | 10,07 | **11,35** | −11 % |
| 2022 → 2026 | 4,06 | **6,33** | −36 % |

Colonne : gain par unité de recul **exposé**. Le PnL brut dit la même chose
(+945 % contre +1 172 % sur la fenêtre longue) — les deux colonnes s'accordent,
il n'y a pas d'ambiguïté à arbitrer.

## Le balayage du stop, qui était la question posée

Sur 2018 → 2026, à réglage identique par ailleurs :

| `atr_multiple_stop` | gain/douleur | capital engagé |
| --- | --- | --- |
| 4,0 | 11,77 | 9 676 $ |
| **6,0** | **12,07** | 9 784 $ |
| 8,0 | 11,74 | 9 616 $ |
| 12,0 | 11,64 | 9 516 $ |
| aucun stop | **7,07** | **6 397 $** |

Deux choses en sortent, et la seconde vaut plus que la première :

**6 ATR est bien le sommet**, et il tient sur la fenêtre longue — ce n'était pas
acquis, le réglage ayant été choisi sur 2018-2021. Mais le sommet vaut 12,07
dans un ensemble dont le témoin fait 15,25 : **c'est le meilleur d'un jeu
perdant**, et régler le stop ne rattrape pas l'écart.

**Retirer le stop est bien pire**, et pour une raison qui n'est pas celle qu'on
croit : sans lui, le moteur n'engage que **6 397 $** au lieu de 9 676 $. Dans un
DCA borné par la trésorerie, le stop **recycle du liquide**. Ce n'est pas une
protection qui coûte du rendement, c'est un mécanisme d'alimentation. La leçon
du 03/09 sur les onze stops de 2018 reste juste — ils ont bien coupé la reprise —
mais elle ne conclut pas à retirer le stop, et ce balayage-ci dit pourquoi.

## Ce que ça rend faux dans le dépôt

Toute phrase qui présente la stratégie comme battant un DCA aveugle. Elle ne le
bat sur **aucune** des trois fenêtres réelles disponibles, ni en gain par unité
de douleur, ni en rendement brut.

Et ce n'est pas une découverte du dehors : **le banc le dit lui-même**, sous
chacune des cinq sorties, sans qu'on ait rien demandé —

> ⚠ La protection **ne paie pas son prix** : le témoin rend plus par unité de
> recul **exposé**. Le recul du compte flatte la stratégie parce qu'une grande
> part y dort en liquide — et du liquide ne recule pas.

L'avertissement était imprimé à chaque exécution depuis qu'il existe. Ce qui
manquait n'était pas la mesure, c'était de la **lire** : on regardait la ligne
de la stratégie et le réglage qu'on venait de changer, pas la ligne d'en
dessous.

## La règle, qui dépasse ce moteur

**Un banc d'essai qui compare à un témoin ne sert à rien tant qu'on lit la
colonne de son propre camp.** Le réflexe est de faire varier un réglage et de
regarder si *sa* ligne monte — et elle monte, on progresse, on publie. La seule
question qui compte est ailleurs : a-t-elle dépassé le témoin ? Trois jours de
réglages ont amélioré une stratégie qui n'a jamais cessé de perdre contre la
chose qu'elle est censée remplacer.

Corollaire de méthode : un avertissement imprimé **inconditionnellement** finit
par ne plus être lu, exactement comme une alerte de vérificateur qui ne s'éteint
jamais — cas déjà écrit dans `CLAUDE.md` §7 bis. Ici il disait vrai depuis le
début.

## Ce qui ne se conclut pas de là

**Que la stratégie soit à jeter.** Trois fenêtres, trois actifs, une source
quotidienne sans mèches — le chargeur CoinMetrics fabrique
`bas = min(clôture, clôture de la veille)`, donc tout ce qui se joue en séance
est sous-estimé, stops touchés compris. Un moteur qui perd sur des clôtures peut
perdre autrement sur des bougies réelles, en mieux comme en pire.

**Et surtout pas qu'un DCA plat soit la bonne réponse pour autant.** Le témoin
gagne ici sur des actifs qui ont tous survécu. Il n'a jamais été éprouvé sur un
actif qui ne remonte pas — et c'est exactement contre celui-là que le score et
le stop existent.
