---
name: trier-les-rushes
description: Inventorier d'un coup un lot de médias déposé en vrac — quinze, trente, cinquante fichiers — au lieu de les ouvrir un par un. Relève les doublons par empreinte, la meilleure définition disponible, quelle prise garder parmi les quatre variantes d'une même génération, et quels fichiers contiennent de la parole, le tout rendu en tableau plus une planche de contact. À utiliser dès que plusieurs fichiers audio ou vidéo arrivent ensemble, dès qu'il faut choisir parmi des prises multiples, et dès qu'une demande ressemble à « voilà mes rushes », « j'ai généré plein de trucs », « lequel je garde », « prends les meilleurs », « qu'est-ce que j'ai dans ce dossier », « trie ça », « il y a des doublons ? », « où est le fichier avec la voix ». À utiliser aussi avant tout montage : le plan qu'on écarte est parfois le seul à porter le son dont on a besoin.
---

# Regarder tout le lot avant d'en choisir un

Un lot de rushes n'arrive presque jamais par un ou deux. C'est quinze, trente,
cinquante fichiers déposés d'un coup, aux noms illisibles, avec des doublons et
quatre variantes de chaque prise. Les ouvrir séquentiellement coûte une
demi-heure et laisse quand même passer l'essentiel, parce que ce qui compte se
voit par comparaison, pas isolément.

Cette compétence existe parce que l'inverse a été essayé. Sur un lot réel, trois
choses ont été manquées faute d'inventaire :

- Un plan écarté du montage pour une raison d'image était, **au bit près**, le
  seul fichier portant les vraies répliques. Les deux noms n'avaient rien en
  commun ; seule l'empreinte le disait.
- Le montage a tourné des heures en 768 × 1344 alors qu'une version
  **1456 × 2544** du même plan dormait dans le même dossier.
- Une voix off générée la veille, intacte, attendait au milieu du lot pendant
  qu'on en refabriquait une.

Aucune de ces trois erreurs n'était une erreur de jugement. C'étaient des
erreurs de **regard** : personne n'avait tout regardé en même temps.

## Le geste

```bash
python3 scripts/trier.py <dossier ou fichiers…> [--sortie <dossier>]
```

Le script rend trois choses dans le dossier de sortie :

- **`inventaire.md`** — un tableau trié par énergie audible sur téléphone ;
- **`inventaire.json`** — les doublons, la meilleure prise par famille, les
  fichiers qui contiennent probablement de la parole ;
- **`planche.png`** — une image par vidéo, en grille.

**Puis il faut regarder la planche**, littéralement, avec l'outil de lecture
d'images. Le tableau dit les chiffres ; la planche dit ce que le lot montre —
un plan noir, un doublon visuel qui n'en est pas un pour l'empreinte, un
personnage qui change de visage d'un fichier à l'autre.

## Ce que l'inventaire tranche, et pourquoi ça ne se devine pas

**Les doublons par empreinte.** Deux fichiers au même contenu portent souvent
deux noms sans rapport — l'un donné par le générateur, l'autre par le
téléphone. Les repérer évite de traiter deux fois le même plan, et surtout
révèle qu'un fichier écarté sous un nom est encore présent sous un autre.

**La meilleure prise d'une famille.** Les générateurs rendent quatre variantes
du même prompt. Écoutées séparément, elles se valent. Mesurées ensemble, l'écart
entre la meilleure et la pire atteint couramment **10 à 20 dB** sur la bande
qu'un haut-parleur de téléphone restitue — soit la différence entre un
rugissement et une rumeur. C'est le chiffre qui départage, et il ne s'entend pas
au casque.

**Où quelqu'un parle.** La parole se reconnaît à son rythme : des salves courtes
et nombreuses, séparées de blancs. Un tonnerre, une nappe ou une musique forment
au contraire un bloc continu. Compter les salves suffit donc à dire quel fichier
contient une voix — **sans rien transcrire**, ce qui est précieux quand aucun
modèle de transcription n'est joignable. Quatre salves ou plus : il y a
quelqu'un.

**La définition.** Trivial à relever, systématiquement oublié. Le tableau
l'affiche pour chaque fichier et le rapport nomme le plus défini du lot.

## Comment s'en servir

**En premier, avant de monter quoi que ce soit.** L'inventaire coûte deux
minutes sur cinquante fichiers ; le montage refait parce qu'on a raté une source
coûte la nuit.

**Puis remonter au propriétaire ce qu'on a trouvé**, pas seulement ce qu'on a
décidé. Un fichier oublié dans son propre dossier, un doublon, une meilleure
définition : ce sont des informations qui lui appartiennent, et il saura
souvent tout de suite ce que c'est.

**Et le relancer quand un nouveau lot arrive.** Les lots s'empilent, et le
fichier utile est aussi souvent dans l'avant-dernier que dans le dernier.

## Ce que ça ne fait pas

L'inventaire ne juge pas la beauté d'un plan, ni si deux prises montrent le même
personnage — pour ça, il faut regarder la planche. Il ne transcrit pas la
parole ; il dit seulement où elle se trouve. Et il ne remplace pas
`/voir-le-son`, qui dessine **un** fichier en détail quand celui-ci pose
problème : ici on balaye, là on ausculte.
