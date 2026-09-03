---
name: creation-video
description: "La chaîne complète d'une vidéo, du média brut au fichier publié — dans quel ordre, quelle compétence tient chaque étape, et ce qui change selon la destination (TikTok et Reels en 9:16, YouTube en 16:9, un carrousel en 1:1). À utiliser au **début** d'un travail vidéo, quand on ne sait pas encore par où prendre le sujet : « fais-moi une vidéo », « on monte quoi », « je veux publier ça », « par où je commence », « il me faut une vidéo pour YouTube et une pour TikTok ». À utiliser aussi quand une vidéo doit sortir en **plusieurs formats** : le cadrage, la durée et le niveau sonore ne se décident pas une fois pour toutes, et refaire l'export sans refaire ces trois décisions donne une vidéo recadrée qui ne marche nulle part. Cette compétence **n'exécute rien** : elle ordonne, elle décide de la destination, et elle passe la main. Douze compétences font le travail réel, et elles sont nommées à chaque étape."
---

# La chaîne d'une vidéo

Ce dépôt porte douze compétences vidéo et son. Chacune est bonne et aucune ne
dit **dans quel ordre** elles s'appellent, ni **quoi décider avant** de les
lancer. C'est le seul trou que celle-ci comble.

**Elle ne redocumente rien.** Un réglage recopié ici diverge du jour où son
propriétaire le corrige, et c'est le doublon le plus coûteux : deux fichiers
disent le vrai, puis un seul, et on ne sait plus lequel. Chaque étape ci-dessous
nomme la compétence qui la tient. Allez-y.

---

## Les deux décisions à prendre avant d'ouvrir quoi que ce soit

Elles ne se rattrapent pas au montage. Les prendre après coûte un remontage
complet, et c'est la faute la plus fréquente sur une vidéo multi-destinations.

### 1. La destination, et donc le cadre

| Destination | Rapport | Cadre | Ce qui décide vraiment |
| --- | --- | --- | --- |
| TikTok, Reels, Shorts | **9:16** — 1080 × 1920 | vertical | **La zone sûre, pas le rapport.** Les trois plateformes rognent différemment ; c'est leur **intersection** qui commande, jamais la plus permissive. Tout ce qui compte vit entre **12 et 45 %** de la hauteur — 230 à 865 sur 1920. Détail et mesures dans `CLAUDE.md §2` et `/sous-titres-qui-accrochent`. |
| YouTube « classique » | **16:9** — 1920 × 1080 | horizontal | Aucun rognage d'habillage. Le texte peut occuper le cadre entier, **sauf** le coin bas-droit, où se pose la durée et les suggestions de fin. |
| Carré, fil Facebook / Instagram | **1:1** — 1080 × 1080 | carré | Compromis. Il ne se fabrique pas en recadrant du 9:16 — il perd le haut et le bas, c'est-à-dire le texte. |

**Ce dépôt est vertical de naissance**, et il faut le savoir avant de promettre
de l'horizontal : les zones sûres, les gabarits de `motion/`, les scripts de
`tiktok/` et le plancher sonore de `/master-telephone` sont tous écrits pour
1080 × 1920. Un rendu 16:9 est possible, mais **rien ici ne l'a encore mesuré** —
et une session qui l'annonce comme éprouvé se trompe.

**On ne recadre jamais une vidéo finie d'un rapport à l'autre.** On remonte
depuis les rushes. Un 9:16 recadré en 16:9 perd les deux tiers de l'image et
place le sujet hors centre ; un 16:9 recadré en 9:16 coupe ce qui était à
gauche et à droite, c'est-à-dire tout le cadre utile. Si les deux formats sont
prévus, ils sont **deux montages**, et cela se décide maintenant.

### 2. La durée, qui commande l'écriture

Une voix off se lit à environ **2,5 mots par seconde**. Trente secondes tiennent
donc en **75 mots**, pas 150 — et un script trop long ne se sauve pas au
montage, il se réécrit. Le gabarit et le passage obligé sont dans
`tiktok/modele-script.md`.

---

## L'ordre de la chaîne

### Étape 0 — Juger la matière avant d'y toucher

**C'est l'étape qu'on saute, et elle coûte le plus cher.** Monter sur un rush
inutilisable, c'est découvrir à l'export que rien ne rattrapera la source.

→ **`/trier-les-rushes`** inventorie un lot d'un coup — doublons par empreinte,
meilleure définition disponible, laquelle garder parmi quatre variantes d'une
même génération, ce qui est à écarter.

Ce qui disqualifie une source, et qu'aucun montage ne rattrape :

- **Une définition inférieure à la cible.** L'agrandissement interpole, il ne
  crée pas de détail. Au-delà de ×2 ça se voit ; c'est la première des leçons
  dures de `kdp/CLAUDE.md`, et elle vaut pour la vidéo comme pour l'image.
- **Une cadence variable** (capture d'écran de téléphone, enregistrement de jeu).
  Elle passe le montage et désynchronise à l'export. Se normalise en amont, pas
  après.
- **Un son déjà saturé.** Une crête écrêtée ne se dé-écrête pas. Si le rush
  porte sa propre bande son et qu'on comptait la recouvrir, le vérifier
  **avant** — c'est une des familles de défaut de `/montage-sans-refaire`.

→ **`/voir-le-son`** rend spectrogramme, courbe de sonie et planche de vignettes
en images lisibles. À passer sur la source, pas seulement sur le rendu.

### Étape 1 — Le son avant l'image

Contre-intuitif, et c'est pourtant l'ordre qui économise le plus : la bande son
fixe la durée, les respirations et les points d'appui. Monter l'image d'abord
oblige à étirer le son pour rentrer dedans.

→ **`/bande-son`** fabrique la voix off — synthétisée sur la machine, sans
réseau ni clé —, la musique et les bruitages, puis mixe et vérifie en LUFS.
→ **`/sonotheque`** choisit la prise qui portera, parmi le lot.

**Le piège du lit musical, et il est déjà écrit là-bas.** Une normalisation
calée sur l'ensemble suppose que la parole occupe toute la durée. Sur une vidéo
de **14,8 s dont la voix ne couvre que 8,7 s**, le lit se retrouve à **−44 dB
absolus** : inaudible dès que la voix s'arrête, et les dernières secondes
sonnent comme du silence alors que le fichier mesure conforme. **La parade est
de poser le gain à la main** — `--musique-db`, autour de **−12** — plutôt que de
laisser la normalisation décider. Le détail, les mesures et les cinq ambiances
de `scripts/musique.py` sont dans `/bande-son` : c'est elle qui possède le
script, et c'est là que la valeur se corrigera.

### Étape 2 — Monter

→ **`/video-du-jour`** fabrique le fichier publiable depuis un script, une prise
de voix et des images : découpe sur la voix, recadrage 9:16 sur le sujet,
sous-titres calés au mot, transitions, export H.264/AAC vérifié.
→ **`/sous-titres-qui-accrochent`** pour le texte incrusté et sa zone sûre.
→ **`/etalonner`** dès que les plans viennent de sources différentes — c'est le
saut d'exposition d'un plan à l'autre que l'œil relève en premier.

**Les cartons d'intro et de fin** se fabriquent dans `motion/`, en Remotion, et
se posent en mode « Écran » : le fond noir y tient lieu de canal alpha, parce
que CapCut Android ouvre le H.264 sans discuter là où son support du WebM alpha
est incertain. La zone sûre y est **câblée dans le code** — boîte fixe à 22–88 %,
texte qui passe à la ligne au lieu de s'étirer.

**Et le carton de fin est l'endroit où l'on se fait avoir.** Un titre fantôme
figé derrière son texte, un carton hérité d'une version précédente : invisible
dans toutes les mesures, visible sur n'importe quelle image tirée du fichier.
La parade est à l'étape 4.

### Étape 3 — Sortir au bon niveau

→ **`/master-telephone`**. Un mixage conforme aux normes de diffusion — −14 LUFS —
est systématiquement trop faible là où le format court est regardé, et **rien
dans les mesures habituelles ne le signale**. À passer avant toute publication,
y compris quand le mixage paraît bon.

### Étape 4 — Regarder, pas seulement mesurer

**C'est la règle qui a été payée quatre fois dans la même soirée** : à chaque
fois la mesure disait vert et le fichier était faux, parce que ce qui avait été
mesuré n'était pas ce qui partait.

→ **`/montage-sans-refaire`** est la liste de contrôle, écrite après vingt-cinq
versions d'un même épisode de vingt secondes livrées et rejetées en une nuit.
Chaque ligne est un défaut réel, sa mesure et sa parade. **Elle se passe avant
de rendre, pas après une plainte.**

Trois gestes sur le **fichier final**, et sur lui seul : une planche d'images
sur toute la durée dernière seconde comprise ; le niveau entendu section par
section, filtré au-dessus de 400 Hz ; la durée et le raccord.

### Étape 5 — Publier

→ **`/publier-depuis-capcut`** pour la chaîne verticale faite au doigt, sur
Android, jusqu'à TikTok : l'ordre des opérations, le piège du canevas, le
contrôle du fichier exporté.
→ **`/sortir-les-fichiers`** avant que le conteneur d'une session soit effacé.
Ce qui n'est pas versionné part avec lui, et les rushes ne se refabriquent pas.

Puis le relevé : `tiktok/mesures.md`, **le jour même**. Le lendemain on se
souvient de l'impression, plus du chiffre.

---

## Ce que la chaîne a appris, et d'où ça vient

**Aznaroth épisode 1, publié.** C'est le seul montage de ce dépôt qui soit allé
jusqu'au bout, et il a donné trois choses : la borne horizontale et le cadre de
la zone sûre — un titre y avait été étiré de 9,8 % à 94,7 % et se faisait manger
par les boutons de Facebook —, la première demi-seconde comme point de bascule,
et le protocole CapCut → TikTok de `/publier-depuis-capcut`. Le détail est dans
`tiktok/feuilleton-ep01.md`, écrit **après** coup pour que le montage ne soit
pas reperdu : le conteneur d'une session distante est effacé, et il avait fallu
redemander à l'auteur le nom du dragon et le texte de la voix off.

**Les vingt-cinq versions d'une nuit.** Presque aucune rejetée pour une raison
nouvelle : les mêmes familles de défaut revenaient deux ou trois fois, faute
d'être écrites. Elles le sont maintenant, et c'est tout `/montage-sans-refaire`.

**La voix off et le lipsync, où la leçon est ailleurs.** Deux chemins avaient
été essayés et déclarés impossibles ; le troisième répond — **les objets de
release GitHub**, quand Hugging Face et les sites d'éditeurs sont refusés. C'est
comme ça que sherpa-onnx fabrique la voix à 25× le temps réel, sans réseau ni
clé, et que les poids Wav2Lip sont arrivés. **Deux chemins essayés ne font pas
une impossibilité**, et le premier endroit où chercher n'est pas le dernier.

Depuis le 01/09/2026, le connecteur MCP **ElevenLabs** porte aussi le lipsync —
Sync 3, Veed, OmniHuman —, la voix, les bruitages et la transcription. Son
trafic ne passe pas par la politique réseau, là où `api.elevenlabs.io` reste
refusé au tunnel le même jour. **Piège mesuré : le rapport d'image sort en 16:9
par défaut** et ne se règle que sur le nœud du flux — une série verticale paie
donc une image inutilisable qui a pourtant l'air réussie.

---

## Ce qui n'existe pas, et qu'il ne faut pas chercher

**« Il n'y a pas de montage Couverture Martin » a été écrit ici, et c'est faux.**
Le montage existe : `promocouverturemartin9x16.mp4`, 8,6 s, 1080×1920, H.264 +
AAC, produit par ffmpeg/x264 en deux passes d'encodage. Il montre un avant/après
— une fiche Google « Aucun site internet renseigné » à gauche, la page Artisan
Express à droite — et se termine sur le portrait d'Erwann, « créateur de sites
pour artisans ».

L'entreprise y est **fictive et l'assume à l'écran** : « Ceci est un exemple
fictif pour présenter le principe Artisan Express. Aucun artisan réel n'est
représenté ici — nom, coordonnées et photos sont inventés. » L'adresse montrée,
*12 Rue des Tisserands, 35000 Rennes*, et le numéro `06 XX XX XX XX` sont
inventés eux aussi — c'est voulu, et c'est ce qui distingue ce montage d'une
démonstration au nom d'un vrai prospect.

**Ce que la page n'a pas : de source.** Aucun fichier de ce dépôt ne contient
« COUVERTURE MARTIN », « Tisserands » ni « exemple fictif », et `git log --all
-S` ne les trouve à aucun commit — la page n'avait jamais été versionnée, elle
n'existait que filmée. **Elle a été refabriquée depuis le gabarit d'Artisan
Express, teinte `vert`, et remise en ligne :**
`artisan-express-demos.vercel.app/couverture-martin.html`. Ses deux boutons
sont des `<span>` et non des liens : le numéro affiché est `06 XX XX XX XX`,
donc aucun `tel:` n'est possible, et un bouton mort vaut moins qu'un bouton
inerte.

**La leçon, et elle vaut au-delà de ce fichier :** une session a écrit « ça
n'existe pas » à partir d'une recherche dans le dépôt, alors que la seule preuve
d'existence était un fichier hors dépôt. Ne pas trouver n'est pas une preuve
d'absence quand le livrable est une vidéo, qui ne se versionne pas.

*Couverture Tanguy* — page de démonstration d'Artisan Express, couvreur inventé
— et *Boulangerie Martin* — client d'exemple de `/demarrer-projet-client` — sont
deux noms voisins, et restent sans rapport avec ce montage.

**Il n'y a pas non plus de compétence `monter-video`.** Le montage est tenu par
`/video-du-jour` — qui fabrique — et `/montage-sans-refaire` — qui relit avant
de rendre.
