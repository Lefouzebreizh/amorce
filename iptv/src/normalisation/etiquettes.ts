// Ce que les étiquettes d'un titre disent de la langue et de la définition.
//
// Deux sources se complètent et ne se valent pas : les étiquettes relevées dans
// le titre, sûres parce qu'elles ont été reconnues comme des mots entiers, et
// le **contexte** — nom du groupe, catégorie du panneau — qui n'a pas été
// découpé et se lit donc avec des frontières de mot explicites.
//
// L'ordre de décision compte, et il est francophone par construction : une
// entrée marquée à la fois `VF` et `VOSTFR` porte les deux pistes, c'est donc
// du `multi`, et cette entrée-là doit remonter avant une `vostfr` seule dans la
// liste d'un public français.

import type { Langue, Qualite } from '../domaine/types.ts'
import { ETIQUETTES_LANGUE, ETIQUETTES_QUALITE } from './titre.ts'

function chercheur(
  etiquettes: readonly string[],
  contexte: string,
  connues: ReadonlySet<string>,
): (...cles: readonly string[]) => boolean {
  const jeu = new Set(etiquettes.map((e) => e.toUpperCase()))
  const texte = contexte.toUpperCase()
  return (...cles) =>
    cles.some((cle) => {
      if (jeu.has(cle)) return true
      if (!connues.has(cle)) return false
      // Frontière de mot explicite : `[^A-Z0-9]` plutôt que `\b`, sinon « 4K »
      // serait trouvé dans « 14K » et « HD » dans « UHD ».
      return new RegExp(`(^|[^A-Z0-9])${cle.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([^A-Z0-9]|$)`).test(
        texte,
      )
    })
}

/**
 * Le titre l'emporte sur le contexte, et ce n'est pas un détail.
 *
 * `[VOSTFR] Breaking Bad S01E01` rangé dans un groupe nommé `SERIES VF` est un
 * cas courant : le fournisseur nomme sa catégorie une fois, pour cent épisodes
 * dont certains ne sont pas doublés. Peser les deux également faisait ressortir
 * `multi` — « les deux pistes » — pour un fichier qui n'en a qu'une, et un
 * spectateur qui filtre sur `vf` tombait sur du sous-titré.
 *
 * L'étiquette portée par l'élément est donc lue seule ; le contexte ne sert que
 * lorsqu'elle se tait.
 */
function enDeuxTemps<T>(
  etiquettes: readonly string[],
  contexte: string,
  connues: ReadonlySet<string>,
  classer: (a: (...cles: readonly string[]) => boolean) => T,
  silence: T,
): T {
  const depuisTitre = classer(chercheur(etiquettes, '', connues))
  if (depuisTitre !== silence) return depuisTitre
  return classer(chercheur([], contexte, connues))
}

/**
 * `contexte` reçoit ce qui n'a pas été découpé en mots : le nom du groupe, la
 * catégorie Xtream. Le titre y est inutile — ses étiquettes sont déjà relevées.
 */
export function detecterLangue(etiquettes: readonly string[], contexte = ''): Langue {
  return enDeuxTemps<Langue>(etiquettes, contexte, ETIQUETTES_LANGUE, (a) => {
    const francais = a('VF', 'VFF', 'VFQ', 'VFI', 'VOF', 'TRUEFRENCH', 'FRENCH')
    const sousTitre = a('VOSTFR', 'VOST', 'VOSTA', 'SUBFRENCH')

    if (a('MULTI', 'MULTI-AUDIO')) return 'multi'
    // Les deux à la fois, sur la même source : le fichier porte les deux pistes.
    if (francais && sousTitre) return 'multi'
    if (francais) return 'vf'
    if (sousTitre) return 'vostfr'
    if (a('VO', 'VOA', 'ENGLISH')) return 'vo'
    return 'inconnue'
  }, 'inconnue')
}

export function detecterQualite(etiquettes: readonly string[], contexte = ''): Qualite {
  return enDeuxTemps<Qualite>(etiquettes, contexte, ETIQUETTES_QUALITE, (a) => {
    if (a('4K', 'UHD', '2160P')) return '4k'
    if (a('FHD', '1080P', '1080I')) return 'fhd'
    if (a('HD', '720P', '720I', 'HDLIGHT')) return 'hd'
    if (a('SD', '576P', '480P', '360P', 'LQ')) return 'sd'
    return 'inconnue'
  }, 'inconnue')
}
