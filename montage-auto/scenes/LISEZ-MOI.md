# `scenes/` — des plans fabriqués par le code, pas filmés

Une scène est **une page HTML qui expose `dessiner(t)`**. `rendre_scene.py`
appelle cette fonction une fois par image, photographie le résultat et pousse le
tout dans ffmpeg. C'est le principe de Remotion, sans Remotion.

```bash
python3 montage-auto/rendre_scene.py \
    --scene  montage-auto/scenes/portail.html \
    --site   capture-du-site.png \
    --sortie rushes/portail-martin.mp4 \
    --apercu 0.3 2.6 5.8 12.2      # écrit aussi ces instants en PNG
```

## Pourquoi une page HTML plutôt qu'un moteur de rendu

- **Elle s'ouvre dans un navigateur.** On règle une bordure ou une durée en
  rechargeant l'onglet, sans chaîne de compilation ni serveur de studio.
- **Elle est déterministe.** `dessiner(t)` ne lit ni horloge, ni
  `requestAnimationFrame`, ni `Math.random` — tout le hasard passe par une
  graine fixe. Deux rendus donnent le même fichier, à l'octet près. Une scène
  qui se rejoue autrement à chaque exécution ne se monte pas : on ne peut plus
  caler un son dessus.
- **Elle ne coûte aucune dépendance.** Le Chromium de Playwright et le ffmpeg
  d'`imageio` sont déjà là. `motion/` (Remotion) reste le bon outil pour les
  **habillages** — titres, cartons — qu'on repose ensuite dans CapCut ; `scenes/`
  fabrique des **plans entiers**, son compris, quand il n'y a pas de rush.

**Les images ne touchent jamais le disque.** Elles passent par un tube vers
ffmpeg. 402 images en 1080 × 1920 pèsent près d'un gigaoctet en PNG, et l'espace
disque d'une session est une allocation fixe, pas une machine : écrire la
séquence puis l'encoder, c'est demander ce gigaoctet pour rien. Le tube est là
par précaution, pas après un incident.

## Un récit, plusieurs montages

Les bornes, les cartons et la fenêtre de défilement vivent dans un JSON, pas
dans le dessin :

```bash
python3 montage-auto/rendre_scene.py \
    --scene montage-auto/scenes/portail.html \
    --recit montage-auto/scenes/recits/artisan-court.json \
    --site capture.png --sortie rushes/court.mp4
```

| récit | durée | le pari |
| --- | --- | --- |
| `artisan-long.json` | 13,4 s | le portail s'installe 3,4 s avant le site ; le message parle du soin apporté |
| `artisan-court.json` | 12,0 s | le portail tient en 1,3 s, le texte est là dès l'image zéro, chaque carton nomme ce qui est à l'écran |
| `artisan-choc.json` | 13,0 s | la moitié SERVICE d'un montage à deux plans : deux secondes de vrai dragon d'Aznaroth, coupure sèche, puis la démonstration décor nu |

**Le court n'est pas une coupe du long, c'est un pari inverse**, et il vient
d'une critique juste : trois secondes de spectacle muet, sur un fil où l'on
décide en une seconde, c'est trois secondes offertes au pouce. La réponse n'a
pas été de jeter le portail — il est la seule chose qui distingue ces vidéos de
toutes les autres du même service — mais de le **comprimer** et de faire jouer
le spectacle et la promesse **ensemble**. C'était un réglage, pas une
réécriture, et c'est précisément pour ça que le récit est un fichier.

Les deux existent pour être comparés sur les vues. Personne ici ne sait
d'avance lequel tient.

**Le récit par défaut est aussi écrit en dur dans la scène** (`DEFAUT`), pour
qu'ouvrir `portail.html` dans un navigateur montre quelque chose sans rien
passer. Un test tient les deux copies d'accord — deux copies dérivent toujours.

## `portail.html` — le portail d'Artisan Express

L'ouverture d'Aznaroth, mais ce qui sort du portail est le **site d'un artisan**,
et la vidéo se termine sur une promesse de sérieux plutôt que sur un cri. La
capture passée en `--site` est photographiée sur la vraie page de démonstration :
rien n'y est maquetté, c'est le site qu'on vend qui apparaît.

**Il se réutilise tel quel pour n'importe quel prospect** — une capture, une
commande, une vidéo. C'est là qu'est la valeur : pas dans un montage, dans une
fabrique.

## Seize défauts mesurés, et ce qu’ils enseignent

Chacun était invisible dans le code, et évident dès qu'on regardait le rendu au
bon endroit : une planche de vignettes pour l'image, une analyse par bandes pour
le son, le rectangle publié par la scène pour la géométrie. **Mesurer le rendu,
pas l'intention** — et la moitié de ces dix défauts enseigne surtout *où* poser
la mesure : quatre d'entre eux passaient au vert dans tous les contrôles
existants.

**1. L'image zéro était noire.** La comète partait de `[L+240, -280]` avec une
accélération cubique : relevé sur les vignettes, elle n'entrait dans le cadre
qu'à **0,24 s**. Sept images de noir en tête de fil, exactement ce que
l'ouverture devait empêcher. Une accélération n'est pas un retard : si l'objet
doit être vu tout de suite, il **commence** dans le cadre et sa traînée seule
vient du hors-champ.

**2. Le cœur du portail était un œuf blanc de 1,6 s.** Peint plein et opaque, il
occupait le milieu du cadre pendant que plus rien ne s'y passait. Un portail
n'est pas une lampe : c'est un **bord** lumineux autour d'un dedans qu'on
devine. Anneau net, intérieur voilé — et la dalle monte à travers.

**3. La porte ne se refermait qu'à 30 %.** Son anneau restait donc assez large
pour traverser la dalle *et* le texte de fin : un trait blanc en travers de
« ARTISAN EXPRESS ». Une porte qui s'est ouverte se referme sur ce qu'elle a
laissé passer, sinon elle reste un objet à l'écran.

**4. Les anneaux montaient en lumière pendant que l'éclat retombait.** Rayon et
intensité suivaient la même courbe de 0,42 s, et la vignette de **0,45 s** était
presque noire. Ils sont désormais séparés — le rebond du rayon dure
0,42 s, la lumière arrive en 0,16 s. **Ce qui apparaît et ce qui s'allume ne
sont pas la même horloge.**

**5. Le son sifflait et soufflait, et une seule des deux causes venait de la
scène.** Première écoute d'Erwann : « le son est fiii, chut chut chut ». Deux
défauts, pas un.

Le **souffle** tenait à trois sons, tous dans les deux premières secondes —
là où le spectateur décide. Mesurés source par source, part de l'énergie
au-dessus de 2 kHz et part tenue par les vingt raies les plus fortes :

| son | > 2 kHz | tonal | centroïde |
| --- | --- | --- | --- |
| `whoosh_tournant_long` | **65,6 %** | 0,9 % | 2878 Hz |
| `grondement_braises` | **56,9 %** | 2,3 % | 2887 Hz |
| `impact_debris` | **56,8 %** | 39,6 % | 4073 Hz |

Une part tonale de 1 % avec les deux tiers de l'énergie dans l'aigu, c'est la
définition du bruit blanc. Ces trois-là sont descendus de 8 à 10 dB.

Le **sifflement**, lui, était une bavure de la correction du son précédente :
en comblant quatre secondes de creux sous le message, le lit avait été monté de
+11 dB **en bloc**. `drone_grave` et `nappe_sombre` le portent sans percer —
90 % tonal, rien au-dessus de 2 kHz — mais `riser_long`, un balayage de
centroïde 944 Hz, s'est retrouvé à +16 dB sous le texte. **Un lit se monte son
par son, jamais d'un seul geste sur un groupe.** Le lit tient d'ailleurs à
−25 dB sans lui : le riser n'y était pour rien.

`tests/test_scene_portail.py` interdit désormais qu'un son passé au-dessus de
+12 dB ait un centroïde au-dessus de 200 Hz.

**6. La page ne défilait qu'au tiers.** La course était écrite en dur — 1020 px
sur les 3143 disponibles. Elle se déduit maintenant de la capture
(`img.height - visible`), donc n'importe quelle page d'artisan arrive à son
pied, quelle que soit sa longueur. Le montage y gagne un raccord : le pied de
page dit « Site réalisé par Artisan Express » une seconde avant que le carton
ne le dise à son tour.

**7. Les foyers, et pourquoi ils sont mesurés.** `artisan-choc.json` ne fait
plus défiler la page : il la **regarde**, en s'approchant du bouton d'appel,
puis des photos, puis des avis. Les hauteurs ne sont pas estimées à l'œil —
elles sont relevées sur la vraie page avec un navigateur, en pixels de la
capture :

| en-tête | bouton | services | galerie | avis | pied |
| --- | --- | --- | --- | --- | --- |
| 258 | **620** | 1661 | **2446** | **3588** | 4542 |

Le foyer agrandit la **dalle**, il ne grossit pas l'image dedans : la fenêtre
de page montrée reste la même, seule la caméra avance. Grossir à l'intérieur
d'une dalle fixe donnerait une capture zoomée, pas un mouvement.

**8. La zone sûre avait deux dimensions et les tests n'en tenaient qu'une.**
« 300 € — 200 € POUR LES PREMIERS » sortait des **deux** côtés du cadre et se
lisait « 00 € — 200 € POUR LES PREMIERS ». Le carton était pourtant à sa place
en hauteur, et toute la suite passait au vert.

Deux choses en sont sorties.

**La boîte fait 56 %, pas 66 %.** `motion/` tient une boîte de 22 % à 88 %, mais
son texte n'y est pas centré sur le cadre. Ici il l'est, et une boîte de 66 %
centrée occupe 17 % → 83 % : son bord gauche entre de cinq points dans la bande
des boutons Facebook, qui va de 14 % à 22 %. **Une boîte centrée ne peut pas
dépasser 22 % → 78 %.**

**Le texte passe à la ligne, il ne rétrécit pas sans fin.** Sous 48 px un titre
n'est plus lisible — 1080 de large affichés sur environ 400 points, 48 px n'en
font que 18. La scène coupe donc les lignes trop longues sur les espaces, et ne
réduit la taille que si un **mot seul** dépasse la boîte, jamais sous le
plancher.

**Et un carton qui passe à la ligne devient plus haut.** C'est ainsi que quatre
cartons sur six sont sortis par le HAUT après la correction, alors qu'ils
tenaient avant. Les deux dimensions se tiennent : on ne peut pas régler l'une
sans remesurer l'autre.

```bash
python3 montage-auto/mesurer_textes.py montage-auto/scenes/recits/artisan-choc.json
```

Le mesureur ouvre la scène, appelle `measureText` avec la vraie police, et rend
le cadre occupé et la hauteur réelle de chaque carton. **C'est lui qui fait
foi**, pas le test unitaire : celui-ci borne les lignes *déclarées*, et ne peut
pas savoir qu'une ligne en deviendra trois.

**9. « On n'entend pas ma voix, le dragon couvre » — et le fader n'y pouvait
rien.** Le premier réflexe est de baisser le rush et de monter la voix. Mesuré,
il n'y avait rien à corriger de ce côté : au-dessus de 400 Hz la voix était
**déjà 5 dB plus haut** que le dragon (−18,1 contre −23,8), et `entendu()` le
disait. Baisser le lit n'aurait fait que perdre les deux.

La faute était dans le spectre. Sur la fenêtre de la réplique, par bandes :

| Hz | 20-120 | 120-300 | 300-700 | 700-1k6 | 1k6-3k5 | 3k5-8k |
| --- | --- | --- | --- | --- | --- | --- |
| dragon | **29,3** | 15,2 | 15,2 | 12,5 | **11,7** | 8,1 |
| la voix | 4,1 | 16,6 | 27,4 | 12,8 | 9,5 | 2,2 |

Vingt-cinq décibels au-dessus dans le grave — un grondement de ce niveau
**masque la parole vers le haut**, et aucun niveau moyen ne le voit. Et surtout
2 dB **au-dessus** de la voix entre 1,6 et 3,5 kHz, la bande des consonnes.
D'où « il manque des mots par rapport au sous-titre » : ils étaient prononcés,
ils étaient masqués. **Un déséquilibre voix/lit se lit par bandes avant de se
régler au fader.**

`creuser_pour_la_voix.py` creuse donc la forme de la voix **dans** le lit,
pendant qu'elle parle et nulle part ailleurs, par transformée à court terme
(Hann 2048, saut 512). Les 0,32 premières secondes ne sont jamais touchées —
l'entrée du dragon y est intacte. Et `cible_db` suit : **creuser retire de
l'énergie, donc la normalisation rendrait le plan plus fort** si on ne la
recalait pas.

**Puis « on n'entend plus du tout le dragon », et les deux premiers réglages
étaient en cause.**

Le premier coupait aussi 11 dB sous 130 Hz, au nom du masquage ascendant.
C'était vrai et c'était trop : **le grave EST le dragon**, et le retirer l'a
fait disparaître pour l'oreille sans que la bande des consonnes s'en porte
mieux — mesuré, la couper à 300 Hz au lieu de 700 fait tout le travail. Le
creux du grave est passé à zéro.

Le second était la **fenêtre plate**. Elle retirait le rush pendant toute la
réplique, silences compris : deux secondes de dragon retiré pour 1,26 s de
parole utile. `--suivre` construit l'enveloppe depuis la prise elle-même,
énergie relevée **au-dessus de 300 Hz** — en large bande, le grondement du rush
déclencherait le creux et celui-ci se creuserait lui-même — attaque 0,10 s,
retour 0,40 s.

| | fenêtre plate | suivie |
| --- | --- | --- |
| le dragon entre les syllabes | −7,9 dB | **−7,0** (le rush nu vaut −7,1) |
| le dragon sur toute la fenêtre | −19,2 dB | **−11,9** |
| la voix au-dessus, 700-1k6 | +10,1 dB | **+14,7** |
| la voix au-dessus, 1k6-3k5 | +7,8 dB | **+12,4** |

Sept décibels de dragon rendus **et** quatre décibels de voix gagnés. Un creux
fixe ne pouvait donner ni l'un ni l'autre : il fallait le faire respirer.

**Et vérifier chez qui écoute.** Le fichier réexporté depuis son téléphone
portait une courbe « loudness » d'éditeur — +3 dB dans le grave, −8 dB dans le
bas-médium, 4 LUFS plus bas en tout — qui vidait le dragon de son corps à elle
seule. Un master livré prêt à publier évite ce détour ; un master qu'on
réexporte le subit.

**10. Une vraie prise plafonne là où la synthèse ne plafonnait pas.** Le gain
d'une réplique se borne à la marge réelle sous 0 dBFS — règle juste, écrite
contre une cible que le limiteur reprendrait. Mais la prise d'Erwann a **17,6 dB
de facteur de crête** (−24,5 entendu, −6,9 de crête) là où une voix de diffusion
en a 10 à 12 : deux ou trois attaques tenaient toute la phrase 8 dB sous sa
cible, et demander −13 ou −10 ne changeait strictement rien. C'est le même
symptôme qu'un réglage sans effet, et la cause n'est pas dans la recette.

`ecretage_db` dit de combien on autorise à **dépasser** cette marge, le limiteur
absorbant le reste. Six décibels rendent +2,9 dB de niveau entendu et +3,1 dB
dans la bande des consonnes, **sans toucher au rapport consonnes/voyelles** :
−17,8 avant, −17,8 après. Ce ne sont pas des consonnes écrasées, ce sont des
crêtes rognées — et c'est la mesure qui fait la différence entre les deux.

**11. Un carton qui arrive d'un bloc est correct, et il est mort.** Sur un
format où la rétention se joue à la seconde, un texte qui **s'écrit devant** le
spectateur le retient là où un texte déjà écrit le laisse partir. Les mots
arrivent donc un par un, chacun d'un ressaut d'échelle de 26 %, et tous sont
posés **avant la moitié du carton** — écrire n'est pas lire, et une phrase qui
disparaît au moment où elle finit de s'écrire est pire qu'un carton fixe.

La mise en page reste exactement celle du bloc : la largeur totale est mesurée
d'un coup sur la ligne complète, la position de chaque mot se déduit de la
largeur de ce qui le précède. **Mesurer les mots séparément et les rabouter
donnerait une ligne plus large que la même ligne dessinée d'un trait** — le
crénage et le `letterSpacing` ne s'additionnent pas ainsi — et elle sortirait
de la boîte de 605 px sans que rien ne le signale.

Deux couleurs, et on ne les dépense pas : **vert** `#5fe0a8`, celui des boutons
et du numéro sur la page de l'artisan, donc un mot qui renvoie à ce qu'on voit
à l'écran une seconde plus tard ; **or** `#ffd24a` pour le prix et l'appel à
l'action, rien d'autre. Une couleur qui sert partout ne signale plus rien.

Deux tests tiennent l'ensemble, et ils attrapent des fautes muettes. `PHOTOS`
au lieu de `PHOTOS.` dans la liste des accents ne colore rien, ne lève rien, et
ne se voit qu'en regardant la bonne image ; `300 €` écrit avec une espace
ordinaire fait deux mots dont aucun ne correspond. L'espace **insécable** est
donc la typographie correcte *et* la condition pour que le nombre et son unité
soient un seul mot.

**12. La scène coupe les lignes gloutonnement, et ça se voit dès qu'on les
anime.** Le carton du prix sortait en **cinq** lignes — « POUR LES » puis
« PREMIERS. » seul — et le premier laissait « AS » orphelin au milieu. Invisible
tant que le carton arrivait d'un bloc, flagrant quand on regarde chaque mot se
poser. Les coupures des cartons longs sont donc **écrites à la main**, à 52 px :
533, 416, 400 et 602 px pour une boîte de 605. Le bloc du prix monte de
233 → 574 à 271 → 523.

Et le mesureur affichait les lignes **déclarées**, pas les lignes dessinées : il
marquait « ¶ » sans dire en combien. C'est `verifier_dalle.py`, qui lit la
découpe réelle dans le navigateur, qui a montré les cinq.

**13. Un fichier « refait » par l'utilisateur n'est pas forcément différent.**
La version renvoyée « j'ai coupé ce qu'il fallait » était image pour image
identique à la livraison, décalage nul, durée à deux centièmes près. Le mesurer
avant de repartir de zéro a évité de reconstruire un montage sur une base qu'on
aurait crue nouvelle — et a désigné la seule chose qui avait bougé : le son.

**14. Deux plans tirés de la même scène ne se raccordent pas si on décale un
récit.** L'ouverture devait être un plan à part : la fiche qui se construit,
puis le montage actuel à partir de quatre secondes. Un récit recopié avec des
bornes décalées donnait 13 % d'écart de zoom au raccord — la caméra de la scène
avance en continu, par un terme en `seg(t, T.lecture, T.fin)`, et deux récits
aux bornes différentes ne sont pas à la même seconde de ce mouvement.

`rendre_scene.py --depart` rend la scène **à partir d'un instant négatif** au
lieu de recopier un récit décalé. La construction occupe les deux secondes qui
précèdent zéro, le reste du film n'a pas bougé d'un instant, et **il n'y a plus
de raccord du tout** — un seul plan de 16,10 s. La vidéo vaut « scène + 2,00 »,
exactement comme quand elle ouvrait sur un rush de dragon : aucun instant de
voix ni d'effet n'a été retouché.

**15. Une page qui se construit se capture, elle ne s'anime pas.**
`capturer_page.py` rend la page d'artisan à chaque étape de son montage, et la
scène en choisit une selon l'instant. Ce qui rend les captures enchaînables
tient en un mot : **`visibility: hidden`, jamais `display: none`.** Un bloc
retiré du flux change la hauteur de la page, donc tout ce qui suit remonte, donc
les captures ne sont plus superposables — le montage montrerait une page qui se
réarrange, pas une page qui se construit. Le script refuse de rendre une étape
qui change la hauteur.

La dalle **grandit** pendant la construction, de 785 à 900 px : la fenêtre vaut
`imgW × haut / large`, donc un cadre plus haut montre plus de page **au même
grandissement**. Ce n'est pas un zoom, c'est un téléphone plus long — l'image
dedans ne change pas d'échelle et rien du défilement n'est à recalculer. Quatre
blocs tiennent à 900 là où trois tiennent à 785, et le bas reste à 71,4 % du
cadre.

**Ce qu'il faut savoir accepter :** la fenêtre montre 1 605 px de page, et les
photos de chantier commencent à 1 934. Elles ne peuvent donc pas apparaître
pendant la construction sans faire défiler la page — puis la faire remonter,
ce qui est un rembobinage. Elles arrivent une seconde et demie plus tard, dans
le défilement, où elles ont toujours été.

**16. Le claquement n'est pas un ornement.** Un bloc qui paraît sans lui est un
diaporama : l'œil voit que quelque chose a changé, il ne sent pas que ça vient
d'arriver. Onze centièmes d'éclaircissement suffisent ; au-delà on voit le flash
lui-même. C'est le seul endroit du fichier où un effet existe pour ce qu'il fait
ressentir et non pour ce qu'il montre.

## La zone sûre est câblée

`ZONE = { haut: 230, bas: 865 }`, soit 12 % à 45 % de 1920 — l'intersection des
trois plateformes, jamais la plus permissive (`CLAUDE.md §2`). Aucun texte de
`portail.html` n'en sort. Le site, lui, a le droit de descendre plus bas : il
est le décor, pas le message.

## Et le texte ne passe pas sur le site

Ce n'était vrai d'aucune des deux mesures. Le carton du prix fait quatre lignes
là où les autres en font une : il descendait à 574 px pendant que la dalle
commençait à 470, et « ARTISAN EXPRESS » se posait en travers du téléphone.
La zone sûre était respectée, la boîte de 56 % aussi, et le mesureur de textes
ne connaît que le texte.

```bash
python3 montage-auto/verifier_dalle.py montage-auto/scenes/recits/artisan-choc.json \
    --site /chemin/vers/site.png
```

La scène publie le rectangle qu'elle vient de dessiner dans `window.__DALLE__`,
et le vérificateur le relit **image par image**. Il le faut : la dalle bouge
(elle monte à l'émergence, elle se range de `finale.descente` avant le carton
du prix) et les cartons se succèdent — l'écart entre les deux ne se calcule pas
une fois.

Le chercher dans l'image rendue ne marche pas : le liseré de la dalle est cyan
et les rais du portail aussi. Un détecteur de pixels l'a relevée à 558 là où
elle était à 608.

**Trois réglages tiennent cette règle**, et le premier est le seul qui permette
les deux autres :

- la dalle se met à l'échelle **en gardant son rapport `haut / large`**. La
  fenêtre de page montrée vaut `imgW × haut / large` : rapport conservé, elle
  ne dépend pas du zoom, et le défilement comme les cartons qui s'y accrochent
  restent valables au dixième. Rapport changé, tout est à refaire ;
- `finale.descente` sépare le RECUL du DÉPLACEMENT, qui étaient le même
  réglage. Sans lui, ranger la dalle obligeait à l'effacer ;
- `finale.avance` dit de combien de secondes le mouvement précède le message.
  À zéro, la dalle descend pendant que le carton apparaît — mesuré, une demie
  seconde de texte lisible posée sur le site.

**Le bandeau, lui, a disparu du récit « choc ».** Il servait à séparer un
carton de la page qui défilait dessous ; la page n'est plus dessous. Il
descendait jusqu'à 980 px et voilait le haut du site à 85 % — « rien ne cache
le site » était vrai du texte et faux du décor. Et comme chaque carton dessinait
le sien à son tour, celui de la signature repassait sur le carton déjà peint :
« ÉCRIS SITE EN COMMENTAIRE » sortait gris derrière « ARTISAN EXPRESS ».

Ce qu'il faisait, chaque glyphe le fait maintenant pour lui-même : une ombre
floue de `taille × 0,55` sous un contour net de `taille × 0,22`. Le halo suit
le texte au lieu de le contenir, donc il s'arrête où le texte s'arrête. Mesuré
sur le plan le plus clair du film — la lueur du portail à 5,0 s : glyphe à 200,
anneau immédiat à 65 sur 255. Le contraste du bandeau, sans le bandeau.
