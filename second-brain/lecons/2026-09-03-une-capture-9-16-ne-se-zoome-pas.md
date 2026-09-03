# Une capture d'écran 9:16 ne se zoome pas, et la voix off dit ce qu'il fallait montrer

Deux découvertes du même montage, et la seconde annule le problème que la
première rendait insoluble.

## 1. Une source au format de sortie n'offre aucun cadrage

Le propriétaire demandait des plans serrés sur un élément — un titre, une paire
de boutons, une liste — dans une vidéo verticale montée à partir d'une **capture
d'écran de téléphone**.

C'est géométriquement impossible, et la raison mérite d'être écrite parce
qu'elle se represente à chaque montage de ce type : **la source est déjà en
9:16, exactement le format de sortie.** Un cadre 9:16 qui isolerait un élément
de 340 px de haut devrait faire 191 px de large ; la page en fait 1080. Il n'y
a pas de « zoom » disponible, seulement un agrandissement uniforme.

Le seul levier est la **marge latérale du texte**, et elle se mesure :

```bash
# encre la plus à gauche et la plus à droite, sur une image de la page
python3 -c "
from PIL import Image
im=Image.open('plan.png').convert('L'); w,h=im.size; px=im.load()
cols=[max(px[x,y] for y in range(0,h,3)) for x in range(w)]
g=next(x for x in range(w) if cols[x]>90); d=next(x for x in range(w-1,-1,-1) if cols[x]>90)
print(g, w-1-d, 'zoom max', w/(w-2*min(g,w-1-d)))"
```

Ici : **55 px à gauche, 56 à droite, donc 1,11× au maximum.** Au-delà, les
phrases sont rognées. Toute promesse de « plan serré » sur une capture verticale
se vérifie par ces trois lignes **avant** d'être faite.

Le corollaire pratique : sur une capture 9:16, ce qui distingue deux plans n'est
pas le cadrage, c'est **la position dans la page**. Mesurée par la recherche du
meilleur décalage vertical entre deux images, elle se chiffre — 692 à 1 020 px
entre plans voisins dans le montage retenu, soit 36 à 53 % d'un écran. En
dessous, l'œil lit un défilement tranché ; au-dessus, il lit des plans.

## 2. Transcrire la voix off avant de monter l'image

Le défaut réel n'était pas le cadrage. La voix off, transcrite **en local** —
sherpa-onnx whisper-small, modèle déjà en cache, zéro réseau, zéro clé —
disait :

> « Salut, moi c'est Erwann, j'aide les artisans à Rennes à avoir un site
> internet sans les prises de tête. Ça, c'est un exemple pour une entreprise de
> couverture. 300 euros sans abonnement, en ligne en 48 heures. Si ça
> t'intéresse, contacte-moi. »

Elle ne nomme **aucune** des sections que l'image s'échinait à faire lire. Le
texte à l'écran n'apportait donc rien : il entrait en concurrence avec une voix
qui portait déjà le message. Trois montages ont été livrés avant que quiconque
sache ce que la bande son racontait.

**La transcription se fait avant le premier plan, pas après la troisième
version.** Elle donne les phrases, et les blancs entre elles donnent les points
de coupe :

```bash
python3 .claude/skills/transcription-media/scripts/asr_hors_ligne.py voix.mp3 --modele small --langue fr
ffmpeg -i voix.mp3 -af "silencedetect=n=-36dB:d=0.10" -f null -
```

Piège au passage : `extraire_media.py --transcrire` passe par `faster-whisper`,
qui va chercher ses poids sur Hugging Face et meurt en `ProxyError: 403`.
C'est `asr_hors_ligne.py` qu'il faut appeler — il lit le modèle sherpa déjà
présent dans `~/.cache/sherpa-onnx-modeles/`. Et son `--modele` attend `small`,
pas `whisper-small`.
