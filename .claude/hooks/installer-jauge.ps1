# Installe la jauge dans la barre d'état de Claude Code, sur Windows.
#
#   powershell -ExecutionPolicy Bypass -File .\.claude\hooks\installer-jauge.ps1
#
# Trois précautions, chacune pour un échec réel de ce genre d'installation :
#
#   1. **Le fichier est COPIÉ dans ~/.claude**, pas pointé dans le dépôt. Une
#      barre d'état qui vise un clone se tait le jour où le dossier est déplacé,
#      renommé ou supprimé — et elle se tait sans rien dire.
#   2. **`settings.json` est fusionné, jamais réécrit.** Il porte déjà les
#      permissions et les serveurs MCP : l'écraser pour y poser une ligne
#      coûterait toute la configuration. Une sauvegarde datée est déposée avant
#      d'écrire.
#   3. **`-ExecutionPolicy Bypass` est dans la commande enregistrée.** Windows
#      refuse par défaut d'exécuter un `.ps1`, et ce refus-là est silencieux
#      dans une barre d'état : elle reste vide, sans message.

$ErrorActionPreference = 'Stop'
$ici     = Split-Path -Parent $MyInvocation.MyCommand.Path
$source  = Join-Path $ici 'ligne-etat.ps1'
$dossier = Join-Path $HOME '.claude'
$cible   = Join-Path $dossier 'ligne-etat.ps1'
$config  = Join-Path $dossier 'settings.json'

if (-not (Test-Path $source)) { throw "introuvable : $source" }
if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Path $dossier | Out-Null }
Copy-Item $source $cible -Force
Write-Host "  jauge copiée   $cible"

# La configuration existante est relue et complétée. Un fichier absent ou
# illisible donne un objet vide plutôt qu'une erreur : mieux vaut une
# configuration neuve qu'une installation qui s'arrête à mi-chemin.
$cfg = [ordered]@{}
if (Test-Path $config) {
  $sauvegarde = "$config.avant-jauge-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $config $sauvegarde -Force
  Write-Host "  sauvegarde     $sauvegarde"
  try {
    $lu = Get-Content $config -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $lu.PSObject.Properties) { $cfg[$p.Name] = $p.Value }
  } catch { Write-Host "  (illisible, on repart d'une configuration vide)" }
}

$cfg['statusLine'] = [ordered]@{
  type    = 'command'
  command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$cible`""
}
$cfg | ConvertTo-Json -Depth 20 | Set-Content -Path $config -Encoding UTF8
Write-Host "  configuré      $config"

# L'épreuve : on nourrit la jauge d'un relevé fabriqué et on montre sa sortie.
# Sans elle, le premier retour possible est une barre vide au prochain
# démarrage, sans moyen de savoir laquelle des trois étapes a manqué.
$essai = '{"model":{"display_name":"Opus 5"},"rate_limits":{"five_hour":{"used_percentage":38},"seven_day":{"used_percentage":71}}}'
$rendu = $essai | & powershell -NoProfile -ExecutionPolicy Bypass -File $cible
Write-Host ""
if ($rendu -match '%') {
  Write-Host "  Essai : $rendu"
  Write-Host "  C'est bon. Rouvre Claude Code : la ligne est en bas."
} else {
  Write-Host "  L'essai n'a rien rendu. La copie et la configuration sont faites ;"
  Write-Host "  c'est l'exécution du script qui bute. Envoie cette sortie."
}
