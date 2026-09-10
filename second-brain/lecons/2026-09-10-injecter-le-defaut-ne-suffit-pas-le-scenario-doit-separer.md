# Injecter le défaut ne suffit pas : le scénario doit séparer les deux mondes

*10/09/2026 — Amorce, sélection du sujet qui parle*

## Ce qui a été mesuré

Quatre règles neuves, quatre gardes écrites en même temps, quatre défauts
injectés pour les voir rouges. **Deux gardes sont restées vertes.**

| règle gardée | défaut injecté | verdict |
| --- | --- | --- |
| la marge de départage | départage sans marge | **rouge** |
| variance nulle rendue `null` | rendue `0` | **rouge** |
| une piste rompue s'arrête | borne de largeur retirée | **vert** |
| deux pistes ne prennent pas la même boîte | appariement non exclusif | **vert** |

Les deux vertes n'étaient pas mal écrites au sens ordinaire : elles
construisaient la bonne situation *en apparence*, et affirmaient la bonne
chose. Ce qui manquait est ailleurs.

## Pourquoi

**La borne de largeur.** Le scénario faisait sauter le visage après trois
échantillons. Sans la borne, la piste continuait — mais s'arrêtait quand même à
trois écarts, sous le plancher de quatre qui écarte les pistes trop courtes. Les
deux mondes rendaient donc `0 piste`, par deux chemins différents. Il a fallu
**allonger la suite après le saut** pour que le monde sans borne produise une
piste survivante.

**L'appariement exclusif.** Le scénario plaçait deux visages à quarante pixels
l'un de l'autre. Chacun gardait son plus proche, exclusivité ou non : la
collision que le test annonçait n'existait pas. Et une fois la collision
fabriquée, l'assertion — comparer les remuements — ne séparait toujours pas :
deux pistes collées au même visage partent de luminances différentes, donc leur
**premier** écart diffère de toute façon. Ce qui sépare vraiment les deux mondes
est le **nombre de pistes survivantes**, un et deux.

## La règle

**Un défaut injecté ne rougit que si le scénario place le système là où les deux
mondes divergent.** L'injection prouve que le code change ; elle ne prouve pas
que le test le voit. Entre les deux, il y a le scénario — et il peut,
tranquillement, se tenir dans la région où les deux versions rendent la même
chose.

Deux façons de tomber dedans, toutes deux vues ici :

1. **Une seconde règle absorbe la différence.** Un filtre en aval — un plancher,
   une borne, une valeur par défaut — ramène les deux mondes au même résultat.
   Le test mesure alors le filtre, pas la règle.
2. **L'assertion porte sur une grandeur qui coïncide.** Deux tableaux qui
   diffèrent d'un seul élément, une longueur plafonnée, une somme invariante :
   la grandeur existe dans les deux mondes et vaut pareil.

Le geste qui l'attrape est court : après avoir injecté, **regarder ce que le
test observe réellement**, pas ce qu'il affirme. Si les deux exécutions
impriment le même nombre, la garde est décorative, quelle que soit la justesse
de sa phrase.

## La quatrième du jour, et c'est le vrai enseignement

Trois autres leçons de la même journée disent la même chose sous d'autres
formes — une couche qui repeint et remplit le trou, un seuil trop large pour
l'écart cherché, une longueur saturée à sa borne. Avec celle-ci, la famille se
laisse énoncer d'un trait :

> **On vérifie qu'une sonde est juste ; on oublie de vérifier qu'elle est encore
> capable de bouger.**

Les quatre causes diffèrent, la parade est commune : **produire les deux
mondes, et exiger qu'ils rendent des nombres différents.** Tant que ce n'est pas
constaté, une garde verte ne dit rien du code — elle dit seulement qu'elle n'a
rien regardé.
