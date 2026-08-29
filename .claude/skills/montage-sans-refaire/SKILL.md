---
name: montage-sans-refaire
description: La liste de contrôle d'un montage vertical, écrite après vingt-cinq versions d'un même épisode livrées et rejetées en une nuit. Chaque ligne est un défaut réel, sa mesure et sa parade. À passer AVANT de rendre un montage — pas après une plainte — et dès qu'une demande dit « ça sature », « on n'entend pas », « ça coupe », « les sous-titres sont mal placés », « c'est trop long », « refais-le », ou dès qu'on s'apprête à livrer une deuxième version du même fichier. À utiliser aussi quand tout paraît juste : la moitié de ces défauts passent toutes les mesures habituelles et ne se voient qu'ici. Ici on relit un montage AVANT de le rendre, toutes causes confondues ; quand le défaut est visuel et tient aux plans qui ne vont pas ensemble — « ça fait amateur », « on dirait des clips collés », un saut de luminosité — c'est `etalonner` qui mesure et corrige.
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

**Le spectrogramme distingue les cinq.** Une raie verticale pleine bande est
une coupure ; un tremblement régulier de l'enveloppe est un étirement ; un
creux large est une automation. Compter les « trous sous un seuil » ne les
sépare pas — un vrai rugissement a des creux naturels, et les supprimer
l'abîme davantage (mesuré : 3 trous devenus 23 en effaçant le lit qui les
remplissait).

---

## 6. Le climax doit être le plan le plus fort, et ça se vérifie

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

## 7. Un texte se place où le sujet n'est pas

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

## 8. Ce qu'on tire d'une image du film hérite de cette image

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

## 9. Un ralenti sans interpolation duplique une image sur cinq

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

## 10. Les durées : ce qui ouvre se regarde, ce qui traverse se coupe

- **Une affiche d'ouverture** : le temps de lire son titre, pas plus. 0,6 s
  gaspille les 0,6 s ; 1,6 s perd le spectateur ; **1,1 s** pour huit lettres.
- **Une amorce** (un œil, une texture) ne porte aucune information : courte.
- Une image qu'on ne peut pas lire ne coûte pas son temps, elle le **gaspille**
  — c'est le pire des deux mondes.

---

## 11. Les trois relevés obligatoires, sur le fichier qui part

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
