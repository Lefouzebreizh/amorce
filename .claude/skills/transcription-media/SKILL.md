---
name: transcription-media
description: >-
  Analyser une vidéo ou un fichier audio que Claude ne peut pas lire
  directement — MP4, MOV, MKV, WebM, AVI, MP3, WAV, M4A, FLAC, OGG — en
  exécutant ffmpeg et un modèle de transcription local plutôt qu'en déclarant
  le fichier inaccessible. Sert à transcrire la parole avec horodatage, extraire
  la piste sonore, tirer des images clés, lire la fiche technique (durée,
  codecs, pistes), récupérer des sous-titres incrustés, ou repérer un passage
  précis. À utiliser dès qu'on te soumet un média et qu'on demande ce qu'il
  raconte, ce qui s'y dit, ce qu'on y voit, combien de temps il dure ou à quel
  moment un sujet est abordé — y compris quand la demande dit seulement
  « écoute ça », « résume cette vidéo », « qu'est-ce qu'ils disent »,
  « transcris-moi cet enregistrement », « fais-moi les notes de cette réunion »,
  ou « à quelle minute il parle de X ». Tout se fait en local, sans clé API et
  sans que le fichier quitte la machine.
---

# Vidéo et audio

Un média n'est pas illisible : il est encodé. `ffmpeg` le décode, un modèle
whisper local transcrit la parole, et tu analyses le texte obtenu comme
n'importe quel document.

La règle qui compte : **ne jamais répondre « je ne peux pas écouter ce
fichier ».** Lance l'extraction, lis ce qui en sort, réponds à la question.

## L'outil

```bash
python3 scripts/extraire_media.py <média> --info          # toujours en premier
python3 scripts/extraire_media.py <média> --transcrire    # parole horodatée
python3 scripts/extraire_media.py <média> --images 8      # images réparties
python3 scripts/extraire_media.py <média> --tout --sortie ./extraction/
```

Le script produit toujours la fiche technique d'abord, et c'est délibéré :
elle décide de la suite. Elle dit s'il y a une piste sonore (sinon il n'y a
rien à transcrire), s'il y a une piste vidéo (sinon les images clés sont un
travail perdu), et surtout **si des sous-titres sont incrustés** — auquel cas
les extraire donne le texte exact, immédiatement, là où une transcription
coûterait des minutes pour un résultat approché.

Il ne s'arrête jamais sur un outil manquant : il fait ce qu'il peut et nomme
la commande d'installation qui débloquerait le reste. Un WAV, notamment, se
sonde et se transcrit sans le binaire `ffmpeg`.

## Choisir la taille du modèle

`--modele` accepte `tiny`, `base`, `small` (défaut), `medium`, `large-v3`.
Le bon réflexe est de commencer petit : la transcription coûte du temps
processeur, et remonter d'un cran après avoir vu un résultat médiocre coûte
moins cher que de lancer `large-v3` sur une heure d'audio par précaution.

- `small` suffit pour du français clair : une réunion, un cours, une vidéo.
- `medium` quand il y a de l'accent, du bruit de fond, plusieurs voix qui se
  chevauchent, ou du vocabulaire technique.
- `large-v3` seulement si la qualité conditionne le résultat — une citation à
  reprendre exactement, un compte rendu qui fait foi.

Compte grossièrement le tiers de la durée du média en `small` sur un
processeur récent, et environ trois fois plus en `large-v3`. Annonce cet ordre
de grandeur avant de lancer une longue transcription : personne n'aime
découvrir après coup qu'il attend depuis vingt minutes.

## Analyser l'image plutôt que le son

Quand la question porte sur ce qu'on voit — « quelle marque apparaît »,
« combien de plans », « à quoi ressemble le produit » — extrais des images et
regarde-les : tu sais lire une image, et huit images réparties disent souvent
plus qu'une transcription complète.

Elles sont réparties sur toute la durée, jamais prises au début : les
premières secondes d'une vidéo se ressemblent toutes et ne racontent rien.
Pour un plan précis, `ffmpeg -ss 00:03:12 -i film.mp4 -frames:v 1 image.jpg`.

Si l'image porte du texte (diapositives, tableau filmé, sous-titres gravés
dans l'image), passe les images extraites à un OCR — voir
`references/images.md` du skill `extraction-multiformat`.

## Restituer une transcription

Le texte brut de whisper est une matière première, pas une réponse. Ce qu'on
te demandait, c'est presque toujours autre chose : un résumé, une décision,
une citation, un moment.

- **Garde les horodatages** dans ce que tu livres. « Vers 12:30 il annonce… »
  permet à l'utilisateur d'aller vérifier ; un mur de texte sans repères le
  laisse relire l'enregistrement entier.
- **Signale ce dont tu doutes.** Whisper ne dit jamais « je n'ai pas compris » :
  il invente un mot plausible. Sur un nom propre, un chiffre ou un sigle —
  exactement ce qu'on cite ensuite — vérifie la cohérence avec le contexte et
  préviens quand un passage est incertain.
- **Attention aux silences.** Sur une piste sans parole, whisper produit parfois
  des phrases fantômes venues de ses données d'entraînement (génériques,
  formules de politesse). Une phrase isolée au milieu d'un long silence mérite
  d'être écartée plutôt que rapportée.
- **Il ne sépare pas les locuteurs.** Sur une réunion à plusieurs, la
  transcription est un flux continu. On peut deviner les tours de parole au
  contexte, mais dis-le plutôt que d'attribuer des propos à quelqu'un.

## Ce qu'il ne faut pas faire

- **Envoyer le média à un service externe.** Tout est local : `ffmpeg` décode,
  `faster-whisper` transcrit sur le processeur, rien ne sort de la machine. Un
  enregistrement de réunion ou une vidéo personnelle n'a rien à faire sur une
  API tierce sans une demande explicite.
- **Laisser traîner les fichiers extraits.** Une heure de vidéo produit un WAV
  volumineux ; écris dans le répertoire scratch et non dans le projet, et dis à
  l'utilisateur où c'est s'il veut le garder.
- **Inventer ce qu'on n'a pas pu entendre.** Si l'audio est inaudible ou la
  transcription incohérente, dis-le. Un résumé plausible d'une réunion qu'on
  n'a pas su transcrire est le pire résultat possible.
