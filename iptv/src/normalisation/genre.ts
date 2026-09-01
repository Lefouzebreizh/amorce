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
/** Un manifeste HLS : un flux qui coule, pas un fichier qu'on télécharge. */
const MANIFESTE = /\.m3u8?(?:\?|$)/i
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

  /*
   * Le conteneur passe avant le nom du groupe, et cette ligne a été écrite
   * après un défaut réel : une liste publique range ses chaînes par thème, et
   * l'une de ces catégories s'appelle « Movies ». Toutes les chaînes de cinéma
   * se retrouvaient donc dans l'onglet Films — où l'on cliquait sur « un film »
   * pour tomber sur une chaîne en direct.
   *
   * Une chaîne qui **diffuse** des films n'est pas un film. Et la différence
   * est lisible dans l'adresse : un manifeste HLS est un flux continu, un
   * fichier `.mkv` ou `.mp4` est une œuvre. Le nom du groupe, lui, décrit le
   * contenu — pas la nature de ce qu'on reçoit.
   */
  if (MANIFESTE.test(url)) return 'direct'

  if (groupe !== undefined && groupe !== '') {
    if (GROUPE_SERIE.test(groupe)) return 'serie'
    if (GROUPE_FILM.test(groupe)) return 'film'
  }

  if (FICHIER_VIDEO.test(url)) return 'film'

  return 'direct'
}
