# Le corpus : ce qui manque, et comment le remplir

> **L'application aussi a entendu ces quarante chats**, et par le chemin de
> l'utilisateur : `web/outils/epreuve-corpus.mjs` la conduit dans un vrai
> Chromium sur les 60 fichiers et compare au noyau Python. **60 verdicts
> identiques sur 60**, malgré deux rééchantillonnages différents.
>
> **Mis à jour le 04/09/2026.** Une partie de ce fichier décrivait un projet
> qui n'avait jamais entendu de vrai chat. Il en a entendu **quarante** —
> ESC-50, récupéré par `scripts/mesurer_esc50.py` — et ce qu'ils ont montré
> est écrit en tête plutôt qu'en note de bas de page.
>
> **La règle du stress était fausse.** `Caterwaul` s'allume sur n'importe quel
> miaulement : 30 chats sur 40 ressortaient « stress, mesuré ». Détail et
> chiffres dans le bloc de `CLASSES_PORTEUSES` de `noyau/verdict.py`.
>
> **La porte, elle, tient** : les 40 chats vont de 0,387 à 2,719 de cumul
> félin ; 16 des 20 témoins sont refusés sous 0,062. Quatre passent, et
> c'est la part non réglée — voir la fin de ce fichier.
>
> Ce que ce corpus **n'apporte pas** : des étiquettes de contexte. ESC-50 dit
> « chat », jamais « chat qui a faim ». La tête acoustique reste donc sans
> vérité de terrain, et sa licence CC BY-NC interdit d'embarquer ces fichiers
> dans un produit vendu.
>
> **Et ce que l'application dit vraiment de ces quarante chats n'était pas
> mesuré — 05/09/2026.** `mesurer_corpus.py` appelait le juge **sans la tête
> acoustique** : sa colonne « intention » était celle de la porte seule. Le
> défaut ne pouvait pas se voir sur ESC-50, dont aucun fichier ne porte
> d'étiquette de contexte — personne n'y attendait autre chose qu'`indecis`.
> Corrigé, l'outil rend ceci :
>
> | sur les 40 chats | verdict |
> | --- | --- |
> | **demande** | **26** |
> | contentement, *mesuré* | 3 |
> | stress, *provisoire* | 2 |
> | indécis | 9 |
>
> **31 chats sur 40 reçoivent une intention**, et non trois. Sur les vingt
> témoins, **zéro** : les quatre qui franchissent la porte ressortent tous
> `indécis`. Le défaut de porte reste entier, mais il ne fait dire à
> l'application rien de faux.
>
> Deux chats sur quarante ressortent en « Recule. » — stress *provisoire*, donc
> sans pourcentage affiché. C'est le seul verdict de cette liste qui touche à
> l'état de l'animal, et il vaut d'être surveillé pour cette raison-là.

Le projet a un modèle qui écoute, une tête qui lit, 47 tests qui gardent — et
**quatre sons réels** en tout. Ce fichier dit lesquels manquent, pourquoi ils ne
peuvent pas venir d'ici, et la commande qui les fait venir d'ailleurs.

## 1. Ce que le traducteur n'a encore jamais entendu

| son | état | ce qu'il éprouverait |
| --- | --- | --- |
| **un miaulement franc** | **jamais vu** | toute la tête acoustique — c'est le seul son qu'elle est faite pour lire |
| bâillement, ronronnement | vus (chat d'Erwann, 03/09) | la porte, la lecture directe `Purr` |
| feulement | 3 sons fabriqués | `Hiss`, mesurée **muette** — 0,000 sur les trois |
| miaulement long *contre* court | **jamais vu** | `FRONTIERE_LONG`, le seuil qui porte tout le partage requête / salutation |

La dernière ligne est la plus coûteuse. La source du référentiel range les deux
premiers types comme *aigus tous les deux* : seule la **durée** les sépare. Un
seuil posé à 0,7 s décide donc à lui seul entre « il demande quelque chose » et
« il te dit bonjour », et **aucun enregistrement n'a jamais servi à le placer**.

## 2. Pourquoi le son ne peut pas être rapatrié d'ici — mesuré le 04/09/2026

Le connecteur TubeAlfred cherche, décrit et transcrit. Il ne télécharge pas, et
rien d'autre ne le fait à sa place :

| chemin | résultat |
| --- | --- |
| `www.youtube.com` | **200** — l'hôte répond, contrairement à ce que le dépôt disait |
| `yt-dlp`, métadonnées et formats | **passent** |
| `yt-dlp`, octets (DASH `140`) | `403 Forbidden` |
| clients `tv`, `web_safari`, `ios` | *« Sign in to confirm you're not a bot »* |
| flux HLS `233` | `403` sur chaque fragment |
| URL média en direct, redirection suivie | `403`, zéro octet |
| `file-upload.com` (liens des chaînes de bruitage) | `000` — refusé au tunnel |
| clients `android_vr`, `tv_embedded` | *« Sign in to confirm you're not a bot »* |
| client `mweb` | **« require a GVS PO Token »** — le refus se nomme enfin |

**Huit clients, un seul mur, et le huitième dit lequel.** `mweb` ne parle ni de
compte ni de robot : il réclame un **jeton PO**, que `yt-dlp` sait faire
fabriquer localement par le greffon `bgutil-ytdlp-pot-provider`. Le greffon
s'installe depuis PyPI et se charge — mais son script serveur vit dans un dépôt
GitHub que la portée accordée à cette session refuse (`403` sur l'API comme sur
la page de publication ; seul `raw.githubusercontent.com` répond, fichier par
fichier). Le chemin existe donc, et il ne s'ouvre pas d'ici.

Ça change la parade sans changer la conclusion : inutile de chercher une clé ou
un compte YouTube — ce n'est pas ce qui manque.

**Ce n'est pas le mandataire, c'est la plateforme.** Une adresse de centre de
données sans cookies de session est refusée quoi qu'on tente : ni clé, ni
ouverture de domaine n'y change quelque chose. Un *runner* GitHub porte une
adresse de la même famille — plausiblement le même refus, **non mesuré, à ne
pas promettre**.

## 3. La commande, sur ta machine

Une adresse résidentielle passe là où celle-ci échoue. `yt-dlp` extrait
directement en WAV 16 kHz mono, la forme que lit `adaptateurs/audio.py` :

```bash
pip install -U yt-dlp
mkdir -p chat-traducteur/.fixtures/corpus && cd chat-traducteur/.fixtures/corpus

yt-dlp -x --audio-format wav \
       --postprocessor-args "-ar 16000 -ac 1" \
       -o "%(title).60s.%(ext)s" \
       <adresse de la vidéo>
```

Puis, depuis la racine du dépôt :

```bash
python3 chat-traducteur/scripts/mesurer_corpus.py chat-traducteur/.fixtures/corpus
```

`mesurer_corpus.py` **descend dans les sous-dossiers** depuis le 04/09/2026, et
c'est ce qui rend le corpus étiqueté mesurable : il range ses fichiers par
intention, là où `iterdir` ne lisait qu'un dossier plat et rendait « aucun son »
sur un dossier parfaitement rempli. Un dossier plat se comporte exactement comme
avant. Le nom de fichier porte désormais son sous-dossier — perdre l'étiquette
dans le tableau reviendrait à mesurer un corpus étiqueté comme s'il ne l'était
pas.

**Ces fichiers ne se committent jamais** — `.fixtures/` est ignoré, et
l'invariant « aucun binaire versionné » ne souffre pas d'exception. Ce qui
revient dans le dépôt est le **tableau de mesures**, jamais le son.

## 4. Les candidats, relevés le 04/09/2026

Repérés par TubeAlfred. Les durées et les vues viennent de ses fiches ; le
contenu réel n'a **pas** pu être écouté d'ici — c'est précisément l'objet de la
section 2, et personne ne doit lire cette liste comme validée à l'oreille.

### Ce qui manque le plus : le miaulement franc

| identifiant | titre | durée |
| --- | --- | --- |
| `_-t7ZCm6xj8` | son chat qui miaule | 9 s |
| `Gm6bGDIQYhc` | bruit de chat miaulement | 3 s |
| `Q2J9UxOi0MU` | bruit de chat miaulement 2 | 3 s |
| `wBdAiRsysDo` | chat qui miaule | 2 s |
| `fWxJG7t3SUQ` | miaulement de chat | 9 s |
| `-Fkmgl8iHrc` | chat qui miaule | 9 s |

Les quatre premiers viennent d'une même chaîne de bruitages, ce qui est un
**défaut de corpus, pas un avantage** : un seul enregistreur, peut-être un seul
chat. Les deux durées de 2 s et 9 s intéressent plus que le reste — elles
encadrent `FRONTIERE_LONG` des deux côtés.

### Pour éprouver le stress, où `Hiss` est muette

| identifiant | titre | durée |
| --- | --- | --- |
| `UAfM0jillzY` | bruit de bagarre de chat — feulements, grognements | 55 s |
| `7qxtTgWwHZE` | bruit de chat en colère | 3 s |

### Pour confirmer le contentement, déjà lu à 1,00

| identifiant | titre | durée |
| --- | --- | --- |
| `bcOAB-Cb4jY` | ronronnement de chat | 5 s |
| `DdWqjHDNJlg` | chat qui ronronne | 1 min 32 |

Adresse d'une fiche : `https://www.youtube.com/watch?v=<identifiant>`.

## 4 bis. Les enregistrements **étiquetés par contexte** — 04/09/2026

La section 5 ci-dessous disait qu'un bruitage n'est pas étiqueté par contexte et
que « la seule source possible est le chat d'Erwann ». C'était vrai des chaînes
de bruitages, et faux du reste de YouTube : **des milliers de gens filment leur
chat et écrivent le contexte dans le titre.** « Hungry cat meowing for food »,
« Cat meowing to go outside », « Cat greets owner home » — l'étiquette est
posée par la personne qui était dans la pièce.

C'est une étiquette **faible** : personne ne l'a vérifiée, et un téléverseur
qui écrit « hungry » décrit une situation, pas un son. Mais c'est la première
vérité de terrain que la tête acoustique aura jamais eue, et elle couvre
exactement les trois intentions que l'application ose nommer.

Vingt-huit enregistrements retenus, relevés par TubeAlfred, triés à la main sur
les fiches. La liste vit dans `scripts/telecharger_corpus_etiquete.py`, avec la
commande qui les rapatrie sur la machine d'Erwann :

| intention | fichiers | durée | ce que ça éprouve |
| --- | --- | --- | --- |
| `demande` | 9 | 14 min 34 | la carte que l'application produit le plus souvent, jamais confrontée |
| `salutation` | 6 | 2 min 37 | `FRONTIERE_LONG` — le seuil de 0,7 s posé sans un seul enregistrement |
| `contentement` | 6 | 2 min 50 | la lecture directe `Purr`, seule porteuse depuis ce matin |
| contrôles | 4 | 2 min 45 | ce que le traducteur ne doit **pas** affirmer |
| bruitages libres | 3 | 1 min 07 | la porte, sans contexte |

**Six des neuf « demande » sont des demandes de nourriture et trois des
demandes de sortie** : c'est le lot qui vérifiera, sur du son, la décision de
produit du 04/09 — fusionner les deux en une seule carte parce qu'aucune mesure
ne les sépare. Si la hauteur et la durée les séparaient franchement ici, la
décision mériterait d'être rouverte. Si elles ne les séparent pas, elle est
confirmée par autre chose qu'un référentiel de vulgarisation.

### Ce qui a été écarté, et pourquoi ça compte

- **`rsucLntx76E`**, le meilleur titre du lot — « My cat meowing and begging to
  open the door » — porte une **musique de fond**, annoncée dans sa propre
  description. Un fond musical déplace tout ce que YAMNet lit. Un titre parfait
  ne fait pas un enregistrement utilisable.
- **Deux vidéos ont changé de colonne à la lecture de leur description.**
  `Ev9S6SAQpPk` est titrée « Cat meowing loud at a door » et raconte un chat
  **paniqué** par quelque chose dans le garage ; `_Z-neVXZtXY` est titrée « to
  open door » et décrite en toutes lettres comme un **appel de chaleur**. Les
  deux sont passées en contrôles. **Le titre étiquette, la description
  corrige** — et lire les vingt-neuf descriptions a coûté un appel.

### L'oreille passe avant la mesure — décidé le 04/09/2026

Le propriétaire a tranché l'ordre : **écouter les vingt-huit d'abord**, mesurer
ensuite, et ne rien dépenser de plus tant que ce contrôle n'est pas fait.
C'est le bon sens de ce projet appliqué à lui-même — mesurer une liste que
personne n'a écoutée est exactement le défaut qu'il a payé deux fois, avec les
quinze sons fabriqués puis avec le plancher de `Caterwaul`.

Le script écrit donc une **feuille d'écoute** à côté des fichiers,
`FEUILLE-ECOUTE.md`, avec deux colonnes à remplir par fichier :

- **étiquette** — ce qu'on entend correspond-il au contexte annoncé ?
- **son** — un seul chat, sans musique ni voix par-dessus ?

Un `non` dans l'une des deux retire le fichier, **avant** la mesure. Un corpus
qu'on nettoie après avoir vu les résultats n'est plus un corpus : c'est un tri,
et il donne raison à celui qui trie.

La feuille vit dans `.fixtures/`, hors de Git. Ce qui revient dans le dépôt est
le verdict — quels fichiers tiennent, lesquels sautent et pourquoi — jamais les
enregistrements.

### Ce que l'oreille a rendu — 05/09/2026

Trois vidéos écoutées, choisies pour trancher deux questions et pas plus : un
chat qui veut sortir (12 s), un qui réclame à manger, un qui accueille (11 s).

| question | ce qu'il a entendu | ce que ça change |
| --- | --- | --- |
| faim contre envie de sortir | **deux sons différents**, reconnaissables | la *raison* de la fusion, pas la décision — voir plus bas |
| le « bonjour » est-il plus court ? | **nettement** | cohérent avec `FRONTIERE_LONG = 0.7`, qui n'avait aucun témoin |

**La première a été tranchée le même jour, et le résultat surprend** : l'oreille
sépare les deux, et la carte unique reste. Verdict du propriétaire — *« chaque
son est différent, on reconnaît quand il a faim, on reconnaît quand il sort. Donc
on garde ce qu'il y a. »*

Ce n'est pas une contradiction. **Il ne distingue pas avec ce que la tête
mesure** : un humain reconnaît au timbre, au contexte, à l'heure, au chat qu'il
connaît ; la tête ne lit que hauteur et durée. Ce qui change est donc la raison
de la fusion, et elle en sort plus solide :

| | pourquoi une seule carte |
| --- | --- |
| 04/09 | « c'est un seul son » — affirmation du référentiel |
| 05/09 | « ce sont deux sons que *nous* ne savons pas séparer » |

La seconde ne repose plus sur une phrase qu'une oreille vient de démentir. Ce
qui rouvrirait la question, et rien d'autre : un trait mesurable qui sépare les
deux groupes **à travers plusieurs animaux**.

### Trois vrais chats, filmés par le propriétaire à 5 h 10

Envoyés le 05/09/2026, hors de tout corpus téléchargé, contexte connu de lui.
**Trois fois `demande`, trois fois sur trois.** Un chat qui réclame à cinq
heures du matin : le verdict est le bon, et c'est la première fois que
l'application est confrontée à un enregistrement dont quelqu'un connaît
vraiment la situation.

| fichier | cumul félin | `Meow` | `Caterwaul` | verdict |
| --- | --- | --- | --- | --- |
| `chat-05h10` | 1,742 | 0,586 | **0,414** | demande |
| `chat-05h10-b` | 1,156 | 0,332 | 0,082 | demande |
| `chat-05h10-c` | 1,598 | 0,586 | 0,148 | demande |

Le premier confirme la correction de la veille sur un chat qu'ESC-50 n'a jamais
vu : `Caterwaul` y vaut **71 % de `Meow`** sur un miaulement parfaitement
ordinaire. Sous l'ancienne règle, ce chat-là sortait en « stress, mesuré ».

Ces fichiers vivent dans `.fixtures/erwann/`, ignoré par Git, et n'en sortent
pas.

### Un second référentiel, apporté le 05/09/2026 — et ce qu'il corrige

Le propriétaire a proposé trois vidéos de vulgarisation françaises. **Aucune
n'entre au corpus** : une voix humaine parle du début à la fin des trois, ce
qui est exactement le motif de rejet de `rsucLntx76E`. Leur valeur est ailleurs
— elles sont un **référentiel**, et le projet n'en avait qu'un.

Lu par transcription (PlanèteAnimal, 4 min 46, 1,2 M de vues), il liste **onze**
vocalisations là où la tête acoustique en connaît trois. Quatre écarts méritent
d'être notés :

| ce que dit le référentiel | ce que le projet en fait |
| --- | --- |
| **le ronronnement n'est pas toujours du plaisir** — chat malade, vulnérable, menacé, ou grondé | ⚠️ contredit la seule lecture `MESUREE` — voir le bloc `LECTURE_DIRECTE` de `verdict.py` |
| le **trille** (*chirrup*) : bref, moins d'une seconde, bouche fermée, salutation affectueuse | tombe du bon côté par accident — sous `FRONTIERE_LONG`, donc lu en contentement |
| le **grondement fréquent** peut signaler une douleur, « consultez un vétérinaire » | délibérément non implémenté — `archives-backlog/ou-a-mal-mon-animal.md` |
| l'**appel de chaleur** : hurlement long et traînant | confirme le reclassement de `_Z-neVXZtXY` en contrôle |

**Le premier est le plus lourd, et il n'est pas réglé.** Le modèle nomme un
*son*, `Purr` ; la carte en conclut un *état*, « il est content », avec un
pourcentage qui lui donne l'air d'une mesure. C'est la forme exacte du défaut
de `Caterwaul` corrigé la veille — sauf que l'erreur va cette fois dans le sens
rassurant, ce qui la rend plus dure à voir et plus grave à laisser.

**Ce qu'un référentiel ne remplace pas** : il dit ce qu'un son *signifie*, jamais
si le modèle sait le *distinguer*. `Purr` reste la classe la mieux séparée des
mesures — 0,148 à 0,262 sur trois chats, 0,008 au pire témoin. Ce qui est en
cause n'est pas la détection, c'est la phrase qu'on écrit dessus.

### Ce que cette liste n'est pas

Aucun de ces sons n'a pu être **écouté** d'ici, pour la raison de la section 2.
Les durées, les descriptions et l'absence de piste de sous-titres viennent des
fiches TubeAlfred ; l'absence de sous-titres rend une voix off improbable, elle
ne la réfute pas. Personne ne doit lire ce tableau comme validé à l'oreille.

**La licence n'est pas réglée non plus.** Six entrées viennent de chaînes qui
annoncent le domaine public ou l'usage libre ; les vingt-deux autres sont sous
licence YouTube standard. Elles servent à **éprouver** chez Erwann, comme
ESC-50 et pour la même raison, et ne peuvent pas être embarquées dans un
produit vendu. Un corpus qu'on ne peut pas redistribuer reste un corpus qu'on
peut mesurer.

## 5. Ce qu'un corpus téléchargé ne réglera pas

Deux choses, et il vaut mieux les savoir avant de s'en réjouir :

- **Un bruitage n'est pas étiqueté par contexte.** « Chat qui miaule » ne dit
  pas si le chat a faim ou dit bonjour. Ces fichiers éprouvent la **porte**, la
  hauteur et la durée — ils ne valident aucune correspondance vers une
  intention. Pour ça il faut un chat filmé dans une situation qu'on sait
  nommer — et **la section 4 bis en a trouvé vingt-huit**, étiquetés par leur
  téléverseur. La phrase « la seule source possible est le chat d'Erwann »
  était fausse : elle décrivait les chaînes de bruitages, pas YouTube.
- **La base de référence de l'animal manque toujours.** La source du référentiel
  attache le miaulement aigu et long aux chats *habituellement silencieux*, et
  l'aigu et court aux *bavards* : c'est une habitude, pas un son. Aucun corpus
  d'enregistrements isolés ne la porte.


## Ce que les quarante chats laissent non réglé — 04/09/2026

**Quatre témoins sur vingt franchissent la porte**, et deux méritent d'être
nommés parce qu'ils disent où elle est fragile :

| témoin | cumul félin | ce que YAMNet dit surtout |
| --- | --- | --- |
| coup à la porte | **0,590** | `Roaring cats` 0,586, `Roar` 0,586 |
| bébé qui pleure | 0,445 | `Babbling` 0,332, `Baby laughter` 0,199 |
| bébé qui pleure | 0,453 | `Animal` 0,500, `Domestic animals` 0,500 |

Le premier vient de `Roaring cats`, entré dans la porte le 03/09 parce que le
chat d'Erwann **bâille** et que YAMNet le range en rugissement. Sur les 40
chats d'ESC-50, cette classe vaut 0,000 à 0,043 — elle n'y sert à rien et y
coûte un faux positif.

**Ce n'est pas une raison suffisante pour la retirer**, et c'est pourquoi rien
n'a bougé : le contre-exemple qui l'a fait entrer est un vrai chat, filmé par
le propriétaire, dont 4,5 s sur 8 scoraient **zéro** sans elle. Deux corpus
disent deux choses opposées, et trancher demande de savoir lequel ressemble le
plus à ce que les gens enregistreront. Personne ne le sait encore.

Avec l'ancienne règle, le bébé qui pleure ressortait en **« stress, mesuré »**.
Il ressort désormais `indécis`, non parce que la porte a été réparée, mais
parce que plus aucune classe ne porte le stress. Le défaut de porte est intact
et il est écrit ici pour ne pas être oublié.
