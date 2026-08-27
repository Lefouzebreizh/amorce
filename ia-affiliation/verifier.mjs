#!/usr/bin/env node
/**
 * Vérificateur — Radar IA
 *
 * La chaîne publie toute seule, tous les deux jours, sans relecture. Ce script
 * est donc le seul endroit où une erreur peut encore être arrêtée : après lui,
 * il n'y a plus personne. C'est ce qui explique sa sévérité et le fait que le
 * workflow l'exécute *avant* de committer.
 *
 *   node verifier.mjs                 données seules — une seconde
 *   node verifier.mjs --navigateur    plus le parcours réel dans Chromium
 *   node verifier.mjs --strict        les avertissements deviennent bloquants
 *
 * Deux niveaux, parce qu'ils ne portent pas le même risque :
 *
 * · **Erreur** = le site est cassé ou le sera à la prochaine publication
 *   (JSON invalide, identifiant en double, fiche inachevée, sitemap périmé).
 *   Le workflow s'arrête et rien n'est poussé.
 * · **Avertissement** = ça marche, mais ça ne rapporte rien — un lien
 *   d'affiliation resté en exemple, un vivier bientôt vide. Bloquer là-dessus
 *   ferait rougir l'intégration continue tous les deux jours, et on cesserait
 *   de la lire. `--strict` sert au contrôle d'avant-lancement, pas au quotidien.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);

const AVEC_NAVIGATEUR = process.argv.includes('--navigateur');
const STRICT = process.argv.includes('--strict');

const CHAMPS = [
  'id', 'nom', 'categorie', 'prix',
  'description_courte', 'description_longue',
  'lien_affiliation', 'date_ajout'
];

const liensExemple = [];
const erreurs = [];
const avertissements = [];
const reussites = [];

const echec = (m) => erreurs.push(m);
const alerte = (m) => avertissements.push(m);
const ok = (m) => reussites.push(m);

/* ── Contrôles sur une fiche, publiée ou en attente ───────────────────────── */

function controlerFiche(fiche, origine, { exigerDate }) {
  const nom = origine + ' → ' + (fiche && fiche.id ? fiche.id : '(sans identifiant)');

  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) {
    echec(nom + " : ce n'est pas un objet.");
    return;
  }

  const requis = exigerDate ? CHAMPS : CHAMPS.filter((c) => c !== 'date_ajout');
  requis.forEach((champ) => {
    const valeur = fiche[champ];
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      echec(nom + ' : champ « ' + champ + ' » absent ou vide.');
    }
  });

  if (typeof fiche.id === 'string' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fiche.id)) {
    // L'identifiant devient une URL du sitemap : un accent ou une majuscule y
    // survit mal au copier-coller et casse l'égalité avec ce que Google indexe.
    echec(nom + " : l'identifiant doit être en minuscules sans accent (ex. « notion-ai »).");
  }

  if (typeof fiche.lien_affiliation === 'string' && !/^https:\/\/\S+$/.test(fiche.lien_affiliation)) {
    echec(nom + ' : le lien d\'affiliation doit commencer par https:// et ne pas contenir d\'espace.');
  }

  if (typeof fiche.description_courte === 'string' && fiche.description_courte.length > 160) {
    // Au-delà, la carte casse sa mise en page et Google tronque l'extrait.
    alerte(nom + ' : description_courte de ' + fiche.description_courte.length + ' caractères (viser 160 au plus).');
  }

  if (typeof fiche.description_longue === 'string') {
    ['### Points forts', '### Points faibles', '### Idéal pour'].forEach((section) => {
      if (!fiche.description_longue.includes(section)) {
        echec(nom + ' : l\'avis n\'a pas de section « ' + section.replace('### ', '') + ' ».');
      }
    });
  }

  if (exigerDate && typeof fiche.date_ajout === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fiche.date_ajout)) {
      echec(nom + ' : date_ajout doit s\'écrire AAAA-MM-JJ.');
    } else if (fiche.date_ajout > new Date().toISOString().slice(0, 10)) {
      // Une date future fait mentir le sitemap, et Google le remarque.
      echec(nom + ' : date_ajout dans le futur (' + fiche.date_ajout + ').');
    }
  }

  const inacheve = Object.values(fiche).some(
    (v) => typeof v === 'string' && v.includes('À COMPLÉTER')
  );
  if (inacheve) {
    if (exigerDate) {
      echec(nom + ' : fiche publiée alors qu\'elle porte encore des « À COMPLÉTER ».');
    } else {
      alerte(nom + ' : fiche inachevée, gardée hors ligne par l\'auto-pilote.');
    }
  }

  // Ces liens-là seront tous en exemple le premier jour et tous remplacés le
  // même après-midi : une ligne par fiche noierait les vrais problèmes sous
  // vingt lignes identiques. On compte, et on le dit une fois.
  if (/exemple-affiliation\.com/.test(String(fiche.lien_affiliation))) {
    liensExemple.push(fiche.id);
  }
}

/* ── Le catalogue publié ──────────────────────────────────────────────────── */

let catalogue = [];
try {
  const brut = fs.readFileSync(path.join(RACINE, 'outils.json'), 'utf8');
  catalogue = JSON.parse(brut);
  if (!Array.isArray(catalogue)) { throw new Error('le fichier ne contient pas un tableau'); }
  if (catalogue.length === 0) { throw new Error('catalogue vide — le site afficherait une page blanche'); }
  ok('outils.json lisible — ' + catalogue.length + ' outil(s)');
} catch (e) {
  echec('outils.json : ' + e.message);
  catalogue = [];
}

catalogue.forEach((fiche) => controlerFiche(fiche, 'outils.json', { exigerDate: true }));

const vusCatalogue = new Set();
catalogue.forEach((fiche) => {
  const id = fiche && fiche.id;
  if (typeof id === 'string') {
    if (vusCatalogue.has(id)) {
      echec('outils.json : identifiant « ' + id + ' » présent deux fois — deux cartes, une seule URL.');
    }
    vusCatalogue.add(id);
  }
});

/* ── Le vivier : ce qui partira tout seul les jours suivants ──────────────── */

let vivier = [];
try {
  const autoPilote = require_(path.join(RACINE, 'auto-pilot.js'));
  vivier = autoPilote.BACKLOG.concat(autoPilote.chargerVivier());
  ok('vivier lisible — ' + vivier.length + ' fiche(s) au total');
} catch (e) {
  echec('vivier illisible : ' + e.message);
}

vivier.forEach((fiche) => controlerFiche(fiche, 'vivier', { exigerDate: false }));

const vusVivier = new Set();
vivier.forEach((fiche) => {
  const id = fiche && fiche.id;
  if (typeof id === 'string') {
    if (vusVivier.has(id)) {
      alerte('vivier : « ' + id + ' » en double (code et dossier) — la seconde sera ignorée.');
    }
    vusVivier.add(id);
  }
});

const enAttente = vivier.filter(
  (f) => f && !vusCatalogue.has(f.id) &&
    !Object.values(f).some((v) => typeof v === 'string' && v.includes('À COMPLÉTER'))
);
const autonomie = enAttente.length * 2;
if (enAttente.length === 0) {
  alerte('Vivier épuisé : le site ne publiera plus rien. node nouvelle-fiche.mjs "Nom" Catégorie');
} else if (enAttente.length <= 3) {
  alerte('Vivier presque vide : ' + enAttente.length + ' fiche(s), soit ' + autonomie + ' jours d\'autonomie.');
} else {
  ok('Autonomie : ' + enAttente.length + ' fiche(s) prêtes, soit ' + autonomie + ' jours de publication');
}

if (liensExemple.length > 0) {
  const total = catalogue.length + vivier.length;
  alerte(liensExemple.length + ' fiche(s) sur ' + total + ' ont encore un lien d\'affiliation d\'exemple' +
    ' — le site ne rapporte rien tant qu\'ils ne sont pas remplacés (' +
    liensExemple.slice(0, 4).join(', ') + (liensExemple.length > 4 ? ', …' : '') + ').');
} else {
  ok('Tous les liens d\'affiliation sont réels');
}

/* ── Le sitemap doit refléter le catalogue, pas une version d'avant ───────── */

const cheminSitemap = path.join(RACINE, 'sitemap.xml');
if (!fs.existsSync(cheminSitemap)) {
  echec('sitemap.xml absent — lancez : node generate-sitemap.js');
} else {
  const avant = fs.readFileSync(cheminSitemap, 'utf8');
  const resultat = spawnSync_(process.execPath, [path.join(RACINE, 'generate-sitemap.js')]);
  const apres = fs.readFileSync(cheminSitemap, 'utf8');
  if (resultat.code !== 0) {
    echec('generate-sitemap.js a échoué : ' + resultat.sortie.trim());
  } else if (avant !== apres) {
    echec('sitemap.xml était périmé — il vient d\'être régénéré, pensez à le committer.');
  } else {
    const urls = (apres.match(/<loc>/g) || []).length;
    ok('sitemap.xml à jour — ' + urls + ' URL(s)');
  }
}

function spawnSync_(commande, args) {
  const { spawnSync } = require_('node:child_process');
  const r = spawnSync(commande, args, { encoding: 'utf8', env: process.env });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

/* ── La page elle-même ────────────────────────────────────────────────────── */

const cheminPage = path.join(RACINE, 'index.html');
if (!fs.existsSync(cheminPage)) {
  echec('index.html absent.');
} else {
  const page = fs.readFileSync(cheminPage, 'utf8');
  if (!/rel="canonical"/.test(page)) {
    echec('index.html n\'a pas de balise canonique — Google ne saura pas quelle URL fait foi.');
  } else if (/radar-ia\.example/.test(page)) {
    alerte('index.html pointe encore vers le domaine de démonstration (radar-ia.example).');
  } else {
    ok('index.html : balise canonique posée sur un vrai domaine');
  }
}

/* ── Le parcours réel, dans un vrai navigateur ────────────────────────────── */

if (AVEC_NAVIGATEUR) {
  await parcoursNavigateur();
} else {
  ok('Parcours navigateur non demandé (--navigateur pour le lancer)');
}

async function parcoursNavigateur() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    alerte('Playwright introuvable : parcours navigateur ignoré. npm install playwright à la racine du dépôt.');
    return;
  }

  const PORT = 4399;
  const serveur = spawn(process.execPath, [path.join(RACINE, 'servir.mjs'), String(PORT)], {
    stdio: 'ignore'
  });
  const base = 'http://127.0.0.1:' + PORT + '/index.html';

  // Le Chromium de ce dépôt n'est pas à la révision qu'attend Playwright ; le
  // chemin explicite est ce qui évite un « playwright install » inutile.
  const chemin = process.env.AMORCE_CHROMIUM ||
    (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

  let nav;
  try {
    await attendre(400);
    nav = await chromium.launch(chemin ? { executablePath: chemin } : {});
    const page = await nav.newPage({ viewport: { width: 390, height: 844 } });

    const bruits = [];
    page.on('pageerror', (e) => bruits.push(String(e)));

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => document.querySelectorAll('#grille article').length > 0,
      null, { timeout: 20000 }
    );

    const cartes = await page.locator('#grille article').count();
    cartes === catalogue.length
      ? ok('navigateur : ' + cartes + ' cartes affichées, autant que le catalogue')
      : echec('navigateur : ' + cartes + ' cartes pour ' + catalogue.length + ' outils.');

    await page.fill('#recherche', 'zzzznimportequoi');
    await page.waitForTimeout(120);
    const videVisible = await page.locator('#vide').evaluate((n) => !n.classList.contains('hidden'));
    videVisible ? ok('navigateur : l\'état vide répond') : echec('navigateur : l\'état vide ne s\'affiche pas.');
    await page.click('#reinitialiser');
    await page.waitForTimeout(120);

    await page.locator('#grille article').first().getByRole('button', { name: 'En savoir plus' }).click();
    await page.waitForTimeout(150);
    const ouverte = await page.locator('#modale').evaluate((n) => !n.classList.contains('hidden'));
    const sections = await page.locator('#modale-corps h3').allTextContents();
    ouverte && sections.length >= 3
      ? ok('navigateur : la modale ouvre un avis structuré (' + sections.join(', ') + ')')
      : echec('navigateur : la modale ne rend pas l\'avis détaillé.');

    // Ce que le sitemap promet à Google doit réellement répondre.
    const premier = catalogue[0] && catalogue[0].id;
    if (premier) {
      await page.goto(base + '?outil=' + encodeURIComponent(premier), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => !document.getElementById('modale').classList.contains('hidden'),
        null, { timeout: 20000 }
      );
      const titre = await page.title();
      titre.startsWith(catalogue[0].nom)
        ? ok('navigateur : une URL du sitemap ouvre bien sa fiche et son titre')
        : echec('navigateur : ?outil=' + premier + ' n\'ouvre pas la bonne fiche (titre : ' + titre + ').');
    }

    // Le CDN Tailwind peut être injoignable ici (mandataire, hors-ligne) : la
    // page n'est alors pas stylée, mais son comportement doit rester intact.
    const reels = bruits.filter((b) => !b.includes('tailwind is not defined'));
    reels.length === 0
      ? ok('navigateur : aucune erreur JavaScript')
      : echec('navigateur : erreur JavaScript — ' + reels.join(' | '));
    if (bruits.length !== reels.length) {
      alerte('CDN Tailwind injoignable depuis cette machine : page non stylée pendant le test, comportement vérifié quand même.');
    }
  } catch (e) {
    echec('navigateur : parcours interrompu — ' + e.message);
  } finally {
    if (nav) { await nav.close(); }
    serveur.kill();
  }
}

function attendre(ms) {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

/* ── Verdict ──────────────────────────────────────────────────────────────── */

console.log('── Vérification de Radar IA');
reussites.forEach((m) => console.log('  ✓ ' + m));
avertissements.forEach((m) => console.log('  ⚠ ' + m));
erreurs.forEach((m) => console.log('  ✗ ' + m));
console.log('');

const bloquants = erreurs.length + (STRICT ? avertissements.length : 0);
if (bloquants === 0) {
  console.log('✓ Bon pour publication — ' + reussites.length + ' contrôle(s) au vert' +
    (avertissements.length ? ', ' + avertissements.length + ' avertissement(s) sans gravité.' : '.'));
  process.exit(0);
}
console.log('✗ ' + erreurs.length + ' erreur(s)' +
  (STRICT && avertissements.length ? ' et ' + avertissements.length + ' avertissement(s) en mode strict' : '') +
  ' — rien ne doit être publié en l\'état.');
process.exit(1);
