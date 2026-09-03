# `zoompan` multiplie les images d'une boucle au lieu de les remplacer

Un zoom lent sur une image fixe — l'effet Ken Burns — s'écrit avec `zoompan`,
dont le paramètre `d` dit combien d'images produire. Le piège : **`d` vaut par
image d'entrée, pas pour la sortie.**

Alimenté par `-loop 1 -framerate 30 -t 3.0`, qui fournit déjà 90 images,
`zoompan=d=90` en rend **8 100**. Sur six plans concaténés, le montage attendu
de 14,7 s est sorti à **548,7 s et 16 462 images**, sans un seul avertissement :
la commande réussit, le fichier est valide, il dure trente-sept fois trop
longtemps.

La parade tient en un tiret retiré : **on donne à `zoompan` une seule image**,
donc `-i image.png` sans `-loop`, et c'est lui qui l'étale sur `d` images.

```bash
# faux — 90 images en entrée × d=90 = 8 100 images
ffmpeg -loop 1 -framerate 30 -t 3 -i plan.png -vf "zoompan=d=90:s=1080x1920" …

# juste — une image en entrée, d=90 en sortie
ffmpeg -i plan.png -vf "zoompan=d=90:s=1080x1920:fps=30" …
```

`-loop 1 -t` reste correct pour un plan **fixe**, où aucun `zoompan` n'entre en
jeu : là, il faut bien fournir les 60 ou 90 images.

## Le coût réel, et pourquoi il ne se voit pas tout de suite

Ce n'est pas seulement une durée fausse : c'est **cinq minutes d'encodage** au
lieu de quinze secondes, et la première tentative a été tuée par le délai
d'exécution avant même de rendre un fichier — ce qui envoie chercher la cause
du côté de la performance (résolution intermédiaire, préréglage x264) au lieu du
compte d'images. La mesure qui tranche est la première ligne de `ffprobe` :
`nb_frames` et `duration`. La lire **avant** de regarder le fichier, à chaque
montage assemblé par `concat`.

Vaut aussi comme rappel de méthode : la fenêtre d'exécution qui expire n'est
presque jamais un problème de vitesse, c'est un travail qu'on n'a pas demandé.
