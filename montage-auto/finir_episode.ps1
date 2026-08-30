# Le jumeau Windows de `finir_episode.sh` — même chaîne, mêmes décisions.
#
#   powershell -ExecutionPolicy Bypass -File finir_episode.ps1 RUSH SORTIE REPERTOIRE
#
# REPERTOIRE porte st.ass, carte.ass, plan_auto.json et sfx_library/.
#
# Écrit parce que la version bash demande Git Bash, que Windows n'a pas. Les
# commentaires de la version bash portent les quatre décisions du montage ; ils
# sont recopiés ici plutôt que résumés, parce qu'un jumeau qui perd les raisons
# devient le fichier qu'on modifie sans savoir ce qu'on casse.
#
# Enregistré en UTF-8 AVEC BOM, exprès : sans lui, Windows PowerShell 5.1 lit
# les accents en Latin-1 et affiche du charabia.

param(
  [Parameter(Mandatory=$true)][string]$Rush,
  [Parameter(Mandatory=$true)][string]$Sortie,
  [string]$Repertoire = "."
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$pol = if ($env:POLICES) { $env:POLICES } else { Join-Path $ici '..\.fixtures\polices' }
# Le chemin absolu AVANT le `cd` : sinon la sortie atterrit dans le répertoire
# de travail au lieu de là où l'appelant l'a demandée.
$rushAbs   = (Resolve-Path $Rush).Path
$sortieAbs = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Sortie))

foreach ($b in 'ffmpeg','ffprobe','python') {
  if (-not (Get-Command $b -ErrorAction SilentlyContinue)) {
    throw "$b est introuvable dans le PATH. Ouvre un terminal NEUF : celui-ci a été ouvert avant l'installation et ne voit pas le nouveau PATH."
  }
}
Set-Location $Repertoire

function Ff { & ffmpeg -y -v error @args; if ($LASTEXITCODE -ne 0) { throw "ffmpeg a échoué : $args" } }

# L'ORDRE : montage → carton → COUCHES → master.
#
# Les couches venaient AVANT l'assemblage, et le rugissement — 3,45 s posé à
# 16,08 s sur un film qui s'arrête à 17,96 — y était tranché net en plein
# milieu. Une couche posée avant l'assemblage ne peut pas traverser le raccord :
# elle se pose sur l'image FINIE, carton compris.
Ff -i $rushAbs -vf "subtitles=filename='st.ass':fontsdir='$pol'" `
   -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a copy _st.mp4

$dv = [double](& ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 _st.mp4)
# La culture invariante, sinon une machine en français écrit « 17,96 » et
# ffmpeg lit 17 : la virgule décimale coupe l'argument en deux.
$ci = [Globalization.CultureInfo]::InvariantCulture
Ff -ss ($dv - 0.10).ToString($ci) -i _st.mp4 -frames:v 1 _last.png
Ff -loop 1 -t 2.9 -i _last.png -r 24 `
   -vf "eq=brightness=-0.15:saturation=0.78,boxblur=6:1,zoompan=z='min(1.0+0.0011*on,1.08)':d=1:s=1080x1920:fps=24:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',subtitles=filename='carte.ass':fontsdir='$pol',fade=t=out:st=2.5:d=0.4" `
   -pix_fmt yuv420p -c:v libx264 -crf 16 _carte.mkv

Ff -i _st.mp4 -an -c:v copy _v0.mkv
Ff -i _carte.mkv -an -c:v copy _v1.mkv

# Le carton arrive en FONDU, pas en coupe : il passe à une image d'une autre
# nature — figée, floutée, assombrie — et une coupe franche vers ce genre
# d'image se lit comme un saut. Mesuré : c'était l'écart d'image le plus fort.
#
# La durée vient de `_st.mp4` et non de `_v0.mkv` : un MKV remuxé en copie ne
# porte pas toujours `stream=duration`, et ffprobe rend « N/A ».
Ff -i _v0.mkv -i _v1.mkv -filter_complex `
   ("[0][1]xfade=transition=fade:duration=0.25:offset=" + ($dv - 0.25).ToString($ci)) `
   -c:v libx264 -crf 16 -pix_fmt yuv420p -an _vt.mkv

Ff -i _st.mp4 -vn -ac 2 -ar 48000 -c:a pcm_f32le _sf.wav
& python (Join-Path $ici 'assembler_fin.py') $dv.ToString($ci)
if ($LASTEXITCODE -ne 0) { throw "assembler_fin.py a échoué" }

# Le son du carton se réencode, il ne se recopie pas : concaténer deux flux AAC
# en copie a rendu +9 dBTP, un dépassement que le fichier assemblé porte sans
# qu'aucune mesure faite avant ne puisse le montrer.
Ff -i _vt.mkv -i _at.wav -c:v copy -c:a aac -b:a 320k -ar 48000 `
   -movflags +faststart _assemble.mp4

& python (Join-Path $ici 'couches_audio.py') _assemble.mp4 plan_auto.json _couches.mp4 | Select-Object -Last 1
& python (Join-Path $ici 'mastering_tiktok.py') --lufs -14 --grave 1.5 `
   --plancher 32 --plafond 9000 _couches.mp4 $sortieAbs | Select-Object -Last 8
