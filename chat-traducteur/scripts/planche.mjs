// Rasterise les cartes SVG et en fabrique une planche à regarder.
//
// Séparé du reste à dessein : c'est le seul morceau du projet qui a besoin
// d'un navigateur, et `habillage/` doit rester éprouvable sans lui.
//
// Le §8 demande de *regarder*, pas seulement de mesurer. Les positions de
// texte sont déjà vérifiées par les tests Python ; ce que seule une image
// montre, c'est un contraste qui ne tient pas, une ligne qui déborde, ou un
// texte qui tomberait sous les boutons de la plateforme. D'où les repères
// de zone sûre, tracés par-dessus.
//
// DÉPENDANCE EMPRUNTÉE, et c'est écrit ici pour que personne ne la découvre en
// panne : `playwright` n'appartient pas à ce projet, il vient du `package.json`
// d'Amorce, à la racine. C'est exactement le « piège du projet niché » que
// décrit /nouveau-projet — un sous-projet qui trouve un paquet chez son voisin
// et marche, jusqu'à ce qu'on l'isole.
//
// Toléré ici parce que ce script est un **outil de regard**, jamais une étape
// de vérification : les 31 tests du projet n'en dépendent pas, et la CI ne le
// lance pas. Le jour où `chat-traducteur/` gagne son propre `package.json`,
// c'est la première ligne à y écrire.
import { chromium } from 'playwright';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dossier = process.argv[2] ?? '.fixtures/cartes';
const sortie = process.argv[3] ?? '.fixtures/planche-cartes.png';
mkdirSync(join(sortie, '..'), { recursive: true });

const svgs = readdirSync(dossier).filter((f) => f.endsWith('.svg')).sort();
if (!svgs.length) { console.error(`Aucun SVG dans ${dossier}`); process.exit(1); }

// Les repères : 12 % et 45 % de la hauteur, l'intersection des zones sûres
// de TikTok, Instagram et Facebook. Tout texte doit vivre entre les deux.
const vignettes = svgs.map((f) => {
  const svg = readFileSync(join(dossier, f), 'utf8');
  return `<figure>
    <div class="cadre">
      ${svg}
      <span class="repere" style="top:12%"></span>
      <span class="repere" style="top:45%"></span>
    </div>
    <figcaption>${f.replace('.svg', '')}</figcaption>
  </figure>`;
}).join('');

const page = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#111;font:14px system-ui;color:#ddd;padding:24px}
  .grille{display:flex;gap:20px;align-items:flex-start}
  figure{margin:0}
  .cadre{position:relative;width:270px;height:480px;overflow:hidden;border-radius:8px}
  .cadre svg{width:270px;height:480px;display:block}
  .repere{position:absolute;left:0;right:0;height:0;border-top:1px dashed #ff3b6b}
  figcaption{margin-top:8px;text-align:center;color:#aaa}
</style><div class="grille">${vignettes}</div>`;

// Le Chromium préinstallé de l'environnement (build 1194) ne correspond pas
// à celui qu'attend la version de Playwright installée ici, qui réclame alors
// « npx playwright install » — impossible, le téléchargement est refusé. On
// désigne donc le binaire directement, comme l'environnement le prévoit.
// Le `chrome` complet plutôt que le `headless_shell` : ce dernier suffirait,
// mais le complet est déjà là et rend le même PNG.
const CHROME = process.env.CHROMIUM_BIN
  ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const navigateur = await chromium.launch({ executablePath: CHROME });
const onglet = await navigateur.newPage({ viewport: { width: 40 + svgs.length * 290, height: 580 } });
await onglet.setContent(page);
await onglet.screenshot({ path: sortie });
await navigateur.close();
console.log(`Planche écrite : ${sortie}  (${svgs.length} cartes, repères à 12 % et 45 %)`);
