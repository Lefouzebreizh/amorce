// Réglages de rendu du projet — ils valent pour toutes les compositions.
//
// Le format n'est pas un choix de style : 1080 × 1920 et 30 images/seconde
// sont les valeurs que le protocole de publication contrôle avant de publier
// (voir `/publier-depuis-capcut`). Un habillage rendu à 24 ou à 60 obligerait
// CapCut à rééchantillonner et se verrait sur les mouvements lents.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind-v4';

Config.overrideWebpackConfig(enableTailwind);

// Le Chrome de Remotion se télécharge depuis `remotion.media`, que le
// mandataire des sessions distantes refuse — un 403 sec au milieu du rendu.
// La parade était écrite dans `CLAUDE.md` §4 et nulle part ailleurs : il
// fallait donc s'en souvenir et retaper la commande à la main, sans quoi
// `npm run build` échouait à chaque session. Elle vit ici désormais.
//
// Le `headless_shell` de Playwright fait le même travail et il est déjà là.
// Bien le `headless_shell` et non le `chromium` complet, qui échoue sans dire
// pourquoi. `MOTION_CHROMIUM` garde la main sur une machine où il est
// ailleurs ; sans rien, on retombe sur le comportement d'origine, où Remotion
// choisit son propre navigateur. Même forme que `iptv` et `annuaire-ia`.
// Le numéro de révision n'est pas écrit en dur : il change à chaque mise à
// jour de Playwright (1194 le 01/09/2026), et une constante l'aurait fait
// périmer en silence — c'est le défaut même que ce bloc corrige. On cherche
// donc le dossier, quel que soit son numéro.
const racinePlaywright = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
const shellPlaywright = existsSync(racinePlaywright)
  ? readdirSync(racinePlaywright)
      .filter((nom) => nom.startsWith('chromium_headless_shell-'))
      .map((nom) => join(racinePlaywright, nom, 'chrome-linux', 'headless_shell'))
      .find(existsSync)
  : undefined;

const navigateur = process.env.MOTION_CHROMIUM ?? shellPlaywright;
if (navigateur) Config.setBrowserExecutable(navigateur);

// H.264 pour que CapCut Android l'ouvre sans conversion.
Config.setCodec('h264');
Config.setVideoImageFormat('jpeg');
