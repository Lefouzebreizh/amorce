@echo off
setlocal
title Acces au tableau de bord OmniRoute
powershell.exe -NoProfile -Command "$p=Join-Path $env:LOCALAPPDATA 'OmniRoutePilot\.runtime\secrets.json'; $s=Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; if (-not $s.INITIAL_PASSWORD) { exit 1 }; Set-Clipboard -Value $s.INITIAL_PASSWORD"
if errorlevel 1 goto failed
echo Mot de passe du tableau de bord copie dans le presse-papiers.
echo Adresse : http://127.0.0.1:20128
echo Collez-le dans le champ Mot de passe du tableau de bord.
pause
exit /b 0
:failed
echo Impossible de copier le mot de passe local.
pause
exit /b 1
