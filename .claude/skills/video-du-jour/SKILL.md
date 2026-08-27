---
name: video-du-jour
description: Fabriquer un fichier vidéo publiable à partir d'un script TikTok, d'une prise de voix et d'images — analyse et découpe de la voix, recadrage 9:16 sur le sujet, sous-titres calés au mot, transitions du studio, export H.264/AAC vérifié sur les pixels. À utiliser dès qu'une demande parle de monter une vidéo, d'exporter un montage, de sous-titrer une voix off, de recadrer des images en vertical, de préparer une publication TikTok, Reels ou Shorts — y compris quand elle dit seulement « monte-moi ça », « il manque les sous-titres », « le cadrage est moche », « ça ne marche pas dans Amorce » ou « je fais quoi maintenant ». À utiliser aussi quand le montage bloque : la moitié de cette compétence est la liste des pannes qui ne lèvent aucune erreur.
---

# Du script au fichier publiable

Cette compétence existe parce qu'une soirée entière a été dépensée à découvrir,
une par une, des pannes qui ne lèvent aucune erreur. Un export qui s'ouvre et
qui est noir. Un fichier trois fois trop court qui annonce la bonne durée. Un
sujet dont il ne reste que la croupe. Aucune ne se voit sans aller regarder.

**Le principe qui décide de tout : on ne juge pas un montage sur ses
métadonnées.** Une durée, un débit et un poids de fichier peuvent tous être
justes devant une vidéo inutilisable. Il faut mesurer les pixels et le signal
sonore, et il faut regarder des images. Les scripts fournis font les deux.

`references/pieges.md` porte la liste complète des pannes silencieuses, leur
symptôme et leur cause. **Le lire dès que quelque chose ne se comporte pas comme
prévu**, plutôt que de rechercher à l'aveugle : chaque entrée a coûté un quart
d'heure au moins une fois.

## Ce qu'il faut avant de commencer

Trois choses manquent dans un conteneur neuf, et `scripts/outils.mjs` les règle
seul : le Chromium de Playwright n'est pas téléchargé (on cherche celui de la
machine), `ffmpeg` n'est pas installé (on l'installe à la demande — celui que
livre Playwright est amputé et ne sait rien démuxer), et `fetch` est interdit
depuis une page `file://` (on sert le dossier en HTTP le temps du rendu).

Il n'y a donc rien à préparer à la main. Si un script échoue au lancement, la
cause est dans `references/pieges.md`.

## Le parcours

### 1. Écouter la prise

```bash
node .claude/skills/video-du-jour/scripts/voix.mjs ecouter voix.mp3
```

Rend la durée, chaque passage parlé, chaque silence, la crête. Le découpage
vient de `src/lib/voice.ts`, le module du studio — pas d'un calcul refait ici,
sans quoi deux calages coexisteraient pour un même fichier.

**Ce qu'on cherche dans cette sortie :**

- **Le silence de tête.** C'est le seul qui coûte vraiment : il tombe dans les
  trois secondes qui décident si le spectateur reste. 0,7 s de vide au début,
  c'est un quart de la fenêtre d'accroche dépensé pour rien.
- **Le nombre de passages**, qui doit correspondre aux phrases attendues. Un
  passage de trop, c'est une hésitation ; un de moins, c'est deux phrases
  collées, et les sous-titres se caleront mal.
- **La crête**, qui doit rester sous 0 dB. Au-delà, le fichier sature et aucun
  mixage ne le rattrape.

### 2. Rogner, et retirer ce qui est faux

```bash
node …/voix.mjs rogner voix.mp3 voix.wav
node …/voix.mjs garder voix.wav court.wav 0-2.16 6.30-15.02
```

`rogner` enlève les silences de tête et de queue. `garder` ne conserve que les
intervalles nommés — c'est ce qui permet de retirer une phrase devenue fausse
sans réenregistrer quoi que ce soit.

Les raccords sont croisés sur 60 ms. Un silence n'est pas du vide : il porte le
souffle de la pièce, et coller deux morceaux net y fait un trou qu'on entend.

**Quand une phrase enregistrée est devenue fausse, proposer d'abord la coupe.**
Réenregistrer coûte une prise, un raccord audible si la pièce a changé, et
souvent une soirée de plus. Une vidéo plus courte se termine plus souvent — et
c'est le taux de complétion qui décide de la distribution.

### 3. Caler les sous-titres

```bash
node …/voix.mjs caler court.wav --texte "La transcription exacte, mot pour mot."
```

Répartit les mots sur les passages parlés au prorata de leurs syllabes, coupe à
chaque silence, et rend un JSON prêt à coller dans le plan.

**Deux règles que le calage automatique ne connaît pas :**

- **Un sous-titre ne se termine pas sur un mot-outil.** « Elle est moche, et »
  laisse l'œil suspendu. Le script le signale ; reporter le mot sur le bloc
  suivant.
- **Un carton qui remplace un sous-titre doit porter la phrase entière.** Un
  carton graphique peut être plus ramassé que la parole — mais dès qu'il tient
  lieu de sous-titre, chaque mot prononcé doit être à l'écran. La majorité
  regarde sans le son.

### 4. Recadrer les images

```bash
node …/images.mjs mesurer *.webp
node …/images.mjs essayer zebre.webp --ancrages 0.5,0.62,0.72 --sortie /tmp/essais
node …/images.mjs recadrer --sortie /tmp/plans oeil.png zebre.webp:0.62 main.webp
```

`mesurer` dit, pour chaque image, quelle part de sa largeur survit au cadrage
9:16. En dessous de 60 %, il faut aller voir où est le sujet avant de monter.

`essayer` produit plusieurs cadrages du même fichier pour les comparer. **Les
regarder** — un recadrage se juge à l'œil, jamais au calcul.

**Ce qui se décide ici :**

- **Un sujet plus large que le cadre ne rentre pas.** Il faut choisir ce qu'on
  garde. Pour un animal ou une personne, c'est la tête : le train arrière qui
  sort du champ ne manque à personne, un museau coupé se voit immédiatement.
- **Une image qui porte un texte incrusté est presque toujours à écarter.** En
  9:16 il sera tronqué, et il se battra avec les textes du montage. `--hauteur
  0.9` permet de cadrer au-dessus d'un bandeau, au prix d'un cadrage plus serré.

### 5. Écrire le plan

Un fichier `plan.json` décrit toute la vidéo. C'est lui qu'on retouche quand
quelque chose ne va pas — jamais le code du compositeur.

```json
{
  "duree": 10.82,
  "fps": 30,
  "voix": "voix.wav",
  "transition": 0.3,
  "plans": [
    { "src": "01-oeil.jpg",   "de": 0.00, "a": 2.48,  "mouvement": "zoomIn",  "transition": "cut" },
    { "src": "02-noeud.jpg",  "de": 2.48, "a": 3.75,  "mouvement": "zoomOut", "transition": "zoomPunch" },
    { "src": "03-zebre.jpg",  "de": 3.75, "a": 10.82, "mouvement": "zoomIn",  "transition": "whipPan" }
  ],
  "cartons": [
    { "texte": "Je ne sais pas monter\nune vidéo.", "de": 0.10, "a": 2.34, "y": 0.30, "taille": 128 }
  ],
  "soustitres": [
    { "texte": "Alors je me donne un an.", "de": 2.48, "a": 3.66 }
  ]
}
```

Les chemins sont relatifs au dossier du plan. Y déposer les images et la voix.

**Mouvements** : `zoomIn`, `zoomOut`, `panLeft`, `panRight`, `none`.
**Transitions** : celles du studio — `cut`, `fade`, `whipPan`, `zoomPunch`,
`slideUp`, `flash`, `glitch`. Elles ne sont pas réimplémentées : le compositeur
importe `src/lib/transitions.ts` compilé.

**Les règles qui décident du plan :**

- **Les coupes tombent dans les silences**, jamais au milieu d'un mot. La
  sortie de `voix.mjs ecouter` donne les intervalles.
- **Aucun plan ne dépasse 2,5 s.** Au-delà, l'analyse du studio compte une
  retombée d'attention — et elle a raison.
- **Pas de panoramique sur un sujet serré.** Le balayage impose un sur-cadrage
  de 10 % qui rogne l'image : réservé à ce qui a de la marge autour de soi.
- **Un carton ne se pose jamais pendant un flash.** Gris sur blanc ne se lit
  pas, et le dernier carton est ce que le spectateur emporte.
- **Ne pas doubler un sous-titre par un carton qui dit la même chose.** Deux
  textes à lire pour une seule phrase à entendre, c'est un texte de trop.

### 6. Monter et vérifier

```bash
node …/monter.mjs plan.json --sortie jour-1.mp4
```

`monter.mjs` enregistre, réencode en H.264 + AAC, puis contrôle : durée réelle,
codecs, luminosité image par image, niveau sonore. Il annonce ce qui passe et ce
qui échoue.

**Ces contrôles ne suffisent pas, et c'est volontaire.** Ils attrapent le noir,
le muet, le tronqué — les pannes qui ne se voient pas. Ils ne verront jamais un
texte trop petit, un sujet coupé au bord, ni un raccord raté. Il faut regarder.

Pour regarder, `/voir-le-son` fait déjà le travail : planche de vignettes,
spectrogramme, courbe de sonie. L'appeler plutôt que d'en refabriquer une.

```bash
python3 .claude/skills/voir-le-son/scripts/voir.py jour-1.mp4 /tmp/regard
```

Ses huit vignettes sont réparties sur la durée. **Pour juger les raccords, il
faut viser les instants de transition**, que la planche régulière manque presque
toujours — deux lignes de ffmpeg suffisent, inutile d'un script de plus :

```bash
for t in 2.6 3.9 5.1 6.7 9.0; do
  ffmpeg -y -ss $t -i jour-1.mp4 -frames:v 1 -vf scale=300:533 /tmp/r-$t.png
done
ffmpeg -y $(printf -- '-i /tmp/r-%s.png ' 2.6 3.9 5.1 6.7 9.0) \
  -filter_complex hstack=inputs=5 /tmp/raccords.png
```

## Ce que d'autres compétences font déjà

Trois voisines couvrent une partie du terrain, et il vaut mieux les appeler que
refaire ce qu'elles savent — un deuxième outil pour le même geste, c'est un
choix à refaire à chaque fois, et deux résultats le jour où ils divergent.

| Pour | Appeler | Plutôt que |
| --- | --- | --- |
| Regarder un fichier — vignettes, spectrogramme, sonie | `/voir-le-son` | refaire une planche |
| Le niveau de sortie pour une plateforme, en LUFS | `/bande-son` | se fier à la crête |
| Ce qu'on raconte, la ligne, les concepts | `/tiktok` | improviser un script |
| Le ton de tout texte destiné au public | `/charte-editoriale` | écrire au jugé |

Le contrôle sonore de `monter.mjs` est délibérément sommaire : il dit « il y a
du son et il ne sature pas ». Ça suffit à attraper un export muet, et ça ne
remplace pas une mesure de loudness — un mixage à −1 dBFS de crête peut sortir
deux fois plus faible que la vidéo suivante.

## Ce qu'il faut demander, et ce qu'on décide seul

Le dépôt demande de décider plutôt que d'interroger — devant deux options
défendables, prendre la meilleure et dire laquelle en une ligne. Ça vaut
entièrement ici : cadrage, mouvement, transition, découpe, longueur des plans.

Trois choses restent à demander, et le montage en touche deux :

- **Ce qui part en public au nom de quelqu'un.** Produire le fichier n'est pas
  publier. Le rendre, dire ce qu'il contient, et laisser décider.
- **Ce qui révèle une œuvre non publiée.** Une planche, une couverture, un
  extrait sous embargo ne se montrent pas parce qu'ils feraient une jolie
  image. Le dire sans le montrer marche presque toujours aussi bien.
- **Ce qui engage de l'argent** — une voix de synthèse facturée, un service
  externe.

## Quand c'est fait

Le fichier existe : le rendre, dire sa durée, ses codecs, son poids, et ce qui a
été vérifié. Puis nommer ce qui reste ouvert.

**Et dire qui a monté.** Sur une chaîne dont le sujet est « j'apprends à monter
en public », un montage fait par la machine n'est pas un détail d'attribution :
c'est une information que le spectateur mérite, et qui fait souvent un meilleur
épisode suivant que si on l'avait tue.
