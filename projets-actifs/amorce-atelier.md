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
| Synchronisation labiale | `montage-auto/auto_lipsync.py` | **cousu et prouvé** — 2,0 s rendues, la bouche articule |
| Transcription | `.claude/skills/transcription-media/scripts/asr_hors_ligne.py` | tourne, Whisper hors Hugging Face |
| Bruitages de synthèse | `kits/sfx/`, `src/lib/sfx.ts` | 10 générateurs, index mesuré |
| Musique | `.claude/skills/bande-son/scripts/musique.py`, `kits/music/` | 5 ambiances + nappe de bande-annonce |
| Cri de créature | `kits/sfx/generer-creature.py` | tourne |
| Calques et LUT | `visual_library/` | 10 assets, catalogue, fiche HTML |
| Animation d'image fixe | `kits/video/animer-image.py` | **cousu** — détection sur l'extension, 2,2 → 9,3 et 12,6 |
| Étalonnage | `.claude/skills/etalonner/scripts/etalonner.py` | tourne |
| Mesure du son | `.claude/skills/voir-le-son/`, `sonometre.py` | tourne |
| Montage et rendu | HyperFrames CLI | tourne |

**Ce qui manquait n'était pas la matière, c'était la couture** — et elle est
faite. Les dix outils se lancent maintenant depuis une seule recette JSON,
`montage-auto/monter_episode.py`, au lieu de dix lignes de commande à la main.

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

## La couture est commencée — par une autre session

**Ne pas la réécrire.** `montage-auto/monter_episode.py` existe déjà, piloté par
une recette JSON (`montage-auto/references/titans-ep01.json`). Il encode cinq
échecs de montage à la main, et ce sont exactement ceux de la session TITANS :

- un plan se coupe **sur sa courbe**, pas sur sa durée — `--sonder` relève le
  niveau seconde par seconde avant qu'on choisisse ;
- égaliser tous les plans supprime le relief avec le défaut : ce qui fait un
  montage est une **courbe de cibles écrite**, pas une égalisation ;
- jamais de `loudnorm` en une passe — c'est un compresseur, il aplatit
  précisément le relief qu'on vient de construire ;
- **un seul élément possède le grave à la fois**, et rien de lourd sous une
  voix, qui porte la synchronisation labiale ;
- les sous-titres se calent sur la **parole mesurée**, pas sur une grille.

Il couvre donc le montage, le mixage et les sous-titres depuis une recette.

## Ce qui est branché

Le bloc `finition` de la recette **accorde** les plans entre eux puis **pose un
rendu** — LUT et calques de `visual_library/`. Jamais l'inverse : un rendu posé
avant l'accord amplifie les écarts au lieu de les masquer. Le son traverse sans
être réencodé.

Quatre pièges y ont été payés, tous silencieux, tous consignés dans le fichier :

- **deux noms pour une seule chose** — `audio_catalog.json` d'un côté,
  `second-brain/sound_index.json` de l'autre. C'était exactement la couture
  manquante, et le premier montage complet a échoué dessus ;
- **un PNG ne dure qu'une image sans `-loop 1`**, et le `shortest=1` du mélange
  termine alors tout le film avec lui — 240 paquets attendus, 1 obtenu, sans le
  moindre message ;
- **`blend` ignore la couche alpha** : un vignettage dont le RVB est noir
  éteignait l'image entière. Les calques à transparence se posent en `overlay` ;
- `-stream_loop -1 -i` ajoute **trois** éléments et non deux : en déduire
  l'indice d'entrée décalait d'un cran par calque bouclé.

## Ce que la couture a appris

Les trois derniers maillons — la voix, la parallaxe, la synchronisation labiale —
ont chacun coûté la même leçon, et elle vaut d'être écrite une fois :
**un outil cher se raccorde par son cache et par son échec, pas par son appel.**

- **Le cache décide du coût réel.** Une parallaxe coûte trente secondes, une
  synchronisation plusieurs minutes ; un montage d'essai se relance dix fois. Le
  cache porte la source, la fenêtre et les réglages, et vit dans `atelier/cache`
  — jamais sous `_*`, que le nettoyage de fin de passe efface. Le premier jet
  l'y avait mis, et repayait chaque rendu.
- **L'échec décide de la fiabilité.** Un film de douze plans ne meurt pas parce
  qu'un visage manque sur l'un d'eux : on prévient par écrit, on rend le plan
  intact, le reste se monte. La synchronisation tourne pour cela dans un
  processus séparé — une inférence tuée par manque de mémoire (code −9)
  emporterait le montage avec elle.
- **La détection vaut mieux que la déclaration.** Une image fixe est reconnue à
  son extension, sans champ à remplir : personne ne pense à déclarer qu'une
  image est une image, et l'oubli produisait exactement le plan figé qu'on
  cherchait à supprimer.

## Ce que la synchronisation labiale a coûté, en vrai

Trois enseignements du premier passage de bout en bout, sur un plan de druide de
deux secondes et demie.

**La sonde a payé son écriture au premier essai.** Elle a trouvé **11 images sur
60 sans visage exploitable**, la première étant l'image 0. Sans elle, Wav2Lip
aurait parcouru les soixante images pour annoncer « Face not detected » — mesuré
ailleurs à 4 min 51. Et le visage était pourtant grand, centré, de face : ce qui
gêne `s3fd` ici est une **moustache épaisse** qui noie la bouche, pas un cadrage
difficile. Un plan qu'on croit facile n'est pas un plan sondé.

**La fenêtre que la sonde propose est directement utilisable.** Elle annonçait
0,50 s → 2,50 s ; recopiée dans la recette en `"depart": 0.80, "duree": 2.00`,
elle a rendu du premier coup. C'est ce qui a justifié de traduire ses
coordonnées : la sonde compte depuis la fenêtre extraite, la recette depuis le
rush.

**La bouche est plus molle que le reste du visage**, et c'est structurel : le
générateur reconstruit un carré autour des lèvres et le recolle. Sur ce plan la
barbe le masque bien ; sur un visage glabre en gros plan, il se verrait. À
juger sur le téléphone, jamais sur l'écran d'un ordinateur.

## Prochain pas

La chaîne est complète et se lance d'une commande. Ce qui manque n'est plus un
outil, c'est **une interface** : la recette JSON reste écrite à la main, et
c'est elle qui sépare aujourd'hui l'Atelier d'un produit.

Zéro fonctionnalité neuve avant elle. La valeur est dans le fait que les outils
se parlent, pas dans le nombre d'outils.

**Et le réflexe qui a manqué six fois dans la session TITANS :** avant de
construire, lire la liste des branches ouvertes que le hook de démarrage
affiche. Elle pose la question — « l'une d'elles fait-elle déjà ce travail ? » —
et cette fiche a bien failli répondre non à tort.
