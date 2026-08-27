/**
 * Lecture d'un prix affiché sur une page, sans rien deviner.
 *
 * Ce module ne connaît aucun éditeur. Il ne lit que ce que les pages
 * **déclarent** dans des formats normalisés, par ordre de fiabilité :
 *
 * 1. **JSON-LD `schema.org/Offer`** — le vendeur écrit son prix en toutes
 *    lettres pour les moteurs de recherche. C'est une déclaration, pas une
 *    apparence : rien à interpréter.
 * 2. **Microdonnées** `itemprop="price"` — même idée, dans le balisage.
 * 3. **OpenGraph** `product:price:amount` — le plus pauvre des trois, et le
 *    dernier consulté.
 *
 * Ce qu'il ne fait délibérément pas : chercher un « 9,99 € » dans le texte
 * visible. Une page de tarifs en affiche cinq — mensuel, annuel, promotion,
 * prix barré, offre famille — et rien dans le texte ne dit lequel est celui
 * qu'on suit. Prendre le premier venu fabriquerait une courbe, ce que ce
 * projet reproche précisément aux autres.
 *
 * D'où la règle du module, qui est aussi sa seule subtilité :
 *
 * **Plusieurs montants différents déclarés ⇒ aucun prix.** L'ambiguïté n'est
 * pas un petit défaut de lecture qu'on tranche au hasard ; c'est l'absence de
 * réponse. Le Worker n'écrit alors rien, exactement comme pour un site qui n'a
 * pas répondu.
 *
 * N'exporte que des fonctions : `workerd` refuse de charger un module d'entrée
 * dont un export nommé ne l'est pas, et ce module est importé par celui-là.
 */

/** Ce qu'on accepte comme prix d'abonnement : ni gratuit, ni aberrant. */
const MONTANT_MIN = 0.5;
const MONTANT_MAX = 999;

/**
 * Convertit un montant déclaré en nombre, ou rend `null`.
 *
 * Le point douloureux est le séparateur. « 12,99 » est européen, « 1,299 » est
 * un millier anglo-saxon, et les deux se croisent sur les mêmes pages. La règle
 * qui tranche sans deviner : le **dernier** séparateur ne vaut décimale que
 * s'il est suivi de une ou deux décimales exactement — « 1,299 » reste donc
 * mille deux cent quatre-vingt-dix-neuf, et « 12,99 » vaut douze quatre-vingt-
 * dix-neuf.
 */
function normaliserMontant(brut) {
  if (typeof brut === 'number') return Number.isFinite(brut) ? brut : null;
  if (typeof brut !== 'string') return null;

  // On retire tout ce qui n'est ni chiffre ni séparateur : symboles, espaces
  // insécables, codes de devise, mentions « /mois ».
  const nettoye = brut.replace(/[^\d.,]/g, '');
  if (!nettoye) return null;

  const dernier = Math.max(nettoye.lastIndexOf(','), nettoye.lastIndexOf('.'));
  let texte;
  if (dernier === -1) {
    texte = nettoye;
  } else {
    const decimales = nettoye.length - dernier - 1;
    if (decimales === 1 || decimales === 2) {
      texte = `${nettoye.slice(0, dernier).replace(/[.,]/g, '')}.${nettoye.slice(dernier + 1)}`;
    } else {
      texte = nettoye.replace(/[.,]/g, '');
    }
  }

  const valeur = Number.parseFloat(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

/** Un montant est plausible, ou il n'est pas retenu. */
function plausible(valeur) {
  return valeur !== null && valeur >= MONTANT_MIN && valeur <= MONTANT_MAX;
}

/** Parcourt une structure JSON-LD et récolte tout ce qui se présente comme un prix. */
function prixDansJsonLd(noeud, recolte) {
  if (Array.isArray(noeud)) {
    for (const enfant of noeud) prixDansJsonLd(enfant, recolte);
    return;
  }
  if (!noeud || typeof noeud !== 'object') return;

  for (const [cle, valeur] of Object.entries(noeud)) {
    if (cle === 'price' || cle === 'lowPrice') {
      const montant = normaliserMontant(valeur);
      if (plausible(montant)) recolte.push(montant);
    } else if (typeof valeur === 'object') {
      prixDansJsonLd(valeur, recolte);
    }
  }
}

/** Les montants déclarés en JSON-LD. Un bloc illisible est sauté, pas fatal. */
function candidatsJsonLd(html) {
  const recolte = [];
  const blocs = html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const bloc of blocs) {
    try {
      prixDansJsonLd(JSON.parse(bloc[1].trim()), recolte);
    } catch {
      // Un JSON-LD malformé est fréquent et sans gravité : on passe au suivant.
    }
  }
  return recolte;
}

/** Les montants déclarés en microdonnées, en attribut `content` ou en texte. */
function candidatsMicrodonnees(html) {
  const recolte = [];
  for (const m of html.matchAll(/<meta[^>]+itemprop\s*=\s*["']price["'][^>]*>/gi)) {
    const contenu = /content\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    const montant = contenu ? normaliserMontant(contenu[1]) : null;
    if (plausible(montant)) recolte.push(montant);
  }
  for (const m of html.matchAll(/<(?!meta)([a-z]+)[^>]+itemprop\s*=\s*["']price["'][^>]*>([^<]*)</gi)) {
    const montant = normaliserMontant(m[2]);
    if (plausible(montant)) recolte.push(montant);
  }
  return recolte;
}

/** Les montants déclarés en OpenGraph. */
function candidatsOpenGraph(html) {
  const recolte = [];
  for (const m of html.matchAll(
    /<meta[^>]+(?:property|name)\s*=\s*["']product:price:amount["'][^>]*>/gi,
  )) {
    const contenu = /content\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    const montant = contenu ? normaliserMontant(contenu[1]) : null;
    if (plausible(montant)) recolte.push(montant);
  }
  return recolte;
}

/**
 * Lit le prix déclaré par une page.
 *
 * Rend `{ montant, source }` quand la page en déclare **un seul**, et
 * `{ montant: null, raison }` sinon — page muette, ou page qui en déclare
 * plusieurs différents. Les trois formats sont consultés dans l'ordre : le
 * premier qui parle tranche, on ne mélange pas les sources.
 */
function lirePrix(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return { montant: null, raison: 'page vide' };
  }

  const sources = [
    ['json-ld', candidatsJsonLd],
    ['microdonnees', candidatsMicrodonnees],
    ['opengraph', candidatsOpenGraph],
  ];

  for (const [source, extraire] of sources) {
    const distincts = [...new Set(extraire(html))];
    if (distincts.length === 1) return { montant: distincts[0], source };
    if (distincts.length > 1) {
      // Plusieurs tarifs déclarés : mensuel et annuel, ou prix barré et prix
      // courant. Choisir serait inventer.
      return {
        montant: null,
        raison: `${distincts.length} montants déclarés en ${source}`,
        candidats: distincts.sort((a, b) => a - b),
      };
    }
  }

  return { montant: null, raison: 'aucun prix déclaré' };
}

export { lirePrix, normaliserMontant };
