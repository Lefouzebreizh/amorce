---
name: video-de-reference
description: >-
  Prendre une vidéo qu'on admire — un TikTok, un Reel, un Short téléchargé — et
  en extraire par la mesure ce qui est reproductible dans Amorce : cadence des
  coupes, durée des plans, hauteur du texte à l'écran, niveau sonore réellement
  entendu sur un téléphone. Rend un rapport chiffré, une planche d'images, et
  la traduction en réglages du studio. À utiliser dès qu'une demande arrive
  avec une vidéo ou un lien et une intention de s'en inspirer : « regarde
  cette vidéo », « je veux que ça ressemble à ça », « pourquoi la sienne
  marche et pas la mienne », « c'est ce style-là que je cherche », « analyse ce
  montage », « comment il fait ses coupes », « son texte est mieux placé »,
  « fais-moi la même chose » — et aussi quand un lien vidéo arrive **seul,
  sans un mot**, ce qui est le cas le plus fréquent. Explique aussi pourquoi un
  lien YouTube ne s'ouvre pas ici et quoi demander à la place. Ne pas attendre
  le mot « analyse » : personne ne le prononce en envoyant une vidéo.
---

# Ce qu'on peut prendre à une vidéo qu'on admire

Une vidéo dont on dit « je veux ça » contient deux choses très différentes :
une intention, qui ne se mesure pas, et une **grammaire** — combien de temps
dure un plan, où vit le texte, à quel niveau sort le son — qui se mesure très
bien et se règle dans Amorce.

Cette compétence ne juge pas la vidéo. Elle relève sa grammaire et la met en
face des bornes que le studio se donne déjà, pour dire ce qui est à portée de
réglage et ce qui ne l'est pas.

## D'abord : un lien ne marche pas, un fichier oui

**Aucune route vers YouTube n'existe depuis une session distante.** Mesuré le
29/08/2026, neuf hôtes rendent `000` — le mandataire refuse le tunnel :
`youtu.be`, `youtube.com`, `www.youtube.com`, `i.ytimg.com`,
`youtube-nocookie.com`, les miroirs `invidious.fdn.fr` et `piped.video`, le
passe-plat texte `r.jina.ai`. Ni `yt-dlp` ni `youtube-dl` ne sont installés, et
les installer ne servirait à rien : il leur faudrait joindre l'hôte fermé.

Un connecteur YouTube n'y changerait rien non plus, et pour une raison
différente : un connecteur rend du **texte**. Un titre, une description, une
transcription. Le style d'un montage ne passe pas par une transcription.

**Ce qui marche, en revanche : le fichier lui-même.** Un `.mp4` déposé dans la
conversation arrive entier. C'est le seul chemin, et il faut le demander en une
phrase plutôt que de faire semblant d'avoir vu la vidéo :

> Le lien ne s'ouvre pas d'ici. Deux options : tu télécharges la vidéo et tu me
> l'envoies en fichier — là je peux tout mesurer — ou tu me dis en une phrase ce
> que tu veux en reprendre.

La seconde option n'est pas un lot de consolation. « Ses coupes tombent sur la
musique » ou « son texte est énorme et il bouge » se traduit en réglages tout
aussi bien qu'une mesure, et coûte trente secondes à qui a vu la vidéo.

## Mesurer

```bash
python3 .claude/skills/video-de-reference/scripts/mesurer.py video.mp4 [--sortie dossier]
```

Bibliothèque standard plus ffmpeg, rien à installer. Une vidéo verticale de
trente secondes prend cinq secondes.

Le script rend quatre choses, et une seule est un jugement :

| Ce qu'il mesure | Contre quoi il le compare |
| --- | --- |
| nombre de plans, durée moyenne, plus court, plus long | la bande 1,1–2,8 s que `src/lib/analysis.ts` récompense |
| hauteur de la zone la plus chargée en contours | la bande sûre 12–45 % de `src/lib/captions.ts` |
| sonie intégrée et vrai pic | −14 LUFS et l'écrêtage |
| sonie au-dessus de 400 Hz | ce qu'un haut-parleur de téléphone restitue vraiment |

Plus une **planche de quarante images** sur toute la durée. C'est elle qui
tranche ce que les nombres ne peuvent pas.

## Lire le résultat sans se tromper

Trois pièges, chacun mesuré :

**Le nombre de plans est une fourchette, pas un nombre.** La détection repose
sur le changement d'image : un fondu enchaîné lui est **invisible**, un
panoramique rapide passe pour une coupe. Sur un montage de vingt-huit plans
connus, les seuils usuels en trouvent entre 13 et 33. Le rapport donne donc
l'estimation *et* les bornes — sur du format court à coupes franches
l'estimation est bonne, sur un montage en fondus c'est un plancher.

**La zone chargée n'est pas forcément du texte.** Un plan très détaillé fait la
même bosse qu'un titre. L'indice ne vaut qu'avec la planche sous les yeux, et
c'est pour cela que les deux sortent ensemble.

**Une référence peut être mauvaise sur un point et excellente sur les autres.**
Une vidéo qui écrête, ou dont le texte sort de la bande sûre, ne devient pas un
contre-modèle : elle a peut-être été faite pour une seule plateforme. Le
rapport le signale, il ne condamne pas.

## Traduire en réglages

C'est le point de la compétence. Une mesure qui ne change rien au studio n'a
servi à rien.

- **Plans plus courts que 1,1 s** → hors de ce qu'Amorce produit. Y aller
  demande de baisser `MIN_SHOT_VU` dans `src/lib/autoEdit.ts`, et donc
  d'accepter que la note de rythme baisse : ce sont les deux faces d'un même
  choix, et il vaut mieux le poser que le subir.
- **Plans entre 1,1 et 2,8 s** → à portée sans toucher au code. C'est le
  **nombre de rushes importés** qui décide : le montage express vise 22 s au
  total et répartit dessus.
- **Plans plus longs que 2,8 s** → importer moins de rushes, plutôt que de
  changer un réglage.
- **Texte hors de la bande 12–45 %** → ne pas copier. La bande vient de
  captures réelles sur les trois plateformes, et c'est Instagram qui ferme le
  bas à 63 %. Une vidéo publiée sur une seule plateforme peut se le permettre ;
  une vidéo qui part sur les trois, non.
- **Son plus faible que −16 LUFS** → sur un téléphone, la vidéo suivante la
  couvre. `/master-telephone` sort au bon niveau.

## Les compétences voisines

Trois autres regardent des fichiers, et elles ne font pas la même chose :

- `/voir-le-son` **juge** un fichier — spectrogramme, sonie, vignettes — quand
  on demande « c'est bon ? », « ça sonne amateur ». Ici on ne juge pas : on
  relève une grammaire pour la reproduire.
- `/trier-les-rushes` **inventorie** un lot déposé en vrac. Ici il n'y a qu'un
  fichier, et on ne cherche pas à choisir.
- `/montage-sans-refaire` relit **son propre** montage avant de le rendre. Ici
  on lit celui de quelqu'un d'autre pour en prendre quelque chose.

Et une fois le réglage choisi, `npm run planche [N]` montre ce qu'Amorce en
fait — les deux planches se comparent alors côte à côte, ce qui est la seule
manière honnête de dire « on s'en rapproche ».
