# Un détecteur sans témoin ne se règle pas — il se persuade

Mesuré le 03/09/2026, sur les deux moteurs crypto du dépôt, en achevant le
balayage commencé pour la leçon voisine
(`2026-09-03-le-dca-aveugle-gagne-sur-trois-fenetres.md`).

## Le score de NexusCrypto ne vaut presque rien

`influence_score` décide du poids du scoring dans le dimensionnement de chaque
achat. Balayé sur toute sa plage autorisée, stop à 6 ATR, BTC + ETH + LINK,
2018 → 2026 :

| `influence_score` | gain/douleur |
| --- | --- |
| 0,0 — le score ne pèse rien | 11,71 |
| 0,15 | **11,65** |
| 0,3 — le réglage livré | **12,07** |
| 0,333 — plafond du validateur | 11,95 |
| *témoin, DCA plat* | *15,25* |

Le plafond n'est pas arbitraire : la configuration **refuse** au-delà, avec son
motif — *« au-delà de 0,333 le score domine la zone de valorisation, ce qu'un
DCA doit refuser »*. La plage entière a donc été couverte.

**Toute l'influence du scoring tient dans 0,42 point**, quand il en manque 3,5
pour rejoindre un DCA aveugle. Et elle n'est même pas **monotone** : 0,15 fait
moins bien que 0, et le plafond fait moins bien que 0,3. Une courbe qui descend
puis monte puis redescend sur une amplitude aussi faible ne décrit pas un
réglage qui agit — elle décrit du bruit.

Conséquence pratique, et c'est ce qui vaut d'être retenu : **le déficit n'est ni
dans le stop ni dans le score.** Les deux ont été balayés sur toute leur plage,
et aucun des deux ne déplace le résultat de plus d'un demi-point. Ce qui coûte
est ailleurs — dans le fait même de retenir du capital que le témoin engage.

## Et le radar de pépites n'a pas de témoin du tout

`pepites/profils.py` fait passer six profils de marché fabriqués par les mêmes
filtres et la même note que le radar, avec les réglages du moment. Son en-tête
dit exactement ce qu'il fait, et il le fait bien :

> On bouge un seuil, on relance, on lit la colonne qui a bougé.

C'est un excellent outil de **régression** — il dit ce qu'un seuil vient de
casser ailleurs. Ce n'est pas un banc d'essai : il ne compare à rien. Aucun
témoin, aucun tirage au hasard, rien qui réponde à la seule question qui décide
si le détecteur mérite qu'on lui confie un dollar — **fait-il mieux que prendre
les jetons au hasard parmi ceux que DexScreener remonte ?**

C'est le même angle mort que la leçon voisine vient de payer sur NexusCrypto, en
pire : là-bas le témoin **existait** et son avertissement s'imprimait sous chaque
sortie ; on ne le lisait pas. Ici il n'y a rien à ne pas lire.

## La règle

**Un détecteur ne se juge jamais sur ses propres sorties.** Un scan qui remonte
vingt-cinq jetons sur trois cents a l'air de trier, et il en aurait l'air même
si sa note était tirée aux dés — c'est ce que « il a retenu 8 % » ne peut pas
distinguer. La seule mesure qui tranche est un **comparatif** : la même liste,
le même nombre de retenues, prises au hasard.

Le corollaire coûte peu et évite beaucoup : **un banc d'essai s'écrit avec son
témoin, dès le premier jour.** Ajouté après coup, il arrive toujours après que
des semaines de réglages aient été accumulées sur une chose qu'on n'a jamais
comparée à rien — et il devient alors très cher à regarder en face.

## Ce qui ne se conclut pas de là

**Que le radar ne trouve rien.** Ce n'est pas mesuré, et ça ne peut pas l'être
depuis une session distante : le radar a besoin de paires DexScreener de faible
capitalisation **en direct**, et les neuf hôtes de marché sont refusés par le
mandataire (`CLAUDE.md` §7). Aucun jeu figé sur GitHub ne porte ce genre de
données — CoinMetrics ne publie que des actifs majeurs, en clôture quotidienne.
Mesurer le radar là-dessus mesurerait autre chose que le radar.

Ce qui manque n'est donc pas le verdict, c'est **l'appareil qui permettrait de le
rendre** le jour où le radar tourne sur une machine avec du vrai réseau. Celui-là
s'écrit d'ici, hors ligne, et il ne dépend d'aucun hôte.
