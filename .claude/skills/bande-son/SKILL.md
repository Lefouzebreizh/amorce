---
name: bande-son
description: Fabriquer la bande-son d'une vidéo — voix off **synthétisée sur la machine**, musique, bruitages — et la sortir au bon niveau pour la plateforme visée, à partir d'une simple phrase d'intention. Mesure le fichier, propose les réglages, mixe avec ffmpeg, puis vérifie le résultat en LUFS et en vrai pic. À utiliser dès qu'une vidéo et du son se croisent : « fais-moi la bande-son de ce clip », « quel volume pour la musique », « la musique couvre ma voix », « le son est trop faible sur TikTok », « ajoute une ambiance », « il manque du rythme », « fais-moi une voix off », « je n'ai pas de voix », « lis ce script à voix haute » — et aussi quand un fichier .mp4 ou .mov arrive avec une intention de montage mais rien de dit sur le son. Ne pas attendre le mot « LUFS » : personne ne le prononce, et c'est précisément le réglage qui manque. Cette compétence *fabrique* le son ; pour **juger** un fichier déjà mixé — « ça sonne amateur », « on n'entend rien » — c'est `voir-le-son` qui regarde d'abord, et on revient ici pour corriger.
---

# Le son se juge en LUFS, pas en décibels de crête

## L'écart par défaut vide la queue quand la voix ne remplit pas la vidéo

Trouvé en assemblant une démonstration, et la mesure ne l'a pas vu : le montage
sortait à −14,2 LUFS, **conforme TikTok**, et les quatre dernières secondes
étaient vides. Seul le tracé du niveau l'a montré.

La cause n'est pas un défaut de `monter.py` mais une hypothèse de son réglage
par défaut. Seize décibels sous la voix est la valeur juste de la diffusion —
quand la parole occupe toute la durée. Sur une vidéo de 14,8 s dont la voix ne
couvre que 8,7 s, le lit se retrouve à **−44 dB absolus** : inaudible dès que la
voix s'arrête, c'est-à-dire précisément là où il devrait porter.

```
              corps    queue    écart
défaut        −16 dB   −44 dB   28 dB   ← la queue est morte
--ecart-db 9  −16 dB   −30 dB   14 dB
--musique-db -12  −16 dB  −30 dB  14 dB   ← retenu
```

**La règle qui s'en déduit :** dès que la voix laisse plus de deux secondes de
queue, poser le gain de musique à la main (`--musique-db`, autour de −12) plutôt
que de laisser calculer un écart. L'écart raisonne sur la voix ; il ne sait rien
de ce qui se passe quand elle se tait.

C'est aussi un rappel de pourquoi `/voir-le-son` passe avant la livraison : la
sonie intégrée est une moyenne, et une moyenne conforme peut cacher un quart de
vidéo silencieux.

## La musique se fabrique aussi, à partir d'une intention

`scripts/musique.py` produit un lit sonore de la durée voulue. Cinq ambiances,
chacune un mode, un tempo et une progression d'accords :

```bash
python3 scripts/musique.py --liste
python3 scripts/musique.py --ambiance calme --duree 30 --sortie fond.wav
python3 scripts/musique.py --ambiance espoir --graine 12   # autre chant, même harmonie
```

| ambiance | mode | pour |
| --- | --- | --- |
| `calme` | dorien 64 bpm | voix off posée, tutoriel, témoignage |
| `melancolie` | éolien 58 bpm | récit personnel, ce qui s'est mal passé |
| `lumineux` | lydien 72 bpm | ouverture, ce qui va mieux, fin d'épisode |
| `espoir` | majeur 68 bpm | conclusion, appel doux, remerciement |
| `attente` | éolien 60 bpm | suspension, question laissée ouverte |

**Trois contraintes gouvernent ce fichier, et aucune n'est musicale.** Ce sont
elles qui expliquent des choix qui paraîtraient timides ailleurs.

1. **Ça passe sous une voix.** La bande 1,5–4 kHz porte l'intelligibilité des
   consonnes ; la musique y est creusée de 5 dB. Ça ne s'entend pas seul et ça
   change tout au mixage. Même raison pour l'absence de percussion sèche : un
   transitoire fait plonger la voix à chaque coup dès qu'un compresseur les
   partage.
2. **Ça sort d'un haut-parleur de téléphone.** La basse passe par
   `porter_sur_telephone`. Mesuré sur les cinq ambiances : **0,6 à 1,2 dB de
   perte** une fois filtré comme le fait un téléphone — contre 30 dB pour un
   grondement non traité.
3. **Le public est hypersensible.** Pas de montée qui force, pas de crête qui
   surprend. L'étendue dynamique est volontairement faible : ce qui fait un bon
   disque fait une mauvaise musique de fond, parce qu'on monte le volume sur les
   passages doux et qu'on sursaute ensuite.

Deux points de facture qui s'entendent quand ils manquent : les enveloppes sont
en cosinus et jamais linéaires — une rampe droite laisse un angle dans la forme
d'onde, et cet angle s'entend comme un clic qu'on croit venir du fichier ; et la
nappe est écartée d'une octave et demie au-dessus de la basse, parce qu'une
tierce sous 200 Hz donne une bouillie que ni le mode ni le timbre ne rattrapent.

`--graine` change le chant sans toucher à l'harmonie : c'est le réglage à
tourner quand une prise « ne va pas » sans qu'on sache dire pourquoi.

## Une voix qui sonne robotique se corrige par la ponctuation, pas par le modèle

Retour d'écoute : « la voix est robotique, essaie l'autre modèle ». Changer de
modèle a **empiré** les choses, et la mesure le dit.

Ce qui fait entendre « récité » plutôt que « dit », c'est l'ampleur de la
mélodie — l'écart entre les hauteurs basses et hautes d'une phrase. Une voix
humaine posée couvre 8 à 14 demi-tons ; sous 6, l'oreille décroche.

| variante | ampleur | respirations |
| --- | --- | --- |
| `siwis` 0,94, phrase longue | 8,6 demi-tons | 5 |
| `upmc` 0,94, phrase longue | **6,7** | 6 |
| `upmc` 0,90 + ponctuation refaite | 7,2 | 10 |
| **`siwis` 0,90 + ponctuation refaite** | **11,0** | 9 |
| `siwis` 0,82 + ponctuation refaite | 11,4 | 9 |

**Le levier est le texte.** Ces synthèses tirent leur prosodie de la ponctuation :
chaque point remet la mélodie à zéro et pose une respiration. Découper en
phrases courtes a gagné 2,4 demi-tons d'ampleur et presque doublé les pauses,
sans changer un mot du sens.

```
Avant : « Je connais, la mienne non plus pendant des années. »
Après  : « Je connais. La mienne non plus, pendant des années. »
```

Écrire pour l'oreille n'est donc pas une coquetterie de rédaction : c'est le
réglage principal de la synthèse. Un texte écrit pour l'œil sonnera récité quel
que soit le modèle.

`--vitesse` vient en second, entre 0,88 et 0,92 : plus lent gagne encore un peu
d'ampleur, mais traîne. `upmc` reste utile pour un autre grain de voix, pas pour
plus de vie.

## La palette : seize bruitages, tous fabriqués

| son | ce qu'il fait | pour |
| --- | --- | --- |
| `souffle` | une bande qui se déplace, pas un bruit en fondu | **la coupe** — sans lui chaque transition est un trou |
| `eclat` | un corps grave puis des éclats qui se raréfient | quelque chose qui vole en morceaux |
| `carillon` | partiels inharmoniques, longue traîne | une rune, un signe, un éveil |
| `pulsation` | deux coups par battement, le second plus grave | la tension, **sous** autre chose |
| `souffle_tournant` | rotation qui **accélère** | un vortex, une aspiration |
| `respiration` | enveloppe asymétrique, montée vite / retombée lente | le souffle d'une créature |
| `boom` `choc_metal` `grondement` `crepitement` | | impacts et lits |
| `montee` `electricite` `rugissement` `nappe_sombre` | | tension, décharge, fond |
| `braam` | six cuivres désaccordés, chute d'un demi-ton à la fin | **la signature du film-catastrophe** |
| `chute_sous_grave` | une hauteur qui tombe de 130 à 28 Hz | ce qui suit un impact |

Trois de ces six-là tiennent à une seule ligne, et c'est elle qui les distingue
d'un effet générique :

- **Le souffle est une bande qui bouge**, pas un volume qui monte. L'oreille lit
  le déplacement comme un objet qui passe ; sans lui on n'entend qu'un chuintement.
- **La rotation du vortex accélère.** À vitesse constante on entend un
  hélicoptère ; en accélérant, une aspiration.
- **Les éclats se raréfient** en retombant. À densité constante on entend une
  averse, pas un objet qui explose.

`pulsation` s'emploie **sous** autre chose. Seule, elle devient une horloge, et
l'urgence fabriquée est précisément ce qu'on ne fait pas ici.

## Ce que `porter_sur_telephone` ne sait pas faire

Il transforme un grave **synthétique** en son audible : mesuré, +30,7 dB sur le
grondement, +19,2 sur la pulsation.

**Sur un enregistrement réel, il grésille.** Essayé sur une explosion générée,
dense et entièrement sous 150 Hz : l'énergie du médium est passée de 1,4 % à
29,6 %, et l'auteur a rejeté le résultat à la première écoute. La cause est dans
la méthode — le redressement d'un signal complexe fabrique des produits
d'intermodulation, là où sur une sinusoïde il fabrique des harmoniques propres.

Sur un son enregistré, s'en tenir donc à une **cloche d'égalisation vers
190 Hz** et à une queue de réverbération. Ça rend moins, et ça ne salit rien.

Et accepter la limite : un son entièrement sous 150 Hz ne sera **jamais** rendu
par un haut-parleur de téléphone. Le choix n'est pas entre sourd et audible,
mais entre sourd et sale.

## Un bruitage grave doit être porté sur le téléphone

Le défaut ne s'entendait pas au casque, et c'est ce qui le rendait durable.
Mesurée en filtrant la palette comme le fait un haut-parleur de téléphone —
rien sous 400 Hz — elle rendait ceci :

| bruitage | avant | après | gain |
| --- | --- | --- | --- |
| grondement | **−72,1 dB** | −41,4 dB | **+30,7** |
| nappe_sombre | −39,4 dB | −30,5 dB | +8,9 |
| boom | −40,2 dB | −34,7 dB | +5,5 |
| rugissement | −33,4 dB | −31,7 dB | +1,7 |

Le grondement à −72 dB n'était pas discret : il était **absent** de l'appareil
où le format court est regardé.

`porter_sur_telephone()` applique la parade du mastering, déjà éprouvée dans
`src/lib/sfx.ts` : on ne remonte pas le grave, on lui **fabrique ses
harmoniques** par redressement puis saturation douce. Les partiels 2f, 3f, 4f…
passent, et l'oreille reconstruit le fondamental manquant.

**Les deux couches se partagent le niveau, elles ne s'y ajoutent pas.** Les
additionner ferait grimper la crête, et le limiteur commun, en l'écrasant,
ferait pomper tout le mixage à chaque frappe. Vérifié : la crête de la palette
est restée à 0,890 avant comme après, et les quatre bruitages déjà aigus n'ont
pas bougé de plus de 0,3 dB.

Le `poids` se règle par bruitage — un impact bref supporte plus d'harmoniques
qu'une nappe tenue, qui devient agressive avant d'être plus audible.

## La voix off se fabrique ici, sans clé

Le dépôt a longtemps tenu la synthèse vocale pour hors de portée : pas de clé
ElevenLabs, et `edge-tts` passe par un hôte que le mandataire refuse. La
conclusion était juste sur les deux chemins essayés, et fausse sur le troisième.

`scripts/voix.py` produit une voix off française **sur la machine**, par
sherpa-onnx, dont les modèles sont publiés en objets de release GitHub — l'hôte
qui répond, là où Hugging Face est bloqué. Mesuré : 6,1 s de parole en 20 s la
première fois (65 Mo de modèle téléchargés), puis un instant, à 25× le temps
réel.

```bash
python3 scripts/voix.py --check
python3 scripts/voix.py --texte "Ce soir, on ne cherche pas à aller plus vite." --sortie voix.wav
python3 scripts/voix.py --fichier script.txt --sortie voix.wav --vitesse 0.95
```

Deux voix : `siwis` (neutre, lisible) et `upmc` (grain plus marqué). La sortie
est du WAV brut — c'est `monter.py` qui pose ensuite la loudness de la
plateforme, et convertir ici ajouterait une perte avant le mixage.

Passée à `voir-le-son`, cette voix perd **4 à 5 dB** sur un haut-parleur de
téléphone : son fondamental descend sous les 400 Hz, mais ses formants n'y sont
pas, et ce sont eux qui portent l'intelligibilité.

**Ce qui n'est toujours pas fabricable ici : la musique.** `bruitages.py` couvre
les impacts, grondements, crépitements et nappes ; une mélodie, une harmonie,
une rythmique, non. Le repli honnête reste une piste libre de droits déposée à
la main.

C'est l'erreur qui coûte une journée. Un mixage calé à -1 dBFS de **crête** peut
mesurer -22 LUFS de **loudness** : il ne sature pas, la forme d'onde remplit
l'écran, tout paraît normal — et à la publication il sort deux fois plus faible
que la vidéo suivante. Les plateformes ne normalisent pas la crête, elles
normalisent la loudness perçue, et elles **baissent** ce qui dépasse sans jamais
remonter ce qui manque.

Donc : mesurer avant de toucher, viser une cible chiffrée, vérifier après.
Le reste de cette recette découle de là.

## LRA : la mesure qui explique « on n'entend rien »

La sonie dit à quel point c'est fort. Elle ne dit rien de ce qui **ressort**.
La plage de dynamique — `LRA`, rendue par le même `ebur128` — dit l'écart entre
les passages calmes et les passages forts, et c'est elle qu'il faut lire quand
un mixage conforme s'entend comme du silence.

```bash
ffmpeg -hide_banner -i film.mp4 -af ebur128=framelog=verbose -f null - 2>&1 \
  | grep -E "^\s+(I|LRA):" | tail -2
```

| LRA | Ce que ça donne |
| --- | --- |
| < 3 LU | Tout au même niveau. L'oreille ne distingue plus rien : perçu comme « pas de son », quelle que soit la sonie. |
| 4 – 6 LU | Tenable pour un format court très dense. |
| 6 – 10 LU | Une bande-annonce qui respire : creux avant les crêtes. |
| > 12 LU | Les passages calmes deviennent inaudibles dans un fil de réseau social. |

Un montage mesuré ici à **−8,4 LUFS et LRA 2,1** — plus fort que la référence
de l'auteur — a été rejeté huit fois pour « pas de son ». La cause était un lit
sonore posé **en continu** sous tous les plans : le retirer et ne le laisser
revenir que par touches a rendu LRA 6,8, sans toucher au niveau moyen.

**Trois conséquences pratiques.**

**Un creux se réduit, il ne se comble pas.** Remonter le bloc le plus faible
jusqu'au niveau des voix a fait retomber LRA de 6,8 à 3,5 : on avait rebouché
le trou en supprimant la dynamique qui le rendait nécessaire. Un creux doit
cesser d'être un silence, pas cesser d'être un creux.

**Un limiteur ne rend pas plus fort.** Mesuré sur ce mixage : au-delà de deux
décibels de gain, +2 dB de plus n'achetaient que 0,6 LUFS et coûtaient 0,8 LU.
Le limiteur reprend en dynamique ce qu'il donne en niveau.

**Une double passe de `loudnorm` écrase LRA** quand le mixage est déjà dense —
2,1 LU en sortie contre 4,7 en entrée. Pour un master déjà mixé, préférer un
gain fixe suivi d'un `alimiter` qui ne touche que la crête :

```bash
-af "volume=2dB,alimiter=limit=0.92:attack=8:release=200:level=disabled"
```

## Le parcours, en quatre gestes

**1. Mesurer avant de toucher.** `scripts/sonometre.py` sur chaque source rend
la loudness intégrée, le vrai pic, l'étendue dynamique et — sur une voix — les
passages parlés. On ne propose aucun réglage avant d'avoir ces chiffres : sans
eux on devine, et deviner sur du son, c'est refaire trois fois.

**2. Traduire l'intention en réglages.** L'utilisateur donne une phrase, pas des
décibels : « recette de cuisine, 45 s, voix off, ambiance chaleureuse ». Le
tableau plus bas convertit ça en niveau de musique, profondeur de baisse et
densité de bruitages. **Ne poser qu'une seule question**, et seulement si la
réponse ne se devine pas : la plateforme de destination, quand elle n'est pas
dite. Le reste s'infère de la vidéo (durée, format, présence de parole).

**3. Mixer.** `scripts/monter.py` fait le montage complet : boucle et fondu de
la musique, plongée sous les passages parlés, mixage, normalisation en
deux passes, remultiplexage sans ré-encoder l'image.

**4. Rendre la carte du mixage.** Pas un fichier lâché sans un mot. Toujours
ces trois blocs :

```
Bande-son — <fichier de sortie>
  Mesuré : -14,1 LUFS · vrai pic -1,2 dBTP · étendue 6,8 LU  → conforme <plateforme>
  Décidé : musique -5 dB (soit 16 dB sous la voix), plongeant de 10 dB de plus
           sous la parole · fondu de sortie 2 s · bruitages : aucun
  À changer d'un mot : « plus de musique », « la voix devant », « plus calme »
```

La dernière ligne compte autant que les deux autres : l'outil doit être
contredit en une phrase, sinon personne n'y revient.

## Les cibles

| Destination | Loudness intégrée | Vrai pic |
| --- | --- | --- |
| TikTok, Reels, Shorts | **-14 LUFS** | -1 dBTP |
| YouTube (horizontal) | -14 LUFS | -1 dBTP |
| Podcast (Apple, Spotify) | -16 LUFS | -1 dBTP |
| Diffusion TV (EBU R128) | -23 LUFS | -1 dBTP |

Viser la cible, jamais la dépasser : au-dessus, la plateforme baisse **tout** le
mixage, voix comprise, et le résultat sort plat. En dessous de -1 dBTP de marge,
l'encodage AAC final repousse les crêtes au-delà de 0 et fait craquer un
fichier qui passait pourtant les mesures avant encodage.

## Une cible n'est pas une attente

Le tableau ci-dessus dit ce que les plateformes **admettent**. Il ne dit pas ce
que les créateurs **livrent**, et l'écart se paie cher.

Constaté sur un montage réel : la version calée à −14 LUFS, donc conforme, a
été rejetée huit fois. Le montage que l'auteur avait fait lui-même, du même
film, mesurait **−7,3 LUFS** — six décibels plus fort, et six de plus sur la
bande qu'un haut-parleur de téléphone restitue.

Donc : quand quelqu'un juge un mixage mauvais alors qu'il est conforme, **lui
demander un fichier qu'il trouve réussi et le mesurer**. Comparer sonie,
dynamique et énergie au-dessus de 400 Hz entre les deux. Un écart chiffré
tranche en une minute ce que l'itération au jugé ne trouve pas.

La cible reste un plafond à ne pas dépasser sans raison. Elle n'a jamais été
une consigne de ressemblance.

## De la phrase aux réglages

Les décibels ci-dessous sont **l'écart entre la musique et la voix**, jamais un
gain absolu. C'est la même distinction qu'entre « la musique seize décibels sous
la voix » et « la musique à -16 dB » : la première a un sens, la seconde n'en a
aucun tant qu'on ne sait pas à quel niveau la voix a été enregistrée. Mesurer
les deux sources d'abord, puis calculer le gain qui produit l'écart voulu.

| L'intention dit… | Musique sous la voix | Plongée pendant la parole | Bruitages |
| --- | --- | --- | --- |
| voix off, tutoriel, explication | 16 dB | 10 à 12 dB de plus | rares, ponctuation seulement |
| ambiance, voyage, sans parole | — (musique seule) | — | discrets, sous le rythme |
| rythmé, sport, accroche courte | 10 dB | 8 dB de plus | marqués, sur les coupes |
| calme, intime, témoignage | 20 dB | 12 dB de plus | aucun |
| démonstration produit | 14 dB | 10 dB de plus | un par geste montré |

Sans voix, le gain de la musique n'a aucun effet : elle est seule et la
normalisation finale la ramène à la cible quoi qu'on fasse. Ne rien y toucher.

Détails et cas limites : `references/intentions.md`.

## Les huit pièges

1. **Crête ≠ loudness.** Le piège principal, rappelé en tête. `dynaudnorm` et
   la normalisation par crête ne remplacent pas `loudnorm`.
2. **`loudnorm` en une passe est dynamique**, donc imprévisible : il compresse
   au fil de l'eau et le résultat mesuré ne tombe pas sur la cible. Toujours
   deux passes — mesurer, puis appliquer les valeurs mesurées.
3. **Baisser la musique en continu au lieu de la faire plonger sous la voix.**
   Une musique posée douze décibels plus bas pour rester intelligible devient
   inaudible dans les blancs, là où elle devrait porter. La baisse suit les
   passages parlés ; ce n'est pas un réglage de volume.
4. **Un compresseur à chaîne latérale ne tient pas une profondeur annoncée.**
   Mesuré sur ce dépôt : `sidechaincompress` réglé pour 12 dB n'en rendait que
   8, et donnait le même résultat pour 0 et pour 6 — son taux dépend du niveau
   instantané de la voix, pas de sa loudness. `monter.py` trace donc une
   enveloppe sur les passages parlés détectés, dans son propre étage de gain
   (l'écrire sur le volume de la musique ferait que bouger le curseur efface la
   baisse, et inversement).
5. **44,1 kHz contre 48 kHz.** La piste audio d'une vidéo est en 48 kHz, une
   musique téléchargée souvent en 44,1. Rééchantillonner explicitement, sinon
   la dérive s'entend sur une minute.
6. **Ne jamais ré-encoder l'image quand seul le son change** : `-c:v copy`.
   Sinon on paie une perte de qualité et plusieurs minutes pour rien.
7. **Une musique plus courte que la vidéo** se boucle avec un fondu enchaîné,
   pas par un redémarrage sec — la reprise brutale est le marqueur amateur le
   plus audible, juste devant la coupure nette en fin de vidéo (fondu de 1,5 à
   2 s, aligné sur la dernière image).
8. **Mesurer le fichier final, pas le mixage avant encodage.** C'est le seul
   chiffre qui correspond à ce que la plateforme recevra.
9. **Un gain de musique absolu ne veut rien dire.** Mesuré au banc d'essai : sur
   des sources où la musique arrivait déjà onze décibels sous la voix,
   appliquer « -16 dB » l'enterrait vingt-sept décibels plus bas, donc
   inaudible. Ce qui se règle est l'écart entre les deux, après les avoir
   mesurées — `monter.py` le calcule, mais quiconque mixe à la main doit y
   penser aussi.

### Ce que coûte la passe unique de `loudnorm` (point 2), en chiffres

Le point 2 est écrit depuis longtemps, et il a quand même été ignoré — par une
session qui a préféré six lignes de `ffmpeg` à la main plutôt que `monter.py`.
Le chiffre manquait, le voici : sur une bande-annonce, un impact sortant à **−1,4 dB**
dans le mixage brut ressortait à **−24 dB** après une passe unique de
`loudnorm`, c'est-à-dire au niveau du lit qu'il devait dominer. Quatre versions
ont été retouchées avant qu'on regarde la dernière ligne de la commande.

Rendue linéaire — mesure, gain unique, limiteur — la même bande-annonce fait
ressortir ses quatre frappes **16 à 17 dB au-dessus du lit**.

## Fabriquer les bruitages

Quand une vidéo n'a aucun son, il ne suffit pas de poser une musique : il manque
l'environnement et les ponctuations. `scripts/bruitages.py` les **synthétise** —
rien à télécharger, rien à licencier, et chaque son se règle par ses paramètres.

Le montage vit dans un fichier JSON, pas dans le code : d'un clip à l'autre,
seuls les instants et les gains changent. Partir de
`references/plan-exemple.json`, qui commente chaque pose.

| Bruitage | Ce qu'il fait |
| --- | --- |
| `boom` | Frappe lourde : claquement, corps saturé, coup de médium |
| `choc_metal` | Acier frappé — partiels amortis en 0,3 s |
| `rugissement` | Growl : modulation de fréquence saturée et souffle rauque |
| `electricite` | Décharge : bruit haché irrégulièrement |
| `montee` | Tension qui grimpe (ou retombe, avec `descendante`) |
| `grondement` | Masse grave, intensité sans cadence |
| `crepitement` | Braises : un train d'impulsions, pas un sifflement |
| `nappe_sombre` | Le lit, volontairement immobile |
| `braam` | Masse de cuivres : désaccord fixe en hertz, attaque de 65 ms, glissée finale d'un demi-ton |
| `chute_sous_grave` | Descente exponentielle sous le seuil — on n'entend que ses harmoniques |

## Un seul élément possède le grave à la fois

Mesuré en construisant `sfx_library` : quatorze bruitages **individuellement
conformes** — chacun sous les 10 dB de perte — empilés dans une bande-annonce de
vingt secondes ont donné **11,0 dB de perte**. Deux drones, un grondement, une
chute sub et un boom au même instant : les graves ne se masquent pas, ils
s'additionnent, et la somme repasse sous le seuil du haut-parleur.

Trois versions ont été nécessaires, et l'écart entre elles dit toute la règle :

| version | ce qui change | perte |
| --- | --- | --- |
| 1 | tout empilé, au gain conseillé | 11,0 dB |
| 2 | un seul événement grave à la fois | 9,0 dB |
| 3 | **le lit audible porté par un son qui passe le filtre**, le drone huit décibels dessous | **5,7 dB** |

C'est la troisième qui donne la méthode. Un drone perd 15,7 dB à lui seul : il ne
peut pas *porter* un lit sonore, c'est une couche qu'on **ressent** sur une
enceinte et qui ne doit rien coûter sur un téléphone. Le lit audible se confie à
un `grondement_braises` ou un `souffle_caverne`, qui perdent 1,3 et 0,3 dB.

Vérifier avec `/voir-le-son` **le mixage**, jamais les éléments : chacun passait.

**Les instants viennent de l'image, jamais d'une grille.** Les repérer avec
`ffmpeg -vf "select='gt(scene,0.3)',showinfo"` pour les coupes, et à l'œil pour
les gestes. Une montée se pose **avant** la coupe : un mouvement qui commence
sur l'image arrive déjà en retard.

**Trois erreurs déjà commises, et ce qui les corrige :**

1. **Des partiels inharmoniques qui sonnent une seconde et demie, c'est une
   cloche** — c'est la durée d'extinction, et elle seule, qui sépare le carillon
   du choc sur l'acier. Rester sous 0,4 s.
2. **Une modulation régulière fabrique du ressac.** Du bruit filtré dont
   l'amplitude suit une sinusoïde, l'oreille l'entend comme une vague : c'est
   littéralement ce qu'est une vague. Le feu et la pierre sont irréguliers.
3. **Des bruitages ne sont pas une musique.** Ils ponctuent la parole au lieu de
   la porter : `--ecart-db 6 --baisse-db 4` plutôt que les 16 et 10 d'un fond
   musical, sinon l'impact posé sous la voix off devient inaudible.

## Outillage

```bash
S=.claude/skills/bande-son/scripts

python3 $S/sonometre.py ma-video.mp4                    # mesurer
python3 $S/sonometre.py voix.wav --parole               # + repérer les passages parlés

python3 $S/monter.py --video clip.mp4 --musique fond.mp3 --voix voix.wav \
        --plateforme tiktok --intention "tutoriel, voix off, calme"

python3 $S/bruitages.py plan.json ambiance.wav      # sonoriser un montage muet
python3 $S/monter.py --video muet.mp4 --musique ambiance.wav \
        --ecart-db 6 --baisse-db 4 --voix off.mp3 --voix-debut 0.7
```

`--voix-debut` décale la voix off et la plongée de la musique ensemble : une
narration ne commence jamais sur la première image.

Les deux scripts trouvent ffmpeg seuls : celui du système d'abord, sinon celui
livré par `imageio-ffmpeg` (même stratégie que `mon-app-audio/core/mixeur.py`).
Aucune installation à demander avant d'avoir essayé.

Si la vidéo porte déjà sa voix dans sa propre piste audio, ne pas demander de
fichier séparé : `--voix-de-la-video` l'extrait.
