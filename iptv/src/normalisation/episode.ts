// Reconnaître une saison et un épisode dans un titre.
//
// C'est ce qui sépare une liste plate de 4 000 lignes d'une navigation en
// séries, saisons et épisodes. Les fournisseurs francophones écrivent la même
// chose de cinq façons — `S01E02`, `S1 E2`, `1x02`, `Saison 1 Episode 2`,
// `Saison 1 - 02` — et un lecteur qui n'en reconnaît que la première range
// quatre séries sur cinq dans les films.
//
// Deux prudences, chacune pour une erreur qu'on voit dans les listes réelles :
//
// - **`1x02` ne doit pas attraper une résolution.** `1920x1080` porte le même
//   motif ; la borne à deux chiffres pour la saison et l'absence de chiffre
//   collé de part et d'autre l'écartent.
// - **Un numéro d'épisode seul n'invente pas de saison.** `Episode 4` rend une
//   saison `undefined`, pas `1` : afficher une « Saison 1 » qui n'existe nulle
//   part dans la liste est un mensonge d'interface, et il se voit.

export interface Episode {
  /** Le titre de la série, nettoyé du motif et de ce qui le colle. */
  readonly serie: string | undefined
  readonly saison: number | undefined
  readonly episode: number
}

interface Motif {
  readonly motif: RegExp
  readonly saison: number | undefined
  readonly episode: number
}

// L'ordre est celui de la certitude décroissante : le premier qui trouve gagne.
const MOTIFS: readonly Motif[] = [
  // S01E02, S1 E2, S01 EP02, Saison 1 Episode 2, Season 3 Episode 10
  {
    motif: /(?:^|[^A-Za-z0-9])S(?:aison|eason)?\s*(\d{1,2})\s*[-–—.]?\s*(?:[EÉ]pisode|EP|E)\s*(\d{1,3})(?![0-9])/i,
    saison: 1,
    episode: 2,
  },
  // 1x02 — jamais 1920x1080 : le chiffre voisin immédiat disqualifie.
  {
    motif: /(?:^|[^0-9])(\d{1,2})\s*[xX]\s*(\d{1,3})(?![0-9])/,
    saison: 1,
    episode: 2,
  },
  // Saison 1 - 02
  {
    motif: /(?:^|[^A-Za-z0-9])S(?:aison|eason)\s*(\d{1,2})\s*[-–—]\s*(\d{1,3})(?![0-9])/i,
    saison: 1,
    episode: 2,
  },
  // Episode 4, EP 12, E05 — sans saison, et seulement précédé d'un séparateur.
  {
    motif: /(?:^|[\s\-–—.|:])(?:[EÉ]pisode|EP|E)\s*(\d{1,3})(?![0-9])/i,
    saison: undefined,
    episode: 1,
  },
]

function nettoyerBords(texte: string): string {
  return texte
    .replace(/^[\s\-–—:|.,]+/, '')
    .replace(/[\s\-–—:|.,]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Rend `undefined` si le titre ne porte aucun numéro d'épisode reconnaissable. */
export function detecterEpisode(titre: string): Episode | undefined {
  for (const { motif, saison, episode } of MOTIFS) {
    const trouve = motif.exec(titre)
    if (trouve === null) continue

    const brutEpisode = trouve[episode]
    if (brutEpisode === undefined) continue
    const numeroEpisode = Number.parseInt(brutEpisode, 10)
    if (Number.isNaN(numeroEpisode)) continue

    const brutSaison = saison === undefined ? undefined : trouve[saison]
    const numeroSaison =
      brutSaison === undefined ? undefined : Number.parseInt(brutSaison, 10)

    // Ce qui précède le motif est le nom de la série ; ce qui suit ne l'est que
    // si rien ne précède, cas des listes qui écrivent « S01E02 - Le Titre ».
    const avant = nettoyerBords(titre.slice(0, trouve.index))
    const apres = nettoyerBords(titre.slice(trouve.index + trouve[0].length))
    const nom = avant !== '' ? avant : apres

    return {
      serie: nom === '' ? undefined : nom,
      saison: numeroSaison !== undefined && Number.isNaN(numeroSaison) ? undefined : numeroSaison,
      episode: numeroEpisode,
    }
  }
  return undefined
}
