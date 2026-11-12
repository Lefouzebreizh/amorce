import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
if (process.platform !== 'win32') { console.error('Ce raccourci est destiné à Windows. Utilise npm run phare:local sur cet ordinateur.'); process.exit(1); }
const app = process.cwd(), launcher = path.join(app, 'scripts', 'phare-local', 'start.mjs');
if (!existsSync(launcher) || !existsSync(path.join(app, '.next', 'BUILD_ID'))) { console.error('Prépare d’abord cette version avec npm run build.'); process.exit(1); }
const q = value => "'" + value.replace(/'/g, "''") + "'";
const script = `$desktop = [Environment]::GetFolderPath('Desktop'); $path = Join-Path $desktop 'Le Phare - Studio local.lnk'; $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($path); $shortcut.TargetPath = ${q(process.execPath)}; $shortcut.Arguments = ${q('"' + launcher + '"')}; $shortcut.WorkingDirectory = ${q(app)}; $shortcut.WindowStyle = 7; $shortcut.Description = 'Le Phare - mes mots, ma voix, mon clip local'; $shortcut.Save(); Write-Output $path`;
const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
console.log(`Raccourci créé : ${result.stdout.trim()}\nUn double-clic ouvre le Studio et sa bibliothèque locale. Aucun abonnement ajouté.`);
