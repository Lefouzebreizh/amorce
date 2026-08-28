#!/usr/bin/env node
/**
 * Éprouver une interface comme un pouce la rencontre, pas comme un test la lit.
 *
 * Le dépôt écrit ses règles d'affichage depuis longtemps — aucun défilement
 * horizontal en 390 px, quarante-quatre pixels pour tout ce qui se touche, la
 * zone du pouce en bas. Elles étaient écrites, et rien ne les mesurait. En une
 * seule journée, quatre défauts sont passés au travers : une barre d'étapes de
 * 628 px dans un écran de 393, un bouton à deux gestes de distance de l'action
 * la plus utile, une hauteur posée en `max-h` qui ne contraignait rien, et des
 * panneaux qui défilaient sous la barre de lecture.
 *
 * Aucun n'aurait été trouvé par un test unitaire : ils ne voient ni la mise en
 * page, ni la portée du pouce, ni ce qui sort du cadre.
 *
 * **Le contrôle qui manquait vraiment est le troisième.** Compter les
 * débordements et les cibles trop petites est facile ; ce qui coûte cher, c'est
 * une action présente mais *inatteignable*. Elle passe tous les tests — le
 * bouton existe, il est rendu, son libellé est juste — et personne ne la
 * trouve. On mesure donc la **distance en gestes** : combien de touchers
 * séparent l'ouverture de l'écran de chaque action nommée.
 *
 * Usage :
 *   node eprouver.mjs --url http://localhost:3000
 *   node eprouver.mjs --url http://localhost:3000 --fichier rush.webm \
 *                     --actions "Découper,Exporter,Poser les réglages"
 */

import { chromium } from 'playwright';

// Le terrain de référence du dépôt : Redmi Note 12 Plus, Chrome Android, ~20:9.
const LARGEUR = 393;
const HAUTEUR = 873;
const CIBLE_MINI = 44;
const CONTRASTE_MINI = 4.5;

function args() {
  const a = {};
  for (const brut of process.argv.slice(2)) {
    const [c, v] = brut.replace(/^--/, '').split('=');
    a[c] = v ?? true;
  }
  // Accepte aussi la forme « --url valeur ».
  const liste = process.argv.slice(2);
  for (let i = 0; i < liste.length; i++) {
    if (liste[i].startsWith('--') && liste[i + 1] && !liste[i + 1].startsWith('--')) {
      a[liste[i].replace(/^--/, '')] = liste[i + 1];
    }
  }
  return a;
}

function luminance([r, v, b]) {
  const c = (x) => {
    const n = x / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(v) + 0.0722 * c(b);
}

function contraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function couleur(css) {
  const m = css.match(/(\d+(?:\.\d+)?)/g);
  return m ? m.slice(0, 3).map(Number) : null;
}

async function releverLaPage(page) {
  return page.evaluate((mini) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
    };

    // Le débordement se mesure sur **tout** conteneur défilant, pas seulement
    // sur le document : une barre qui déborde à l'intérieur d'un panneau ne
    // fait pas déborder la page, et c'est précisément le cas qui a échappé.
    const debordements = [];
    for (const el of document.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const trop = el.scrollWidth - el.clientWidth;
      if (trop > 2 && el.clientWidth > 100) {
        debordements.push({
          balise: el.tagName.toLowerCase(),
          role: el.getAttribute('aria-label') || el.className?.toString().slice(0, 60) || '',
          visible: el.clientWidth,
          reel: el.scrollWidth,
          trop,
        });
      }
    }

    const petites = [];
    const contrastes = [];
    for (const el of document.querySelectorAll('button,a,[role=button],input,select,summary')) {
      if (!visible(el)) continue;
      // La piste d'un curseur fait quelques pixels de haut ; ce qu'on touche
      // est sa poignée, que le navigateur dimensionne lui-même. La mesurer
      // rendrait un défaut à chaque réglage, et trente faux positifs font
      // abandonner un contrôle plus sûrement qu'aucun contrôle.
      if (el.type === 'range') continue;
      const r = el.getBoundingClientRect();
      const nom = (el.innerText || el.getAttribute('aria-label') || el.type || '').trim().slice(0, 40);
      if (r.width < mini || r.height < mini) {
        petites.push({ nom, l: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    for (const el of document.querySelectorAll('p,span,label,li,h1,h2,h3,button,a')) {
      if (!visible(el)) continue;
      const texte = (el.textContent || '').trim();
      if (!texte || el.children.length) continue;
      const s = getComputedStyle(el);
      // Le fond effectif : on remonte jusqu'au premier ancêtre non transparent.
      let fond = s.backgroundColor;
      let p = el.parentElement;
      while (p && (fond === 'rgba(0, 0, 0, 0)' || fond === 'transparent')) {
        fond = getComputedStyle(p).backgroundColor;
        p = p.parentElement;
      }
      contrastes.push({
        texte: texte.slice(0, 40),
        avant: s.color,
        arriere: fond,
        taille: parseFloat(s.fontSize),
      });
    }

    // La zone du pouce : le tiers haut est hors de portée à une main.
    const hautDeCadre = [];
    for (const el of document.querySelectorAll('button,[role=button]')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight / 3) {
        hautDeCadre.push({
          nom: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          haut: Math.round(r.top),
        });
      }
    }

    return { debordements, petites, contrastes, hautDeCadre };
  }, CIBLE_MINI);
}

/** Combien de touchers séparent l'écran d'arrivée de chaque action nommée. */
async function distanceEnGestes(page, actions, profondeur = 3) {
  const resultats = [];
  for (const cherchee of actions) {
    let trouvee = null;
    // Zéro geste : elle est déjà là.
    if (await page.locator('button', { hasText: cherchee }).first().count()) {
      trouvee = 0;
    } else {
      // Un geste, puis deux : on touche chaque bouton, on regarde, on revient.
      const depart = page.url();
      const boutons = await page.$$eval('button', (bs) =>
        bs.map((b) => (b.innerText || '').trim().replace(/\n/g, ' ')).filter(Boolean));
      for (const b of boutons.slice(0, 14)) {
        try {
          await page.locator('button', { hasText: b }).first().click({ timeout: 1500 });
          await page.waitForTimeout(500);
          if (await page.locator('button', { hasText: cherchee }).first().count()) {
            trouvee = 1;
            break;
          }
        } catch {
          /* un bouton qui refuse le clic n'est pas un chemin */
        }
        if (page.url() !== depart) await page.goto(depart, { waitUntil: 'networkidle' });
      }
    }
    resultats.push({ action: cherchee, gestes: trouvee });
  }
  return resultats;
}

async function main() {
  const a = args();
  const url = a.url || 'http://localhost:3000';
  const actions = (a.actions || '').split(',').map((x) => x.trim()).filter(Boolean);

  const navigateur = await chromium.launch({
    executablePath: process.env.AMORCE_CHROMIUM || '/opt/pw-browsers/chromium',
  });
  const page = await navigateur.newPage({
    viewport: { width: LARGEUR, height: HAUTEUR },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await page.goto(url, { waitUntil: 'networkidle' });

  if (a.fichier) {
    await page.setInputFiles('input[type=file]', a.fichier);
    await page.waitForTimeout(6000);
  }

  const releve = await releverLaPage(page);

  const combats = releve.contrastes
    .map((c) => {
      const av = couleur(c.avant);
      const ar = couleur(c.arriere);
      if (!av || !ar) return null;
      return { ...c, rapport: contraste(av, ar) };
    })
    .filter((c) => c && c.rapport < CONTRASTE_MINI);

  const gestes = actions.length ? await distanceEnGestes(page, actions) : [];

  console.log(`── Épreuve du pouce · ${LARGEUR} × ${HAUTEUR}\n`);

  const dire = (titre, liste, ligne) => {
    if (!liste.length) {
      console.log(`  ✓ ${titre}`);
      return 0;
    }
    console.log(`  ✗ ${titre} — ${liste.length}`);
    for (const x of liste.slice(0, 6)) console.log(`      ${ligne(x)}`);
    if (liste.length > 6) console.log(`      … et ${liste.length - 6} de plus`);
    return liste.length;
  };

  let fautes = 0;
  fautes += dire('Aucun débordement horizontal', releve.debordements,
    (d) => `${d.role || d.balise} : ${d.visible} visibles pour ${d.reel} réels (+${d.trop})`);
  fautes += dire(`Toute cible fait au moins ${CIBLE_MINI} px`, releve.petites,
    (p) => `« ${p.nom} » ${p.l} × ${p.h}`);
  fautes += dire(`Tout texte tient ${CONTRASTE_MINI}:1`, combats,
    (c) => `« ${c.texte} » ${c.rapport.toFixed(2)}:1 (${c.taille} px)`);

  if (gestes.length) {
    const perdues = gestes.filter((g) => g.gestes === null || g.gestes > 1);
    fautes += dire('Chaque action est à un geste au plus', perdues,
      (g) => `« ${g.action} » : ${g.gestes === null ? 'introuvable en deux gestes' : g.gestes + ' gestes'}`);
    for (const g of gestes.filter((x) => x.gestes !== null && x.gestes <= 1)) {
      console.log(`      « ${g.action} » à ${g.gestes} geste${g.gestes > 1 ? 's' : ''}`);
    }
  }

  console.log(`\n  Pour information : ${releve.hautDeCadre.length} bouton(s) dans le tiers haut,`
    + ' hors de portée à une main sans changer de prise.');
  console.log(fautes === 0
    ? '\n  L\'interface tient dans le pouce.'
    : `\n  ${fautes} point(s) à reprendre.`);

  await navigateur.close();
  process.exit(fautes === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
