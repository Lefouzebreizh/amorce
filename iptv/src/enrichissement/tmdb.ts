// Affiche et résumé, depuis TMDB — en repli de ce qu'un fournisseur ne donne pas.
//
// **Pourquoi ici, et pas dans le normalisateur.** Un fournisseur Xtream porte
// déjà souvent une affiche (`stream_icon`, `cover`), mais jamais de résumé pour
// un film ou une série déduite d'une liste M3U. Aller le chercher à l'import
// interrogerait TMDB pour chaque entrée d'un catalogue de plusieurs milliers de
// titres, contre une limite de quelques dizaines de requêtes par seconde — la
// même raison que les épisodes Xtream se chargent à l'ouverture d'une fiche,
// pas à l'import. Ici pareil : un appel, à l'ouverture, jamais en lot.
//
// **Sans clé, la fonctionnalité s'absente au lieu d'échouer** — la même règle
// que les sous-titres externes, et pour la même raison : `/dependance-indisponible`.
//
// **Ce qui n'est pas vérifié ici, et il faut le dire.** Aucun appel réel n'a
// été fait : le réseau qui a écrit ce fichier ne joint pas `api.themoviedb.org`.
// La forme suivie est celle, publique et stable depuis des années, de l'API v3
// (`GET /search/movie`, `GET /search/tv`, `results[].poster_path`,
// `results[].overview`) — mais le premier branchement avec une vraie clé reste
// le seul moment où l'on saura si un champ a bougé. Même aveu, même parade que
// pour Xtream et OpenSubtitles : rien n'est supposé présent, une réponse qui
// n'est pas du JSON attendu rend simplement « rien trouvé », jamais une erreur.

export interface EnrichissementTmdb {
  readonly affiche: string | undefined
  readonly resume: string | undefined
}

export interface ReglagesTmdb {
  readonly fetch?: typeof globalThis.fetch
  readonly delaiMs?: number
}

const DELAI_DEFAUT = 8000
const BASE_API = 'https://api.themoviedb.org/3'
// Taille d'affiche fixe : les grilles de ce projet n'ont jamais besoin de plus
// que ce qu'un téléphone affiche, et une taille variable compliquerait le cache
// du navigateur pour rien.
const BASE_IMAGE = 'https://image.tmdb.org/t/p/w342'

/**
 * Cherche un film ou une série par titre, et rend sa première correspondance.
 *
 * `undefined` couvre volontairement trois cas qu'il ne sert à rien de
 * distinguer pour l'appelant : pas de clé, aucun résultat, service muet. Dans
 * les trois cas la fiche s'affiche sans affiche ni résumé plutôt que de casser.
 */
export async function enrichirTmdb(
  cle: string,
  titre: string,
  annee: number | undefined,
  genre: 'film' | 'serie',
  reglages: ReglagesTmdb = {},
): Promise<EnrichissementTmdb | undefined> {
  if (cle === '') return undefined

  const appeler = reglages.fetch ?? globalThis.fetch
  const delai = reglages.delaiMs ?? DELAI_DEFAUT
  const chemin = genre === 'film' ? 'movie' : 'tv'

  const parametres = new URLSearchParams({
    api_key: cle,
    query: titre,
    language: 'fr-FR',
    include_adult: 'false',
  })
  if (annee !== undefined) {
    parametres.set(genre === 'film' ? 'year' : 'first_air_date_year', String(annee))
  }

  let reponse: Response
  try {
    reponse = await appeler(`${BASE_API}/search/${chemin}?${parametres.toString()}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(delai),
    })
  } catch {
    return undefined
  }
  if (!reponse.ok) return undefined

  let donnees: unknown
  try {
    donnees = JSON.parse(await reponse.text())
  } catch {
    return undefined
  }

  const racine = (typeof donnees === 'object' && donnees !== null ? donnees : {}) as Record<
    string,
    unknown
  >
  const resultats = Array.isArray(racine['results']) ? racine['results'] : []
  const premier = resultats[0]
  if (typeof premier !== 'object' || premier === null) return undefined
  const champs = premier as Record<string, unknown>

  const cheminAffiche = typeof champs['poster_path'] === 'string' ? champs['poster_path'] : undefined
  const resumeBrut = typeof champs['overview'] === 'string' ? champs['overview'] : undefined
  const resume = resumeBrut !== undefined && resumeBrut !== '' ? resumeBrut : undefined
  const affiche = cheminAffiche === undefined ? undefined : `${BASE_IMAGE}${cheminAffiche}`

  if (affiche === undefined && resume === undefined) return undefined
  return { affiche, resume }
}
