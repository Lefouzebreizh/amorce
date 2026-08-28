/**
 * Vérification de bout en bout du studio, dans un vrai navigateur.
 *
 * Les tests unitaires couvrent le calcul de la timeline et la notation, mais
 * l'essentiel du studio ne peut pas être vérifié hors d'un navigateur : décodage
 * vidéo, mixage Web Audio, tracé sur canvas, enregistrement du fichier. Ce
 * script pilote donc l'application pour de vrai et contrôle le résultat sur les
 * pixels et sur le signal sonore, pas sur la présence d'éléments dans le DOM.
 *
 * Prérequis : `npm run fixtures` puis `npm run dev` dans un autre terminal.
 * Usage : npm run verify
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUSHES = join(ROOT, '.fixtures', 'rushes');
const SHOTS = join(ROOT, '.fixtures', 'captures');
const URL_BASE = process.env.AMORCE_URL || 'http://localhost:3000';

/** Durée attendue du montage express sur les rushes de test, en secondes. */
const EXPECTED_DURATION = 7.5;

if (!existsSync(join(RUSHES, 'rush1.webm'))) {
  console.error('Rushes absents. Lance d’abord : npm run fixtures');
  process.exit(1);
}
mkdirSync(SHOTS, { recursive: true });

/**
 * Deux profils, une seule passe.
 *
 * Le téléphone n'est pas qu'un écran plus étroit : le pointeur est un doigt et
 * le processeur est lent. Le second est bridé volontairement, sinon la
 * dégradation automatique de qualité ne se déclencherait jamais sur une machine
 * de développement et ne serait donc jamais éprouvée.
 */
const PROFILES = [
  {
    id: 'desktop',
    label: 'Ordinateur',
    context: { viewport: { width: 1600, height: 1000 } },
    throttle: 1,
    mobile: false,
  },
  {
    id: 'mobile',
    label: 'Téléphone',
    context: {
      // 640 px et non 844 : sur un téléphone réel, la barre d'adresse et la
      // barre système amputent la hauteur. Mesurer sur l'écran nominal laissait
      // passer un débordement qui écrasait l'aperçu jusqu'à le faire disparaître.
      viewport: { width: 390, height: 640 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    throttle: 4,
    mobile: true,
  },
];

/**
 * Aller à une étape, quelle que soit la coque.
 *
 * L'ordinateur garde une barre d'étapes à cliquer ; le téléphone est passé à
 * une page unique qui défile, où les sept panneaux sont **déjà** dans le
 * document et portent chacun une ancre. Le parcours cliquait la barre sur les
 * deux profils : sur téléphone il attendait trente secondes un bouton qui
 * n'existe plus, et tombait avant d'avoir rien mesuré.
 *
 * Les intitulés sont ceux de `src/lib/steps.ts`, les ancres celles que pose
 * `ancre()` dans `StudioMobile.tsx`. Une étape inconnue lève ici plutôt que de
 * laisser le parcours dériver sur un défilement silencieux.
 */
const ANCRE_ETAPE = {
  Importer: 'import',
  Monter: 'montage',
  Accroche: 'texte',
  Son: 'son',
  Cinéma: 'cinema',
  Analyser: 'analyse',
  Exporter: 'export',
};

/**
 * Remonter en tête de la page téléphone.
 *
 * Le parcours cliquait « Fermer » à trois endroits pour rendre l'écran à
 * l'aperçu. Le tiroir a disparu avec le passage à une page unique qui défile :
 * l'aperçu y est collé en haut, et le geste équivalent est de remonter.
 */
async function remonterEnTete(page) {
  await page.evaluate(() => {
    const defilant = document.querySelector('.overflow-y-auto');
    if (defilant) defilant.scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
}

async function allerAEtape(page, profile, label) {
  if (!profile.mobile) {
    await page.click(`nav[aria-label="Étapes du montage"] button:has-text("${label}")`);
    return;
  }

  const id = ANCRE_ETAPE[label];
  if (!id) throw new Error(`Étape inconnue du parcours : ${label}`);

  const section = page.locator(`#etape-${id}`);
  await section.waitFor({ state: 'attached' });
  await section.scrollIntoViewIfNeeded();
  // Le défilement peut être animé ; on laisse la page se poser avant de mesurer
  // ce qui s'y trouve, sinon le panneau est encore sous l'aperçu collé.
  await page.waitForTimeout(400);
}

const results = [];
let profileLabel = '';
const check = (name, ok, detail = '') => {
  results.push({ name: `[${profileLabel}] ${name}`, ok });
  console.log(`${ok ? '  OK  ' : ' ECHEC'} | ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Compte les secondes de silence total dans un fichier exporté.
 *
 * Renvoie null si ffmpeg n'est pas installé : le parcours doit rester
 * exécutable sans lui, et l'absence de mesure vaut mieux qu'un faux verdict.
 */
function mesurerSilence(fichier) {
  try {
    // Sonder `ffmpeg`, le seul binaire que cette fonction appelle. Gardé sur
    // `ffprobe`, le contrôle s'abstenait là où il pouvait mesurer : plusieurs
    // installations — dont `imageio-ffmpeg` — ne livrent que le premier.
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    return null;
  }

  const pcm = execFileSync(
    'ffmpeg',
    ['-hide_banner', '-v', 'quiet', '-i', fichier, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
    { maxBuffer: 64 * 1024 * 1024 },
  );

  const RATE = 8000;
  const total = Math.floor(pcm.length / 2 / RATE);
  let muettes = 0;

  for (let s = 0; s < total; s++) {
    let carre = 0;
    for (let i = 0; i < RATE; i++) {
      const v = pcm.readInt16LE((s * RATE + i) * 2) / 32768;
      carre += v * v;
    }
    // −60 dB : en dessous, il ne s'agit plus d'un passage discret mais d'un trou.
    if (Math.sqrt(carre / RATE) < 0.001) muettes++;
  }

  return { muettes, total };
}

const browser = await chromium.launch({
  executablePath: process.env.AMORCE_CHROMIUM || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

// `AMORCE_PROFILE=mobile` n'exécute qu'un profil : indispensable pour isoler un
// défaut et savoir s'il vient du profil lui-même ou de l'enchaînement.
const only = process.env.AMORCE_PROFILE;
for (const profile of PROFILES.filter((p) => !only || p.id === only)) {
  profileLabel = profile.label;
  console.log(`\n=== ${profile.label} ===`);
  await runProfile(profile);
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n--- BILAN : ${results.length - failed.length}/${results.length} vérifications passées ---`);
for (const failure of failed) console.log(`  échec : ${failure.name}`);
process.exit(failed.length ? 1 : 0);

async function runProfile(profile) {
const context = await browser.newContext({
  ...profile.context,
  acceptDownloads: true,
});

/**
 * Sonde audio.
 *
 * Tout nœud qui se branche sur la sortie alimente aussi un analyseur. C'est la
 * seule façon de mesurer le son réellement produit sans ajouter de code de
 * débogage dans l'application elle-même.
 */
await context.addInitScript(() => {
  window.__probe = { analysers: [], errors: [] };
  window.addEventListener('error', (e) => window.__probe.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__probe.errors.push(String(e.reason)));

  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    try {
      if (target === this.context.destination) {
        if (!this.context.__tap) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 2048;
          this.context.__tap = analyser;
          window.__probe.analysers.push(analyser);
        }
        connect.call(this, this.context.__tap);
      }
    } catch {
      // La sonde ne doit jamais faire échouer l'application observée.
    }
    return connect.call(this, target, ...rest);
  };
});

const page = await context.newPage();

// Le protocole de débogage sert à deux choses : brider le processeur pour
// simuler un appareil lent, et produire de vrais évènements tactiles.
const client = profile.mobile ? await context.newCDPSession(page) : null;
if (client && profile.throttle > 1) {
  await client.send('Emulation.setCPUThrottlingRate', { rate: profile.throttle });
}

/**
 * Fait glisser un doigt d'un point à un autre.
 *
 * `fill()` écrit la valeur directement dans le champ sans produire le moindre
 * geste : il ne dirait rien d'un curseur devenu impossible à manipuler.
 *
 * Portée réelle, à ne pas surestimer : les évènements injectés ici arrivent
 * directement au moteur de rendu et échappent donc à `touch-action`, que le
 * navigateur applique en amont. Ce contrôle vérifie qu'un curseur réagit bien à
 * une suite touchStart / touchMove / touchEnd, pas qu'aucune règle CSS ne
 * confisque le geste.
 */
async function touchDrag(from, to, steps = 14) {
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let step = 1; step <= steps; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps,
        },
      ],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const consoleErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => consoleErrors.push(String(error)));

try {
  await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 });
} catch {
  console.error(`Serveur injoignable sur ${URL_BASE}. Lance : npm run dev`);
  process.exit(1);
}
/*
 * On attend que l'application soit vivante, pas seulement affichée.
 *
 * Le HTML arrive avant que React n'y branche ses gestionnaires : d'ici là, un
 * dépôt de fichier est purement et simplement perdu. La zone d'import annonce
 * elle-même son état, ce qui donne un point d'attente fiable — et informe
 * l'utilisateur du même coup.
 */
await page.locator('text=Dépose tes vidéos').waitFor({ state: 'visible', timeout: 60000 });
check('L’application devient interactive', true);
check(
  'L’annulation est nommée, pas seulement symbolisée',
  await page.locator('button:has-text("Annuler")').first().isVisible(),
);

// Le guidage doit être présent dès l'arrivée, et dire quoi faire en premier.
const guide = page.locator('[aria-label="Prochaine étape"]');
check('Une consigne est donnée dès l’ouverture', await guide.isVisible());
check(
  'La première consigne est d’importer',
  /Importe tes vid/.test((await guide.textContent()) ?? ''),
  ((await guide.textContent()) ?? '').slice(0, 60).replace(/\s+/g, ' '),
);

if (profile.mobile) {
  // Un débordement horizontal sur téléphone est le défaut de mise en page le
  // plus courant, et le plus visible : la page se met à glisser latéralement.
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }));
  check('Aucun débordement horizontal', overflow.scroll <= overflow.view + 1, `${overflow.scroll} px pour ${overflow.view} px de large`);
  /*
   * Le téléphone n'a plus de barre d'étapes : il porte les sept panneaux sur
   * une seule page qui défile. Ce qu'on contrôle ici, c'est donc qu'ils y
   * soient tous — une page qui en perdrait un rendrait une partie du studio
   * simplement inatteignable au doigt, sans qu'aucun autre test le voie.
   */
  const ancres = await page.locator('[id^="etape-"]').count();
  check('Les sept étapes sont sur la page', ancres === 7, `${ancres} panneaux sur 7`);
}

// --------------------------------------------------------------- 1. Import
const fileInputs = await page.locator('input[type=file][accept*="video/*"]').count();
await page.setInputFiles(
  'input[type=file][accept*="video/*"]',
  [1, 2, 3, 4].map((i) => join(RUSHES, `rush${i}.webm`)),
);
const accepted = await page.evaluate(
  () => document.querySelector('input[type=file][accept*="video/*"]')?.files?.length ?? -1,
);
console.log(`     champs=${fileInputs} fichiers acceptés=${accepted}`);

// Décoder quatre vidéos prend un temps très variable selon l'appareil : on
// attend le résultat plutôt qu'un délai arbitraire, qui serait soit trop court
// sur téléphone bridé, soit inutilement long sur ordinateur.
let assetCount = 0;
try {
  // Scrutation sur intervalle plutôt que sur `requestAnimationFrame` : la
  // boucle de rendu occupe déjà cette file, et sur un appareil bridé la
  // vérification s'y retrouve reléguée derrière chaque image composée.
  await page.waitForFunction(() => document.querySelectorAll('li img').length === 4, undefined, {
    timeout: 90000,
    polling: 500,
  });
  assetCount = 4;
} catch {
  assetCount = await page.locator('li img').count();
  const contexte = await page.evaluate(() => ({
    zone: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
    erreurs: window.__probe.errors.slice(0, 3),
  }));
  console.log(`     état : ${contexte.zone}`);
  if (contexte.erreurs.length) console.log(`     erreurs : ${contexte.erreurs.join(' | ')}`);
}
check('Les quatre rushes sont importés', assetCount === 4, `${assetCount} dans la bibliothèque`);

const thumbnails = await page.evaluate(() =>
  [...document.querySelectorAll('li img')].map((img) => img.src.slice(0, 16)),
);
// Le comptage est explicite : un tableau vide satisferait un simple « every ».
check(
  'Les vignettes sont générées',
  thumbnails.length === 4 && thumbnails.every((src) => src.startsWith('data:image/jpeg')),
  `${thumbnails.length} vignettes`,
);

const meta = (await page.locator('li p.text-\\[11px\\]').first().textContent())?.trim();
check('Les métadonnées sont lues', /\d+×\d+/.test(meta ?? ''), meta);

await page.screenshot({ path: join(SHOTS, `01-import-${profile.id}.png`) });

// -------------------------------------------------------- 2. Montage express
// Le bandeau de guidage propose le même intitulé : on vise explicitement le
// bouton du panneau d'import.
await page.locator('button:has-text("Monter automatiquement (")').click();
await page.waitForTimeout(1500);

const canvasSize = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  return { width: canvas?.width, height: canvas?.height };
});
check(
  'Le canvas garde le rapport vertical 9:16',
  Math.abs(canvasSize.width / canvasSize.height - 9 / 16) < 0.01,
  `${canvasSize.width}×${canvasSize.height}`,
);

// Ancré sur le libellé accessible : il vaut pour les deux dispositions et ne
// casse pas au moindre remaniement de classes.
const scoreLabel = await page.locator('header [role="status"]').getAttribute('aria-label');
const score = Number(scoreLabel?.match(/(\d+)\s+sur\s+100/)?.[1]);
check('Une note de viralité est calculée', score > 0, `note ${score}/100`);
await page.screenshot({ path: join(SHOTS, `02-montage-${profile.id}.png`) });

/*
 * Poser les réglages recommandés, et vérifier que la note bouge.
 *
 * C'est la seule preuve que la chaîne complète fonctionne : le bouton écrit
 * dans le projet, l'analyse relit ce projet, et le chiffre affiché en découle.
 * Un test unitaire vérifierait le calcul, pas le fait que l'appui aboutisse.
 */
{
  const lireNote = async () => {
    const label = await page.locator('header [role="status"]').getAttribute('aria-label');
    return Number(label?.match(/(\d+)\s+sur\s+100/)?.[1]);
  };

  await allerAEtape(page, profile, 'Analyser');
  await page.waitForTimeout(500);
  const avant = await lireNote();

  const poser = page.getByRole('button', { name: /Poser les réglages/ });
  check('Le bouton de réglages recommandés est offert', await poser.isVisible());
  await poser.scrollIntoViewIfNeeded();
  await poser.click();
  await page.waitForTimeout(900);

  const apres = await lireNote();
  check(
    'Poser les réglages recommandés fait monter la note',
    apres > avant,
    `${avant} → ${apres} sur 100`,
  );

  // On rend le montage à son état d'origine : la suite du parcours mesure le
  // résultat du montage express, pas celui du bouton.
  await page.locator('button:has-text("Annuler")').first().click();
  await page.waitForTimeout(600);
}

if (profile.mobile) {
  /*
   * Panneau ouvert : c'est la configuration où la hauteur manque, et donc celle
   * où la mise en page casse. On mesure les rectangles réels plutôt que de se
   * fier à la présence des éléments — un aperçu écrasé à zéro reste bel et bien
   * présent dans le document.
   */
  const layout = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const canvas = rect('canvas');
    const transport = rect('[aria-label="Commandes de lecture"]');
    const timeline = rect('[aria-label="Timeline du montage"]');

    const overlaps = (a, b) =>
      !!a && !!b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

    return {
      canvasHeight: Math.round(canvas?.height ?? 0),
      canvasWidth: Math.round(canvas?.width ?? 0),
      transportOverlapsTimeline: overlaps(transport, timeline),
      canvasOverlapsTransport: overlaps(canvas, transport),
      bottom: Math.round(Math.max(canvas?.bottom ?? 0, transport?.bottom ?? 0)),
      viewportHeight: window.innerHeight,
    };
  });

  check(
    'L’aperçu garde une hauteur exploitable panneau ouvert',
    layout.canvasHeight >= 80,
    `${layout.canvasWidth}×${layout.canvasHeight} px affichés sur ${layout.viewportHeight} px de haut`,
  );
  check(
    'Aucun élément n’en recouvre un autre panneau ouvert',
    !layout.transportOverlapsTimeline && !layout.canvasOverlapsTransport,
  );

  await page.screenshot({ path: join(SHOTS, `02c-panneau-ouvert-${profile.id}.png`) });
}

// Sur téléphone, il n'y a plus de panneau à refermer : la coque est une page
// unique qui défile, et l'aperçu y est collé en haut. On remonte donc en tête
// pour le juger en pleine hauteur, là où l'ancien parcours cliquait « Fermer »
// — un bouton de tiroir disparu avec le tiroir.
if (profile.mobile) {
  await remonterEnTete(page);
  await page.screenshot({ path: join(SHOTS, `02b-apercu-${profile.id}.png`) });
}

check(
  'Le montage express a posé une accroche',
  await page.locator('text=Attends la fin').first().isVisible(),
);

// La consigne suit l'état réel du montage : une fois les plans posés, elle ne
// doit plus parler d'import.
const guideAfter = (await page.locator('[aria-label="Prochaine étape"]').textContent()) ?? '';
check(
  'La consigne s’adapte à l’avancement',
  !/Importe tes vid/.test(guideAfter) && guideAfter.length > 20,
  guideAfter.slice(0, 70).replace(/\s+/g, ' '),
);

if (profile.mobile) {
  // Sélectionner un plan depuis la timeline ouvre l'étape qui sait le régler.
  await page.locator('[aria-label="Timeline du montage"] [draggable], [aria-label="Timeline du montage"] div[title]').first().click();
  await page.waitForTimeout(800);

  // Les jauges sont rangées derrière un bloc repliable : les gestes qui
  // produisent un résultat prévisible passent devant, elles restent pour qui
  // veut affiner. Il faut donc l'ouvrir avant de pouvoir en manipuler une.
  const fineTuning = page.locator('summary:has-text("Réglage fin")');
  check('Les jauges sont rangées en réglage fin', await fineTuning.isVisible());
  await fineTuning.click();
  await page.waitForTimeout(400);

  const slider = page.locator('input[aria-label="Point de fin"]');
  await slider.scrollIntoViewIfNeeded();

  /**
   * Abscisse du bouton de la jauge.
   *
   * Seul le bouton règle la valeur : partir d'un point quelconque de la barre
   * ne produirait plus rien, et le test échouerait pour la bonne raison.
   */
  const thumbX = async () => {
    const box = await slider.boundingBox();
    const [value, min, max] = await slider.evaluate((el) => [+el.value, +el.min, +el.max]);
    const ratio = max === min ? 0 : (value - min) / (max - min);
    return { x: box.x + ratio * box.width, y: box.y + box.height / 2, box };
  };

  const depart = await thumbX();
  const before = Number(await slider.inputValue());

  await touchDrag(depart, { x: depart.box.x + depart.box.width * 0.95, y: depart.y });
  await page.waitForTimeout(500);
  const after = Number(await slider.inputValue());

  check(
    'Un curseur se règle réellement au doigt',
    after > before,
    `point de fin porté de ${before.toFixed(2)} s à ${after.toFixed(2)} s`,
  );

  /*
   * Le glissement horizontal amorcé sur la barre, loin du bouton.
   *
   * Un panneau de réglages n'est qu'une pile de jauges : un pouce qui effleure
   * en traversant en faisait bouger une, sans qu'on sache laquelle ni de
   * combien. La barre affiche la valeur, elle ne la commande pas.
   */
  const apresReglage = await thumbX();
  const avantEffleurement = Number(await slider.inputValue());
  // Un point de la barre franchement à l'écart du bouton, du côté où il y a
  // de la place.
  const loin =
    apresReglage.x - apresReglage.box.x > apresReglage.box.width / 2
      ? apresReglage.box.x + apresReglage.box.width * 0.08
      : apresReglage.box.x + apresReglage.box.width * 0.92;

  await touchDrag({ x: loin, y: apresReglage.y }, { x: loin + 60, y: apresReglage.y });
  await page.waitForTimeout(500);

  check(
    'Effleurer la barre ne règle rien, seul le bouton commande',
    Number(await slider.inputValue()) === avantEffleurement,
    `valeur inchangée à ${avantEffleurement.toFixed(2)}`,
  );

  /*
   * Le balayage vertical amorcé sur une jauge.
   *
   * C'est le geste qu'on fait cent fois pour parcourir un panneau, et il ne
   * doit rien dérégler au passage — une vitesse passée à 3,20× sans que
   * personne ne l'ait voulu est un montage abîmé sans qu'on sache pourquoi.
   */
  const boxApres = await slider.boundingBox();
  const avantBalayage = Number(await slider.inputValue());

  await touchDrag(
    { x: boxApres.x + boxApres.width * 0.3, y: boxApres.y + boxApres.height / 2 },
    { x: boxApres.x + boxApres.width * 0.3, y: boxApres.y - 220 },
  );
  await page.waitForTimeout(500);

  check(
    'Un balayage vertical ne dérègle pas la jauge qu’il traverse',
    Number(await slider.inputValue()) === avantBalayage,
    `valeur inchangée à ${avantBalayage.toFixed(2)}`,
  );

  // Rendre l'écran à l'aperçu avant la suite des mesures.
  await remonterEnTete(page);
}

/** Mesure la luminosité, le détail et le niveau sonore de l'instant courant. */
const sample = () =>
  page.evaluate(() => {
    const source = document.querySelector('canvas');
    const probe = document.createElement('canvas');
    probe.width = 48;
    probe.height = 85;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);

    const values = [];
    for (let i = 0; i < data.length; i += 4) values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);

    let rms = 0;
    for (const analyser of window.__probe.analysers) {
      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);
      let energy = 0;
      for (const value of buffer) energy += value * value;
      rms = Math.max(rms, Math.sqrt(energy / buffer.length));
    }

    return {
      mean,
      deviation,
      rms,
      state: window.__probe.analysers[0]?.context?.state ?? 'aucun',
      playhead: document.body.innerText.match(/(\d+:\d+\.\d)\s*\//)?.[1],
    };
  });

// ------------------------------------------------- 3. Lecture, image et son
await page.click('canvas'); // Geste utilisateur : débloque le contexte audio.
await page.waitForTimeout(600);

const frames = [];
for (let i = 0; i < 14; i++) {
  frames.push(await sample());
  if (i === 3) await page.screenshot({ path: join(SHOTS, `03-lecture-${profile.id}.png`) });
  await page.waitForTimeout(500);
}

check(
  'L’image n’est pas noire pendant la lecture',
  frames.filter((f) => f.mean > 6).length >= 10,
  `${frames.filter((f) => f.mean > 6).length}/14 images éclairées`,
);
check(
  'L’image contient du détail',
  frames.filter((f) => f.deviation > 8).length >= 10,
  `${frames.filter((f) => f.deviation > 8).length}/14 images texturées`,
);
check(
  'L’image change au fil du temps',
  new Set(frames.map((f) => f.mean.toFixed(1))).size >= 6,
  `${new Set(frames.map((f) => f.mean.toFixed(1))).size} niveaux distincts`,
);

const peak = Math.max(...frames.map((f) => f.rms));
check('Du son sort du mixage', peak > 0.001, `niveau crête ${peak.toFixed(4)} (contexte ${frames[0].state})`);
check(
  'La tête de lecture avance',
  frames.some((f) => f.playhead && f.playhead !== frames[0].playhead),
  `${frames[0].playhead} → ${frames.at(-1).playhead}`,
);

// La largeur du canvas révèle le palier réellement appliqué : à définition de
// sortie constante, elle vaut 1080 fois l'échelle en vigueur.
const previewWidth = await page.evaluate(() => document.querySelector('canvas').width);
if (profile.mobile) {
  check(
    'La qualité s’adapte à un appareil lent',
    previewWidth < 1080,
    `aperçu rendu en ${previewWidth} px de large au lieu de 1080`,
  );
} else {
  check('L’aperçu suit un palier de qualité valide', previewWidth <= 1080 && previewWidth >= 360, `${previewWidth} px`);
}

// ------------------------------------------------------------ 4. Étalonnage
/** Écart moyen entre canaux : proche de zéro, l'image est désaturée. */
const chroma = () =>
  page.evaluate(() => {
    const source = document.querySelector('canvas');
    const probe = document.createElement('canvas');
    probe.width = 40;
    probe.height = 71;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);

    let spread = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      spread += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      count++;
    }
    return spread / count;
  });

await allerAEtape(page, profile, 'Cinéma');
// La mesure se fait à pleine intensité : au dosage par défaut, une part de la
// couleur subsiste volontairement et le contrôle n'aurait rien prouvé.
await page.locator('input[aria-label="Intensité du rendu"]').fill('1');
await page.click('button:has-text("Naturel")');
await page.waitForTimeout(700);
const chromaNaturel = await chroma();

await page.click('button:has-text("Noir et blanc")');
await page.waitForTimeout(700);
const chromaNoir = await chroma();
await page.screenshot({ path: join(SHOTS, `04-cinema-${profile.id}.png`) });

check(
  'L’étalonnage agit sur l’image',
  chromaNoir < 4 && chromaNaturel > chromaNoir,
  `chroma ${chromaNaturel.toFixed(1)} en naturel → ${chromaNoir.toFixed(1)} en noir et blanc`,
);

await page.click('button:has-text("Cinéma")');
await page.locator('input[aria-label="Intensité du rendu"]').fill('0.7');
await page.waitForTimeout(400);

// Un choix explicite doit primer sur la surveillance automatique, y compris
// sur l'appareil bridé qui vient tout juste de dégrader la qualité.
//
// On n'épingle pas la pleine définition sur le profil téléphone : elle est si
// lourde sous processeur bridé que la boucle de rendu accapare le fil principal
// et que l'interface ne répond plus. C'est précisément ce que l'application
// signale désormais à l'utilisateur avant qu'il ne fasse ce choix.
const pinned = { label: 'Maximale', width: 1080 };

/*
 * L'observateur est installé AVANT le clic, et échantillonne à chaque image
 * depuis la page.
 *
 * Sur l'appareil bridé, la boucle de rendu sature le fil principal : une
 * commande envoyée depuis l'extérieur n'y est exécutée que plusieurs secondes
 * plus tard, quand l'état transitoire qu'on cherche à observer a déjà disparu.
 * `textContent` plutôt que `innerText` : le premier ne force pas de calcul de
 * mise en page, et l'échantillonnage doit rester bon marché.
 */
await page.evaluate(() => {
  window.__trace = { widths: [], gaps: [], warned: false };
  let previous = performance.now();
  const sample = () => {
    const now = performance.now();
    window.__trace.gaps.push(now - previous);
    previous = now;

    const canvas = document.querySelector('canvas');
    if (canvas) window.__trace.widths.push(canvas.width);
    if (document.body.textContent.includes('risque de saccader')) window.__trace.warned = true;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});

await page.click(`button:has-text("${pinned.label}")`);
await page.waitForTimeout(profile.mobile ? 12000 : 3000);

const trace = await page.evaluate(() => {
  const sorted = [...window.__trace.gaps].sort((a, b) => a - b);
  return {
    sequence: window.__trace.widths.filter((w, i, all) => i === 0 || all[i - 1] !== w),
    warned: window.__trace.warned,
    medianGap: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
  };
});

check(
  'Un palier choisi à la main écrase la surveillance',
  trace.sequence.includes(pinned.width),
  `largeurs traversées : ${trace.sequence.join(' → ')} px`,
);

if (profile.mobile) {
  check('Un palier lourd au doigt est signalé', trace.warned);

  /*
   * Le contrat du filet de sécurité est conditionnel, et le test doit l'être
   * aussi : il ne doit reprendre la main que si le palier choisi rend
   * effectivement l'interface impraticable. Exiger un sauvetage inconditionnel
   * reviendrait à exiger que l'application reste lente.
   *
   * On mesure donc la cadence réellement obtenue, et on vérifie l'une ou
   * l'autre moitié du contrat selon ce qu'elle vaut.
   */
  const FROZEN_MS = 120;
  const pinnedAt = trace.sequence.indexOf(pinned.width);
  const droppedAfter = pinnedAt >= 0 && trace.sequence.slice(pinnedAt + 1).some((w) => w < pinned.width);

  if (trace.medianGap > FROZEN_MS) {
    check(
      'Un palier qui fige l’interface est abandonné tout seul',
      droppedAfter,
      `${trace.medianGap} ms par image → retombé à ${trace.sequence.at(-1)} px`,
    );
    check(
      'La reprise en main est expliquée à l’utilisateur',
      await page.locator('text=Ton montage est intact').isVisible(),
    );
  } else {
    check(
      'Un palier tenable n’est pas abandonné à tort',
      !droppedAfter,
      `${trace.medianGap} ms par image, aucun sauvetage nécessaire`,
    );
  }
} else {
  // Sur une machine qui suit la cadence, le choix explicite doit tenir.
  check(
    'Un palier tenable n’est jamais abandonné',
    trace.sequence.at(-1) === pinned.width,
    `${trace.sequence.at(-1)} px`,
  );
  await page.click('button:has-text("Automatique")');
  await page.waitForTimeout(400);
}

// ------------------------------------ 3bis. Rétablir un plan à sa longueur
if (profile.mobile) {
  // La timeline n'est conservée que pour l'étape de montage quand un panneau
  // occupe la moitié basse : il faut donc y passer avant de pouvoir désigner un
  // plan.
  await allerAEtape(page, profile, 'Monter');
  await page.waitForTimeout(700);
  await page.locator('[aria-label="Timeline du montage"] div[title]').first().click();
  await page.waitForTimeout(800);

  /*
   * Rien ne doit condamner un plan à la longueur que le montage express lui a
   * donnée : sur un rush qui porte une voix, ce raccourci coupe la phrase, et
   * tous les autres gestes disponibles ne font que raccourcir davantage.
   */
  const restore = page.locator('button:has-text("Tout le plan")');
  const avant = Number(await page.locator('input[aria-label="Point de fin"]').inputValue().catch(() => 0));

  if ((await restore.count()) > 0) {
    await restore.first().click();
    await page.waitForTimeout(600);

    await page.locator('summary:has-text("Réglage fin")').click();
    await page.waitForTimeout(300);
    const apres = Number(await page.locator('input[aria-label="Point de fin"]').inputValue());
    const max = Number(await page.locator('input[aria-label="Point de fin"]').getAttribute('max'));

    // La jauge avance par pas de 0,05 s : la valeur atteinte ne peut pas coller
    // au maximum à mieux qu'un pas près.
    check(
      'Un plan peut être rétabli à toute sa longueur',
      Math.abs(apres - max) <= 0.06 && apres > avant,
      `point de fin porté à ${apres.toFixed(2)} s pour un rush de ${max.toFixed(2)} s`,
    );

    // On défait pour rendre au montage sa forme d'origine : les mesures qui
    // suivent portent sur le résultat du montage express, pas sur ce plan
    // rallongé.
    await page.locator('button:has-text("Annuler")').first().click();
    await page.waitForTimeout(500);
  } else {
    check('Un plan peut être rétabli à toute sa longueur', false, 'bouton absent');
  }

  await remonterEnTete(page);
}

// ------------------------------------- 4ter. La frise suit la tête de lecture
if (profile.mobile) {
  /*
   * Sur un écran de téléphone, la frise ne montre que six secondes à la fois.
   * Passé ce point, la tête de lecture sort du cadre — et l'on ne sait plus où
   * l'on est dans son propre montage : impossible de tomber sur le plan qui
   * porte un texte pour le modifier.
   *
   * Ce contrôle a été écrit après un rapport terrain que rien n'attrapait :
   * les tests unitaires ne voient ni le défilement, ni la mise en page, et le
   * défaut n'apparaît qu'au-delà d'un montage d'une dizaine de secondes.
   *
   * On vérifie les deux chemins séparément — ils sont distincts dans le code —
   * et à l'arrêt d'abord : c'est celui qui ne suivait pas du tout.
   */
  const cadre = async () =>
    page.evaluate(() => {
      const c = document.querySelector('[aria-label="Timeline du montage"]');
      if (!c) return null;
      const t = c.querySelector('.bg-accent.w-px');
      const x = t ? parseFloat(t.style.left) : null;
      return {
        deborde: c.scrollWidth > c.clientWidth + 8,
        vue: x !== null && x >= c.scrollLeft - 2 && x <= c.scrollLeft + c.clientWidth + 2,
      };
    });

  const depart = await cadre();
  if (depart?.deborde) {
    const duree = Number(
      await page.locator('input[aria-label="Position dans le montage"]').getAttribute('max'),
    );
    const poser = (t) =>
      page.evaluate((v) => {
        const i = document.querySelector('input[aria-label="Position dans le montage"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String(v));
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }, t);

    let perdue = 0;
    const positions = [0.08, 0.92, 0.45, 0.99, 0.02, 0.7].map((f) => duree * f);
    for (const t of positions) {
      await poser(t);
      await page.waitForTimeout(450);
      const e = await cadre();
      if (!e?.vue) perdue += 1;
    }
    check(
      'La frise suit le curseur déplacé à l’arrêt',
      perdue === 0,
      `${positions.length - perdue}/${positions.length} positions gardent la tête de lecture en vue`,
    );

    await poser(0);
    await page.waitForTimeout(400);
    await page.locator('[aria-label="Commandes de lecture"] button').first().click();
    let perdueEnLecture = 0;
    const releves = 8;
    for (let i = 0; i < releves; i += 1) {
      await page.waitForTimeout(500);
      const e = await cadre();
      if (!e?.vue) perdueEnLecture += 1;
    }
    await page.locator('[aria-label="Commandes de lecture"] button').first().click();
    await page.waitForTimeout(300);
    check(
      'La frise suit la tête de lecture pendant la lecture',
      perdueEnLecture === 0,
      `${releves - perdueEnLecture}/${releves} relevés gardent la tête de lecture en vue`,
    );
  } else {
    // Un montage qui tient entièrement dans la largeur ne peut rien démontrer.
    check('La frise suit le curseur déplacé à l’arrêt', true, 'frise plus courte que l’écran');
  }

  await remonterEnTete(page);
}

// ------------------------------------- 4bis. Manipulation directe du texte
if (profile.mobile) {
  /*
   * Un texte dessiné dans un canvas n'est pas un élément du document : rien ne
   * garantit qu'il réponde au doigt sinon la table des rectangles remplie à
   * chaque image. On vise donc la position réelle de l'accroche à l'écran.
   */
  // L'accroche ne couvre que le début du montage : la lecture s'étant arrêtée
  // à la fin, il n'y aurait aucun texte à l'écran à cet instant.
  await page.locator('input[aria-label="Position dans le montage"]').fill('1');
  await page.waitForTimeout(600);

  const canvasBox = await page.locator('canvas').boundingBox();
  const captionY = canvasBox.y + canvasBox.height * 0.28;
  const centerX = canvasBox.x + canvasBox.width / 2;

  await page.mouse.click(centerX, captionY);
  await page.waitForTimeout(700);

  check(
    'Toucher un texte dans l’aperçu le sélectionne',
    await page.locator('text=Texte sélectionné').isVisible(),
  );

  const before = Number(await page.locator('input[aria-label="Position verticale"]').inputValue());

  /*
   * Le cadre est remesuré : sélectionner le texte ouvre le panneau de réglage,
   * qui prend la moitié basse de l'écran et réduit l'aperçu d'autant. Viser
   * avec les coordonnées d'avant reviendrait à pointer à côté.
   */
  const boxSelection = await page.locator('canvas').boundingBox();
  const centerXSel = boxSelection.x + boxSelection.width / 2;

  // Glissement vers le bas : le sous-titre doit suivre le doigt.
  await touchDrag(
    { x: centerXSel, y: boxSelection.y + boxSelection.height * before },
    { x: centerXSel, y: boxSelection.y + boxSelection.height * 0.6 },
  );
  await page.waitForTimeout(600);
  const after = Number(await page.locator('input[aria-label="Position verticale"]').inputValue());

  check(
    'Faire glisser un texte le déplace',
    after > before + 0.1,
    `hauteur passée de ${before.toFixed(2)} à ${after.toFixed(2)}`,
  );

  // La couleur fait partie des réglages accessibles une fois le texte touché.
  await page.locator('button[aria-label="Couleur Jaune"]').click();
  await page.waitForTimeout(400);
  check(
    'Une couleur peut être appliquée au texte sélectionné',
    (await page.locator('button[aria-label="Couleur Jaune"]').getAttribute('aria-pressed')) === 'true',
  );

  // On remet la hauteur d'origine pour ne pas fausser les mesures d'image.
  await page.locator('input[aria-label="Position verticale"]').fill(String(before));
  await page.waitForTimeout(300);
}

// ------------------------------------------------------- 5. Table de mixage
await allerAEtape(page, profile, 'Son');
await page.waitForTimeout(600);

// Chaque source doit avoir son propre réglage : c'est ce qui permet de faire
// ressortir un bruitage sans toucher au son des plans un par un.
for (const source of ['Son des vidéos', 'Bruitages', 'Musique']) {
  check(`La source « ${source} » a son propre réglage`, await page.locator(`input[aria-label="${source}"]`).count() === 1);
}

const clipsFader = page.locator('input[aria-label="Son des vidéos"]');
await clipsFader.scrollIntoViewIfNeeded();
await clipsFader.fill('0.2');
await page.waitForTimeout(400);
check(
  'Baisser une source n’affecte pas les autres',
  (await page.locator('input[aria-label="Bruitages"]').inputValue()) === '1',
  `son des vidéos à ${await clipsFader.inputValue()}, bruitages inchangés`,
);
await clipsFader.fill('0.75');
await page.waitForTimeout(300);

// ---------------------------------------------------------------- 6. Export
await allerAEtape(page, profile, 'Exporter');
await page.waitForTimeout(400);

if (profile.mobile) {
  // Un téléphone doit pouvoir alléger sa sortie : l'enregistrement se faisant
  // en direct, la pleine définition lui coûte des images perdues.
  await page.click('button:has-text("720")');
  await page.waitForTimeout(600);
}
const expected = profile.mobile ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };

const format = (await page.locator('dt:text-is("Format") + dd').textContent())?.trim();
check('Un format d’export est disponible', !/non pris en charge/.test(format ?? ''), format);

const downloading = page.waitForEvent('download', { timeout: 90000 });
await page.locator('button:has-text("⬇ Exporter la vidéo")').click();
await page.waitForTimeout(2500);
await page.screenshot({ path: join(SHOTS, `05-export-${profile.id}.png`) });

let exportPath = null;
try {
  const download = await downloading;
  exportPath = join(SHOTS, `${profile.id}-${download.suggestedFilename()}`);
  await download.saveAs(exportPath);
  check('Un fichier est téléchargé', true, download.suggestedFilename());
} catch (error) {
  check('Un fichier est téléchargé', false, String(error).slice(0, 120));
}

if (!profile.mobile) {
  // La bande-son seule : le mixage est déjà fait dans le graphe audio, seule la
  // piste vidéo n'est pas jointe au flux enregistré.
  await page.click('button:has-text("Son seul")');
  await page.waitForTimeout(500);

  const audioDownload = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('button:has-text("⬇ Exporter la bande-son")').click();
  try {
    const download = await audioDownload;
    const audioPath = join(SHOTS, `${profile.id}-${download.suggestedFilename()}`);
    await download.saveAs(audioPath);
    const size = readFileSync(audioPath).length;
    check(
      'La bande-son s’exporte seule',
      /\.(m4a|webm|ogg)$/.test(download.suggestedFilename()) && size > 2000,
      `${download.suggestedFilename()} — ${(size / 1024).toFixed(0)} Ko`,
    );
  } catch (error) {
    check('La bande-son s’exporte seule', false, String(error).slice(0, 100));
  }

  await page.click('button:has-text("Vidéo + son")');
  await page.waitForTimeout(300);
}

const pageErrors = await page.evaluate(() => window.__probe.errors);
check(
  'Aucune erreur JavaScript',
  pageErrors.length === 0 && consoleErrors.length === 0,
  [...pageErrors, ...consoleErrors].slice(0, 2).join(' | '),
);

// ------------------------------------------- 6. Relecture du fichier produit
if (exportPath) {
  const probe = await context.newPage();
  await probe.goto('about:blank');

  // Le fichier est rejoué pour de bon : un conteneur de la bonne taille mais
  // sans image décodable ni piste sonore passerait sinon pour un export réussi.
  const info = await probe.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
    const video = document.createElement('video');
    video.src = url;

    const ready = await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve(true);
      video.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 10000);
    });
    if (!ready) return { ready: false };

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    audioCtx.createMediaElementSource(video).connect(analyser);
    analyser.connect(audioCtx.destination);
    await audioCtx.resume();
    await video.play();

    let rms = 0;
    const buffer = new Float32Array(analyser.fftSize);
    const start = performance.now();
    while (performance.now() - start < 4000 && !video.ended) {
      analyser.getFloatTimeDomainData(buffer);
      let energy = 0;
      for (const value of buffer) energy += value * value;
      rms = Math.max(rms, Math.sqrt(energy / buffer.length));
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    video.pause();
    video.currentTime = Math.min(1.5, video.duration / 2);
    await new Promise((resolve) => {
      video.onseeked = resolve;
      setTimeout(resolve, 5000);
    });

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 57;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;

    return {
      ready: true,
      rms,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      brightness: sum / (data.length / 4),
      bytes: bytes.length,
    };
  }, readFileSync(exportPath).toString('base64'));

  check('Le fichier exporté est lisible', info.ready === true, info.ready ? `${info.duration.toFixed(2)} s` : 'métadonnées illisibles');
  check(
    'L’export sort à la définition demandée',
    info.width === expected.width && info.height === expected.height,
    `${info.width}×${info.height}`,
  );
  /*
   * La capture se faisant en temps réel, l'enregistrement porte un résidu
   * incompressible : le délai entre la demande de lecture et son démarrage
   * effectif, puis la marge laissée en fin pour que la dernière image traverse
   * la chaîne d'encodage. Sur un appareil bridé quatre fois, ces deux temps
   * s'allongent d'autant. Ce qui est vérifié ici, c'est que la durée reste du
   * bon ordre — le défaut qui avait été trouvé donnait vingt secondes pour un
   * montage de sept.
   */
  const slack = profile.mobile ? 2.5 : 1.2;
  check(
    'L’export dure la longueur du montage',
    Math.abs((info.duration ?? 0) - EXPECTED_DURATION) < slack,
    `${info.duration?.toFixed(2)} s pour ${EXPECTED_DURATION} s attendues`,
  );
  check('L’image de l’export n’est pas noire', (info.brightness ?? 0) > 6, `luminosité ${info.brightness?.toFixed(1)}`);
  check('L’export contient une piste sonore', (info.rms ?? 0) > 0.001, `niveau crête ${info.rms?.toFixed(4)}`);

  /*
   * Le son ne doit pas s'arrêter en cours de route.
   *
   * Un niveau crête suffisant ne prouve rien : il est atteint par la première
   * seconde. Le défaut trouvé sur un export réel laissait du son de la première
   * à la cinquième seconde puis le silence numérique absolu jusqu'à la fin —
   * la moitié de la vidéo muette, sans que rien ne le signale, parce que
   * l'image, elle, était là.
   *
   * La cause : les plans n'étaient branchés sur le mixage qu'une fois, à la
   * création du moteur audio. Tout plan né ensuite — un découpage, un import —
   * s'affichait sans son.
   *
   * Le contrôle demande ffmpeg, qui n'est pas garanti sur toutes les machines :
   * son absence est dite, jamais silencieuse.
   */
  const silence = mesurerSilence(exportPath);
  if (silence === null) {
    console.log('  —    | Silence non mesuré (ffmpeg absent)');
  } else {
    check(
      'Le son ne s’interrompt pas en cours de montage',
      silence.muettes <= 1,
      `${silence.muettes} s de silence total sur ${silence.total} s`,
    );
  }

  console.log(`\n  fichier : ${((info.bytes ?? 0) / 1024 / 1024).toFixed(2)} Mo — ${exportPath}`);
  await probe.close();
}

if (consoleErrors.length) {
  console.log('  erreurs console :');
  for (const error of [...new Set(consoleErrors)].slice(0, 5)) console.log(`    ${error.slice(0, 180)}`);
}

await context.close();
}
