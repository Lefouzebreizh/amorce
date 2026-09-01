# Chaîne de montage — de la recette au format court

Une commande, cinq étapes, et l'ordre compte plus que les réglages.

```bash
bash montage-auto/installer.sh          # ffmpeg + numpy + soundfile, et vérifie

python3 montage-auto/pipeline.py \
    montage-auto/references/titans-ep01.json sortie.mp4 \
    --carte "THE NEXT CREATURE" "THE CYBER HYDRA TITAN" "EPISODE 02"
```

## Arborescence

```
montage-auto/
├── pipeline.py            l'enchaînement complet — le seul point d'entrée
├── monter_episode.py      le moteur : plans, effets, titres, étalonnage
├── carte_episode.py       le carton qui annonce l'épisode suivant
├── sous_titres.py         lecture SRT/JSON, tracé mot à mot en ASS
├── mastering_tiktok.py    master aux normes de plateforme (−14 LUFS, −1 dBTP)
├── sfx_pro.py             la sonothèque : lecture, gains conseillés, bacs NLE
├── download_blockbuster_sfx.py   la fabrique de cette sonothèque
├── references/*.json      les recettes — c'est là qu'un épisode se décrit
├── requirements.txt
└── installer.sh
```

Deux masters coexistent, et le choix n'est pas indifférent :

| | cible | quand |
| --- | --- | --- |
| `.claude/skills/master-telephone/` | −12 LUFS, présence 2,2 / 4,2 kHz | haut-parleur de téléphone |
| `montage-auto/mastering_tiktok.py` | −14 LUFS, vrai pic −1,0 dBTP | norme de plateforme, casque |

## L'ordre des cinq étapes

```
montage → carton → boucle → sous-titres → master
```

Chaque inversion a coûté un défaut, et chacun est écrit là où il s'est produit :

- **Le master vient en dernier et une seule fois.** Masteriser avant
  d'assembler masterise deux fois le film ; le limiteur appliqué deux fois se
  met à pomper — un gain qui varie de +1,0 à +6,1 dB selon l'instant, que
  l'oreille rapporte comme une coupure au milieu du son.
- **La boucle vient avant le master**, parce qu'elle fabrique une image de plus
  qui doit passer par la même chaîne que les autres.
- **Le carton se fabrique depuis la dernière image du film**, ce qui lui évite
  le fond noir — et impose que les titres se soient éteints avant cette image,
  faute de quoi ils s'y retrouvent figés derrière le texte du carton.

## Les options

| option | ce qu'elle fait |
| --- | --- |
| `--carte L1 L2 L3` | le carton de fin, jusqu'à trois lignes |
| `--boucle 0.5` | fond la queue dans la tête : le film **raccourcit** de 0,5 s |
| `--sous-titres f.srt` | mot à mot brûlé par libass (`.srt` ou `.json`) |
| `--cadence 60` | ré-interpole le mouvement — lent, à ne demander que si utile |
| `--gain 2` | décibels du master téléphone |

## Titres en `drawtext`, dialogue en ASS

Les deux tracés coexistent parce qu'ils ne servent pas la même chose.

`drawtext` évalue des expressions image par image : c'est ce qui permet le
ressort à l'arrivée, la secousse et la lueur qui bat. Le format ASS ne sait pas
les écrire.

ASS, lui, fait le mot à mot en une passe. En `drawtext` il faudrait trois
passes de rendu **par mot** — plusieurs centaines pour dix secondes de dialogue.

Ne pas mélanger les deux sur un même texte : on obtient deux copies légèrement
décalées.

## Trois pièges qui ont chacun coûté un débogage

1. **`pip install imageio-ffmpeg` fournit un ffmpeg sans `libfreetype` ni
   `libass`.** Il encode parfaitement et ne trace rien, sans message d'erreur —
   le filtre est simplement introuvable. D'où `/usr/bin/ffmpeg` d'abord,
   partout.
2. **`set -o pipefail` inverse `ffmpeg … | grep -q`.** `grep -q` sort au
   premier résultat, ferme le tuyau, ffmpeg meurt en SIGPIPE (141), et
   `pipefail` remonte ce 141 : **trouver** se lit comme échouer. Relever la
   liste dans une variable, grepper ensuite.
3. **Concaténer deux flux AAC en copie fabrique un artefact au raccord**, les
   deux fichiers n'ayant pas le même délai d'amorçage. Mesuré : un vrai pic à
   +9 dBTP sur un mixage qui ne dépassait pas −0,8. La vidéo se concatène en
   copie, l'audio se réassemble en PCM, un seul encodage à la fin.

## Vérifier

```bash
python3 -m unittest discover -s montage-auto/tests
```

Et avant d'envoyer un média, les trois relevés de `CLAUDE.md` § 8, sur le
fichier final : la planche d'images sur toute la durée, le niveau entendu
section par section — **le climax doit être le plus fort** —, et le raccord.
