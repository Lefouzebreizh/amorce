# Roussy & Zéphy — Tome 1 : dossier de production, reconstitué

**Ces invites ne sont pas les originales.** Celles du tome 1 ont été écrites
hors du dépôt et perdues avec la conversation ; seules celles du tome 2 ont été
conservées. Ce dossier a été reconstitué en août 2026 **à partir des planches
elles-mêmes** : bulles relevées par reconnaissance de caractères sur les
planches corrigées, scènes décrites à la lecture.

Ce que cela implique, et qu'il faut savoir avant de s'en servir :

- **Une régénération donnera une planche proche, pas identique.** L'invite
  décrit ce qui est sur la page ; elle ne reproduit ni la graine, ni le modèle,
  ni le hasard de la génération d'origine.
- **Les bulles, en revanche, sont exactes.** Elles sont relevées sur les
  planches *après* correction : les coquilles de la relecture (`doucement`,
  `intérieur`, le « la la » doublé) sont déjà corrigées ici.
- **Régénérer une planche annule ce qui a été posé dessus** : chirurgie de
  glyphe, les sept écarts du jeu, les pupilles redessinées, le recadrage à 7 %.

Voir `kdp/relecture/PASSE-RESOLUTION.md` : la mesure ne recommande que **deux**
régénérations, « Ce livre appartient à » et « Faire le singe », seules planches
agrandies au-delà de ×2.

---

## La mécanique, en quatre temps

1. **Roussy nomme** une émotion difficile par une expression toute faite.
2. **Zéphy la prend au pied de la lettre** et la rend absurde, donc visible.
3. **Le décalage fait rire** et déplace le poids.
4. **On ne guérit pas, on apprivoise.** La fin est douce, jamais moralisante.

Le parchemin du bas n'est pas la morale du panneau 4 : il ouvre plus loin.

---

## Une inconsistance relevée à la reconstitution

**Trois planches ponctuent leurs bulles de guillemets français, les autres
non.** « Avoir une faim de loup », « Un temps de chien » et « Tempête et
bigorneaux » ouvrent et ferment chaque réplique par « … » ; les onze autres
histoires s'en passent. Personne ne l'avait relevé, et cela ne se voit pas en
lisant une planche à la fois.

Ce n'est pas une faute — c'est un choix qui n'a pas été tenu. Si l'une de ces
trois planches est régénérée un jour, **retirer les guillemets** : la majorité
fait la règle, et une bulle est déjà un signe de citation.

---

## Trois relevés du contrôle typographique, examinés

`kdp/tome2/relire.py` a corrigé **125 espaces fines insécables** manquantes
avant `!`, `?` et `:`. Il reste trois relevés, tous examinés et tous laissés en
l'état :

- **Page 11, « Et si j'avais su » entre guillemets.** Le contrôle refuse les
  guillemets dans une bulle, parce que la bulle *est* déjà la citation. Ici ce
  n'est pas le cas : c'est une citation **imbriquée**, qui nomme une chose. Le
  français demande alors des guillemets. Faux positif du contrôle, à ne pas
  corriger. La planche imprimée, elle, porte des guillemets droits — à passer
  en guillemets français si elle est un jour régénérée.
- **Page 17, panneau 2, bulle de 24 mots** au lieu de 22. C'est vrai, et c'est
  déjà imprimé ainsi. À raccourcir seulement en cas de régénération.
- **« Pas de panique ! » et « Mais pas du tout ! », négation sans « ne ».**
  Correctes toutes les deux : ce sont des négations elliptiques, sans verbe, où
  le « ne » n'a pas lieu d'être.

**Une différence assumée avec les planches.** Ce dossier porte les espaces fines
insécables ; les planches imprimées du tome 1, non — elles ont été lettrées
avant que la règle ne soit écrite. C'est une spécification pour régénérer, pas
un relevé de l'existant : elle vise mieux que ce qui est sur le papier.

---

## Le bloc de style, commun à toutes les planches

```
Children's book illustration, soft watercolour and coloured-pencil style, warm
vintage cream paper texture, gentle autumn palette.

ROUSSY: a small slender red fox cub, copper-orange fur, white chest and white
tail tip, amber eyes, expressive eyebrows. Quadruped fox anatomy, never
humanised.

ZEPHY: a small winged zebra foal. Realistic equine anatomy — four hooves, no
human torso, no hands. Black and white stripes, mane and tail tuft in violet and
gold, large feathered wings in violet fading to gold. Comic, rubbery, highly
expressive face; often tongue out, eyes crossed or spiralled.

LAYOUT: square 2x2 comic grid, four equal panels, thin ornate corner frames,
small numbered medallion (1 to 4) in the top corner of each panel. Decorative
border of autumn leaves, oak leaves, acorns and violet feathers running around
all four edges and bleeding off the page. Title in elegant brown script across
the top. Unfurled parchment scroll across the bottom carrying one italic
sentence.

FRENCH SPEECH BUBBLES, cream white, soft rounded outline, black handwritten
sans-serif, no quotation marks inside the bubbles.

Render at 2600 x 2600 pixels. Keep the title and the parchment at least 0.3 inch
away from the image edge; let only the leaf border reach the edge.
```

Les pages d'atelier, la carte, le diplôme et l'hymne n'ont pas de grille 2×2 :
leur invite porte son propre cadrage, indiqué en tête de chacune.

---

## Page 1 — Ce livre appartient à

*Page de garde. À régénérer en priorité : agrandie ×2,54, c'est la plus molle
du recueil.*

Pas de bulles. Texte calligraphié dans l'image, ligne à remplir laissée vide.

```
Single full-page illustration, no comic grid, no speech bubbles.
Elegant gold-brown calligraphic title at the top on two lines: "Roussy & Zephy"
then "Ce livre appartient a :", with an empty writing line beneath.
Centre: one large single feather lying horizontally, violet fading to gold, with
a faint dusting of gold sparkles around it.
Lower third: ROUSSY and ZEPHY seen FROM BEHIND, sitting side by side on a pebble
shore, looking out at a calm sea at sunset, a small white lighthouse on the
horizon. A red squirrel and a hedgehog sit beside them; two small blue birds on
a branch at the right.
Wide decorative border of autumn leaves, acorns and violet feathers on all four
edges. Warm cream paper, very soft pastel watercolour.
```

---

## Page 2 — Carte de l'île bretonne imaginaire

*Carte, pas de grille ni de bulles. Les noms de lieux sont dans l'image.*

```
Hand-drawn watercolour treasure map on aged cream paper, thin double frame line.
Title in elegant serif capitals at the top: "CARTE DE L'ILE BRETONNE
IMAGINAIRE".
An island seen from above, sandy cliffs and orange autumn woods, a dotted path
winding across it. ROUSSY trots along the path, ZEPHY stands further right with
wings half open.
Place names in brown script around the island: "Foret des Souvenirs" over the
orange trees, "Phare du Destin" beside a small white lighthouse on the left
headland, "Lande des Hermines" over violet heather on the right, "Cascade du
Calme" over a waterfall at the bottom, "Vers le Pays des Reves" beside a cluster
of pale blue crystals in the top right corner.
A compass rose in the top left and bottom left corners, a ship's anchor in the
top right and bottom right. Autumn leaf border on all four edges.
```

---

## Page 3 — Qui est qui ?

*Page de présentation. Quatre médaillons, pas de grille de bande dessinée.*

```
Character reference page on cream paper. Two lines of brown script at the top:
"- Qui est qui ? -" then "Rencontre les amis de Roussy & Zephy".
Four round portrait medallions in a 2x2 arrangement, each in an ornate thin gold
ring, with a name and one line of description in brown script beneath:
- ROUSSY, red fox cub wearing a mustard yellow scarf, forest background.
- a WHITE ERMINE wearing a pale pink scarf, soft violet background.
- ZEPHY, winged zebra foal, wings spread, pale sky background.
- a LIGHTHOUSE at night on a rock, crescent moon, deep blue starry background.
At the bottom, two empty ruled cartouches side by side for the child to write in.
Autumn leaf and violet feather border on all four edges.
```

---

## Page 4 — Faire le singe

*Le rire comme sortie de la grisaille. À régénérer : agrandie ×2,41.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Pfff… Aujourd’hui, je suis tout gris à l’intérieur… |
| **2** | **Zéphy :** Attention, spectacle de singe savant ! Interdit de ne pas rire ! |
| **3** | **Roussy :** Hahaha ! Mais t’es un vrai singe, Zéphy ! |
| **4** | **Roussy :** Bon ok, faire le singe, c’est contagieux ! — **Zéphy :** Et c’est beaucoup plus joli qu’une tête qui boude ! HI HI ! |

> *Faire le singe, ce n’est pas être bête, c’est offrir son visage au sourire des autres.*

```
Panel 1: mossy autumn forest, ROUSSY sitting alone on a mossy stump, ears down,
eyes sad, small mushrooms around him.
Panel 2: bright sky, ZEPHY flying with an opened banana skin draped over his
head like a wig, tongue out, gurning.
Panel 3: sunny meadow, ROUSSY throwing his head back laughing, ZEPHY sitting
beside him grinning, a ladybird on the grass.
Panel 4: same meadow, both laughing together, ROUSSY sitting up on his hind legs
paws in the air, ZEPHY laughing with wings half raised, small flowers and a
spider on the grass.
```

---

## Page 5 — Avoir une faim de loup

*La faim qui déguise l'humeur. Guillemets à retirer si régénérée.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Ne me parle pas, Zéphy. Ne me regarde pas. Je ne réponds plus de rien. J’ai une faim de loup. — **Zéphy :** Une faim de loup ? Oh non… C’est une catastrophe médicale ! |
| **2** | **Zéphy :** Ouvre grand ! Est-ce que tes dents poussent ? Tu es en train de te transformer en prédateur ! |
| **3** | **Roussy :** Ce loup-là ne veut qu’une seule chose : un sandwich. — **Zéphy :** Chut ! Je l’entends. Le loup est coincé dans ton estomac ! Il faut l’amadouer ! |
| **4** | **Roussy :** Miam… Le loup s’est rendormi. Merci, Zéphy, tu m’as sauvé la vie. — **Zéphy :** Ouf ! Le monstre est apaisé. Tu as retrouvé tes yeux doux de petit renard. |

> *Quand le ventre est vide, la mauvaise humeur gronde comme un loup… mais un bon repas et un ami attentionné ramènent toujours la paix.*

```
Panel 1: autumn forest path, ROUSSY stomping along with front paws crossed,
scowling; ZEPHY hovering behind him looking alarmed.
Panel 2: ZEPHY holding Roussy's muzzle open with both hooves and peering inside;
Roussy's eyes squeezed shut, unimpressed.
Panel 3: meadow, ROUSSY standing with his belly letting out a huge cartoon
"ROOAAR" lettered across it; ZEPHY pressing one ear against the belly, listening
intently.
Panel 4: picnic on the grass, ROUSSY sitting biting into a big sandwich beside
an open wicker hamper of bread and fruit; ZEPHY sitting next to him, content.
```

---

## Page 6 — Un temps de chien

*La grisaille et l'abri d'un ami. Guillemets à retirer si régénérée.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Quel désastre… Regarde ce rideau de pluie. C’est officiellement un temps de chien. — **Zéphy :** Un temps de… quoi ?! Mais c’est une invasion ! — **Roussy :** Zéphy, par pitié… Il fait juste gris et il pleut des gouttes d’eau. Pas des chiots. |
| **2** | **Zéphy :** Des chiens qui tombent du ciel ?! Des gros ? Des caniches ? Roussy, imagine s’il pleut des saint-bernards ! |
| **3** | **Roussy :** Hmm… Ça n’a pas le goût de croquettes. Pourquoi les humains disent-ils ça alors ? — **Zéphy :** Parce que les croquettes ne tombent pas du ciel ! |
| **4** | **Zéphy :** S’il fait un temps de chien, alors faisons les petits chiens au chaud. Tiens, un chocolat chaud ! |

> *Quand la grisaille s’installe et que le temps est à la pluie, il suffit d’ouvrir l’aile d’un ami pour retrouver toute la chaleur de la vie.*

```
Panel 1: heavy rain in the woods, ROUSSY sheltering under a huge spotted
toadstool wearing a green scarf, glum; ZEPHY flying through the downpour.
Panel 2: ZEPHY standing on his hind legs scanning the sky through binoculars
held in his hooves; ROUSSY beside him, arms folded, rain streaming.
Panel 3: ZEPHY reaching out a hoof to catch raindrops and tasting them, puzzled;
ROUSSY looking up at him.
Panel 4: both sitting on the ground beneath ZEPHY's outstretched wing used as an
umbrella, holding steaming mugs of hot chocolate, rain around them.
```

---

## Page 7 — Avoir un chat dans la gorge

*Le chagrin qu'on n'arrive pas à dire.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Rrrr… je n’arrive plus à parler… J’ai un chat dans la gorge… |
| **2** | **Zéphy :** Mission Bienveillance activée ! Petit chat, sors de là, on a du lait chaud pour toi ! |
| **3** | **Roussy :** Miaou ! Hahaha ! Ton miaou est encore plus enroué que le mien ! — **Zéphy :** Miaou |
| **4** | **Roussy :** Merci, Zéphy… Parfois il suffit d’écouter doucement. — **Zéphy :** Et de câliner le petit chat intérieur avec bienveillance ! Ronron |

> *Avoir un chat dans la gorge, ce n’est pas être enroué, c’est entendre son petit chagrin miauler et le caresser avec bienveillance.*

```
Panel 1: forest, ROUSSY sitting on a stump with one paw at his throat, brow
furrowed, unable to speak.
Panel 2: bright sky, ZEPHY flying and carrying a steaming bowl of warm milk on
one hoof, tongue out, determined.
Panel 3: meadow, ROUSSY laughing openly; ZEPHY sitting with his tongue out
miaowing, eyes screwed up.
Panel 4: both cuddling a real small grey kitten between them, the bowl of milk on
the grass, everyone content.
```

---

## Page 8 — Donner sa langue au chat

*Ne pas savoir, et que ce ne soit pas grave.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Heu… je… mmm… — **Zéphy :** Alors Roussy, tu as trouvé la réponse à ma devinette ? |
| **2** | **Roussy :** J’abandonne ! Je donne ma langue au chat ! |
| **3** | **Zéphy :** Oh non ! Reviens ici, petit voleur de mots ! |
| **4** | **Roussy :** Ah ! Je l’ai récupérée ! Finalement, la réponse était : l’amitié ! — **Zéphy :** Bien joué ! Mais garde-la bien dans ta bouche cette fois ! HI HI ! |

> *Ne pas avoir de réponse n’est pas grave, tant qu’on a un ami pour traduire nos silences.*

```
Panel 1: autumn woodland floor, ROUSSY sitting with one paw at his chin,
embarrassed, a question mark above him; ZEPHY standing opposite, waiting.
Panel 2: ROUSSY eyes shut, sticking out his tongue which becomes a long glowing
golden ribbon; a small black kitten catches the end of it.
Panel 3: ZEPHY galloping after the black kitten who runs off trailing the golden
ribbon, a small "haha" lettered beside the kitten.
Panel 4: ROUSSY and ZEPHY laughing together, the black kitten sitting calmly
beside them.
```

---

## Page 9 — La tête dans les nuages

*Rêver sans se perdre.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Zéphy :** Mmmfff… j’étais en train de compter les étoiles du matin… |
| **2** | **Roussy :** Zéphy ! Redescends, tu vas louper le goûter ! |
| **3** | **Zéphy :** Oh… je crois que j’avais vraiment la tête dans les nuages ! |
| **4** | **Roussy :** La prochaine fois, garde au moins un pied sur terre ! |

> *On peut rêver la tête dans les nuages, tant qu’on garde un ami les pattes sur terre.*

```
Panel 1: valley view, a big white cloud with only ZEPHY's four legs and tail
dangling out of the bottom of it.
Panel 2: ROUSSY on his hind legs hauling down on ZEPHY's dangling legs, tugging
hard, one eye shut with effort.
Panel 3: ZEPHY back on the ground, dizzy, eyes spiralled, tongue out, wisps of
cloud still around his head; ROUSSY grinning up at him.
Panel 4: both sitting in golden afternoon light beside a small basket of
hazelnuts and acorns, laughing.
```

---

## Page 10 — L'araignée au plafond

*Les pensées bizarres, redécorées plutôt que chassées.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Au secours Zéphy… J’ai une araignée au plafond et elle tisse des idées toutes noires… |
| **2** | **Zéphy :** Hum… Manque cruel de paillettes ! Ce projet immobilier manque totalement de joie ! |
| **3** | **Roussy :** Tu es en train de redécorer mes paniques ? |
| **4** | **Zéphy :** Voilà ! Maintenant, tes pensées ont une jolie veilleuse. |

> *Avoir une araignée au plafond, c’est juste avoir une petite lumière qui danse différemment.*

```
Panel 1: dim wooden barn interior, ROUSSY sitting anxious in the foreground, a
big grey cobweb with a small spider in the top right corner.
Panel 2: ZEPHY inspecting the web wearing enormous round rainbow-rimmed glasses,
a yellow tape measure draped over his neck, one eyebrow raised.
Panel 3: the web now strung with garlands of bright paper flowers and stars,
confetti in the air; ZEPHY wearing a party hat shaking the little spider's leg;
ROUSSY watching, amused.
Panel 4: dusk, the web transformed into a glowing string of fairy lights and
paper lanterns, the spider in a tiny party hat at the centre; ROUSSY and ZEPHY
lying on the ground below, peaceful.
```

---

## Page 11 — Mon cerveau a oublié le bouton OFF

*Les ruminations du soir.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Pfff… mon cerveau fait du vélo sans moi… il pédale à 200 à l’heure ! |
| **2** | **Zéphy :** Aha ! C’est ton usine à « Et si j’avais su » qui a oublié de fermer ! |
| **3** | **Zéphy :** On ne va pas la débrancher, on va juste baisser le volume… chaussettes sur les oreilles et PCHHHHT ! |
| **4** | **Roussy :** Ah ! Ça fait du bien de laisser passer les nuages sans monter dedans ! |

> *On ne peut pas empêcher les pensées de passer, mais on peut arrêter de leur payer un loyer.*

```
Panel 1: night forest, crescent moon, ROUSSY wrapped tight in a brown blanket,
eyes open and tired, small thought bubbles floating around him reading "et
si...", "j'aurais du...".
Panel 2: ZEPHY hanging upside down in front of Roussy holding a yellow lamp,
tongue out; a question mark above Roussy's head.
Panel 3: ZEPHY, wearing a yellow hard hat, fitting fluffy grey ear muffs onto
ROUSSY's ears; fireflies in the dark.
Panel 4: dawn light, both running along a path, golden heart-shaped balloons on
strings trailing behind them, both laughing.
```

---

## Page 12 — La flamme qui s'éteint

*Quand l'élan retombe. Le seul épisode où Roussy soigne Zéphy.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Zéphy :** Je crois que j’ai perdu mon feu, Roussy. Il n’y a plus rien qui pétille. |
| **2** | **Roussy :** Un feu qui dort, ça se réveille. Regarde bien. |
| **3** | **Roussy :** HI HI HI, regarde ma tête de hibou fâché ! |
| **4** | **Zéphy :** HA HA HA ! Ça y est, il est revenu, mon feu ! |

> *Une journée sans rire, c’est une flamme qui s’éteint. Le rire, c’est l’étincelle qui la rallume.*

```
Panel 1: muted autumn wood, ZEPHY sitting head low, wings drooping, three small
smoking snuffed-out flames floating in soft bubbles around him.
Panel 2: ROUSSY sitting opposite holding out one paw with a single small golden
flame burning above it; ZEPHY looking at it, attentive.
Panel 3: ROUSSY pulling a ridiculous angry-owl face, cheeks puffed, blowing;
ZEPHY starting to smile, a small "pfff... pfff..." lettered beside him.
Panel 4: a tall golden flame blazing between them inside a spiral of light, both
laughing with their heads back.
```

---

## Page 13 — Fier comme un paon

*La fierté qui s'allège.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** TADAM ! Fier comme un paon… avec mes fougères de compétition ! |
| **2** | **Zéphy :** Wouah ! Tu as même inventé la queue de paon bio ! Tu veux un arrosage automatique ? HI HI ! |
| **3** | **Roussy :** HOOO ! Au secours ! |
| **4** | **Zéphy :** Finalement, une petite plume c’est plus léger ! — **Roussy :** Et tu es encore plus beau comme ça ! |

> *La vraie fierté vient du courage de se transformer.*

```
Panel 1: forest clearing, ROUSSY strutting with a fan of tall green ferns stuck
into his tail like a peacock's train, chin high.
Panel 2: ZEPHY flying above, laughing hard, eyes crossed into X shapes, tongue
out.
Panel 3: a gust of wind, the ferns tearing loose and blowing away, ROUSSY tumbled
over backwards, mouth open in alarm; ZEPHY flying in from the right.
Panel 4: ZEPHY placing one small violet feather on ROUSSY's head with a hoof;
ROUSSY sitting, eyes shut, smiling.
```

---

## Page 14 — Se tenir à cœur

*Sortir de sa réserve. Attention : c'est Zéphy qui porte ici la ligne sage, et
Roussy la réplique finale — l'inverse du contrat habituel.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Je préfère me tenir à carreau. On ne sait jamais… |
| **2** | **Zéphy :** À carreau, à carreau… tu comptes te tenir comme ça tout l’automne ? |
| **3** | **Zéphy :** Pourquoi rester coincé derrière un carreau quand on peut se tenir à cœur ? |
| **4** | **Roussy :** Wouah ! C’est vrai que l’automne est bien plus beau quand on n’a plus de vitre devant les yeux ! — **Zéphy :** Et ton cœur bat beaucoup plus vite que tes pattes ! HI HI ! |

> *Se tenir à carreau rassure, se tenir à cœur fait grandir.*

```
Panel 1: ROUSSY leaning on the sill of a closed rustic wooden window, wary,
autumn leaves outside.
Panel 2: ZEPHY appearing at the same window beside him, grinning, wings folded.
Panel 3: the window now open, ZEPHY leaning right through it into the room,
cheerful.
Panel 4: golden autumn light outdoors, ROUSSY bounding along a path delighted,
ZEPHY flying beside him, a rabbit and a hedgehog watching from the right.
```

---

## Page 15 — Le secret de l'hermine

**Pas d'invite.** Cette page est **composée par script** (`kdp/pipeline/page12.py`) :
son titre et son récit sont tracés en vectoriel, donc nets à toute taille et
corrigibles en une ligne. **Ne pas la régénérer** — ce serait troquer du texte
vectoriel contre du texte pixellisé.

---

## Page 16 — Tempête et bigorneaux

*Escale bretonne. Le phare intérieur. Guillemets à retirer si régénérée.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Quel vacarme ! La tempête veut tout emporter ! J’ai peur que les vagues nous avalent tout crus ! — **Zéphy :** Pas de panique ! J’ai déployé mes ailes anti-courants d’air. Accroche-toi à ma crinière ! |
| **2** | **Roussy :** Rien n’est solide, tout bouge ! Comment font les marins pour ne pas devenir complètement fous dans ce bazar ? — **Zéphy :** Ils regardent le phare, Roussy. Lui, il ne danse pas le Fest Noz avec le vent. |
| **3** | **Zéphy :** Regarde-le. Il ne se bat pas contre la mer, il reste juste debout et il brille. Sois ton propre phare. — **Roussy :** Être mon propre phare ? Facile à dire ! Je n’ai même pas de prise de courant sur la queue ! |
| **4** | **Roussy :** C’est vrai… Je suis comme le granit breton. L’orage peut passer, ma lumière reste allumée. — **Zéphy :** Voilà ! Et en plus, le granit, ça ne prend pas froid. En route pour le chocolat chaud ! |

> *Reste solide comme le granit. La plus belle lumière est celle que tu portes en toi pour éclairer tes propres nuits.*

```
Panel 1: storm at sea, huge waves breaking on black rocks, driving rain; ROUSSY
clinging to ZEPHY's mane, ZEPHY braced with wings spread wide against the wind.
Panel 2: the shore, calmer, ROUSSY standing on his hind legs with paws crossed
looking out; ZEPHY standing beside him, mane wet.
Panel 3: a white lighthouse on the headland in the rain, its lamp lit; ZEPHY
gesturing towards it with a hoof, ROUSSY sitting small in the foreground.
Panel 4: the storm passing, warm light returning, the lighthouse glowing behind
them; both standing on the rocks, ROUSSY confident.
```

---

## Page 17 — Le secret des vagues d'Ys

*Escale bretonne. La ville engloutie, et ce qu'on rebâtit.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** On dit qu’une ville entière est cachée sous ces vagues bleues. C’est triste de penser que tout peut disparaître… — **Zéphy :** Une ville sous l’eau ? Imagine le désastre pour le facteur ! Les lettres doivent être toutes trempées ! |
| **2** | **Roussy :** Je suis sérieux, Zéphy… Est-ce que nos souvenirs douloureux finissent eux aussi engloutis là-dessous ? — **Zéphy :** Seulement si tu les laisses couler, petit renard. Mais regarde le sable : la mer efface les traces pour nous donner une page blanche. |
| **3** | **Roussy :** Un château ? D’accord, mais j’exige des douves pour empêcher les bigorneaux de m’attaquer. — **Zéphy :** Ce qui est englouti devient le trésor de demain. Viens, on va reconstruire un château encore plus beau ! |
| **4** | **Roussy :** Regarde ma petite maison de sable ! Elle est magnifique. Je bâtis mon avenir ici. — **Zéphy :** Splendide ! Bon, par contre, la marée monte… On a exactement trois minutes avant qu’elle ne devienne un souvenir englouti. |

> *Même sous les vagues les plus sombres se cachent les trésors de ta force. On peut toujours rebâtir sur le sable neuf.*

```
Panel 1: clifftop above a blue sea, a lighthouse on a distant islet; ROUSSY
sitting looking out, ZEPHY standing behind him.
Panel 2: ROUSSY sitting on the grass looking down, troubled; ZEPHY leaning
towards him, gentle.
Panel 3: the beach, both standing on the sand, ZEPHY gesturing with a hoof,
ROUSSY already crouching to dig.
Panel 4: a finished sandcastle with a moat; ROUSSY standing proudly beside it,
ZEPHY looking at the incoming tide with wide eyes.
```

---

## Page 18 — La magie du Fest Noz

*Escale bretonne. Danser malgré la peur de mal faire.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Tu entends cette musique, Zéphy ? Le biniou et la bombarde appellent à la fête ! — **Zéphy :** Oh oui ! Ça swingue chez les blaireaux et les hérissons ! Viens, on va danser ! |
| **2** | **Roussy :** Attends ! Je ne connais pas les pas… J’ai peur de me tromper, de trébucher et de gêner tout le monde. — **Zéphy :** Regarde-moi : j’ai des ailes, quatre sabots et aucune idée de ce que je fais. Et pourtant, je m’éclate ! |
| **3** | **Roussy :** Bon… Si un hérisson arrive à danser sans piquer son voisin, je devrais y arriver ! — **Zéphy :** Laisse-toi porter par le rythme de la terre, Roussy. Dans un Fest Noz, on s’en fiche des erreurs, on est tous liés. |
| **4** | **Roussy :** Kenavo la tristesse ! Ce soir, mon cœur bat au rythme de la Bretagne ! — **Zéphy :** C’est ça ! Attention Roussy, tu danses tellement bien que tu vas finir par t’envoler avec moi ! |

> *La vie est une danse. Ensemble, on oublie ses peines et on retrouve la force d’avancer.*

```
Panel 1: night, paper lanterns strung between trees, a badger, a hedgehog and a
crow gathered; ROUSSY and ZEPHY arriving, ears up.
Panel 2: a bonfire, rabbits dancing in a ring holding paws with ZEPHY; ROUSSY
sitting apart, hesitant, knees drawn in.
Panel 3: ROUSSY up on his hind legs dancing with ZEPHY, rabbits, a badger and a
hedgehog circling them.
Panel 4: the full ring around the bonfire seen from behind, ROUSSY leaping in the
air laughing, ZEPHY rearing with wings spread, all the animals joined.
```

---

## Page 19 — Le murmure des étoiles

*Dernière histoire. Elle annonce le tome 2 dans sa dernière bulle.*

| | Bulle, telle qu'elle doit être lettrée |
| --- | --- |
| **1** | **Roussy :** Le Fest Noz est fini, Zéphy. C’est triste, la musique s’est éteinte. — **Zéphy :** Mais pas du tout ! Mon cœur fait encore du biniou-powa ! Écoute ! |
| **2** | **Roussy :** Regarde, le premier murmure de l’hiver ! Une étoile de glace ! — **Zéphy :** Slurp ! Tu crois que ça a le goût de la crêpe au beurre salé ? |
| **3** | **Roussy :** Hahaha ! Mais non, ça ne se mange pas ! C’est le monde des songes qui s’éveille. |
| **4** | **Zéphy :** Alors… prêt à rallumer toutes les étoiles avec moi pour le Tome 2 ? |

> *Le voyage ne fait que commencer. Quand une fête se termine, c’est juste pour laisser la place au Pays des Rêves…*

```
Panel 1: a Breton village at night, lit windows, ROUSSY sitting on a low stone
wall looking down; ZEPHY sitting beside him.
Panel 2: snowy pine forest, a single large six-pointed ice star glowing in the
sky; ROUSSY pointing up at it, ZEPHY with his tongue out.
Panel 3: falling snow, ZEPHY now wearing a striped scarf and striped leg warmers;
ROUSSY sitting in the snow, laughing.
Panel 4: deep starry night, ZEPHY facing the reader with wings fully spread and
glittering, ROUSSY sitting in front of him; frost and snowflake border.
```

---

## Page 20 — Le goûter des menhirs

*Jeu des sept différences. Deux vignettes, pas de grille 2×2 ni de bulles.*

**Ne pas régénérer sans nécessité** : les sept écarts sont posés et vérifiés par
`kdp/pipeline/page17.py`, à partir d'**une seule** vignette dupliquée. Une
nouvelle génération obligerait à tout reposer, un écart après l'autre.

```
Title in gold-brown script across the top: "Le Gouter des Menhirs - Trouve les 7
differences !".
Below it, the SAME illustration twice, side by side in two thin frames, labelled
A and B in small corner medallions.
The illustration: a Breton moor at sunset, three tall standing stones carved with
spiral triskelion motifs, purple heather. ROUSSY wearing a blue scarf sits on a
flat stone; ZEPHY stands beside him with wings spread. A glowing violet potion
bottle floats in the air between them. A slice of buttered bread with red topping
lies on the stone, an open wicker picnic hamper with a honey pot sits on the
grass at the left, a white ermine at the front right, and a small korrigan in a
brown jerkin at the right edge.
Cream paper, autumn leaf border on all four edges.
```

---

## Page 21 — La météo de mon cœur

*Page d'atelier. Pas de grille ni de bulles.*

```
Workshop page on cream watercolour paper with soft violet and grey paint
splashes. Elegant dark script title across the top: "La Meteo de mon Coeur".
Four round watercolour medallions in a 2x2 arrangement: a golden sun, a grey rain
cloud with blue drops, a storm cloud with a yellow lightning bolt, a pale
rainbow. Beneath each, a small ruled cartouche beginning "Aujourd'hui je me
sens..." with empty writing lines.
At the bottom, ROUSSY sitting on the left and ZEPHY sitting on the right with
wings spread. Light autumn leaf border.
```

---

## Page 22 — Dessine ton propre animal magique

*Page d'atelier. Le cadre central doit rester entièrement vide.*

```
Workshop page on cream paper. Brown script title across the top: "Dessine ton
propre animal magique".
The centre is a LARGE EMPTY FRAME made of woven vines, small leaves and tiny gold
stars, enclosing a completely blank cream area for the child to draw in — no
illustration inside it whatsoever.
ROUSSY sits at the bottom left of the frame, ZEPHY stands at the bottom right
with wings raised. Violet heather, autumn leaves and feathers around the edges.
```

---

## Page 23 — Coloriage

*Page à colorier. Trait noir pur, aucun aplat, aucun gris.*

```
Colouring page: PURE BLACK LINE ART ON WHITE, no shading, no grey, no fills, thick
clean even outlines suitable for a young child.
Title across the top in large hollow outlined capitals: "ROUSSY & ZEPHY".
ROUSSY sits on the left and ZEPHY sits on the right, facing each other, both
smiling; ZEPHY's wings drawn as clear separate feathers.
Around them: two trees with simple foliage, small clouds, two butterflies, a bird
on a branch, a tree stump, ferns, flowers, acorns and fallen leaves, and a small
lighthouse on the horizon at the right.
Leave generous white space; every shape closed so it can be coloured in.
```

---

## Page 24 — Mon journal de lumière

*Page d'atelier.*

```
Workshop page on cream watercolour paper with faint violet paint splashes and
gold sparkles. Gold script title across the top: "Mon Journal de Lumiere".
Three ruled cartouches stacked down the page, each with a script heading and
empty writing lines: "Aujourd'hui, j'ai reussi a...", "Mon moment prefere...",
"Demain, j'ai envie de...".
At the bottom, ROUSSY and ZEPHY asleep curled up against each other on a bed of
violet heather, ZEPHY's wing folded over them. Autumn leaf border.
```

---

## Page 25 — Le diplôme du Petit Phénix

*Page de récompense, à remplir. Pas de bulles.*

```
Award certificate on aged cream paper. Ornate gold script title across the top:
"Diplome du Petit Phenix". Beneath it, in brown script: "Decerne a" followed by a
long dotted line, then "pour son courage et sa resilience.".
Centre: ROUSSY standing on his hind legs wearing small copper-and-violet feathered
wings of his own, and ZEPHY standing with his wings fully spread; between them, a
round gold wax seal embossed with a paw print.
Rich border on all four edges of golden oak leaves, acorns and violet feathers.
```

---

## Page 26 — L'hymne de Roussy & Zéphy

*Page de l'hymne. Le QR est **retracé en vectoriel** par
`kdp/pipeline/hymne.py` : la planche générée sert de fond, son QR d'origine est
recouvert. Ne pas se soucier de sa lisibilité à la génération.*

```
Single full-page illustration, no comic grid, no speech bubbles.
Gold script title across the top: "L'Hymne de Roussy & Zephy".
Beneath it, six centred lines of italic French verse in dark brown.
Lower half: ROUSSY sitting upright on the left in profile, ZEPHY lying down on the
right with his wings fully spread, violet fading to gold, dusted with sparkles.
At the bottom centre, a small line of italic caption and a square placeholder for
a QR code.
Cream paper, autumn leaf and violet feather border on all four edges.
```

---

## Page 27 — Mon histoire

*Page de l'auteur. Le texte est celui d'Erwann et ne se réécrit pas.*

```
Author's page on cream paper. In the upper half, a soft watercolour vignette with
feathered edges: a Breton rocky coast at sunset, a small lighthouse on an islet,
warm orange and violet sky; ROUSSY sitting on a rock on the left, ZEPHY lying on
the rocks on the right with wings folded, both looking out to sea.
Beneath the vignette, a brown script heading: "Mon Histoire par Erwann
Lefouzebreizh", then a block of handwritten-style French text filling the lower
half.
Light autumn leaf and feather border in the four corners only.
```
