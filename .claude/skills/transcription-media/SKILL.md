---
name: transcription-media
description: >-
  Ouvrir une vidéo ou un fichier audio pour dire ce qu'il contient — MP4, MOV,
  MKV, WebM, AVI, MP3, WAV, M4A, FLAC, OGG — en exécutant ffmpeg et un modèle
  de transcription local, plutôt qu'en déclarant le fichier inaccessible.
  Transcrire la parole avec horodatage, quelle que soit la langue, la durée ou
  l'accent ; extraire la piste sonore ; tirer des images clés pour voir ce qui
  est filmé ; lire la fiche technique (durée, codecs, pistes) ; **récupérer des
  sous-titres incrustés**, qui donnent le texte exact sans transcrire ; repérer
  le moment où un sujet est abordé. À utiliser dès qu'un média est soumis et
  qu'on demande ce qu'il raconte, ce qui s'y dit, ce qu'on y voit, combien de
  temps il dure ou à quelle minute quelque chose survient — y compris sans nom
  de fichier précis, et quand la demande dit seulement « écoute ça », « résume
  cette vidéo », « qu'est-ce qu'ils disent », « transcris l'interview », « fais
  les notes de cette réunion », « il y a des sous-titres dedans ? ». Tout se
  fait en local, sans clé API et sans que le fichier quitte la machine.
  Ne pas déclencher pour une question théorique ou un conseil d'outillage sans
  média à ouvrir (« quel modèle whisper choisir », « mp4 ou mkv »), ni pour un
  défaut de l'application Amorce — son désynchronisé, export vide — qui relève
  de debogage-systematique.
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

## Juger un niveau sonore

Quand la question porte sur la qualité du son plutôt que sur son contenu — « est-ce
exploitable », « c'est trop fort ? » — une mesure vaut mieux qu'une écoute :

```bash
ffmpeg -hide_banner -nostats -i FICHIER -filter_complex volumedetect -f null /dev/null 2>&1 \
  | grep -E "mean_volume|max_volume"
```

Une moyenne autour de **−14 à −16 dB** avec des crêtes vers **−1 dB** est saine.
Au-dessus de −10 dB de moyenne, le son est trop fort : les plateformes le
ramèneront elles-mêmes, en lui prenant sa dynamique au passage — le montage
sortira donc plus plat que s'il avait été livré au bon niveau. Très en dessous
de −20 dB, il faudra monter le volume pour entendre, et le souffle avec.

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

## Quand `huggingface.co` est refusé

`faster-whisper` va chercher ses poids sur Hugging Face. En session distante la
politique de sortie le refuse au CONNECT, et la transcription paraît impossible.
Elle ne l'est pas : deux hôtes restent ouverts, et `scripts/asr_hors_ligne.py`
y va.

| Route | Ce qui passe |
| --- | --- |
| **PyPI en direct** | le mandataire le liste dans `noProxy` ; tout modèle livré dans une roue s'installe. `pocketsphinx` embarque 38 Mo d'anglais, zéro téléchargement. |
| **Objets de release GitHub** | `github.com` redirige vers `release-assets.githubusercontent.com`, qui répond 200. Les modèles sherpa-onnx y sont publiés, Whisper compris. |

Mesuré le 27 août 2026 : `huggingface.co`, `alphacephei.com` et
`openaipublic.azureedge.net` échouent tous les trois ; les deux routes ci-dessus
rendent 200 et un modèle a été téléchargé, chargé et exécuté. Ce n'est pas un
contournement — ni le TLS ni le mandataire ne sont touchés, ce sont des hôtes
que la politique autorise.

```bash
# ce qui se dit, multilingue (tiny 116 Mo · base 208 · small 639 · medium 1931)
python3 scripts/asr_hors_ligne.py media.mp4 --modele base

# à quelle seconde commence chaque mot — anglais seulement
python3 scripts/asr_hors_ligne.py media.mp4 --instants

# dernier repli, sans aucun réseau
python3 scripts/asr_hors_ligne.py media.mp4 --pocketsphinx
```

**Deux pièges, et le second est sournois.**

`from_whisper` a pour défaut `language="en"` et **ne prévient pas** : sur du
français il rend de l'anglais grammatical et faux, qu'on relit sans broncher.
Le script renverse ce défaut à `fr` parce que ce dépôt est francophone, mais
`--langue` reste à poser dès qu'on sort du français.

`--instants` (zipformer) n'existe qu'en anglais : aucun modèle français dans
cette release, vérifié par requête. Et son premier jeton tombe volontiers à
0,00 s par artefact de décodage. **Recouper avec `--passages` avant de croire
un instant** : sur le clip qui a motivé ces scripts, le zipformer annonçait un
mot à 0,04 s là où la parole ne commence qu'à 1,86 s.

## Les passages parlés, dans n'importe quelle langue

C'est le relevé qui sert vraiment à caler une voix off sur des images : pas un
mur de texte, mais « le passage 2 commence à 4,20 s ».

```bash
python3 scripts/asr_hors_ligne.py media.mp4 --passages --modele base
```

Silero VAD (640 ko) donne les bornes — **il ne dépend d'aucune langue** — et
Whisper transcrit chaque passage. Sortent les instants, les durées, le texte,
et les respirations entre passages.

C'est la bonne réponse au « français à dater » : un seuil posé à la main sur
l'enveloppe se trompe dès qu'un bruitage couvre une syllabe, et c'est
exactement ainsi qu'une session a conclu « pas de voix » sur un fichier qui en
portait une, mixée bas.

## Relever les instants d'un montage

`scripts/relever_instants.py` répond à « à quelle seconde se passe quoi », qui
est une autre question que « qu'est-ce qui se dit ». Il existe parce qu'un plan
sonore donnait l'apparition d'un dragon à 7,50 s là où le fichier la met à
10,29 s : trois secondes d'erreur que personne n'a vues, parce qu'un instant
plausible se relit sans broncher.

```bash
python3 scripts/relever_instants.py montage.mp4                 # tout
python3 scripts/relever_instants.py montage.mp4 --fenetre 10 11 --par-seconde 8
```

Deux pièges qu'il connaît, et qui valent d'être connus même sans lui :

- **Un score de rupture bas ne veut pas dire « pas de temps forts ».** Un fondu
  ou un iris ne font aucun pic : l'image change beaucoup, mais lentement. Quand
  le maximum plafonne bas, c'est un plan continu, et les temps forts se lisent
  sur la planche contact.
- **L'énergie dans la bande de parole ne prouve pas qu'on parle.** Un choc, une
  étincelle, une cymbale l'occupent aussi bien qu'une syllabe — et une voix
  mixée bas s'y cache. Sur le clip qui a motivé ces scripts, la lecture de
  l'enveloppe a conclu « aucune voix » alors qu'il y en avait une : c'est la
  reconnaissance lancée pour de bon qui a tranché. **Devant un doute, transcris
  au lieu de raisonner sur des courbes.**

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
