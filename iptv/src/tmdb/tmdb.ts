// Affiche et résumé d'un film ou d'une série, cherchés chez TMDB.
//
// **Sur un geste, jamais avant.** Une intégration posée dès l'ouverture de la
// fiche dirait à un tiers ce que la personne s'apprête à regarder, à chaque
// film ou série ouverts — la même règle que pour la bande-annonce et les
// sous-titres externes, et pour la même raison. Le titre et l'année seuls
// partent ; jamais l'identifiant du fournisseur IPTV, jamais l'adresse du flux.
//
// **Sans clé, la fonctionnalité s'absente au lieu d'échouer**, comme pour les
// sous-titres : c'est la règle de `/dependance-indisponible` appliquée telle
// quelle.

export interface DemandeAffiche {
  readonly titre: string
  readonly annee?: number | undefined
  readonly genre: 'film' | 'serie'
}

export interface Affiche {
  readonly url: string | undefined
  readonly resume: string | undefined
}

export interface ReglagesTmdb {
  readonly cle?: string | undefined
  readonly fetch?: typeof globalThis.fetch
  readonly delaiMs?: number
}

const DELAI_DEFAUT = 8_000
const BASE = 'https://api.themoviedb.org/3'
// w500 : assez grand pour une fiche, assez léger pour ne pas attendre sur un
// lien mobile. TMDB sert aussi w200 et l'original en pleine taille, inutiles ici.
const BASE_IMAGE = 'https://image.tmdb.org/t/p/w500'

function chaine(valeur: unknown): string | undefined {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : undefined
}

export function tmdbDisponible(reglages: Pick<ReglagesTmdb, 'cle'>): boolean {
  return (reglages.cle?.trim() ?? '') !== ''
}

/**
 * Cherche l'affiche et le résumé d'un titre.
 *
 * Trois issues, et il faut les distinguer : `undefined` dit qu'on ne sait pas
 * — pas de clé, service injoignable, réponse illisible — et ne doit **jamais**
 * être mis en cache, sinon une coupure réseau passagère se fige en « aucune
 * affiche » pour de bon. `{ url: undefined, resume: undefined }` dit que TMDB a
 * répondu et n'a rien à donner sous ce titre ; celui-là se met en cache, pour
 * ne pas réinterroger le service à chaque clic sur la même fiche.
 */
export async function chercherAffiche(
  demande: DemandeAffiche,
  reglages: ReglagesTmdb = {},
): Promise<Affiche | undefined> {
  const cle = reglages.cle?.trim()
  if (cle === undefined || cle === '') return undefined

  const appeler = reglages.fetch ?? globalThis.fetch
  const delai = reglages.delaiMs ?? DELAI_DEFAUT
  const chemin = demande.genre === 'film' ? 'search/movie' : 'search/tv'
  const parametres = new URLSearchParams({ api_key: cle, query: demande.titre, language: 'fr-FR' })
  if (demande.annee !== undefined) {
    // Le nom du paramètre d'année diffère entre les deux points d'entrée : TMDB
    // distingue une date de sortie d'une date de première diffusion.
    parametres.set(demande.genre === 'film' ? 'year' : 'first_air_date_year', String(demande.annee))
  }

  let reponse: Response
  try {
    reponse = await appeler(`${BASE}/${chemin}?${parametres.toString()}`, {
      signal: AbortSignal.timeout(delai),
    })
  } catch {
    return undefined
  }
  if (!reponse.ok) return undefined

  let donnees: unknown
  try {
    donnees = await reponse.json()
  } catch {
    return undefined
  }

  const racine =
    typeof donnees === 'object' && donnees !== null ? (donnees as Record<string, unknown>) : {}
  const resultats = Array.isArray(racine['results']) ? racine['results'] : []
  const premier = resultats[0]
  if (typeof premier !== 'object' || premier === null) return { url: undefined, resume: undefined }

  const champs = premier as Record<string, unknown>
  const cheminAffiche = chaine(champs['poster_path'])
  return {
    url: cheminAffiche === undefined ? undefined : `${BASE_IMAGE}${cheminAffiche}`,
    resume: chaine(champs['overview']),
  }
}
