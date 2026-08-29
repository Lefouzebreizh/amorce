// Direct, film ou série : la décision qui range toute la liste.
//
// Elle se prend sur quatre indices de fiabilité très inégale, et c'est l'ordre
// qui fait la justesse :
//
// 1. **Le chemin de l'URL**, quand la liste vient d'un panneau Xtream : ce
//    n'est pas une convention de nommage mais la route du serveur lui-même.
//    `/series/`, `/movie/` et `/live/` ne mentent pas.
// 2. **Un numéro d'épisode reconnu** : rien d'autre ne porte un `S01E02`.
// 3. **Le nom du groupe**, écrit à la main par le fournisseur — souvent juste,
//    parfois fantaisiste, et vérifié après les deux précédents.
// 4. **L'extension du fichier** : un `.mkv` n'est jamais du direct.
//
// À défaut, c'est du direct : c'est le cas majoritaire d'une liste IPTV, et
// c'est aussi l'erreur la moins coûteuse — une chaîne rangée dans les films se
// voit tout de suite, un film perdu dans 4 000 chaînes ne se retrouve pas.

import type { Genre } from '../domaine/types.ts'

const FICHIER_VIDEO = /\.(mkv|mp4|avi|mov|webm|flv|mpe?g|wmv)(?:\?|$)/i
const GROUPE_SERIE = /s[ée]ries?|s[ée]ason|saison|tv[ -]?shows?|animes?/i
const GROUPE_FILM = /films?|movies?|cin[ée]ma|vod|documentaires?/i

export interface IndicesGenre {
  readonly url: string
  readonly groupe?: string | undefined
  /** Vrai quand `detecterEpisode` a trouvé quelque chose. */
  readonly episode?: boolean
}

export function detecterGenre({ url, groupe, episode = false }: IndicesGenre): Genre {
  if (/\/series\//i.test(url)) return 'serie'
  if (/\/movie\//i.test(url)) return 'film'
  if (/\/live\//i.test(url)) return 'direct'

  if (episode) return 'serie'

  if (groupe !== undefined && groupe !== '') {
    if (GROUPE_SERIE.test(groupe)) return 'serie'
    if (GROUPE_FILM.test(groupe)) return 'film'
  }

  if (FICHIER_VIDEO.test(url)) return 'film'

  return 'direct'
}
