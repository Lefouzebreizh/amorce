# Traducteur de chat

Quelqu'un enregistre son chat pendant trois secondes. L'application dit ce
qu'elle a entendu, et l'habille d'une scène partageable — pas d'un paragraphe.

**État au 01/09/2026 :** l'étage 1 (est-ce un chat ?) et deux des quatre
intentions marchent et sont mesurés. Les deux autres attendent une tête
entraînée qui n'existe pas encore, et l'application le dit franchement à
l'écran plutôt que de deviner.

## Ce que ça donne aujourd'hui

```
$ python3 chat-traducteur/cli.py enregistrement.m4a

Fichier   : enregistrement.m4a  (5.00 s, 9 fenêtres)
Intention : contentement
Source    : mesuree
Confiance : 0.66
Raison    : YAMNet a nommé « Purr » à 0.66.

À l'écran : « Reste. »
Scène     : fourrure en lumière rasante, plan très serré, presque immobile
Sous-titre: C'est bien. Ne bouge pas.
```

## La décision qui tient tout le projet

Les quatre intentions demandées — faim, envie de sortir, stress, contentement —
**ne sont pas au même niveau de preuve**, et confondre les deux moitiés est la
seule façon de rater ce projet.

| Intention | D'où elle vient | État |
| --- | --- | --- |
| **contentement** | YAMNet nomme `Purr` lui-même | **mesurée**, marche aujourd'hui |
| **stress** | YAMNet nomme `Hiss` ou `Caterwaul` | **mesurée**, marche aujourd'hui |
| **faim** | il faut séparer deux façons de miauler | tête entraînée manquante |
| **envie de sortir** | idem | tête entraînée manquante |

C'est la bonne nouvelle du projet, et elle n'était pas prévue : **le modèle
public livre déjà la moitié du produit**, et il la livre *mesurée*. Un
ronronnement n'est pas une supposition, c'est une classe que le modèle a
nommée.

L'autre moitié demande un classifieur entraîné sur des miaulements étiquetés
par contexte réel. Tant qu'il n'existe pas, l'application rend `indécis` — avec
son propre écran, conçu, qui dit « j'ai bien entendu un chat, mais je ne devine
pas plus ». Un pourcentage inventé sur un écran de partage a l'air d'une
mesure : `CLAUDE.md` interdit le procédé qui manipule, et c'en est un.

## Faisabilité — ce qui a été mesuré, pas supposé

Tout ce tableau a été relevé le 01/09/2026 depuis une session distante de ce
dépôt, en exécutant, pas en lisant de la documentation.

| Question | Réponse mesurée |
| --- | --- |
| YAMNet TFLite existe-t-il, récupérable ? | **Oui**, 4 126 810 octets, md5 `d02e1b83…` |
| Depuis quel hôte ? | `storage.googleapis.com` (miroir MediaPipe) — **`tfhub.dev`, `kaggle.com` et `huggingface.co` rendent tous `000`** |
| Le modèle tourne-t-il ici ? | **Oui**, entrée `[15600] float32`, sortie `[1, 521] float32` |
| Les étiquettes ? | **Embarquées dans le `.tflite`** : c'est aussi une archive ZIP, qui contient `yamnet_label_list.txt` |
| Y a-t-il des classes félines ? | **Cinq** : `Cat` (76), `Purr` (77), `Meow` (78), `Hiss` (79), `Caterwaul` (80) |
| Assez rapide pour un téléphone ? | **1,9 ms** par fenêtre de 0,975 s sur un cœur de serveur — environ 500× le temps réel |
| Détecte-t-il un vrai miaulement ? | **Oui** : `Cat` 0,988, `Meow` 0,891 sur un bruitage réaliste |
| Rejette-t-il ce qui n'est pas un chat ? | **Oui** : sinus de synthèse → `Synthesizer`, cumul félin 0,008 |
| Le dataset CatMeows est-il récupérable ? | **Non depuis ici.** Zenodo et Mendeley rendent `000`, aucun miroir GitHub trouvé |

### Sur mobile

Rien n'a été éprouvé sur un téléphone — c'est la limite honnête de ce lot.
Ce qui est établi : le modèle est au format TFLite, pèse 4 Mo, et son coût
d'inférence laisse trois ordres de grandeur de marge. C'est la même brique que
celle qu'utilise MeowTalk. Rien n'indique un obstacle ; rien ne le prouve non
plus tant qu'un APK n'a pas tourné.

## Ce qui manque, nommément

**Le jeu de données étiqueté, et c'est le seul vrai blocage du projet.**

CatMeows (Ludovico & al.) porte 440 miaulements de 21 chats, étiquetés par
**trois** contextes : brossage, attente de nourriture, isolement. Deux choses
à en dire, et la seconde est plus gênante que la première :

1. **Il n'est pas téléchargeable depuis ce dépôt.** Zenodo est refusé au
   tunnel. Il faut le récupérer depuis la machine d'Erwann, qui a du vrai
   réseau, et le déposer dans `enregistrements/` (ignoré par Git).
2. **Ses trois contextes ne sont pas les quatre intentions demandées.**
   « Attente de nourriture » recouvre *faim*. « Isolement » recouvre à peu près
   *envie de sortir*, et ce « à peu près » est une hypothèse, pas une
   correspondance. « Brossage » ne correspond à rien de la liste. Et *aucun*
   des trois n'est *stress* ni *contentement* — que YAMNet donne déjà.

Autrement dit : le dataset public entraîne un modèle à trois classes qui n'est
pas celui du produit. Il reste le meilleur point de départ, mais il faudra
**des enregistrements maison étiquetés par Erwann** pour la classe qui manque.
C'est aussi ce qui rend l'axe communautaire — la correction collective, mise de
côté pour plus tard — plus stratégique qu'il n'en avait l'air : c'est la seule
source d'étiquettes qui passe à l'échelle.

## Structure

```
chat-traducteur/
├── noyau/              ← bibliothèque standard PURE, aucune dépendance
│   ├── intentions.py     les 4 intentions + INDECIS, et leur habillage
│   └── verdict.py        les deux étages de décision et le veto
├── adaptateurs/        ← le seul endroit qui importe numpy et TFLite
│   ├── audio.py          n'importe quel format → mono 16 kHz fenêtré
│   └── yamnet.py         le modèle, chargé une fois
├── scripts/
│   └── telecharger_modeles.py
├── tests/                20 tests, 0,001 s, sans rien installer
├── modeles/              poids — jamais versionnés
└── cli.py                le prototype : un fichier entre, une intention sort
```

**Le noyau ne connaît ni numpy, ni TFLite, ni fichier son.** Même règle que le
cœur de NexusCrypto, et pour la même raison : ce qui *décide* doit s'éprouver
sur une machine où rien n'est installé, sinon plus personne ne vérifie. Les 20
tests tournent en 1 milliseconde sur une session fraîche.

Le corollaire pratique : **l'habillage visuel se branchera sans toucher à ce
qui décide.** `noyau/intentions.py` porte déjà la table des scènes et des
sous-titres, séparée du verdict. C'est la couture prévue pour l'étape 3.

## Installer et lancer

```bash
pip install -r chat-traducteur/requirements.txt
python3 chat-traducteur/scripts/telecharger_modeles.py
python3 chat-traducteur/cli.py mon-chat.m4a --detail
```

Les tests du noyau n'ont besoin de rien :

```bash
python3 -m unittest discover -s chat-traducteur/tests
```

## Les décisions qui tiennent le code

### L'étage 1 est un veto, pas une note

Si le son n'est pas un chat, il n'y a pas d'intention à chercher — et surtout
pas à laisser un étage suivant en trouver une. Une porte qui claque a une
durée, une hauteur et une enveloppe ; un classifieur d'intention lui attribuera
quelque chose. Même ordre que le bouclier anti-rugpull de NexusCrypto : le veto
passe avant tout ce qui affine.

### `Cat` ouvre la porte et ne choisit jamais

Le premier défaut du projet, trouvé en **regardant de vrais scores** et non en
relisant du code. `Cat` est une classe *parente* : sur un miaulement réel elle
vaut 0,988 quand `Meow` vaut 0,891. La laisser concourir ferait qu'un
ronronnement à `Cat 0,90 / Purr 0,60` retiendrait `Cat`, ne trouverait aucune
lecture directe, et repartirait en `indécis` — la seule intention réellement
mesurable serait perdue à tous les coups.

Six tests étaient verts au moment où ce défaut existait. Aucun ne pouvait le
voir : le verdict rendu restait plausible.

### La meilleure fenêtre décide, jamais la moyenne

Trois secondes d'enregistrement portent un miaulement d'une demi-seconde
entouré de silence — c'est le cas d'usage normal, quelqu'un appuie puis attend.
Une moyenne sur les fenêtres noierait le seul instant utile.

### Le seuil de la porte est bas, et c'est mesuré

0,20 sur le cumul des cinq classes félines. Les valeurs relevées :

| son | cumul félin |
| --- | --- |
| sinus de synthèse | 0,008 |
| miaulement synthétisé à la main | 0,059 |
| **ronronnement réel** | **0,262** |
| miaulement réel | 1,84 à 1,97 |

Le ronronnement ne passe qu'avec six centièmes de marge : c'est le son félin le
plus discret que YAMNet connaisse, et c'est lui qui interdit de relever le
seuil sans mesurer. (Le cumul dépasse 1,0 parce que YAMNet est multi-étiquette :
521 sigmoïdes indépendantes, pas un softmax. Ce n'est donc pas une probabilité.)

### Une question reste ouverte

`Meow` ne porte aucune lecture — c'est la classe résiduelle. `Purr`, `Hiss` et
`Caterwaul` en portent une. Prendre le maximum fait donc parfois gagner celle
qui n'apprend rien : sur un chat qui feule, `Meow 0,891` bat `Caterwaul 0,586`
et le stress est perdu.

Une règle « la classe porteuse de lecture l'emporte » réglerait ce cas. Elle
n'est **pas** écrite : quatre bruitages générés ne sont pas un jeu de données,
et un seuil inventé ici aurait l'air d'une mesure. Le comportement actuel est
épinglé par un test qui échouera le jour où on tranchera — pour que ce soit une
décision et non une dérive.

## La suite

1. ~~Structure et faisabilité~~ — fait.
2. ~~Prototype : un fichier audio entre, une intention sort~~ — fait.
3. **Habillage visuel** par-dessus `noyau/intentions.py`. La table des scènes
   existe ; il manque le rendu. Le §2 de `CLAUDE.md` le borne : texte entre
   12 et 45 % de la hauteur, 18 px minimum, format 1080 × 1920.
4. **Enregistrements réels du chat d'Erwann.** Ils tranchent trois choses que
   rien d'autre ne peut trancher : le seuil de la porte, la question ouverte
   ci-dessus, et si `Purr` se détecte sur un micro de téléphone à un mètre.
5. **La tête d'intention**, quand il y aura des étiquettes. La couture est déjà
   là : `juger(..., tete_intention=…)`, éprouvée par un test.

Les deux autres axes — personnalisation par animal, correction collective —
restent notés pour plus tard, comme décidé.
