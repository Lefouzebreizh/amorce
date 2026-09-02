// Une chaîne, un film ou une série est-il étranger — au sens où rien n'y est en
// français ?
//
// **D'où vient l'information, et pourquoi deux sources différentes.** Pour une
// chaîne en direct, rien ne dit sa langue mieux que le nom de son groupe : un
// panneau Xtream range ses chaînes par pays — « ALLEMANDES (Deutsch) »,
// « ESPAGNOLES (España) », « FR TV HD (France) ». `etiquettes.ts` ne les
// reconnaît pas : il cherche des étiquettes de piste audio (VF, VOSTFR, MULTI),
// pas des noms de pays. Pour un film ou une série, c'est l'inverse : `langue`
// est déjà juste, posée sur l'étiquette du fichier — VOSTFR ou VO disent
// qu'aucune piste française n'existe.
//
// **La règle qui tranche les cas mêlés : un marqueur français gagne toujours.**
// « BELGES (FR-SPORTS-FLAMAND) » porte à la fois un marqueur français et un
// marqueur étranger — cette chaîne existe pour un public qui regarde en
// français, la garder est le choix le moins risqué. Retenir un vocabulaire
// fermé plutôt que deviner groupe par groupe évite surtout l'erreur inverse,
// plus grave : masquer par excès une chaîne qui est en français.
//
// **Ce qui reste affiché faute de motif reconnu, et pourquoi c'est voulu.** Une
// bonne partie de ce catalogue range ses chaînes françaises sous des noms de
// catégorie génériques et anglais — « Movies », « General », « Kids » —
// hérités d'un guide de programmes, alors que les chaînes qu'ils contiennent
// sont france 4, 6ter, BFM ou Gulli. Un groupe sans motif reconnu reste donc
// visible : le motif inverse — tout masquer sauf ce qui est marqué français —
// aurait effacé une bonne partie des chaînes françaises réelles de ce
// catalogue, précisément celles qui n'ont pas besoin d'être marquées.
//
// **Les cas tranchés par prudence, à la marge.** « CANADA ( CA ) » et
// « SUISSES (SWITZERLAND) » sont comptés étrangers alors que le Québec et la
// Suisse romande existent : ces groupes-ci ne les distinguent pas de leurs
// voisins anglophones ou germanophones, et rien dans ce catalogue ne permet de
// les séparer plus finement.

function nu(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Un marqueur français présent n'importe où l'emporte sur tout marqueur étranger. */
const MARQUEURS_FRANCAIS = /\b(fr|france|belgique|quebec|wallonie)\b/

/**
 * Les pays et langues étrangers reconnus dans un nom de groupe.
 *
 * Un vocabulaire ouvert plutôt que fermé, à la différence de `theme.ts` : il ne
 * s'agit pas de choisir la meilleure étiquette parmi plusieurs, mais de
 * répondre oui ou non à une seule question. L'ordre n'a donc pas d'importance.
 */
const MARQUEURS_ETRANGERS: readonly RegExp[] = [
  /arab|alrabiaa|\bar sports?\b/,
  /espagn|espana|\bspain\b/,
  /ital/,
  /turq|turk/,
  /allemand|deutsch|german/,
  /anglais|\buk\b|british/,
  /etats.?unis|\busa\b|\bus\b/,
  /\bcanada\b/,
  /pologne|polon/,
  /portugu|brasil|brazil/,
  /scandinav|danemark|norway|norvege|sweden|suede|denmark/,
  /sud.?afrique|south.?africa/,
  /bosniaqu|bosna|herzegovin/,
  /croate|hrvat/,
  /\bruss/,
  /maghreb/,
  /grec|hellas/,
  /albanais|shqip/,
  /pays.?bas|netherland|holland/,
  /roumain|romania/,
  /\bsuisse|switzerland/,
  /tcheq|cesko|czech/,
  /armeni/,
  /\binde\b|indian/,
]

/** Un film ou une série sans piste française : sous-titré ou en version originale. */
export function estEtrangerVod(langue: string): boolean {
  return langue === 'vostfr' || langue === 'vo'
}

/** Une chaîne dont le groupe désigne un pays ou une langue autre que le français. */
export function estEtrangerDirect(groupe: string | undefined): boolean {
  if (groupe === undefined || groupe === '') return false
  const texte = nu(groupe)
  if (MARQUEURS_FRANCAIS.test(texte)) return false
  return MARQUEURS_ETRANGERS.some((motif) => motif.test(texte))
}
