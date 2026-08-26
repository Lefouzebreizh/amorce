#!/usr/bin/env bash
# La jauge d'usage, affichée en permanence plutôt que demandée à `/usage`.
#
# Trois décisions tiennent ce fichier :
#
# 1. **Les deux fenêtres, pas une.** Un abonnement bute sur deux plafonds
#    distincts : celui des cinq heures, qui se vide vite, et celui des sept
#    jours, qui décide vraiment de la fin de semaine. N'afficher que le premier
#    laisse croire qu'on a de la marge la veille du jour où on n'en a plus.
# 2. **Court avant d'être précis.** Cette ligne se lit sur un téléphone tenu à
#    une main. Des barres de cinq blocs, des pourcentages entiers, et l'heure de
#    réinitialisation seulement quand la fenêtre a commencé à se remplir.
# 3. **L'absence n'est pas zéro.** `rate_limits` n'arrive qu'après la première
#    réponse du modèle, et seulement pour un abonnement Pro ou Max. Tant qu'il
#    manque, on affiche ce qu'on a — afficher « 0 % » serait une information
#    fausse, pas une information manquante.

entree=$(cat)

lire() { printf '%s' "$entree" | jq -r "$1 // empty" 2>/dev/null; }

modele=$(lire '.model.display_name')

# Cinq blocs : au-delà, la ligne déborde sur un écran de six pouces.
barre() {
  local pourcent=${1%.*} pleins i sortie=''
  pleins=$(( (pourcent + 10) / 20 ))
  (( pleins > 5 )) && pleins=5
  for ((i = 0; i < 5; i++)); do
    (( i < pleins )) && sortie+='▓' || sortie+='░'
  done
  printf '%s' "$sortie"
}

jauge() {
  local nom=$1 fenetre=$2 pourcent reprise
  pourcent=$(lire ".rate_limits.${fenetre}.used_percentage")
  [[ -z $pourcent ]] && return
  reprise=$(lire ".rate_limits.${fenetre}.resets_at")
  local texte
  texte=$(printf '%s %s %.0f %%' "$nom" "$(barre "$pourcent")" "$pourcent")
  # L'heure de reprise n'intéresse que si la jauge est déjà bien entamée.
  if [[ -n $reprise ]] && (( ${pourcent%.*} >= 50 )); then
    texte+=" ↻$(date -d "@$reprise" '+%Hh%M' 2>/dev/null || echo '')"
  fi
  printf '%s' "$texte"
}

morceaux=()
[[ -n $modele ]] && morceaux+=("$modele")
cinq=$(jauge '5 h' 'five_hour');  [[ -n $cinq ]] && morceaux+=("$cinq")
sept=$(jauge '7 j' 'seven_day');  [[ -n $sept ]] && morceaux+=("$sept")

# Rien d'autre à dire que le modèle : la jauge n'est pas encore connue.
(( ${#morceaux[@]} == 1 )) && morceaux+=('jauge en attente')

# `IFS` ne retient qu'un caractère : le séparateur se pose donc à la main.
ligne=''
for morceau in "${morceaux[@]}"; do
  [[ -n $ligne ]] && ligne+=' · '
  ligne+=$morceau
done
printf '%s\n' "$ligne"
