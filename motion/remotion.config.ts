// Réglages de rendu du projet — ils valent pour toutes les compositions.
//
// Le format n'est pas un choix de style : 1080 × 1920 et 30 images/seconde
// sont les valeurs que le protocole de publication contrôle avant de publier
// (voir `/publier-depuis-capcut`). Un habillage rendu à 24 ou à 60 obligerait
// CapCut à rééchantillonner et se verrait sur les mouvements lents.
import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind-v4';

Config.overrideWebpackConfig(enableTailwind);

// H.264 pour que CapCut Android l'ouvre sans conversion.
Config.setCodec('h264');
Config.setVideoImageFormat('jpeg');
