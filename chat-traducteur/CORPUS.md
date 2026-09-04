# Le corpus : ce qui manque, et comment le remplir

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

## 5. Ce qu'un corpus téléchargé ne réglera pas

Deux choses, et il vaut mieux les savoir avant de s'en réjouir :

- **Un bruitage n'est pas étiqueté par contexte.** « Chat qui miaule » ne dit
  pas si le chat a faim ou dit bonjour. Ces fichiers éprouvent la **porte**, la
  hauteur et la durée — ils ne valident aucune correspondance vers une
  intention. Pour ça il faut un chat qu'on connaît, filmé dans une situation
  qu'on sait nommer, et la seule source possible est le chat d'Erwann.
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
