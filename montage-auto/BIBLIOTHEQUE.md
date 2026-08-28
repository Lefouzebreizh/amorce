# La bibliothèque d'effets cinématiques

```bash
python3 montage-auto/download_blockbuster_sfx.py --only-cc0 --make-demo
```

Quarante-deux sons, une page de consultation, deux bacs de montage, cinq
recettes et une bande-annonce, en une commande et moins d'une minute. Rien n'est
téléchargé, rien n'est versionné : `sfx_library/` est régénérée à l'identique par
le script, et le dépôt n'en garde que la recette.

## Pourquoi elle est fabriquée et non téléchargée

Trois raisons, et la première est celle qui a coûté quatre jours.

**Une banque « blockbuster » brute ne survit pas à un téléphone.** Un braam
hollywoodien vit presque entièrement sous 400 Hz, et un haut-parleur de
téléphone ne restitue rien en dessous. Mesuré sur soixante-trois plans de ce
dépôt : perte médiane de 8,5 dB, jusqu'à 24 dB sur les pires. Ici, la perte
médiane est de **4,2 dB**, parce que chaque son passe par
`porter_sur_telephone`, qui lui fabrique les harmoniques que l'appareil rend.

**Un son fabriqué est monétisable sans condition.** Aucune attribution, aucune
redevance, aucun risque de voir la licence changer entre le téléchargement et la
publication. `LICENSES.md` le dit pour chaque entrée.

**Un son fabriqué se règle.** Une banque propose ce qu'elle a ; une recette
change de hauteur, de durée et de grain en une ligne.

## Ce que le catalogue porte, et pourquoi

`audio_catalog.json` décrit chaque son par vingt-huit champs. Trois méritent
d'être compris, les autres se lisent seuls.

**`phone_loss_db`** — l'écart entre le son entier et ce qui traverse un
passe-haut à 400 Hz. C'est la colonne qui décide d'un emploi : au-delà de 10 dB,
la moitié du sound design n'atteindra jamais l'auditeur.

**`gain_conseille_db`** — le gain qui amène le son au niveau *entendu* de ses
voisins. Il existe parce que la crête ne dit rien de ce qu'on entend :
normalisés à la même crête, les quarante-deux sons s'étalaient sur **33,2 dB de
niveau entendu**. Posés au même gain par un monteur, seuls les plus aigus
s'entendaient. Le champ n'est pas appliqué au fichier — un WAV normalisé garde
sa marge, et c'est au montage de décider.

**`recipe_layering`** — les couches qui composent le son, pour savoir ce qu'on
peut en retirer.

## Ce que le script ne fait pas, et pourquoi

**Il ne « corrige » pas les neuf sons qui perdent plus de 10 dB.** Sept sont des
drones et des pulsations, deux des booms purs. Leur rôle *est* d'être ressentis
sans être entendus ; les exciter davantage en ferait autre chose, et
l'excitation appliquée deux fois grésille — mesuré, et refusé à l'écoute.

**Il ne confie jamais le lit sonore à un drone.** Voir
`recipes/lit-qui-tient.md` : un drone perd quinze décibels à lui seul, il ne
peut rien porter. Cette règle vient d'une mesure, pas d'un principe — trois
versions de la bande-annonce ont été nécessaires, à 11,0 puis 9,0 puis 5,7 dB
de perte.

**Il ne télécharge rien par défaut.** Freesound n'entre en jeu qu'avec une clé
dans `FREESOUND_API_KEY`, et `--only-cc0` l'écarte tout à fait. L'absence de
clé n'est pas une erreur : c'est le cas courant, et la bibliothèque se suffit.

## Les commandes

| commande | ce qu'elle fait |
| --- | --- |
| `--dry-run` | annonce ce qui serait fait, n'écrit rien |
| `--only-cc0` | ne garde que ce qui est monétisable sans attribution |
| `--make-demo` | assemble en plus une bande-annonce de 30 s |
| `--limit N` | s'arrête après N recettes |
| `--refaire` | régénère même ce qui existe |
| `--sans-apercus` | passe le tracé des spectrogrammes (le poste le plus lent) |

Le script est **idempotent** : deux passages consécutifs ne changent pas un
octet, vérifié par empreinte de l'arborescence entière.

## Ce qui est produit

```
sfx_library/
├── 01_Impacts_and_Booms/{Sub_Bass,Trailer_Hits,Braams}/   12 sons
├── 02_Risers_and_Tension/                                  8 sons
├── 03_Whooshes_and_Transitions/                            8 sons
├── 04_Drones_and_Ambiances/                                7 sons
├── 05_UI_and_App_Buttons/                                  7 sons
├── app_optimized/          MP3 128 kbps + OGG 96 kbps      3,9 Mo
├── previews/               forme d'onde + spectrogramme    42 images
├── recipes/                cinq fiches de montage
├── my_signature_sounds/    les 20 qui passent le mieux     0,0 à 2,6 dB
├── audio_catalog.json      sfx_library.html
├── DaVinci_Resolve_Bins.xml  Premiere_Pro_Bins.xml
└── LICENSES.md
```

Les WAV sont en **48 kHz / 24 bits**. Seize bits suffisaient à l'écoute ; ils ne
suffisent plus dès qu'un monteur baisse un son de vingt décibels puis le
remonte, ce que fait n'importe quel étagement de couches.

`sfx_library.html` s'ouvre depuis le disque, sans serveur ni réseau : elle lit
le JSON voisin, filtre par perte, humeur et intensité, joue les versions
légères et copie un chemin. Elle est délibérément inutile ailleurs que dans le
dossier — une page qui irait chercher ses sons sur un serveur cesserait de
marcher le jour où le serveur s'arrête.
