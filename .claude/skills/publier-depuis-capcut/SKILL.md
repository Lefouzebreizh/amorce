---
name: publier-depuis-capcut
description: La chaîne de montage et de publication d'une vidéo verticale faite au doigt, dans CapCut sur Android, puis publiée sur TikTok — l'ordre des opérations, le piège du canevas, le contrôle du fichier exporté et la lecture des statistiques. Établie sur le montage d'Aznaroth épisode 1. À utiliser dès qu'une demande parle de monter dans CapCut, de recadrer un projet, d'exporter en 1080p, de publier sur TikTok, de programmer une vidéo, de regarder les vues, la rétention ou les abonnés — et dès qu'un export arrive pour contrôle avant publication. À utiliser aussi quand une demande dit seulement « j'ai fini le montage », « je publie ça ce soir », « le format est bizarre », « ça n'est pas en plein écran », « c'est flou sur TikTok », « la vidéo ne marche pas », « pourquoi si peu de vues ». Ici c'est l'outil et la publication ; pour les défauts du fichier lui-même — son, coupes, sous-titres, climax — c'est `montage-sans-refaire`, et pour juger un média `voir-le-son`.
---

# Monter au doigt, puis publier

Établi sur le montage d'Aznaroth épisode 1, CapCut Android. Chaque point vient
d'un travail refait, pas d'une lecture de documentation.

## 1. L'ordre des opérations, sans exception

1. **Tous les raccourcissements de plans**
2. **Le carton de fin**
3. **La musique** — réduction de bruit coupée, recalage, volume

**Raison :** toute coupe faite après le carton décale tout ce qui suit. Le
travail est refait deux fois.

C'est le même invariant que la chaîne en ligne de commande
(`montage-auto/finir_episode.sh`), qui pose ses couches sonores **après**
l'assemblage du carton et pour la même raison : ce qui se cale sur une durée
doit venir après tout ce qui change cette durée.

## 2. Le canevas — le piège principal

**CapCut fixe le format du projet sur le PREMIER clip importé, et ne le corrige
plus ensuite.** Recadrer les clips un par un ne change rien : le canevas est
déjà posé.

- Démarrer tout nouveau projet en important **d'abord** un clip en vrai 9:16 —
  1080×1920, 1152×2048, 720×1280.
- Le déplacer **ensuite** à sa vraie place dans la frise.
- À éviter en position 1 : tout format bâtard, type 768×1344.

## 3. Contrôler le fichier exporté AVANT de publier

Jamais après. Quatre chiffres, et ce qu'ils veulent dire :

| relevé | attendu | ce qu'un écart signale |
| --- | --- | --- |
| largeur | **1080 px** | 2 px : négligeable. **10 px : canevas de travers** |
| durée | conforme au montage | un export partiel, ou une sélection oubliée |
| images/seconde | **30** | un projet monté à 24 ou 60 |
| poids | **~1 Mo par seconde** | très en dessous : débit écrasé |

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,nb_frames,duration \
  -of default=nk=0 export.mp4
ls -la export.mp4
```

**Et un cinquième relevé, qui a déjà attrapé ce que les quatre autres
laissaient passer : compter les plans.** Un export peut être parfaitement
conforme sur la largeur, la durée, la cadence et le poids, et ne contenir
qu'**un seul plan** — la frise n'a pas été exportée en entier. Aucun des quatre
chiffres ne le dit.

```bash
# écart moyen entre images successives ; une coupe franche saute très
# au-dessus de la médiane. Attention : des éclairs ou un stroboscope
# produisent le même saut — les regarder avant de les compter comme coupes.
ffmpeg -v error -y -i export.mp4 -vf "fps=30,scale=160:-1" /tmp/c%04d.png
```

**Et le seuil se prend sur la médiane LOCALE, jamais absolue.** Un seuil fixe
rate les raccords à l'intérieur d'une séquence agitée et en invente dans un
plan calme. Comparer chaque écart à la médiane des trente images qui
l'entourent.

**Un raccord entre deux plans de même composition ne se détecte pas — et ne se
voit pas non plus.** Relevé sur l'épisode 1 publié : sur 17,73 s, huit raccords
ressortent, et une fenêtre de **six secondes** n'en montre aucun. En la
regardant à deux images par seconde, elle contient pourtant trois créatures
différentes — même cadre, même palette, même volcan au même endroit. L'écart
entre images successives ne bouge pas, et l'œil du spectateur non plus.

C'est le plus long bloc du film, et c'est là que la rétention tombe : six
secondes qui *paraissent* un plan fixe, au milieu d'un montage dont la durée
médiane de plan est de 1,77 s. Le remède n'est pas de couper plus vite, c'est
de **changer de cadre** — une échelle de plan, un axe, un contre-champ.

Compter les plans ne suffit donc pas : il faut aussi compter les **cadres**.
Une bande à deux images par seconde le dit en un coup d'œil.

```bash
ffmpeg -v error -y -ss <début> -t <durée> -i export.mp4 \
  -vf "fps=2,scale=190:-1,tile=12x1" bande.png   # puis la REGARDER
```

## 4. Les réglages d'export

**1080p / 30 fps.** Suffisant pour TikTok.

Le 4K quadruple le poids **sans aucun gain visible en vertical** : la vidéo est
regardée sur une dalle de téléphone, à travers un ré-encodage de plateforme.

## 5. Publier

**Passer par l'application TikTok directement, jamais par le bouton de partage
de CapCut** — perte de qualité, et aucun contrôle sur la vignette ni sur
l'horaire.

**Laisser la vidéo vivre seule plusieurs heures** avant de la pousser à des
contacts. Des partages manuels précoces faussent le signal envoyé à
l'algorithme.

## 6. Lire les statistiques

**Ne rien conclure avant 200 à 300 vues.** En dessous, les pourcentages sont du
bruit statistique — et c'est là qu'on refait un montage qui n'avait rien.

Dans l'ordre :

1. **Rétention moyenne** (visionnage moyen ÷ durée totale). Objectif :
   **au-dessus de 70 %**.
2. **Taux de complétion.**
3. **Nouveaux abonnés** — mesure si la série est identifiée *comme série*, pas
   seulement si la vidéo plaît.

Les **partages manuels ne sont pas un signal organique** et doivent être
écartés de l'analyse.

## Ce que ce protocole a en commun avec le reste du dépôt

Les points 1 et 3 sont la même règle que `montage-sans-refaire` énonce pour le
contenu : **ce qui se cale sur une durée vient après ce qui change la durée**,
et **on vérifie le fichier qui part, pas celui d'avant**.

Le point 3 en ajoute une, propre à l'outil : un export peut être conforme sur
tous ses chiffres et ne pas contenir le montage. Les quatre relevés décrivent
le **contenant**. Seul l'œil, ou le comptage des plans, décrit le **contenu**.
