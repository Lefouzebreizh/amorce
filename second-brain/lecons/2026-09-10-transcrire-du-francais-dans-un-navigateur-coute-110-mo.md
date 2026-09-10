# Transcrire du français dans un navigateur coûte 110 Mo, et ne rend pas les mots

*10/09/2026 — Amorce, sous-titres d'un rush filmé*

## Ce qui a été mesuré

Le dépôt retenait sherpa-onnx comme chemin de transcription, sans que personne
ait jamais pesé un modèle. Fait, à la source — objets de release GitHub,
`Content-Range` sur une requête d'un octet :

| modèle multilingue | archive |
| --- | --- |
| `sherpa-onnx-whisper-tiny` | **110,8 Mo** |
| `sherpa-onnx-whisper-base` | 197,9 Mo |
| `sherpa-onnx-whisper-small` | 609,8 Mo |

À comparer à ce que le même studio télécharge déjà pour **détecter les
visages** : 3,6 Mo sur le réseau, modèle compris. Le plus petit modèle capable
de comprendre du français pèse donc **trente fois** tout le détecteur.

## Et le poids n'est pas le pire

Ce que les sous-titres d'Amorce demandent est un **instant par mot** — c'est ce
qui fait qu'un mot s'allume quand il est prononcé, et c'est toute la différence
entre un sous-titre et un carton. Le studio l'a déjà pour la voix qu'il
fabrique lui-même.

Whisper ne le donne pas : ses horodatages sont **par segment**. Le seul type de
modèle qui rende un instant par mot dans sherpa-onnx est le zipformer — et
`CLAUDE.md` le note depuis des mois : **il n'en existe pas de français**,
vérifié par requête.

Donc, en l'état : 110 Mo achètent une transcription française **sans le mot à
mot**, c'est-à-dire sans ce pour quoi on la voulait.

## La règle

**Un chemin « retenu » n'est pas un chemin mesuré.** Celui-ci figurait dans les
notes du dépôt comme la réponse à la transcription, et il y figurait
légitimement — c'est le seul qui tourne sans réseau et sans clé. Ce qui manquait
est le prix, et le prix change la question : ce n'est plus « comment
l'intégrer » mais « est-ce qu'on veut le payer, pour ce qu'il rend ».

La leçon transposable tient à la nature de la mesure. Trois chiffres suffisaient
— le poids, la couverture linguistique, la granularité des horodatages — et
aucun ne demandait d'écrire une ligne de code. **Les mesures qui retournent une
décision coûtent presque toujours moins cher que le prototype qui l'aurait
révélée**, et on les remet pourtant à après l'intégration, quand elles ne
peuvent plus que confirmer.

## Ce qui reste ouvert, et à qui

Le compromis appartient au produit, pas au code :

- **Payer les 110 Mo** et livrer des sous-titres au segment, moins bons que ceux
  de la voix fabriquée.
- **Attendre un zipformer français**, qui n'existe pas et dont rien ne dit qu'il
  existera.
- **Transcrire ailleurs** — mais Amorce a exclu le stockage distant
  définitivement, et un rush qui part chez un tiers est un reniement, pas un
  compromis.

Aucune de ces trois branches n'est technique.

## Ce qui n'a pas été mesuré

Le poids **décompressé** et celui du seul `int8`, qui pèserait moins que
l'archive complète — elle contient les variantes flottantes et quantifiées. Le
temps de transcription sur un téléphone, jamais éprouvé. Et le WASM de
sherpa-onnx pour le navigateur, dont un paquet npm existe
(`speech-asr`, 1.1.6) sans qu'on ait vérifié qu'il tourne ici. Ces trois-là ne
changent pas l'ordre de grandeur, et c'est l'ordre de grandeur qui décide.
