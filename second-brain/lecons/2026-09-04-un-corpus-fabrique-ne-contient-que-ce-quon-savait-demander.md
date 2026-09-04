# Un corpus fabriqué ne contient que ce qu'on savait demander

*04/09/2026 — mesuré en confrontant le traducteur de chat à quarante vrais chats.*

## Ce qui a été mesuré

Le projet réglait sa lecture du stress sur **quinze sons fabriqués**. Sur ce
corpus, la classe `Caterwaul` de YAMNet séparait proprement : 0,000 à 0,031 sur
les miaulements ordinaires, 0,199 à 0,738 sur les sons de détresse. Un écart de
six. Un plancher à 0,10 tombait au milieu, et le fichier le disait « mesuré ».

Quarante enregistrements de chats d'ESC-50 — jeu de données de recherche — ont
dit autre chose :

| sur les 40 chats | min | médiane | max | ≥ 0,10 |
| --- | --- | --- | --- | --- |
| `Meow` | 0,020 | 0,627 | 0,918 | 39/40 |
| `Caterwaul` | 0,000 | **0,199** | 0,801 | **31/40** |
| `Purr` | 0,000 | 0,004 | 0,262 | 3/40 |
| `Hiss` | 0,000 | **0,000** | 0,000 | 0/40 |

La médiane de `Caterwaul` sur un chat **ordinaire** vaut exactement ce que le
corpus fabriqué rangeait du côté de la **détresse**. L'écart de six n'existe
pas : il n'y a pas de trou, `Caterwaul` suit simplement le volume du
miaulement.

Conséquence, avec la règle en place : **30 chats sur 40 ressortaient en
« stress », annoncé comme mesuré.**

## Le piège, avec sa cause

**Un corpus fabriqué ne contient que les sons qu'on a su demander.** On génère
« un miaulement », « un feulement », « un ronronnement » — trois intentions
nettes, bien séparées, parce que c'est ainsi qu'on les a commandées. Le monde
réel n'a pas cette obligeance : un vrai miaulement est fort, modulé, et
ressemble par bien des aspects à un cri de détresse.

Le défaut n'est donc pas dans le seuil, il est **dans l'échantillon**. Et il est
invisible depuis l'intérieur : sur son propre corpus, la règle sépare
parfaitement. Tous les tests étaient verts, et ils le sont restés.

Ce qui rend le cas coûteux, c'est que le fichier **savait**. Il portait, écrit
noir sur blanc : « ces quinze sons sont générés, pas enregistrés ; le plancher
n'a jamais vu un vrai chat ». La réserve était juste, datée, honnête — et le
produit a quand même été construit dessus pendant deux jours, parce qu'une
réserve écrite n'empêche rien. **Seule la mesure qui manque empêche.**

## Ce qui rend une phrase de ce dépôt fausse

« Le modèle public livre le contentement **et le stress**, mesurés. » Fausse.
Aucune classe de YAMNet ne porte le stress sur de vrais chats : `Hiss` est
morte (0,000 sur quarante), `Caterwaul` ne distingue rien.

## Ce qui vaut au-delà de ce projet

**Deux réparations plausibles ont été essayées et écartées par la mesure**, et
c'est cette partie-là qui se transpose :

- **Monter le seuil.** Impossible à justifier : la grandeur va de 0,000 à 0,801
  sans discontinuité. Tout nombre choisi là-dedans serait inventé et **aurait
  l'air d'une mesure** — la faute que ce dépôt s'interdit.
- **Passer à un rapport** plutôt qu'à un plancher. La règle s'allumait alors
  **deux fois sur vingt témoins contre une fois sur quarante chats** : plus
  souvent sur ce qui n'est pas un chat que sur ce qui en est un. Un critère
  qui se comporte ainsi ne se garde pas, même s'il « corrige » le symptôme.

D'où la règle : **quand aucun réglage ne sépare, la bonne réponse est de
retirer la lecture, pas d'en choisir un.** Le produit dit « je n'ai pas
compris » là où il annonçait une alarme. C'est moins vendeur et c'est le seul
état honnête.

**Et le garde-fou structurel a payé.** La carte n'affiche un pourcentage que
pour une lecture `MESUREE`. Le stress étant passé en `PROVISOIRE`, la carte a
cessé d'afficher son score **sans qu'une ligne d'habillage soit touchée**. Une
règle rendue structurelle survit au changement qui la met à l'épreuve ; une
règle laissée à la discipline aurait continué d'afficher un chiffre.

**Dernier point, et il s'est reproduit dans la même heure** : le test qui
mesurait les palettes est resté vert **en couvrant une intention de moins**.
Sa liste de cas contenait un `Hiss` qui ne produisait plus de stress ; la
palette du stress n'était donc plus éprouvée, et rien ne le disait. Une liste
de cas écrite à la main dérive dès qu'une règle change. **Compter ce qu'elle
produit** est le seul contrôle qui ne dérive pas avec elle.
