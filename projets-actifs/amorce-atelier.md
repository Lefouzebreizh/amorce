# Amorce Atelier — la chaîne complète, du rush au film

> **Décision prise le 28 août 2026**, en fin de session TITANS. Elle n'est pas
> une extension d'Amorce : c'est un **second produit**, et c'est précisément
> pour ne pas toucher au premier qu'il existe.

## Pourquoi ce n'est pas une V2 d'Amorce

Amorce tient une promesse en une phrase : **aucun fichier ne quitte l'appareil**.
Ni serveur, ni base, ni route API. C'est ce qui la rend digne de confiance pour
48 000 personnes, et c'est écrit comme un cap dans `CLAUDE.md` — la seule
exclusion nommée du chantier Cloudflare.

Or tout ce que demande l'atelier la contredit. Une génération d'images, un
agrandisseur de vidéo, une synchronisation labiale : chacun réclame soit un
serveur, soit un modèle de plusieurs centaines de mégaoctets. Les entasser dans
Amorce ne l'améliorerait pas — cela lui retirerait la seule chose qu'elle
promet.

Deux produits, donc, et la frontière est nette : **Amorce est ce qu'on emmène
partout, l'Atelier est ce qu'on installe.**

## Ce qui existe déjà, et qui n'est pas à refaire

C'est le point qui décide du calendrier : la moitié de la chaîne tourne, mais
en morceaux, hors de toute interface.

| Maillon | Où | État |
| --- | --- | --- |
| Voix off française | `.claude/skills/bande-son/scripts/voix.py` | tourne, sherpa-onnx, 25× le temps réel |
| Synchronisation labiale | `montage-auto/auto_lipsync.py` | tourne, Wav2Lip sur processeur, sonde de visages |
| Transcription | `.claude/skills/transcription-media/scripts/asr_hors_ligne.py` | tourne, Whisper hors Hugging Face |
| Bruitages de synthèse | `kits/sfx/`, `src/lib/sfx.ts` | 10 générateurs, index mesuré |
| Musique | `.claude/skills/bande-son/scripts/musique.py`, `kits/music/` | 5 ambiances + nappe de bande-annonce |
| Cri de créature | `kits/sfx/generer-creature.py` | tourne |
| Calques et LUT | `visual_library/` | 10 assets, catalogue, fiche HTML |
| Animation d'image fixe | `kits/video/animer-image.py` | parallaxe, 4,1 → 9,8 de mouvement |
| Étalonnage | `.claude/skills/etalonner/scripts/etalonner.py` | tourne |
| Mesure du son | `.claude/skills/voir-le-son/`, `sonometre.py` | tourne |
| Montage et rendu | HyperFrames CLI | tourne |

**Ce qui manque n'est donc pas la matière, c'est la couture.** Neuf outils
existent, aucun ne se parle, et chacun se lance à la main avec ses arguments.

## Ce qui manque vraiment

- **Génération d'images.** Aucun chemin dans les sessions distantes :
  Pollinations, Pexels, Pixabay et Mixkit répondent tous 403 au CONNECT. Se
  fait sur la machine de l'auteur, ou avec une clé.
- **Agrandisseurs** son, image, vidéo. Rien d'écrit, rien d'essayé.
- **Une banque de modèles de texte.** Trois trames existent dans Amorce ; il en
  faudrait vingt.
- **Une jauge par média** — image, son, transition, vidéo. Amorce note six
  dimensions du montage ; l'atelier devrait noter chaque pièce séparément.

## Objectif mesurable

**Un épisode de bande-annonce verticale sorti de bout en bout sans intervention
manuelle entre les étapes** : rushes en entrée, fichier publiable en sortie,
avec voix française synchronisée, bruitages mesurés au-dessus de 400 Hz,
étalonnage accordé et une note par pièce.

Le repère existe : l'épisode 01 de TITANS a demandé une nuit entière et une
douzaine d'allers-retours. Le premier succès de l'atelier, c'est **le même
résultat en une commande**.

## Ce que la session TITANS a déjà appris, et qu'il ne faut pas réapprendre

Tout est dans `second-brain/lecons.md`. Les quatre qui gouvernent ce projet :

- **une mesure agrégée dit qu'un son est fort, jamais qu'il est bon** — lire
  LRA avant tout le reste, et regarder un spectrogramme ;
- **le poids d'un son se fabrique par les harmoniques du grave**, jamais en
  descendant le registre, qui sort du spectre d'un téléphone ;
- **aucun traitement ne fabrique une bande de fréquences absente de la source** —
  chercher la prise qui a déjà de l'aigu ;
- **ce qui fait bouger une image fixe est la parallaxe, pas le zoom.**

Et la règle de méthode qui les vaut toutes : **deux chemins essayés ne font pas
une impossibilité.** La voix off, les poids Wav2Lip et la transcription ont tous
été déclarés hors de portée avant qu'un troisième chemin réponde — et les trois
fois, c'étaient les objets de release GitHub.

## Prochain pas

**Écrire la couture avant d'ajouter le moindre outil.** Un fichier de recette
qui décrit un épisode — rushes, texte des répliques, ambiance, format — et un
programme qui appelle les neuf outils existants dans l'ordre. Zéro
fonctionnalité neuve au premier jet : la valeur est dans le fait qu'ils se
parlent enfin.
