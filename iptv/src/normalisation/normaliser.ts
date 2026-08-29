// Le seul endroit qui fabrique un `Element`.
//
// M3U et Xtream entrent ici sous leur forme brute et en ressortent identiques :
// c'est la contrepartie de la règle posée dans `domaine/types.ts`. Deux
// chemins de normalisation en parallèle produiraient deux modèles qui divergent
// doucement — un `logo` renseigné d'un côté, absent de l'autre — et l'interface
// finirait par tester la provenance, ce qui est exactement ce qu'on évite.

import { identifiant } from '../domaine/identite.ts'
import type { Element, FicheSerie } from '../domaine/types.ts'
import type { EntreeM3U } from '../ingestion/m3u.ts'
import type { BrutXtream, ClientXtream } from '../ingestion/xtream.ts'
import { entier, texte } from '../domaine/valeurs.ts'
import { detecterEpisode } from './episode.ts'
import { detecterLangue, detecterQualite } from './etiquettes.ts'
import { numeroDeCanal, rangDeChaine } from './canal.ts'
import { detecterTheme } from './theme.ts'
import { detecterGenre } from './genre.ts'
import { analyserTitre } from './titre.ts'

/**
 * Ce dont la normalisation a besoin d'un client Xtream : l'adresse de base et
 * les trois constructeurs d'URL. Rien de plus, pour que les tests n'aient pas à
 * fabriquer un client complet ni à simuler le réseau.
 */
export type ConstructeurUrl = Pick<
  ClientXtream,
  'base' | 'urlDirect' | 'urlFilm' | 'urlEpisode'
>

/** Table `category_id` → `category_name`, telle que rendue par `client.categories()`. */
export type Categories = ReadonlyMap<string, string>

function nomCategorie(brut: BrutXtream, categories: Categories | undefined): string | undefined {
  const id = texte(brut['category_id'])
  if (id === undefined) return undefined
  return categories?.get(id)
}

function anneeDepuis(brut: BrutXtream): number | undefined {
  const directe = entier(brut['year'])
  if (directe !== undefined && directe >= 1900) return directe
  // `releaseDate` et `release_date` cohabitent selon la version du panneau.
  const date = texte(brut['releaseDate']) ?? texte(brut['release_date'])
  const trouve = date === undefined ? null : /(19\d{2}|20\d{2})/.exec(date)
  return trouve?.[1] === undefined ? undefined : Number(trouve[1])
}

/** Une entrée de liste M3U devient un élément affichable. */
export function normaliserEntreeM3U(entree: EntreeM3U): Element {
  const attributs = entree.attributs
  // `tvg-name` sert de secours : certaines listes laissent le titre vide après
  // la virgule et ne renseignent que l'attribut.
  const titreBrut = entree.titre !== '' ? entree.titre : (attributs['tvg-name'] ?? '')
  const analyse = analyserTitre(titreBrut)
  const episode = detecterEpisode(analyse.titre)
  const groupe = entree.groupe
  const genre = detecterGenre({
    url: entree.url,
    groupe,
    episode: episode !== undefined,
  })
  const contexte = groupe ?? ''

  return {
    // L'URL est la seule chose stable d'une liste M3U : ni le titre, ni l'ordre,
    // ni le groupe ne survivent à une mise à jour du fournisseur. Un fournisseur
    // qui change ses adresses fait donc perdre les favoris — c'est le prix du
    // format, et il est écrit ici pour qu'on cesse de le redécouvrir.
    id: identifiant(genre === 'direct' ? 'ch' : genre === 'film' ? 'fi' : 'ep', entree.url),
    source: 'm3u',
    genre,
    titre: analyse.titre,
    titreBrut,
    url: entree.url,
    langue: detecterLangue(analyse.etiquettes, contexte),
    qualite: detecterQualite(analyse.etiquettes, contexte),
    groupe,
    logo: attributs['tvg-logo'],
    tvgId: attributs['tvg-id'],
    // Seules les chaînes portent un rang : un film n'a pas de canal, et lui en
    // donner un le ferait passer devant les autres sans raison.
    canal: genre === 'direct' ? numeroDeCanal(analyse.titre) : undefined,
    rang: genre === 'direct' ? rangDeChaine(analyse.titre, attributs) : undefined,
    // Et le pendant pour ce qui se regarde plutôt que se zappe : une chaîne n'a
    // pas de thème, elle a un numéro.
    theme: genre === 'direct' ? undefined : detecterTheme(groupe),
    annee: analyse.annee,
    serie: episode?.serie,
    saison: episode?.saison,
    episode: episode?.episode,
    etiquettes: analyse.etiquettes,
    optionsLecture: entree.optionsLecture,
    refExterne: undefined,
  }
}

/**
 * Identifiant d'un élément Xtream : calculé sur l'adresse **de base**, jamais
 * sur l'URL de lecture. Celle-ci porte le mot de passe, et un changement de mot
 * de passe effacerait alors tous les favoris.
 */
function idXtream(prefixe: string, base: string, type: string, ref: string): string {
  return identifiant(prefixe, base, type, ref)
}

export function normaliserDirectXtream(
  brut: BrutXtream,
  urls: ConstructeurUrl,
  categories?: Categories,
): Element | undefined {
  const ref = texte(brut['stream_id'])
  if (ref === undefined) return undefined
  const titreBrut = texte(brut['name']) ?? ''
  const analyse = analyserTitre(titreBrut)
  const groupe = nomCategorie(brut, categories)
  const contexte = groupe ?? ''

  return {
    id: idXtream('ch', urls.base, 'live', ref),
    source: 'xtream',
    genre: 'direct',
    titre: analyse.titre,
    titreBrut,
    url: urls.urlDirect(ref),
    langue: detecterLangue(analyse.etiquettes, contexte),
    qualite: detecterQualite(analyse.etiquettes, contexte),
    groupe,
    logo: texte(brut['stream_icon']),
    tvgId: texte(brut['epg_channel_id']),
    canal: numeroDeCanal(analyse.titre),
    // Un panneau Xtream numérote ses chaînes dans `num` : son ordre à lui ne
    // vaut pas celui de la TNT, mais il vaut mieux que rien pour le reste.
    rang: rangDeChaine(analyse.titre, { num: texte(brut['num']) ?? '' }),
    theme: undefined,
    annee: analyse.annee,
    serie: undefined,
    saison: undefined,
    episode: undefined,
    etiquettes: analyse.etiquettes,
    optionsLecture: [],
    refExterne: ref,
  }
}

export function normaliserFilmXtream(
  brut: BrutXtream,
  urls: ConstructeurUrl,
  categories?: Categories,
): Element | undefined {
  const ref = texte(brut['stream_id'])
  if (ref === undefined) return undefined
  const titreBrut = texte(brut['name']) ?? ''
  const analyse = analyserTitre(titreBrut)
  const groupe = nomCategorie(brut, categories)
  const contexte = groupe ?? ''
  // Le conteneur est celui que le panneau annonce : demander un `.m3u8` sur un
  // `.mkv` rend 404, et c'est la première cause de « le film ne démarre pas ».
  const extension = texte(brut['container_extension'])

  return {
    id: idXtream('fi', urls.base, 'movie', ref),
    source: 'xtream',
    genre: 'film',
    titre: analyse.titre,
    titreBrut,
    url: urls.urlFilm(ref, extension),
    langue: detecterLangue(analyse.etiquettes, contexte),
    qualite: detecterQualite(analyse.etiquettes, contexte),
    groupe,
    logo: texte(brut['stream_icon']) ?? texte(brut['cover']),
    tvgId: undefined,
    canal: undefined,
    rang: undefined,
    theme: detecterTheme(groupe, [texte(brut['genre']) ?? '']),
    annee: analyse.annee ?? anneeDepuis(brut),
    serie: undefined,
    saison: undefined,
    episode: undefined,
    etiquettes: analyse.etiquettes,
    optionsLecture: [],
    refExterne: ref,
  }
}

export function normaliserFicheSerieXtream(
  brut: BrutXtream,
  base: string,
  categories?: Categories,
): FicheSerie | undefined {
  const ref = texte(brut['series_id'])
  if (ref === undefined) return undefined
  const titreBrut = texte(brut['name']) ?? ''
  const analyse = analyserTitre(titreBrut)
  const groupe = nomCategorie(brut, categories)
  const genres = texte(brut['genre'])

  return {
    id: idXtream('se', base, 'series', ref),
    refExterne: ref,
    titre: analyse.titre,
    titreBrut,
    annee: analyse.annee ?? anneeDepuis(brut),
    logo: texte(brut['cover']),
    resume: texte(brut['plot']),
    // Le panneau rend les genres en une chaîne, séparés par des virgules.
    genres:
      genres === undefined
        ? []
        : genres
            .split(/\s*[,/]\s*/)
            .map((g) => g.trim())
            .filter((g) => g !== ''),
    groupe,
    langue: detecterLangue(analyse.etiquettes, groupe ?? ''),
  }
}

export interface EpisodeBrut {
  readonly saison: number | undefined
  readonly brut: BrutXtream
}

/**
 * Aplatit la réponse de `get_series_info`.
 *
 * Sa forme est déroutante : `episodes` est un **objet** dont les clés sont les
 * numéros de saison en chaînes de caractères, et non un tableau. Un `for…of`
 * dessus ne rend rien, sans erreur — le piège coûte une demi-heure la première
 * fois qu'une série paraît vide alors que la réponse est pleine.
 */
export function extraireEpisodesXtream(infos: BrutXtream): EpisodeBrut[] {
  const brut = infos['episodes']
  if (typeof brut !== 'object' || brut === null) return []
  const parSaison = brut as Record<string, unknown>
  const sortie: EpisodeBrut[] = []

  for (const [cle, valeur] of Object.entries(parSaison)) {
    if (!Array.isArray(valeur)) continue
    const saison = entier(cle)
    for (const element of valeur) {
      if (typeof element !== 'object' || element === null) continue
      sortie.push({ saison, brut: element as BrutXtream })
    }
  }
  return sortie
}

export function normaliserEpisodeXtream(
  { saison, brut }: EpisodeBrut,
  fiche: FicheSerie,
  urls: ConstructeurUrl,
): Element | undefined {
  const ref = texte(brut['id'])
  if (ref === undefined) return undefined
  const titreBrut = texte(brut['title']) ?? ''
  const analyse = analyserTitre(titreBrut)
  const numero = entier(brut['episode_num'])
  const extension = texte(brut['container_extension'])
  const infos = (
    typeof brut['info'] === 'object' && brut['info'] !== null ? brut['info'] : {}
  ) as BrutXtream

  return {
    id: idXtream('ep', urls.base, 'series', ref),
    source: 'xtream',
    genre: 'serie',
    titre: analyse.titre,
    titreBrut,
    url: urls.urlEpisode(ref, extension),
    langue: fiche.langue,
    qualite: detecterQualite(analyse.etiquettes, ''),
    groupe: fiche.groupe,
    logo: texte(infos['movie_image']) ?? fiche.logo,
    tvgId: undefined,
    canal: undefined,
    rang: undefined,
    // L'épisode hérite du thème de sa série : le panneau ne le déclare qu'une
    // fois, sur la fiche, jamais sur chaque épisode.
    theme: detecterTheme(fiche.groupe, fiche.genres),
    annee: fiche.annee,
    serie: fiche.titre,
    saison: saison ?? entier(brut['season']),
    episode: numero,
    etiquettes: analyse.etiquettes,
    optionsLecture: [],
    refExterne: ref,
  }
}

/**
 * Regroupe des épisodes par série, dans l'ordre où ils arrivent.
 *
 * Utile pour une liste M3U, où rien ne déclare les séries : elles n'existent
 * que par ce regroupement. La clé est le nom de série détecté, à défaut le
 * titre — deux épisodes dont le nom n'a pas été reconnu restent alors séparés,
 * ce qui est préférable à les fondre à tort dans une même fiche.
 */
export function regrouperParSerie(elements: Iterable<Element>): Map<string, Element[]> {
  const groupes = new Map<string, Element[]>()
  for (const element of elements) {
    if (element.genre !== 'serie') continue
    const cle = (element.serie ?? element.titre).toLocaleLowerCase('fr')
    const liste = groupes.get(cle)
    if (liste === undefined) groupes.set(cle, [element])
    else liste.push(element)
  }
  return groupes
}
