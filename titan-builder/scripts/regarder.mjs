/*
 * Regarder un site livré avec les règles du dépôt, dans un vrai navigateur.
 *
 * Les tests unitaires savent que le contraste est calculé juste. Ils ne savent
 * pas ce que le navigateur applique : une règle CSS plus spécifique, une police
 * de repli plus petite, un mot trop long qui pousse la page de côté. Ce script
 * mesure la page telle qu'elle s'affiche, sur le terrain de référence.
 *
 *   npm run regarder demo
 *   npm run regarder dossiers/maconnerie-le-goff-2026-08-29
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/* Redmi Note 12 Plus, Chrome Android — le terrain de référence du dépôt. */
const ECRAN = { width: 393, height: 873 };
const CORPS_MINIMUM = 18;
const CIBLE_MINIMUM = 44;
const CONTRASTE_MINIMUM = 4.5;

const dossier = process.argv[2];

if (!dossier) {
  console.error('Usage : npm run regarder <dossier>');
  process.exit(1);
}

const page = resolve(process.cwd(), dossier, 'index.html');

if (!existsSync(page)) {
  console.error(`Pas de page à regarder : ${page}\nLancer d’abord « npm run generer ${dossier} ».`);
  process.exit(1);
}

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const onglet = await navigateur.newPage({ viewport: ECRAN, deviceScaleFactor: 2 });
await onglet.goto(`file://${page}`);

const releve = await onglet.evaluate(({ CORPS_MINIMUM, CIBLE_MINIMUM, CONTRASTE_MINIMUM }) => {
  const lum = (couleur) => {
    const [r, v, b] = couleur.match(/\d+(\.\d+)?/g).slice(0, 3)
      .map((c) => Number(c) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * v + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [clair, sombre] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (clair + 0.05) / (sombre + 0.05);
  };

  /*
   * Le fond réel derrière un texte : `background-color` vaut `transparent` sur
   * la plupart des éléments, et comparer un texte à « transparent » rendrait un
   * contraste rassurant fabriqué de rien. On remonte donc les parents jusqu'au
   * premier fond opaque.
   */
  const fondReel = (element) => {
    for (let n = element; n; n = n.parentElement) {
      const fond = getComputedStyle(n).backgroundColor;
      if (fond && !/rgba\(.*,\s*0\)$/.test(fond) && fond !== 'transparent') return fond;
    }
    return 'rgb(255, 255, 255)';
  };

  const defauts = [];

  for (const element of document.querySelectorAll('body *')) {
    const texte = [...element.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim() !== '')
      .map((n) => n.textContent.trim())
      .join(' ');
    if (texte === '') continue;

    const style = getComputedStyle(element);
    const taille = parseFloat(style.fontSize);
    const contraste = ratio(style.color, fondReel(element));
    const extrait = texte.slice(0, 40);

    /* Le seuil WCAG tombe à 3:1 au-delà de 24 px, ou 18,66 px en gras. */
    const gros = taille >= 24 || (taille >= 18.66 && Number(style.fontWeight) >= 700);
    const seuil = gros ? 3 : CONTRASTE_MINIMUM;

    if (contraste < seuil) {
      defauts.push(`contraste ${contraste.toFixed(2)}:1 (min ${seuil}) — « ${extrait} »`);
    }
    /* Les titres ont le droit d'être plus gros, jamais plus petits. */
    if (taille < CORPS_MINIMUM) {
      defauts.push(`texte à ${taille} px (min ${CORPS_MINIMUM}) — « ${extrait} »`);
    }
  }

  for (const lien of document.querySelectorAll('a')) {
    const { width, height } = lien.getBoundingClientRect();
    if (height < CIBLE_MINIMUM || width < CIBLE_MINIMUM) {
      defauts.push(`cible ${Math.round(width)} × ${Math.round(height)} px (min ${CIBLE_MINIMUM}) — « ${lien.textContent.trim().slice(0, 30)} »`);
    }
  }

  if (document.documentElement.scrollWidth > window.innerWidth) {
    defauts.push(`la page déborde de ${document.documentElement.scrollWidth - window.innerWidth} px sur la droite`);
  }

  return {
    defauts,
    textes: document.querySelectorAll('body *').length,
    liens: document.querySelectorAll('a').length,
    hauteur: document.body.scrollHeight,
  };
}, { CORPS_MINIMUM, CIBLE_MINIMUM, CONTRASTE_MINIMUM });

await navigateur.close();

console.log(`${dossier} — ${ECRAN.width} × ${ECRAN.height}, ${releve.liens} lien(s), ${releve.hauteur} px de haut`);

if (releve.defauts.length === 0) {
  console.log('✅ lisible : contraste, taille de texte, cibles, largeur.');
  process.exit(0);
}

for (const defaut of releve.defauts) console.error(`  ✗ ${defaut}`);
console.error(`\n❌ ${releve.defauts.length} défaut(s) — cette page n’est pas à envoyer.`);
process.exit(1);
