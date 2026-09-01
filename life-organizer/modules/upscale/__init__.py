"""Module 5 — agrandissement des photos basse définition.

**Écrit et vérifié de bout en bout**, inférence comprise, le 01/09/2026.

`regles.py` décide quoi agrandir, de combien et où poser le résultat — six
décisions, aucune dépendance lourde, 25 tests. `traitement.py` mesure les images
et pilote Real-ESRGAN. `commande.py` affiche le plan **même quand le modèle est
absent** : les seuils se règlent alors sans lui, et le calcul se lance ailleurs.

## Ce qui a été mesuré

| | |
| --- | --- |
| Décision — seuils, facteur borné, refus, file reprenable | 25 tests + un dossier réel |
| Mesure des images — dimensions, netteté | sur de vraies photographies |
| Installation des dépendances | `pip install torch realesrgan basicsr` — 3 Go, quelques minutes |
| Téléchargement des poids | 64 Mo en 2 s, objets de release GitHub |
| **Inférence** — 512 px → 2048 px, processeur, neuf tuiles | **58 s par image** |
| Commande complète sur trois photos | **2 min 34** |

La version précédente de cette fiche annonçait l'inférence « jamais exécutée,
hors de portée ». C'était un constat d'**absence** de paquets pris pour une
impossibilité : PyPI répond, les objets de release GitHub aussi, et seul
`download.pytorch.org` — la roue CPU allégée — est refusé, ce qui coûte du
volume de téléchargement et rien d'autre.

## Les trois pièges que seule l'exécution révèle

1. **`basicsr` casse à l'import, après une installation que pip déclare
   réussie.** Il cherche `torchvision.transforms.functional_tensor`, retiré
   depuis torchvision 0.17. `_rebrancher_functional_tensor` pose l'alias ; sans
   lui, on cherche pendant une demi-heure une installation qui a pourtant
   fonctionné.
2. **Le nom du réglage n'est pas le nom du fichier.** `realesrgan-x4plus` dans
   la configuration, `RealESRGAN_x4plus.pth` sur la release : fabriquer
   l'adresse depuis le réglage rend 404 — trois fois, une par image. La table
   `MODELES` dit l'adresse et l'échelle, et refuse un nom inconnu.
3. **Une panne de chargement est définitive.** Le modèle ne s'installe pas tout
   seul entre deux images : elle remonte une fois, au lieu de se répéter autant
   de fois qu'il y a de fichiers.

## Ce qu'il ne fera pas

Les vidéos. Agrandir une vidéo, c'est agrandir chaque image puis réencoder :
58 secondes par image mesurées ici font huit heures pour dix secondes à 30 i/s.
Ce sera un module à part, ou rien.

Réglages dans `organizer_config.json`, section « upscale », désactivée par
défaut — un module qui monopolise le processeur ne s'active pas tout seul.
"""
