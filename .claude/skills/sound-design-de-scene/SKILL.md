---
name: sound-design-de-scene
description: "Concevoir le son d'une scène à partir de son IMAGE — relever ses événements, donner à chacun le sien, mesurer le contraste de chacun contre son fond, et creuser les silences qui les rendent audibles. La méthode, pas le matériau. À utiliser dès qu'une scène doit être sonorisée ou re-sonorisée, et dès qu'une demande dit « on n'entend pas les pas », « le rugissement ne ressort pas », « il manque quelque chose au moment de », « ça ne fait pas peur », « ça manque d'impact », « on ne sent pas le poids », « refais le son de cette scène », « il faut plus d'immersion ». À utiliser aussi **avant** de poser le premier bruitage sur un plan : sonoriser sans avoir listé ce que l'image fait revient à mettre du son à côté, et vingt allers-retours ont été payés pour l'apprendre. Ici on **conçoit** ; `/bande-son` fabrique les sons, `/sonotheque` choisit le matériau, `/voir-le-son` juge un fichier mixé, `/master-telephone` le sort, `/montage-sans-refaire` le relit avant de le rendre."
---

# Le son se conçoit depuis l'image

Vingt-cinq versions d'un même épisode de vingt secondes, rejetées en une nuit.
La cause tenait en une phrase : **je posais des sons, je ne concevais pas une
scène.** Un son posé est un son qui existe dans le fichier ; un son conçu est un
son qui répond à quelque chose et qui a la place d'être entendu.

Les quatre gestes, dans cet ordre. Aucun ne se saute.

---

## 1. Relever ce que l'image fait

**Avant tout**, la liste des événements — et elle se mesure, elle ne s'estime
pas. Deux relevés suffisent.

**Les événements lumineux** — un éclair, une explosion, une décharge :

```python
clairs = [(x > 200).sum() for x in images]     # pixels tres clairs
# une apparition = un facteur 2 ou plus d'une image a la suivante
```

Mesuré sur un plan : 713 → 2864 pixels en trois images, puis 16 782 sur une
seule. Deux événements majeurs du film, et **aucun son ne leur répondait** —
le premier bruitage arrivait 1,2 s plus tard.

**Les événements de mouvement** — un pas, un impact, une coupe :

```python
mv = [abs(im[i] - im[i-1]).mean() for i in range(1, len(im))]
```

Puis on écrit la liste, et **on pointe le son qui répond à chacun**. Celui qui
n'en a pas est un trou que personne ne signale : on ne remarque pas une absence,
on la ressent. « On n'entend pas les éclairs » se dit après la cinquième vision.

---

## 2. Écouter ce que le rush porte déjà

```bash
python3 .claude/skills/voir-le-son/scripts/voir.py rush.mp4 /tmp/vu
```

**Un rush porte souvent une bande son construite**, et c'est le piège le plus
coûteux du lot. Celui d'un dragon avait arrivée, silence, montée, creux, éclair,
rugissement — **19,6 dB de dynamique**, un travail déjà fait que trois versions
de montage ont recouvert sans le voir.

S'il en a une :

- **On la renforce sur SES instants.** Un accent posé à une seconde du sien ne
  s'y ajoute pas : les deux se masquent, et le mélange s'entend comme une
  saturation qu'aucune mesure de niveau ne voit.
- **On se tait dans ses silences.** Un silence dans un rush est une décision.
- **On ne double jamais un cri qu'il porte déjà.** Deux rugissements décalés ne
  s'additionnent pas, ils battent.

Relever ses instants plutôt que les estimer :

```python
X = np.fft.rfft(y); X[f < 400] = 0            # ce qu'un telephone entend
h = np.fft.irfft(X, len(y)); n = int(0.10*sr)
v = [20*np.log10(max(abs(h[i:i+n]).mean(), 1e-9)) for i in range(0, len(h)-n, n)]
# une attaque = +4 dB ou plus d'une tranche a la suivante
```

---

## 3. Donner à chaque événement son contraste

C'est le geste que personne ne fait, et c'est celui qui décide. **Un événement
au même niveau que son fond n'existe pas**, quel que soit son gain.

```python
contraste = max(env[t : t+0.20]) - env[t-0.45 : t-0.05].mean()
```

| contraste | ce que ça donne |
| --- | --- |
| **négatif** | l'événement est **sous** son fond : inaudible, quel que soit son gain |
| 0 à 3 dB | on le devine |
| **5 à 10 dB** | il ponctue — la cible |
| > 15 dB | il agresse |

Relevé sur une scène rapportée comme « tout sature, on n'entend rien » : deux
pas à **−1,2 et −2,2 dB**, c'est-à-dire sous leur propre fond. Corrigés, +3,5 et
+6,3.

**Trois causes, dans cet ordre :**

1. **Un accent précédent dure trop.** Une queue de braam tenait 1,4 s et
   couvrait tout ce qui suivait. Un accent qui dure plus que son plan masque la
   suite.
2. **L'esquive avale ce qu'on a mis dans le creux.** Un effet de recette la
   subit comme le lit ; seul un son posé en **couche** (`suit_la_voix: false`)
   s'ajoute après elle. C'est la seule façon de mettre un son *dans* un silence
   sans qu'il soit creusé avec.
3. **Le son n'existe pas au-dessus de 400 Hz.** Voir le point suivant.

---

## 4. Vérifier que chaque son existe sur l'appareil

Le sol est à **400 Hz** : sous ce seuil, un haut-parleur de téléphone ne
restitue rien. Un son entièrement grave n'est pas discret, il est **absent**.

```bash
ffmpeg -i son.mp3 -af "highpass=f=400,volumedetect" -f null -
```

**Un événement lourd est deux sons, jamais un.** Le poids et le contact viennent
de sources différentes :

| couche | rôle | mesuré sur un pas |
| --- | --- | --- |
| le grave | le poids, qu'on **ressent** | −37 dB entendus |
| le claquement | le contact, qu'on **entend** | **−19,5 dB**, 2-6 kHz à −4,3 |

Dix-sept décibels et demi. Et l'excitation harmonique ne sauve pas le grave
seul : sur un signal presque harmonique elle **recrée le même peigne** — mesuré,
+0,1 dB. Elle sert aux impacts brefs et aux nappes de synthèse, jamais aux lits
tenus, où ses partiels continus fabriquent **une note**.

Un lit audible se confie à un `grondement_braises` ou un `souffle_caverne` — 1,3
et 0,3 dB de perte — jamais à un drone, qui en perd quinze.

---

## La règle qui gouverne les quatre

**Un son n'est pas fort parce qu'on le monte, il est fort parce que le reste se
tait.** Le monter l'envoie dans le limiteur, qui le rend plus petit ; creuser
autour de lui le rend grand sans rien coûter.

C'est vrai à chaque échelle :

- **du plan** : un plan de passage ne dépasse jamais le climax ;
- **de l'événement** : un trou d'air de 0,3 s avant un cri vaut six décibels de
  gain — mais il finit **avant** lui, avec 0,05 s de marge, sinon il mord sur
  son attaque et l'aplatit en montée molle ;
- **du mixage** : onze sources simultanées font de la boue, et la boue s'entend
  comme une saturation.

---

## Ce qui se vérifie avant de rendre

Trois relevés, sur le fichier qui part — la liste complète est dans
`/montage-sans-refaire` :

1. **Le contraste de chaque événement**, positif partout.
2. **Le niveau entendu section par section**, climax en tête.
3. **Aucun gain positif demandé à un rush dont la crête dépasse 0,9** —
   `cible − mesuré` doit rester négatif, sinon le plan sature **avant** le
   mixage et aucune mesure faite après ne peut le montrer.

Puis `/voir-le-son` : perte sous 7 dB, aucun silence détecté.
