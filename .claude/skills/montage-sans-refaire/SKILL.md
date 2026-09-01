---
name: montage-sans-refaire
description: La liste de contrôle d'un montage vertical, écrite après vingt-cinq versions d'un même épisode livrées et rejetées en une nuit. Chaque ligne est un défaut réel, sa mesure et sa parade. À passer AVANT de rendre un montage — pas après une plainte — et dès qu'une demande dit « ça sature », « on n'entend pas », « ça coupe », « les sous-titres sont mal placés », « c'est trop long », « refais-le », « ils partent au bout de deux secondes », « personne ne regarde jusqu'au bout », ou dès qu'on s'apprête à livrer une deuxième version du même fichier. À utiliser aussi quand tout paraît juste : la moitié de ces défauts passent toutes les mesures habituelles et ne se voient qu'ici. Ici on relit un montage AVANT de le rendre, toutes causes confondues ; quand le défaut est visuel et tient aux plans qui ne vont pas ensemble — « ça fait amateur », « on dirait des clips collés », un saut de luminosité — c'est `etalonner` qui mesure et corrige.
---

# Ne pas refaire la vidéo cinquante fois

Vingt-cinq versions d'un même épisode de vingt secondes, livrées et rejetées en
une nuit. Presque aucune ne l'a été pour une raison nouvelle : les mêmes
familles de défaut sont revenues, chacune deux ou trois fois, parce que rien
n'était écrit.

Ceci est cette liste. **Elle se passe avant de rendre**, dans l'ordre — les
premières lignes attrapent les défauts qui obligent à tout refaire, les
dernières ceux qu'on corrige en un chiffre.

---

## 1. Avant d'ajouter le moindre son : dessiner celui qui existe déjà

```bash
python3 .claude/skills/voir-le-son/scripts/voir.py rush.mp4 /tmp/vu
```

**Un rush porte souvent une bande son construite.** Celui du dragon avait
arrivée, silence, montée, creux, éclair, rugissement, et 19,6 dB de dynamique —
un travail de sound design déjà fait, que trois versions de montage ont
recouvert sans le voir.

Si le rush a une construction :

- **On la renforce sur ses instants**, on ne la double pas ailleurs. Un accent
  posé à une seconde du sien ne s'y ajoute pas : les deux se masquent.
- **On se tait dans ses silences.** Un silence dans un rush est une décision.
- Relever ses instants au lieu de les estimer :

```bash
python3 - <<'PY'
import subprocess, numpy as np, soundfile as sf
subprocess.run(['ffmpeg','-v','error','-y','-i','rush.mp4','-vn','-ac','1',
                '-ar','48000','-c:a','pcm_f32le','_r.wav'], check=True)
y, sr = sf.read('_r.wav', dtype='float64')
X = np.fft.rfft(y); f = np.fft.rfftfreq(len(y), 1/sr); X[f < 400] = 0
h = np.fft.irfft(X, len(y)); n = int(0.10*sr)
v = [20*np.log10(max(np.abs(h[i:i+n]).mean(), 1e-9)) for i in range(0, len(h)-n, n)]
for i, x in enumerate(v):
    print(f"{i*0.10:6.2f} {x:6.1f} {'#'*max(0, int((x+45)*1.2))}"
          f"{'  <- ATTAQUE' if i and x-v[i-1] > 4 else ''}")
PY
```

---

## 2. Calculer la frise, jamais l'écrire à la main

**Avec `vitesse`, `duree` compte en secondes SOURCE** et la longueur rendue vaut
`duree / vitesse` — et moins encore si la source s'épuise. Un plan à 1,8 avec
`duree: 2.8` rend **1,56 s**.

Conséquence payée deux fois : tous les accents du plan suivant à **1,24 s** de
leur cible, puis tous décalés de 1,3 s après un simple raccourcissement du
plan d'ouverture. Aucune erreur, aucun avertissement, un fichier faux.

`montage-auto/caler_dragon.py` dérive tous les instants de la frise et des
événements du rush. **Changer une durée les déplace tout seuls.** Pas de
nombre écrit à la main dans une recette qui contient une `vitesse`.

---

## 3. Ce qui n'existe pas sur un téléphone n'existe pas

Le sol est à **400 Hz** : un haut-parleur de téléphone ne restitue rien en
dessous. Mesuré sur seize bruitages « cinéma » reçus d'un coup, **la moitié
avait toute son énergie sous ce seuil** — un fichier à −61,3 dB entendus, c'est
du silence, quel que soit le gain.

```bash
ffmpeg -i son.mp3 -af "highpass=f=400,volumedetect" -f null -
```

- **Grave pur** → `porter_sur_telephone` (clé `telephone` sur un effet), qui
  fabrique ses harmoniques. Gain mesuré : **+32,6 dB** sur le pire des cas.
- **Déjà du médium** → rien à faire, l'excitation ne rend que −0,2 dB.
- Vérifier la crête à l'entrée : plusieurs de ces fichiers décodaient
  **au-dessus du plein échelle** (1,42) et écrêtaient avant le limiteur.

**Et chercher le vrai avant de synthétiser.** Un vrai rugissement mesurait
−12,2 dB entendus contre −25 pour celui fabriqué ici : **treize décibels**
qu'aucun réglage ne rattrape. La synthèse sert à ce qui n'existe pas ou doit
être exact à l'image près.

---

## 4. « Ça sature » veut presque toujours dire « ça masque »

Trois versions passées à baisser des niveaux pour un défaut qui n'était pas un
niveau. Mesurer avant de corriger :

```bash
# l'ecretage : combien d'echantillons touchent le plafond
# (zero + facteur de crete a 11-12 dB = rien ne clippe)
```

Si rien n'écrête, c'est du **masquage** : trop de sources à la fois. Le profil
par octaves le montre d'un coup — **toutes les bandes pleines à la fois**,
c'est de la boue quel que soit le niveau. Il ne se corrige qu'en **enlevant** :
une couche au lieu de deux, les lits continus supprimés, la réverbération
raccourcie. Le monter l'aggrave.

Relief spectral obtenu ainsi : 9,5 → 11,5 dB, et la boue sous 125 Hz de 10,4 à
2,4 dB.

---

## 5. Les cinq façons de fabriquer une « coupure » qui n'en est pas

Le même mot est revenu quatre fois pour quatre causes différentes. Les vérifier
dans cet ordre :

1. **Le limiteur pompe.** Comparer le gain appliqué avant/après master : s'il
   **varie** (mesuré : +1,0 à +6,1 dB selon l'instant), il pompe. On ne baisse
   pas le limiteur, on **ne l'atteint plus** — le gain se gagne dans le mixage.
2. **`atempo` troue.** Sur un ralenti, l'étirement par recouvrement décale les
   phases et creuse des trous périodiques. Tremblement de l'enveloppe : 2,4 nu
   → 3,7 avec `atempo` → **2,5 avec `rubberband=tempo=…:smoothing=on`**.
3. **Le trou d'air mord sur ce qu'il annonce.** Un creux d'automation qui
   déborde de 0,1 s sur l'attaque d'un cri l'aplatit en montée molle. Il finit
   **avant**, avec 0,05 s de marge.
4. **Le son est plat.** Relevé : −25 dB pendant 2,4 s sans onset. Ce n'est pas
   un cri, c'est un bourdon, et un bourdon ne s'entend pas quel que soit son
   gain. Lui donner une enveloppe — mais **après** la normalisation, sinon
   l'accent devient la nouvelle crête et le corps descend d'autant.
5. **Deux flux AAC concaténés en copie.** Les délais d'amorçage diffèrent :
   mesuré, un vrai pic à +9 dBTP sur un mixage qui ne dépassait pas −0,8. La
   vidéo se concatène en copie, l'audio se réassemble en PCM.
6. **Une couche posée avant l'assemblage est tranchée au raccord.** Un
   rugissement de 3,45 s posé à 16,08 s sur un film qui s'arrête à 17,96 perd
   sa fin — et le spectrogramme le montre comme une **raie verticale pleine
   bande**, franche, sans ambiguïté possible avec une modulation. Les couches
   se posent sur l'image **finie**, carton compris : `montage → carton →
   couches → master`.

7. **Deux versions du même son jouent ensemble.** Le rush portait son propre
   rugissement, étiré par le ralenti ; le vrai était posé par-dessus à sa
   vitesse naturelle. Superposés, ils ne s'additionnent pas — ils **battent**,
   et ce battement s'entend comme une saturation ET comme une coupure au
   milieu. Sur le spectrogramme : des **stries verticales irrégulières** entre
   2 et 10 kHz, là où un cri unique dessine une nappe dense.

   C'est la cause qui résiste le plus longtemps, parce que **rien n'est
   défectueux** : le fichier source mesure −0,4 dBFS sans un écrêtage, le
   fichier livré n'a aucune discontinuité au niveau de l'échantillon, aucun
   palier plat, un vrai pic à −1,4 dBTP. Chaque pièce est juste ; c'est leur
   somme qui ne l'est pas. Le lit recule de 8 dB pendant le cri seul — pas
   au-delà, sinon on perd les débris qui font le monde autour.

**Et quand cinq causes sont tombées et que le symptôme revient, c'est
l'effet qui est en trop, pas le réglage qui est faux.** Le ralenti de ce plan
en produisait trois à lui seul : l'audio devait être étiré, l'image
interpolée, et le cri du rush s'y décalait contre celui posé par-dessus. Retiré,
les trois disparaissent d'un coup. **Un effet qui coûte cinq allers-retours ne
vaut pas ce qu'il apporte** — et le plan reste beau à sa vitesse.

Corollaire : **une correction étroite fabrique son propre défaut.** Le +5 dB à
1,9 kHz posé pour désencombrer un cri lui ajoutait une résonance ; une cloche
large à 2,4 kHz fait le même travail sans elle (tremblement 4,1 → 3,7).

**Le spectrogramme distingue les six.** Une raie verticale pleine bande est
une coupure ; un tremblement régulier de l'enveloppe est un étirement ; un
creux large est une automation ; des stries verticales irrégulières dans le
haut du spectre sont deux sons superposés. Compter les « trous sous un seuil »
ne les sépare pas — un vrai rugissement a des creux naturels, et les supprimer
l'abîme davantage (mesuré : 3 trous devenus 23 en effaçant le lit qui les
remplissait).

---

## 6. « Ça saccade » peut n'avoir aucun rapport avec le son

Une secousse de caméra posée sur un rugissement faisait passer le mouvement
image de **16 à 40** pendant 0,35 s. C'est cela, et rien d'autre, qui était
rapporté comme « ça saccade au moment du cri » — le son y était irréprochable.

```python
# le mouvement image, entre deux images consecutives
mv = [abs(im[i] - im[i-1]).mean() for i in range(1, len(im))]
```

**Une secousse sert un plan immobile.** Sur une bête qui hurle et bouge déjà
violemment, elle ne renforce rien : elle brouille son mouvement propre, et le
brouillage se lit comme un défaut de lecture.

Corollaire du point 9 : avant de chercher un défaut de son sur un plan
mouvementé, mesurer son mouvement.

---

## 7. Ce qui se voit sans s'entendre

Des éclairs sortent des yeux d'un personnage — et **aucun son** ne les
accompagne. Le premier bruitage arrivait 1,2 s plus tard.

Ça ne se trouve pas à l'oreille, ça se trouve en **relevant les événements de
l'image** et en vérifiant qu'un son leur répond :

```python
# les evenements lumineux : compter les pixels tres clairs image par image
clairs = [(x > 200).sum() for x in images]
# une apparition = un facteur 2 ou plus d'une image a la suivante
```

Mesuré ici : 713 → 2864 pixels en trois images à 5,42 s, et 16 782 sur une
seule image à 6,96. Deux événements majeurs, zéro son.

**Faire la liste des événements de l'image, puis pointer le son qui répond à
chacun.** Celui qui n'en a pas est un trou que personne ne signale, parce qu'on
ne remarque pas l'absence — on la ressent.

---

## 8. Chaque événement a besoin de son contraste, et ça se chiffre

Le climax en tête ne suffit pas : « on n'entend pas les pas » se dit d'un son
qui est là, au bon instant, au bon niveau — et **au même niveau que ce qui
l'entoure**. Un événement qui ne dépasse pas son fond n'existe pas.

```python
# pour chaque evenement : son niveau, contre la moyenne des 0,45 s qui precedent
contraste = max(env[t : t+0.20]) - env[t-0.45 : t-0.05].mean()
```

| contraste | ce que ça donne |
| --- | --- |
| **négatif** | l'événement est **sous** son fond : inaudible, quel que soit son gain |
| 0 à 3 dB | on le devine |
| **5 à 10 dB** | il ponctue — la cible |
| > 15 dB | il agresse |

Relevé sur une scène rapportée comme « tout sature, on n'entend rien » : deux
pas à **−1,2 et −2,2 dB** — sous leur propre fond. Corrigés, +3,5 et +6,3.

Trois causes possibles, dans cet ordre :

1. **Un accent précédent dure trop.** Une queue de braam tenait 1,4 s et
   couvrait les deux pas posés derrière. `enveloppe.coupe` la taille.
2. **L'esquive avale ce qu'on a mis dans le creux.** Un effet de recette la
   subit comme le reste du lit. Le sortir en **couche** avec
   `suit_la_voix: false` le fait passer après : c'est la seule façon de poser
   un son *dans* un creux sans qu'il soit creusé avec.
3. **Le son n'existe pas au-dessus de 400 Hz.** Voir le point 3.

---

## 9. Le climax doit être le plan le plus fort, et ça se vérifie

```bash
# par section, au-dessus de 400 Hz — si le climax n'est pas en tete,
# c'est LE defaut, quelle que soit la sonie globale
```

Relevé une fois : le **sigil** sonnait 3,3 dB plus fort que le dragon, parce
que quatre transitions s'empilaient sur 1,1 s de plan. Un plan de passage ne
dépasse jamais le climax.

Et un carton de fin n'a pas de niveau propre : posé à −17 dB il ne manquait
nulle part, et il faisait tomber la dynamique du film de 21,4 à 9,8 LU. Une
dizaine de décibels sous le climax.

---

## 9 bis. La première demi-seconde est le seul plan que tout le monde voit

Relevé sur l'épisode 1 d'Aznaroth publié le 31/08/2026, par section, filtré
au-dessus de 400 Hz — c'est-à-dire ce qu'un haut-parleur de téléphone rend :

| section | tout le signal | téléphone | perte |
| --- | --- | --- | --- |
| **ouverture (0 → 0,63 s)** | −15,7 dB | **−33,3 dB** | **17,6** |
| druide | −16,6 | −24,1 | 7,5 |
| portail | **−9,2** | −21,7 | 12,6 |
| vortex | −11,9 | −26,5 | 14,7 |
| dragons | −10,8 | **−19,1** | 8,3 |
| créature | −14,8 | −28,3 | 13,5 |

Deux choses que seule la colonne « téléphone » dit.

**L'ouverture est quatorze décibels sous le reste du film.** Elle mesure −15,7
sur tout le signal — dans la moyenne — parce que son énergie est presque
entièrement sous 400 Hz. Sur l'appareil où la vidéo est regardée, la première
demi-seconde est **muette**, et c'est la seule que tout le monde voit : celle où
le pouce décide.

**Le classement s'inverse.** Le plan le plus fort du mixage est le portail
(−9,2) ; sur un téléphone, c'est la séquence des dragons (−19,1) qui passe
devant, le portail tombant deuxième. Ici la narration s'en sort — les dragons
*sont* le climax. Mais le mixage ne le savait pas : il a désigné un autre plan,
et c'est le filtre du téléphone qui a corrigé par accident.

La règle du point 9 reste vraie et se complète : le climax doit être le plan le
plus fort **au-dessus de 400 Hz**, et l'ouverture ne doit jamais être la plus
faible. Les deux se lisent sur le même tableau, qui se tire en une commande.

## 9 ter. Le palier doit arriver avant la moyenne de visionnage

Le défaut le plus coûteux d'un format court ne se voit pas à l'œil, et aucune
relecture du montage ne le trouve. Il se lit en croisant **deux mesures qui
vivent à deux endroits différents** : les statistiques de la plateforme et la
frise du film.

Relevé sur Aznaroth, le 02/09/2026 :

| | |
| --- | --- |
| visionnage moyen de l'épisode 1 | **7,4 s** |
| instant où le dragon apparaît dans l'épisode 2 | **9,87 s** |

La moitié du public partait donc **avant d'avoir vu la créature** — c'est-à-dire
avant la seule image pour laquelle l'épisode existe. Le montage était bon, les
plans étaient bons, et le palier arrivait deux secondes et demie trop tard.

**La règle : l'image qui justifie le film se place avant la moyenne de
visionnage du précédent.** Pas au milieu, pas au climax dramatique — avant le
chiffre. Sur l'épisode 2 remonté, elle passe de 9,87 s à **4,24 s**.

Deux corollaires, et le second se calcule :

- **Ce qui précède le palier se taille au plus court.** Un portrait fixe de
  3,7 s en ouverture — mouvement mesuré entre 1,4 et 3,1, quand le portail
  voisin est à 17 — coûte deux fois : il n'accroche pas, et il retarde ce qui
  accroche.
- **Raccourcir le film augmente la complétion sans rien changer d'autre.** À
  visionnage moyen constant, la part de gens qui atteignent la fin est
  mécaniquement plus grande sur un film court. L'épisode 1 faisait 7,53 % de
  complétion sur 17,73 s ; l'épisode 2 est passé de 19,43 s à **10,27 s** par
  la seule suppression de ce qui ne bouge pas.

**Comment repérer les creux :** l'écart moyen entre images successives, par
tranche de 0,5 s. Un bloc sous 3 quand ses voisins sont à 12 est un trou, même
s'il dure une seconde au milieu de l'action — il y en avait un de 11,0 à
12,0 s, à 5,3, invisible en regardant le film.

```bash
ffmpeg -v error -y -i film.mp4 -vf "fps=30,scale=160:-1" /tmp/i%04d.png
# puis, par demi-seconde : la moyenne de |image[n] − image[n−1]|
```

Ce que ça ne remplace pas : **la courbe de rétention** de la plateforme, qui
dit *où* les gens partent. Ici on décide avant de l'avoir ; quand elle existe,
c'est elle qui tranche.

## 10. Un texte se place où le sujet n'est pas

```bash
python3 montage-auto/placer_texte.py film.mp4 3.0 4.4 5.8
```

À une hauteur fixe, un sous-titre finit par tomber sur ce qu'il ne faut pas
cacher : à 42 % il couvrait **la bouche du druide** pendant qu'il parle, et se
retrouvait **dans la gueule du dragon** sur le carton.

La zone sûre est **12–45 %** de la hauteur et ne se discute pas. Dedans, on
prend la bande la plus calme — mais **le relevé ne suffit pas** : sur un visage
qui remplit le cadre, toute la zone sûre est du visage, et le choix se fait
entre ce qu'on accepte de couvrir. Retenu ici après l'avoir regardé : **12,5 %**,
le texte sur le front, yeux et bouche libres.

---

## 11. Ce qu'on tire d'une image du film hérite de cette image

Un carton fabriqué depuis la dernière image portait le **titre encore
incrusté**, figé derrière ses trois lignes : quatre textes empilés. Les deux
traitements étaient corrects séparément.

**Un titre s'éteint 0,6 s avant la dernière image** dès qu'on reprend cette
image ailleurs — carton, vignette, miniature.

Et ce qui est monté à part se calcule **dans son propre repère** : la durée
annoncée du montage, celle du flux vidéo et celle du flux audio diffèrent de
quelques centièmes, et six sons posés aux instants absolus du film sont
ressortis à −45 dB.

---

## 12. Un ralenti sans interpolation duplique une image sur cinq

`vitesse: 0.8` sans `interpolation` : ffmpeg tient la cadence en **dupliquant**.
Mesuré sur le plan du dragon — **29 images figées sur 144**, soit une sur cinq à
intervalle régulier, contre **zéro** sur un plan à vitesse normale.

C'est ce que l'œil lit comme un saccadement, et c'est le rapport 1/5 qu'on
attend arithmétiquement d'un ralenti à 0,8.

```python
# compter les images figees : deux images consecutives quasi identiques
d = [abs(im[i+1] - im[i]).mean() for i in range(len(im)-1)]
figees = sum(1 for x in d if x < 0.30)
```

`interpolation: true` fabrique les images manquantes : **1 sur 144**. C'est
lent — cinq minutes pour sept secondes — et c'est le prix d'un ralenti qui
coule.

**Et l'oreille suit l'œil.** La même scène était rapportée comme « ça sature »
alors que le son ne portait **aucun échantillon écrêté** et un facteur de crête
de 13,1 dB. Quand une image saccade, tout le plan paraît mauvais. Avant de
chercher un défaut de son sur un plan ralenti, compter ses images figées.

---

## 13. Les durées : ce qui ouvre se regarde, ce qui traverse se coupe

- **Jamais d'image fixe ni d'affiche en première seconde. On entre dans le
  mouvement.** Cette ligne disait le contraire — « le temps de lire son titre,
  1,1 s pour huit lettres » — et la mesure l'a démentie.

  Relevé sur le teaser du **31/08/2026** : **la moitié de l'audience part avant
  la deuxième seconde**. Visionnage moyen **4,3 s sur 17**, complétion
  **3,6 %**. Une affiche ne demande pas au spectateur de patienter une seconde,
  elle lui demande de décider s'il reste — et il décide non.

  **Et les 63 partages ne sont pas de l'engagement : ce sont les miens.** Un
  chiffre flatteur au tableau de bord qui ne mesure que sa propre diffusion. Le
  compter comme un signal aurait fait conclure que le teaser marchait, alors
  que la courbe de rétention disait l'inverse dans le même écran.

  Ce que ça change en pratique : le premier plan porte du **mouvement dès la
  première image** — un geste en cours, un travelling déjà lancé, une matière
  qui bouge. Le titre, s'il en faut un, se pose **par-dessus** ce mouvement, il
  ne le remplace pas.
- **Une amorce** (un œil, une texture) ne porte aucune information : courte.
- Une image qu'on ne peut pas lire ne coûte pas son temps, elle le **gaspille**
  — c'est le pire des deux mondes.

---

## 14. Les trois relevés obligatoires, sur le fichier qui part

Écrits dans `CLAUDE.md` § 8, rappelés ici parce que c'est le moment de les
faire, et **sur le fichier final**, pas sur celui d'avant :

1. **Une planche d'images sur toute la durée**, dernière seconde comprise.
2. **Le niveau entendu section par section** — le climax en tête.
3. **La durée et le raccord** : `ffprobe` par flux. Vidéo et audio finissent-ils
   ensemble ? (`-shortest` a déjà tronqué 0,2 s d'image, soit la dernière ligne
   d'un carton.) Le son traverse-t-il chaque coupe ?

Puis `voir.py` sur le fichier livré : **aucun silence détecté**, et l'écart
entre les deux courbes sous 7 dB.

---

## Ce que tout ça a en commun

Chacun de ces défauts a un point commun : **une mesure disait vert et le
fichier était faux.** Soit parce qu'on mesurait au mauvais endroit (la sonie
globale au lieu du niveau entendu), soit parce qu'on mesurait le mauvais
fichier (un intermédiaire au lieu de celui qui part), soit parce qu'on ne
mesurait pas du tout ce qui clochait (la forme, pas le niveau).

**La parade n'est jamais de mesurer plus. C'est de mesurer ailleurs, et de
regarder.**
