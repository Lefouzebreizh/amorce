@echo off
setlocal
title Claude Code via OmniRoute
set "OMNIROUTE_PILOT_DIR=%LOCALAPPDATA%\OmniRoutePilot"
if not exist "C:\Program Files\nodejs\node.exe" goto failed
echo Verification des services OmniRoute...
"C:\Program Files\nodejs\node.exe" "%OMNIROUTE_PILOT_DIR%\ensure-pilot.mjs" "%OMNIROUTE_PILOT_DIR%"
if errorlevel 1 goto failed
if not exist "%USERPROFILE%\Documents\OmniRoute-Projets" mkdir "%USERPROFILE%\Documents\OmniRoute-Projets"
if errorlevel 1 goto failed
cd /d "%USERPROFILE%\Documents\OmniRoute-Projets"
if errorlevel 1 goto failed
"C:\Program Files\nodejs\node.exe" "%OMNIROUTE_PILOT_DIR%\claude-via-omniroute.mjs" "%OMNIROUTE_PILOT_DIR%" %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo Le lancement a echoue. Les fichiers de travail ont ete conserves.
pause
exit /b 1
