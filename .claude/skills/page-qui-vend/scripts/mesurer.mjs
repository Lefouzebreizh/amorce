#!/usr/bin/env node
/**
 * Mesurer si une page **vend**, quand `eprouver.mjs` mesure si elle **s'utilise**.
 *
 * Les deux sont nécessaires et aucune ne remplace l'autre. Une page peut passer
 * l'épreuve du pouce sans faille — rien ne déborde, tout fait 44 px, les
 * contrastes tiennent — et ne rapporter strictement rien, parce que son prix
 * arrive au troisième écran, parce que son bouton pointe sur `#`, ou parce
 * qu'elle pèse trois mégaoctets sur une aire d'autoroute.
 *
 * Ce que ce script cherche, personne ne le trouve à l'œil : on a écrit la page,
 * on connaît le prix, on sait où est le bouton. Le visiteur, lui, arrive sur un
 * écran de 393 px avec deux barres de réseau et six secondes d'attention.
 *
 * Cinq contrôles sont **bloquants** — sans eux la page ne peut pas encaisser —
 * et cinq sont des **observations chiffrées**, à lire et à trancher soi-même.
 *
 * Usage :
 *   node mesurer.mjs --url http://localhost:3000/montage-titan
 *   node mesurer.mjs --url ... --achat "Commander|Acheter|Je commande"
 */

import { chromium } from 'playwright';

// Le terrain de référence du dépôt : Redmi Note 12 Plus, Chrome Android, ~20:9.
const LARGEUR = 393;
const HAUTEUR = 873;

// Ce qu'on appelle un bouton d'achat, faute d'indication contraire.
const ACHAT = 'command|achet|payer|réserv|je veux|souscri|s.inscri';

/*
 * Les procédés que le dépôt s'interdit, en expressions régulières.
 *
 * Ce ne sont pas des maladresses de style : ce sont les quatre familles
 * nommées dans la charte — urgence fabriquée, rareté inventée, culpabilisation,
 * faux témoignage. Le public visé est précisément celui qu'elles blessent le
 * plus, et une seule suffit à perdre la confiance qui porte tout le reste.
 * D'où leur place parmi les bloquants, et non parmi les remarques de goût.
 */
const MANIPULATIONS = [
  [/plus que \d+ (place|jour|heure|exemplaire)/i, 'rareté chiffrée non vérifiable'],
  [/il ne reste que \d+/i, 'rareté chiffrée non vérifiable'],
  [/offre (expire|se termine|valable jusqu)/i, 'urgence fabriquée'],
  [/dernier[es]? (chance|heures?|jours?)/i, 'urgence fabriquée'],
  [/dépêche|dépêchez|vite,? avant/i, 'urgence fabriquée'],
  [/tu (vas|va) le regretter|ne rate pas|tu passes à côté/i, 'culpabilisation'],
  [/(garanti|résultat)s? (à )?100\s*%/i, 'promesse de résultat absolu'],
  [/compte à rebours|countdown/i, 'compte à rebours'],
];

/* Les superlatifs creux. Observation, pas faute : c'est une affaire de voix. */
const SUPERLATIFS = /\b(incroyable|révolutionnaire|magique|ultime|imbattable|inégalé|extraordinaire|jamais vu)\b/gi;

function args() {
  const a = {};
  const liste = process.argv.slice(2);
  for (let i = 0; i < liste.length; i++) {
    if (!liste[i].startsWith('--')) continue;
    const cle = liste[i].replace(/^--/, '');
    const [c, v] = cle.split('=');
    a[c] = v ?? (liste[i + 1] && !liste[i + 1].startsWith('--') ? liste[i + 1] : true);
  }
  return a;
}

/**
 * Tout ce qui se relève d'un seul passage dans la page.
 *
 * Un seul aller-retour vers le navigateur : chaque `evaluate` coûte un
 * franchissement de frontière, et dix contrôles en dix appels rendent le script
 * plus lent que le montage qu'il mesure.
 */
async function relever(page, motifAchat) {
  return page.evaluate(({ motif, hauteur }) => {
    const achat = new RegExp(motif, 'i');
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const cliquables = [...document.querySelectorAll('a[href], button')].filter(visible);
    const boutons = cliquables
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          texte: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          href: el.getAttribute('href'),
          balise: el.tagName.toLowerCase(),
          haut: Math.round(r.top + window.scrollY),
          bas: Math.round(r.bottom + window.scrollY),
        };
      })
      .filter((b) => achat.test(b.texte));

    // Le prix : la première occurrence d'un montant dans l'ordre du document.
    const noeuds = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let prix = null;
    let chiffres = 0;
    let mots = 0;
    const textes = [];
    let n;
    while ((n = noeuds.nextNode())) {
      const t = (n.textContent || '').trim();
      if (!t) continue;
      const parent = n.parentElement;
      if (!parent || !visible(parent)) continue;
      textes.push(t);
      mots += t.split(/\s+/).length;
      chiffres += (t.match(/\d[\d\s.,]*\s*(€|%|h\b|kg|min|s\b|j\b)/g) || []).length;
      if (!prix && /\d[\d\s.,]*\s*€/.test(t)) {
        const r = parent.getBoundingClientRect();
        prix = { texte: t.slice(0, 40), haut: Math.round(r.top + window.scrollY) };
      }
    }

    const titre = document.querySelector('h1');
    const titreRect = titre?.getBoundingClientRect();

    // La longueur de ligne : on mesure des paragraphes réels, pas des `div`.
    const lignes = [...document.querySelectorAll('p, li')]
      .filter(visible)
      .map((el) => {
        const t = (el.textContent || '').trim();
        if (t.length < 40) return null;
        const taille = parseFloat(getComputedStyle(el).fontSize);
        // ~0,5 em par caractère en moyenne pour une graisse de labeur.
        return { caracteres: Math.round(el.getBoundingClientRect().width / (taille * 0.5)), extrait: t.slice(0, 40) };
      })
      .filter(Boolean);

    return {
      hauteurTotale: document.documentElement.scrollHeight,
      boutons,
      prix,
      chiffres,
      mots,
      texte: textes.join(' '),
      titre: titre ? (titre.textContent || '').trim().replace(/\s+/g, ' ') : null,
      titreBas: titreRect ? Math.round(titreRect.bottom + window.scrollY) : null,
      lignes,
      actions: [...new Set(cliquables.map((el) => (el.textContent || '').trim().replace(/\s+/g, ' ')).filter((t) => t.length > 2 && t.length < 40))],
      premierEcran: [...document.querySelectorAll('h1, h2, p, a, button, img, video, svg')]
        .filter(visible)
        .filter((el) => el.getBoundingClientRect().top < hauteur)
        .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60)),
    };
  }, { motif: motifAchat, hauteur: HAUTEUR });
}

/**
 * La plus grande distance à parcourir pour retrouver un bouton d'achat.
 *
 * On avance d'un demi-écran et on cherche le bouton le plus proche, devant ou
 * derrière. Le chiffre qui compte est le **pire** : c'est l'endroit où
 * quelqu'un décide d'acheter et ne trouve pas où. Un bandeau collant ramène
 * cette distance à zéro partout, et c'est précisément à quoi il sert.
 */
function pireDistance(boutons, hauteurTotale, collant) {
  if (collant) return 0;
  if (!boutons.length) return Infinity;
  let pire = 0;
  for (let y = 0; y < hauteurTotale; y += HAUTEUR / 2) {
    const centre = y + HAUTEUR / 2;
    const proche = Math.min(...boutons.map((b) => {
      if (b.bas > y && b.haut < y + HAUTEUR) return 0;
      return Math.min(Math.abs(b.haut - centre), Math.abs(b.bas - centre));
    }));
    pire = Math.max(pire, proche);
  }
  return pire / HAUTEUR;
}

async function main() {
  const a = args();
  const url = a.url || 'http://localhost:3000';
  const motifAchat = typeof a.achat === 'string' ? a.achat : ACHAT;

  const navigateur = await chromium.launch({
    executablePath: process.env.AMORCE_CHROMIUM || '/opt/pw-browsers/chromium',
  });
  const contexte = await navigateur.newContext({
    viewport: { width: LARGEUR, height: HAUTEUR },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await contexte.newPage();

  // Le poids réellement transféré, pas celui des fichiers sur le disque.
  let octets = 0;
  page.on('response', async (r) => {
    const l = r.headers()['content-length'];
    if (l) octets += Number(l);
  });

  const depart = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  const chargement = Date.now() - depart;
  await page.waitForTimeout(1200);

  const r = await relever(page, motifAchat);
  const collant = await page.evaluate(() =>
    [...document.querySelectorAll('a, button')].some((el) => {
      const p = getComputedStyle(el.parentElement || el).position;
      return p === 'fixed' && /command|achet|payer/i.test(el.textContent || '');
    }));

  const morts = r.boutons.filter((b) => b.balise === 'a' && (!b.href || b.href === '#'));
  const manips = MANIPULATIONS
    .map(([motif, quoi]) => ({ quoi, trouve: r.texte.match(motif)?.[0] }))
    .filter((m) => m.trouve);
  const premierAchat = r.boutons.length ? Math.min(...r.boutons.map((b) => b.haut)) : null;
  const prixAvantBouton = r.prix && premierAchat !== null && r.prix.haut <= premierAchat;
  const distance = pireDistance(r.boutons, r.hauteurTotale, collant);

  const ecran = r.premierEcran.join(' ');
  const premier = {
    promesse: r.titreBas !== null && r.titreBas < HAUTEUR,
    prix: r.prix !== null && r.prix.haut < HAUTEUR,
    preuve: /\d/.test(ecran),
    bouton: r.boutons.some((b) => b.haut < HAUTEUR),
  };
  const manquants = Object.entries(premier).filter(([, v]) => !v).map(([k]) => k);

  const trop = r.lignes.filter((l) => l.caracteres > 75);
  const superlatifs = [...new Set(r.texte.match(SUPERLATIFS) || [])];

  console.log(`── La page vend-elle ? · ${LARGEUR} × ${HAUTEUR} · ${url}\n`);
  console.log('  Bloquant\n');

  let fautes = 0;
  const juger = (ok, titre, detail) => {
    console.log(`  ${ok ? '✓' : '✗'} ${titre}${detail ? ` — ${detail}` : ''}`);
    if (!ok) fautes += 1;
  };

  juger(r.boutons.length > 0, 'La page porte au moins un bouton d’achat',
    r.boutons.length ? `${r.boutons.length} trouvé(s)` : 'aucun libellé d’achat reconnu');
  juger(morts.length === 0, 'Chaque bouton d’achat mène quelque part',
    morts.length ? morts.map((b) => `« ${b.texte} » → ${b.href || 'sans href'}`).join(', ') : null);
  juger(prixAvantBouton === true, 'Le prix est dit avant le premier bouton',
    r.prix ? `prix à ${r.prix.haut} px, bouton à ${premierAchat} px` : 'aucun montant en euros trouvé');
  juger(manquants.length === 0, 'Le premier écran porte promesse, prix, preuve et bouton',
    manquants.length ? `manque : ${manquants.join(', ')}` : null);
  juger(distance <= 1, 'Un bouton d’achat est toujours à moins d’un écran',
    collant ? 'bandeau collant : distance nulle partout'
      : distance === Infinity ? 'aucun bouton' : `au pire ${distance.toFixed(2)} écran`);
  juger(manips.length === 0, 'Aucun procédé qui manipule',
    manips.length ? manips.map((m) => `${m.quoi} : « ${m.trouve} »`).join(' · ') : null);

  console.log('\n  À regarder\n');
  console.log(`      Poids transféré : ${(octets / 1024).toFixed(0)} Ko, chargé en ${chargement} ms`);
  console.log(`      Densité de chiffres : ${r.chiffres} valeurs concrètes pour ${r.mots} mots`
    + ` (${((r.chiffres / Math.max(r.mots, 1)) * 1000).toFixed(1)} ‰)`);
  console.log(`      Titre : ${r.titre ? r.titre.split(/\s+/).length + ' mots' : 'aucun h1'}`
    + (r.titre ? ` — « ${r.titre.slice(0, 70)} »` : ''));
  console.log(`      Actions distinctes proposées : ${r.actions.length}`);
  console.log(`      Lignes de plus de 75 caractères : ${trop.length}`
    + (trop.length ? ` (ex. ${trop[0].caracteres} car. — « ${trop[0].extrait}… »)` : ''));
  console.log(`      Superlatifs creux : ${superlatifs.length ? superlatifs.join(', ') : 'aucun'}`);
  console.log(`      Longueur de page : ${(r.hauteurTotale / HAUTEUR).toFixed(1)} écrans`);

  console.log(fautes === 0
    ? '\n  La page peut encaisser. Le reste est une affaire de voix.'
    : `\n  ${fautes} point(s) bloquant(s) : en l’état, la page ne vend pas.`);

  await navigateur.close();
  process.exit(fautes === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
