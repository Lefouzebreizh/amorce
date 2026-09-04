# Un banc fabriqué mesure l'hypothèse de son auteur avant de mesurer l'outil

Mesuré le 04/09/2026 en écrivant `pepites/temoin.py`, le banc d'essai du radar
de pépites. La leçon voisine du 03/09
(`2026-09-03-un-detecteur-sans-temoin-se-persuade.md`) disait qu'il faut un
témoin. Celle-ci dit ce qui arrive quand on en fabrique un — et c'est un piège
d'un autre ordre, parce qu'il rend un résultat net, chiffré, et faux.

## Ce qui s'est passé

Faute de données réelles — aucune archive de paires de faible capitalisation
n'existe — le banc engendre un marché. Premier jet : le rendement futur d'un
jeton suit sa demande réelle rapportée à la profondeur de son pool. Rien de
tordu, rien de choisi contre le radar.

Le banc a rendu son verdict : **la note du radar fait 9 points de moins que
tirer au hasard dans le même vivier.** Chiffré, reproductible, au-dessus du
bruit. Prêt à être annoncé.

Deux corrélations l'ont démonté :

| | corr. avec le rendement futur | corr. avec la note |
| --- | --- | --- |
| variation du cours déjà passée | **+0,838** | **−0,293** |

Sans le vouloir, j'avais écrit un monde **momentum** : ce qui a déjà monté
continue. Or le radar parie l'exact contraire, et l'écrit en propres termes —
un mouvement déjà visible est un sommet en train de se faire. Le banc ne
mesurait donc pas la note. Il mesurait **ma** thèse de marché, et le radar
perdait par construction.

## La règle

**Un marché fabriqué porte une thèse, qu'on l'ait voulu ou non.** Écrire la
ligne « voici comment le rendement se forme » *est* une prise de position sur
le fonctionnement du marché — la plus lourde du banc, et la seule qui ne se
présente pas comme un réglage.

D'où la parade, et elle ne coûte presque rien : **la thèse devient un
paramètre.** Le banc tourne plusieurs mondes aux observables identiques dont
seule la ligne du rendement change, et il n'annonce plus un verdict : il
annonce sous quelle hypothèse l'outil gagne. Ce qui reste à trancher est
nommé, au lieu d'être décidé en silence par l'auteur du banc.

**Un monde garde un verdict franc, et c'est celui qu'il faut garder** : celui
où le rendement est tiré **indépendamment** des observables. Il n'y a rien à
trouver, donc l'outil ne doit pas battre le hasard. S'il le bat, il lit du
bruit — et ce constat-là ne dépend d'aucune hypothèse sur la forme du marché.

## Le corollaire, qui compte autant

**Un banc doit imprimer ce qu'il n'éprouve pas.** Mesuré ici : **37 des 100
points** de la note du radar reposent sur des critères auxquels le marché
fabriqué ne donne aucun sens — l'accélération, le critère le plus lourd, en
tête. L'outil y dépense donc du poids sur du bruit, et perdre dans ces
conditions ne dit rien de lui.

Sans cette table, le banc rendrait un verdict qui a l'air général et ne l'est
pas. Elle s'imprime à chaque exécution et un test refuse qu'elle se vide.

## Ce qui distingue ce piège du précédent

L'absence de témoin (leçon du 03/09) laisse **sans** résultat : on tourne des
boutons en regardant sa propre colonne, et rien ne contredit jamais. C'est
coûteux et silencieux.

Un témoin fabriqué donne **un** résultat, chiffré et reproductible, qui a
toutes les apparences d'une mesure. Il est plus dangereux, parce qu'on le
publie.

## Ce qui ne se conclut pas de là

Qu'un banc fabriqué ne serve à rien. Celui-ci a rendu trois choses qu'aucune
suite de tests ne donnait : la note du radar **n'hallucine pas** (verdict
franc), elle **perd franchement** en marché momentum, et **la question qui
décide de tout** n'est pas le réglage des trapèzes mais la thèse de marché
qu'ils parient. Aucune de ces trois n'avait de réponse la veille.
