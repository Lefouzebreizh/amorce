/**
 * Vérifie qu'une licence achetée débloque réellement l'application.
 *
 * ## Pourquoi ce parcours existe
 *
 * Le module de licence était entièrement écrit et testé — lire une clé, la
 * ranger, interroger le serveur, décider de ce qu'une offre autorise — et
 * **aucun appelant** hors de ses propres tests. `Studio.tsx` passait une
 * constante figée ; il n'existait nulle part de champ où coller une clé ; et la
 * seule capacité payante, la pleine définition, n'était contrôlée nulle part.
 *
 * Tous les tests unitaires passaient. C'est exactement le genre de défaut qu'ils
 * ne peuvent pas voir : chaque pièce était juste, aucune n'était branchée.
 *
 * ## Ce que ce script prouve, et ce qu'il ne prouve pas
 *
 * Il conduit un vrai navigateur sur la vraie application, servie avec une
 * adresse de serveur de licence, et devant un vrai serveur qui répond. Il
 * vérifie qu'avant la clé le 1080 est absent, qu'après la clé il apparaît, et
 * qu'un retrait le referme.
 *
 * Ce qu'il ne prouve pas : que Stripe encaisse et que le Worker déployé range
 * la référence en base. Cela demande un compte Stripe et un déploiement, qui
 * n'appartiennent pas à cette machine. Le serveur ci-dessous répond **comme**
 * le vrai — mêmes routes, même forme de réponse, même en-tête — mais il n'est
 * pas le vrai.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from 'playwright';

const RUSHES = join(process.cwd(), '.fixtures', 'rushes');
if (!existsSync(RUSHES) || readdirSync(RUSHES).length === 0) {
  console.error('Rushes absents. Lance d’abord : npm run fixtures');
  process.exit(1);
}
const fichiers = readdirSync(RUSHES).map((f) => join(RUSHES, f));

const PORT_LICENCE = 4319;
const PORT_APP = 3111;

/** La seule clé que le faux serveur reconnaît. */
const CLE_VALABLE = 'AMO-7Q2M4KXZ-9RTVBNHD';

let bad = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} | ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) bad++;
};

/*
 * Le faux serveur de licence.
 *
 * Il répond exactement comme `licence-serveur/src/index.ts` : une route
 * `/etat`, une clé lue dans l'en-tête `Authorization`, un statut en JSON. Rien
 * d'autre — surtout pas un chemin de secours qui rendrait `pro` par défaut, ce
 * qui ferait passer le contrôle sans rien prouver.
 */
const serveurLicence = createServer((requete, reponse) => {
  reponse.setHeader('Access-Control-Allow-Origin', '*');
  reponse.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (requete.method === 'OPTIONS') {
    reponse.writeHead(204).end();
    return;
  }
  if (!requete.url.startsWith('/etat')) {
    reponse.writeHead(404).end();
    return;
  }
  const entete = requete.headers.authorization ?? '';
  const cle = entete.startsWith('Bearer ') ? entete.slice(7) : '';
  reponse.writeHead(200, { 'Content-Type': 'application/json' });
  reponse.end(JSON.stringify({ statut: cle === CLE_VALABLE ? 'pro' : 'libre' }));
});

await new Promise((ok) => serveurLicence.listen(PORT_LICENCE, ok));
console.log(`\n  serveur de licence sur http://localhost:${PORT_LICENCE}`);

/*
 * L'application est servie à part, avec l'adresse du serveur.
 *
 * `NEXT_PUBLIC_LICENCE_URL` est lue à la construction du bundle : la fixer
 * après le démarrage n'aurait aucun effet, et le studio se comporterait comme
 * si aucun endroit où payer n'existait — donc sans champ de clé, donc en
 * annonçant un faux vert.
 */
const environnement = {
  ...process.env,
  NEXT_PUBLIC_LICENCE_URL: `http://localhost:${PORT_LICENCE}`,
};

/*
 * Une construction de production, et non un second serveur de développement.
 *
 * Deux raisons. La première est pratique : Next refuse un deuxième `next dev`
 * dans le même dossier, et le parcours principal en occupe déjà un. La seconde
 * compte davantage — c'est le paquet de production qui part chez le client, et
 * `NEXT_PUBLIC_LICENCE_URL` y est **gravée à la construction**. La vérifier sur
 * un serveur de développement laisserait passer une adresse absente du bundle
 * livré, c'est-à-dire précisément le défaut qu'on cherche.
 */
/*
 * Le dossier de construction est vidé d'abord.
 *
 * `next dev` et `next build` écrivent tous deux dans `.next`. Servir une
 * construction posée par-dessus les restes d'un serveur de développement rend
 * des morceaux de code en erreur 500 : la page se charge, React n'hydrate
 * jamais, le studio reste sur « Préparation du studio… », et tous les
 * sélecteurs qui suivent expirent l'un après l'autre sans nommer la cause.
 *
 * Ce script est donc exclusif : il ne se lance pas pendant qu'un `npm run dev`
 * tourne, contrairement aux autres parcours qui en ont besoin.
 */
rmSync('.next', { recursive: true, force: true });

console.log('  construction du paquet de production…');
await new Promise((ok, ko) => {
  const build = spawn('npx', ['next', 'build'], { env: environnement, stdio: 'ignore' });
  build.on('exit', (code) => (code === 0 ? ok() : ko(new Error(`next build a rendu ${code}`))));
});

/*
 * Le port doit être libre, et on le vérifie avant de construire.
 *
 * Un `next start` d'un lancement précédent survit à la mort de son `npx` :
 * l'ancien serveur garde le port et sert une construction qu'on vient
 * d'effacer. Le navigateur reçoit alors des morceaux de code en 500, React
 * n'hydrate jamais, et la cause — un processus oublié — n'apparaît nulle part.
 */
let libre = false;
try {
  await fetch(`http://localhost:${PORT_APP}`);
} catch {
  libre = true;
}
if (!libre) {
  console.error(`  Le port ${PORT_APP} est déjà pris. Arrête le serveur qui l’occupe et relance.`);
  serveurLicence.close();
  process.exit(1);
}

/*
 * Lancé dans son propre groupe de processus, pour pouvoir le tuer en entier.
 * `npx` n'est qu'un lanceur : le tuer laisserait `next start` orphelin, et
 * c'est précisément lui qui garde le port.
 */
const app = spawn('npx', ['next', 'start', '--port', String(PORT_APP)], {
  env: environnement,
  stdio: 'ignore',
  detached: true,
});

const arreterApp = () => {
  try {
    process.kill(-app.pid, 'SIGTERM');
  } catch {
    app.kill();
  }
};
process.on('exit', arreterApp);

const base = `http://localhost:${PORT_APP}`;
let pret = false;
for (let essai = 0; essai < 60 && !pret; essai += 1) {
  try {
    const r = await fetch(base);
    pret = r.ok;
  } catch {
    await new Promise((ok) => setTimeout(ok, 2000));
  }
}
if (!pret) {
  console.error(`  L’application n’a pas démarré sur ${base}.`);
  arreterApp();
  serveurLicence.close();
  process.exit(1);
}
console.log(`  application sur ${base}\n`);

const browser = await chromium.launch({ executablePath: process.env.AMORCE_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

/*
 * Les erreurs du navigateur sont relevées, jamais avalées.
 *
 * Une erreur au montage laisse le studio bloqué sur « Préparation du studio… »,
 * et tous les sélecteurs qui suivent expirent l'un après l'autre sans dire
 * pourquoi. Le message, lui, nomme la cause en une ligne.
 */
const erreursPage = [];
page.on('pageerror', (cause) => erreursPage.push(String(cause).slice(0, 200)));
page.on('console', (message) => {
  if (message.type() === 'error') erreursPage.push(message.text().slice(0, 200));
});
page.on('response', (reponse) => {
  if (reponse.status() >= 400) erreursPage.push(`${reponse.status()} sur ${reponse.url()}`);
});

/*
 * Ouvre l'étape d'export et **attend le panneau**, pas seulement un délai.
 *
 * L'attente porte sur un texte propre au panneau. Le premier jet attendait
 * « Récupère le fichier », qui est aussi le sous-titre de l'entrée de la barre
 * latérale : la condition était donc satisfaite sans que le panneau soit
 * ouvert. Mesurer au mauvais endroit rend vert sans rien prouver.
 */
async function allerAExporter() {
  await page.click('button:has-text("Exporter")');
  await page.waitForSelector('text=La définition supérieure', { timeout: 20000 });
}

/** Vrai si la définition 1080 est proposée dans l'étape d'export. */
const propose1080 = () =>
  page.evaluate(() => document.body.innerText.includes('1080 × 1920'));

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  /*
   * Un vrai montage d'abord, et ce n'est pas un décor.
   *
   * L'étape d'export d'un projet vide n'affiche pas le choix de définition : le
   * premier jet de ce script y voyait donc l'absence de « 1080 × 1920 » et la
   * comptait comme une réussite, sur une page qui ne proposait rien du tout.
   * Un contrôle vert sur un écran vide est pire qu'un contrôle absent.
   */
  await page.setInputFiles('input[type=file][accept*="video/*"]', fichiers);
  // On attend les vignettes, pas un délai : décoder quatre rushes prend
  // quelques secondes ici et bien plus sur une machine chargée.
  await page.waitForFunction(
    (n) => document.querySelectorAll('li img').length >= n,
    fichiers.length,
    { timeout: 90000 },
  );
  await page.getByRole('button', { name: /⚡ Monter automatiquement/ }).click();
  await page.waitForTimeout(1200);

  // On passe à l'étape d'export : c'est là que vit la limite, et le bloc de
  // licence avec elle.
  await allerAExporter();

  check(
    'Sans clé, la pleine définition n’est pas proposée',
    !(await propose1080()),
    (await propose1080()) ? '1080 × 1920 visible alors qu’aucune clé n’est posée' : 'offre libre',
  );

  const champ = page.locator('#cle-licence');
  check('Un champ existe pour coller sa clé', (await champ.count()) === 1);

  // Une clé fausse ne doit rien ouvrir : sans ce contrôle, un serveur qui
  // répondrait `pro` à tout passerait pour un succès.
  await champ.fill('AMO-FAUSSE00-CLE00000');
  await page.click('button:has-text("Activer ma licence")');
  await page.waitForTimeout(1200);
  check(
    'Une clé inconnue n’ouvre rien',
    !(await propose1080()),
    'la pleine définition reste fermée',
  );
  check(
    'Le refus est dit à l’utilisateur',
    await page.evaluate(() => document.body.innerText.includes('n’a pas été reconnue')),
  );

  await champ.fill(CLE_VALABLE);
  await page.click('button:has-text("Activer ma licence")');
  await page.waitForTimeout(1500);

  check(
    'La clé payée ouvre la pleine définition',
    await propose1080(),
    await propose1080() ? '1080 × 1920 proposé' : 'toujours fermé',
  );
  check(
    'La licence est annoncée comme reconnue',
    await page.evaluate(() => document.body.innerText.includes('Licence reconnue')),
  );

  /*
   * Le rechargement est le contrôle qui compte le plus.
   *
   * Une licence qui s'ouvre puis se referme au retour ne vaut rien : la
   * personne a payé, et devrait recoller sa clé à chaque ouverture. C'est le
   * genre de défaut qu'on ne voit qu'en revenant, donc jamais pendant qu'on
   * développe.
   */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await allerAExporter();
  await page.waitForTimeout(1200);
  check(
    'La licence tient après un rechargement',
    await propose1080(),
    await propose1080() ? 'toujours ouverte' : 'refermée au retour',
  );

  await page.click('button:has-text("Retirer la clé")');
  await page.waitForTimeout(800);
  check(
    'Retirer la clé referme la pleine définition',
    !(await propose1080()),
    'retour à l’offre libre',
  );
} catch (cause) {
  // Un cliché du moment où ça casse : sans lui, un sélecteur qui ne trouve rien
  // ne dit pas si la page était vide, différente, ou simplement plus lente.
  await page.screenshot({ path: '.fixtures/captures/licence-echec.png', fullPage: true }).catch(() => undefined);
  check('Le parcours va au bout', false, String(cause).slice(0, 160));
  for (const erreur of erreursPage.slice(0, 5)) console.log(`         ↳ ${erreur}`);
} finally {
  await browser.close();
  arreterApp();
  serveurLicence.close();
}

console.log(`\n--- LICENCE : ${bad === 0 ? 'tout passe' : `${bad} échec(s)`} ---\n`);
process.exit(bad === 0 ? 0 : 1);
