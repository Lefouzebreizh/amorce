---
name: voir-le-son
description: Regarder un média au lieu de le mesurer — spectrogramme, courbe de sonie et planche de vignettes rendus en images que Claude peut réellement lire. À utiliser avant de livrer un montage, un export, une bande-son ou un rush, et dès qu'on doit juger la qualité d'un fichier audio ou vidéo : « le son n'est pas bon », « on n'entend rien », « ça sonne amateur », « il manque quelque chose », « regarde ce que ça donne », « c'est prêt à publier ? », « pourquoi c'est nul ». À utiliser aussi quand un chiffre agrégé dit « conforme » alors que l'utilisateur dit « mauvais » — c'est précisément le cas où la mesure ment et où l'image tranche. Ne pas attendre le mot « spectrogramme » : personne ne le prononce. Porte aussi `climax.py`, qui répond à une question que l'image ne tranche pas : le plan le plus fort est-il bien le climax ? — « la fin retombe », « le milieu écrase la fin », « ça finit en queue de poisson ».
---

# Un son se regarde

Claude ne peut pas écouter. C'est une limite réelle, et la contourner ne
demande pas d'entendre : il suffit de **dessiner le son et de regarder le
dessin**. Une image se lit, un fichier audio non.

Cette compétence existe parce que l'alternative a été essayée et a échoué.
Un montage mesuré à −14 LUFS — la cible exacte de TikTok, donc « conforme » —
était quasi muet sur un téléphone. Six versions ont été livrées, chacune
accompagnée de chiffres rassurants, chacune rejetée par l'oreille de
l'utilisateur. Le défaut tenait en une phrase : **toute l'énergie vivait sous
400 Hz**, là où un haut-parleur de téléphone ne restitue rien. Un seul
spectrogramme l'aurait montré immédiatement — un bloc lumineux en bas, un vide
au-dessus.

La leçon générale : **une mesure agrégée dit qu'un son est fort, jamais qu'il
est bon.** Une moyenne masque un trou, un déséquilibre, une saturation, un
silence. Une image les montre tous en même temps.

## Le geste

```bash
python3 scripts/voir.py <fichier> [dossier de sortie]
```

Le script rend deux images et un court rapport JSON :

- **`<nom>-son.png`** — le spectrogramme (où vit l'énergie) au-dessus d'une
  courbe de sonie (quand), avec en rouge ce qu'un téléphone laisse passer.
- **`<nom>-images.png`** — huit vignettes réparties sur la durée.

**Puis il faut les lire, littéralement.** Le rapport JSON ne remplace pas le
regard : il donne un chiffre de perte et un verdict, mais les défauts les plus
coûteux — un trou de son, une saturation, un plan noir — n'apparaissent que
sur l'image. Ouvrir les deux fichiers avec l'outil de lecture, et les regarder.

## Le second geste : le climax est-il le plan le plus fort ?

```bash
python3 scripts/climax.py <fichier> [--climax <instant>] [--marge <dB>]
```

`voir.py` **dessine** ; celui-ci **tranche**. Il découpe le fichier aux
changements de plan, mesure chaque plan au-dessus de 400 Hz, et sort en 1 quand
le climax n'est pas le plus fort — de quoi barrer une publication.

`CLAUDE.md` §8 posait la règle depuis longtemps et **rien ne la mesurait**.
Relevé sur un export réel : le climax à **7,4 dB sous** le plan qui le
précédait, avec une sonie globale correcte et un vrai pic conforme. Aucune
mesure agrégée ne pouvait le dire — une moyenne ne compare pas deux plans
entre eux.

Trois choses à savoir avant de lire son verdict :

- **Il découpe au plan, pas à la seconde.** C'est le plan qui est fort ou
  faible. Sur le même fichier, l'écart passe de 6,6 dB mesuré à la seconde à
  7,4 dB mesuré au plan.
- **Le climax est le dernier plan par défaut**, jamais le plus fort — le
  déduire du niveau rendrait le contrôle circulaire et toujours vert.
  `--climax <instant>` quand la chute est ailleurs.
- **Le remède n'est pas celui qu'on croit** : baisser le plan trop fort plutôt
  que monter le climax. Monter fait travailler le limiteur, qui écrase
  précisément ce qu'on voulait faire ressortir.

## Ce qu'on y voit, et ce que ça veut dire

**Un bloc saturé sous la ligne rouge, du vide au-dessus.**
Le son n'existera pas là où la vidéo sera regardée. C'est le défaut le plus
fréquent et le plus invisible aux mesures. Remède : relever la bande
1–4 kHz, ou refaire le bruitage avec des harmoniques (une saturation douce
suivie d'un filtre passe-haut fabrique les harmoniques qui, elles, passent).

**Une bande noire verticale.**
Un silence. Presque toujours un plan sans piste sonore — une image fixe
animée, un rush muet — dont personne n'a comblé le trou. À l'écoute, c'est
ce qui fait « amateur » plus sûrement que n'importe quel défaut de mixage.

**Les deux courbes du bas superposées.**
Bon signe : ce que l'on mixe est ce que le spectateur entendra. Un écart
constant de plus de 6 dB annonce une déception à la publication.

**Une courbe plate d'un bout à l'autre.**
Tout est compressé au même niveau. Le film n'a plus de dynamique : un
rugissement au même volume qu'une respiration ne fait plus peur. Souvent
causé par un compresseur à attaque trop rapide, qui mange les transitoires.

**Des traits horizontaux réguliers et fins.**
De la parole : les harmoniques d'une voix. Utile pour repérer *où* quelqu'un
parle dans un fichier sans le transcrire — et donc pour caler une voix off ou
vérifier qu'un plan contient bien du dialogue.

**Sur la planche de vignettes :** un cadre noir, un plan qui se répète, un
texte qui recouvre le sujet, une image floue. Tout ce qu'un rendu réussi ne
signale pas.

## Quand s'en servir

**Avant de livrer**, systématiquement, pas après une plainte. C'est le point
central : l'outil ne vaut que s'il passe avant l'envoi. Regarder un fichier
coûte quelques secondes ; en livrer six mauvais coûte une nuit.

**Sur les sources aussi.** Avant de retenir une prise parmi quatre, les
dessiner toutes : celle qui a le plus de matière au-dessus de 400 Hz gagne, et
ça ne se devine pas au nom du fichier.

**Quand l'utilisateur dit « ça ne va pas » sans savoir dire pourquoi.** Il a
raison et il ne dispose pas du vocabulaire technique — c'est normal, ce n'est
pas son métier. L'image traduit son ressenti en défaut nommable.

## Le sol à 400 Hz

Le trait rouge n'est pas décoratif. Un haut-parleur de téléphone ne reproduit
à peu près rien en dessous — physiquement, la membrane est trop petite. Or le
format court se regarde sur un téléphone, sans casque, une main sur l'écran.

Un grave y est donc une décision de mixage sans effet audible : il consomme de
la marge, déclenche le limiteur, écrase le reste du mixage, et n'apporte rien.
Ce n'est pas qu'il faille bannir les graves — ils portent sur une enceinte —
mais **rien d'important ne doit reposer sur eux seuls**.

## Limites honnêtes

Cette compétence ne rend pas le goût. Elle montre qu'un son est absent, troué,
déséquilibré ou écrasé ; elle ne dit pas s'il est beau, ni s'il va avec
l'image. Un montage peut être irréprochable sur ces planches et rester
médiocre.

Quand tout est propre à l'image et que l'utilisateur dit encore que ça ne va
pas, c'est du jugement, pas de la mesure : lui rendre la main plutôt que de
livrer une septième version.

## Si l'image ne montre rien d'anormal, lire LRA

Le spectrogramme attrape les trous, les déséquilibres et les saturations. Il
n'attrape pas la platitude : un mixage sans dynamique dessine une bande bien
remplie et parfaitement régulière, ce qui se lit comme un bon signal alors que
c'est le défaut. Quand tout paraît propre et que l'auteur dit « on n'entend
rien », la mesure qui tranche est la plage de dynamique — table des seuils et
correctifs dans `/bande-son`, section « LRA ».
