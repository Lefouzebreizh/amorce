#!/usr/bin/env bash
# Installe de quoi faire tourner la chaîne de montage, et vérifie.
#
# Le point qui piège : `pip install imageio-ffmpeg` fournit un binaire ffmpeg
# SANS libfreetype ni libass. Il lit et encode très bien, et il est incapable
# de tracer le moindre texte — sans message d'erreur, le filtre est simplement
# introuvable. D'où le paquet système, et la vérification qui suit.
set -euo pipefail

# Le ffmpeg du SYSTEME d'abord, exactement comme `monter_episode.ffmpeg()`.
# `command -v ffmpeg` seul trouve celui d'imageio quand il est installe, et
# c'est justement celui qui ne sait rien tracer : la verification passait alors
# a cote de la question qu'elle pose.
FF=/usr/bin/ffmpeg
[ -x "$FF" ] || FF=$(command -v ffmpeg || true)

echo "── ffmpeg"
if [ -z "$FF" ] || [ ! -x "$FF" ]; then
  if command -v apt-get >/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg
  elif command -v brew >/dev/null; then
    brew install ffmpeg
  else
    echo "   ffmpeg absent, et ni apt-get ni brew : à installer à la main." >&2
    exit 1
  fi
  FF=$(command -v ffmpeg)
fi
echo "   $FF"

echo "── paquets Python"
python3 -m pip install --quiet -r "$(dirname "$0")/requirements.txt"

echo "── vérification"
manque=0
# Les listes sont relevées UNE fois et grepées ensuite, jamais en tuyau direct.
# Avec `set -o pipefail`, `ffmpeg ... | grep -q` rend 141 quand grep TROUVE :
# grep sort au premier résultat, ferme le tuyau, ffmpeg meurt en SIGPIPE, et
# pipefail remonte ce 141. La réussite se lisait donc comme un échec, et le
# script annonçait un ffmpeg incapable alors qu'il avait tout.
FILTRES=$("$FF" -hide_banner -filters 2>/dev/null || true)
CODEURS=$("$FF" -hide_banner -encoders 2>/dev/null || true)

for filtre in drawtext subtitles alimiter loudnorm; do
  if printf '%s' "$FILTRES" | grep -q " $filtre "; then
    echo "   ✓ $filtre"
  else
    echo "   ✗ $filtre — recompiler ffmpeg avec le support correspondant" >&2
    manque=1
  fi
done
for codeur in libx264 aac; do
  if printf '%s' "$CODEURS" | grep -q " $codeur "; then
    echo "   ✓ $codeur"
  else
    echo "   ✗ $codeur" >&2; manque=1
  fi
done
python3 -c "import numpy, soundfile" && echo "   ✓ numpy, soundfile"

[ "$manque" -eq 0 ] && echo "
Prêt. Rendu d'un projet :

  python3 montage-auto/pipeline.py \\
      montage-auto/references/titans-ep01.json sortie.mp4 \\
      --carte \"THE NEXT CREATURE\" \"THE CYBER HYDRA TITAN\" \"EPISODE 02\"
"
exit "$manque"
