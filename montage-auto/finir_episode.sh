#!/usr/bin/env bash
# Sous-titre, carton de fin, couches sonores, master — la chaîne qui transforme
# un montage brut en fichier publiable.
#
# Écrit après coup : elle a vécu une nuit entière dans /tmp, où un conteneur
# repris l'aurait effacée avec les quatre décisions que ses commentaires
# portent. Un script qui n'est pas versionné n'existe que jusqu'à la fin de la
# session qui l'a écrit, et l'épisode suivant repart de zéro.
#
#   finir_episode.sh RUSH SORTIE REPERTOIRE
#
# REPERTOIRE porte st.ass, carte.ass, plan_auto.json et sfx_library/.
set -euo pipefail

SRC=${1:?rush monté}; OUT=${2:?fichier de sortie}; DIR=${3:-.}
ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
POL=${POLICES:-$ICI/../.fixtures/polices}
F=$(command -v ffmpeg)
cd "$DIR"

# L'ORDRE : montage → carton → COUCHES → master.
#
# Les couches venaient AVANT l'assemblage, et le rugissement — 3,45 s posé à
# 16,08 s sur un film qui s'arrête à 17,96 — y était tranché net en plein
# milieu. Le spectrogramme le montrait comme une raie verticale pleine bande à
# 17,90 s : une vraie coupure, pas une modulation.
#
# Une couche posée avant l'assemblage ne peut pas traverser le raccord. Elle se
# pose donc sur l'image FINIE, carton compris.
$F -y -v error -i "$SRC" -vf "subtitles=filename='st.ass':fontsdir='$POL'" \
   -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a copy _st.mp4

DV=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 _st.mp4)
$F -y -v error -ss "$(python3 -c "print($DV-0.10)")" -i _st.mp4 -frames:v 1 _last.png
$F -y -v error -loop 1 -t 2.9 -i _last.png -r 24 \
   -vf "eq=brightness=-0.15:saturation=0.78,boxblur=6:1,zoompan=z='min(1.0+0.0011*on,1.08)':d=1:s=1080x1920:fps=24:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',subtitles=filename='carte.ass':fontsdir='$POL',fade=t=out:st=2.5:d=0.4" \
   -pix_fmt yuv420p -c:v libx264 -crf 16 _carte.mkv

$F -y -v error -i _st.mp4 -an -c:v copy _v0.mkv
$F -y -v error -i _carte.mkv -an -c:v copy _v1.mkv

# Le carton arrive en FONDU, pas en coupe. Toutes les autres transitions du
# film sont des coupes franches entre deux plans filmés ; celle-ci passe à une
# image d'une autre nature — figée, floutée, assombrie — et une coupe franche
# vers ce genre d'image se lit comme un saut, pas comme un montage. Mesuré :
# c'était l'écart d'image le plus fort du film.
#
# La durée vient de `_st.mp4` et non de `_v0.mkv` : un MKV remuxé en copie ne
# porte pas toujours `stream=duration`, et ffprobe rend « N/A ».
$F -y -v error -i _v0.mkv -i _v1.mkv -filter_complex \
  "[0][1]xfade=transition=fade:duration=0.25:offset=$(python3 -c "print($DV-0.25)")" \
  -c:v libx264 -crf 16 -pix_fmt yuv420p -an _vt.mkv

$F -y -v error -i _st.mp4 -vn -ac 2 -ar 48000 -c:a pcm_f32le _sf.wav
python3 "$ICI/assembler_fin.py" "$DV"

# Le son du carton se réencode, il ne se recopie pas : concaténer deux flux AAC
# en copie a rendu +9 dBTP, un dépassement que le fichier assemblé porte sans
# qu'aucune mesure faite avant ne puisse le montrer.
$F -y -v error -i _vt.mkv -i _at.wav -c:v copy -c:a aac -b:a 320k -ar 48000 \
   -movflags +faststart _assemble.mp4

python3 "$ICI/couches_audio.py" _assemble.mp4 plan_auto.json _couches.mp4 | tail -1
python3 "$ICI/mastering_tiktok.py" --lufs -14 --grave 1.5 \
   --plancher 32 --plafond 9000 _couches.mp4 "$OUT" | tail -8
