# La jauge d'usage sur Windows — le jumeau de `ligne-etat.sh`, aux mêmes règles.
#
# Pourquoi un second fichier plutôt qu'un seul portable : la version bash
# demande `jq` et `date -d`, dont aucun n'existe sur un Windows nu. PowerShell,
# lui, est sur toutes les machines depuis Windows 7 — c'est la seule chose
# qu'on puisse supposer présente sans rien installer.
#
# Les quatre décisions de la version bash valent ici mot pour mot :
#   1. Les DEUX fenêtres, pas une. Celle de 5 h se vide vite ; celle de 7 jours
#      décide de la fin de semaine, et c'est elle qui surprend.
#   2. Court avant d'être précis : cinq blocs, un pourcentage entier, et
#      l'heure de reprise seulement quand la fenêtre est déjà bien entamée.
#   3. L'absence n'est pas zéro. `rate_limits` n'arrive qu'après la première
#      réponse du modèle, et seulement sur un abonnement Pro ou Max. Afficher
#      « 0 % » serait une information fausse, pas une information manquante.
#   4. La lecture est déposée en passant : Claude Code ne transmet ces chiffres
#      qu'ici, et `/jauge` les relit dans ce fichier.
#
# Ce fichier est enregistré en UTF-8 AVEC BOM, exprès : sans lui, Windows
# PowerShell 5.1 lit les blocs ▓ et ░ en Latin-1 et affiche du charabia.

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$entree = [Console]::In.ReadToEnd()
try { $d = $entree | ConvertFrom-Json } catch { $d = $null }

# Cinq blocs : au-delà, la ligne déborde.
function Barre($pourcent) {
  $pleins = [Math]::Floor(([int]$pourcent + 10) / 20)
  if ($pleins -gt 5) { $pleins = 5 }
  if ($pleins -lt 0) { $pleins = 0 }
  ('▓' * $pleins) + ('░' * (5 - $pleins))
}

function Jauge($nom, $fenetre) {
  $f = $d.rate_limits.$fenetre
  if ($null -eq $f -or $null -eq $f.used_percentage) { return $null }
  # Tronqué et non arrondi, comme la version bash : sinon 49,6 %
  # afficherait deux blocs sur Linux et trois sur Windows.
  $p = [int][Math]::Floor([double]$f.used_percentage)
  $texte = "$nom $(Barre $p) $p %"
  # L'heure de reprise n'intéresse que si la jauge est déjà bien entamée.
  if ($p -ge 50 -and $f.resets_at) {
    $h = [DateTimeOffset]::FromUnixTimeSeconds([long]$f.resets_at).ToLocalTime()
    $texte += " ↻" + $h.ToString('HH\hmm')
  }
  $texte
}

$morceaux = @()
if ($d.model.display_name) { $morceaux += $d.model.display_name }
foreach ($p in @(@('5 h', 'five_hour'), @('7 j', 'seven_day'))) {
  $j = Jauge $p[0] $p[1]
  if ($j) { $morceaux += $j }
}
# Rien d'autre que le modèle : la jauge n'est pas encore connue.
if ($morceaux.Count -eq 1) { $morceaux += 'jauge en attente' }

$morceaux -join ' · '

# Le dépôt pour `/jauge`, silencieux en cas d'échec : une ligne d'état qui se
# plaindrait d'un disque plein remplacerait la jauge par une erreur, à chaque
# rafraîchissement.
if ($d.rate_limits.five_hour.used_percentage -ne $null) {
  $sortie = Join-Path $env:TEMP 'claude-jauge.json'
  try {
    [pscustomobject]@{
      rate_limits = $d.rate_limits
      model       = $d.model.display_name
      releve      = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    } | ConvertTo-Json -Depth 6 -Compress | Set-Content -Path $sortie -Encoding UTF8
  } catch {}
}
