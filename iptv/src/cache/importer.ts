// La glue : d'une source à la base, sans jamais tout tenir en mémoire.
//
// Chaque fonction d'ici est une chaîne de générateurs — on lit, on normalise, on
// écrit, entrée par entrée. Rien n'accumule de tableau intermédiaire, sans quoi
// tout le travail fait dans `flux/lignes.ts` serait défait à l'étage du dessus.

import type { SourceTexte } from '../flux/lignes.ts'
import { analyserM3U } from '../ingestion/m3u.ts'
import { masquerIdentifiants, type ClientXtream } from '../ingestion/xtream.ts'
import type { Element, FicheSerie } from '../domaine/types.ts'
import { texte } from '../domaine/valeurs.ts'
import {
  extraireEpisodesXtream,
  normaliserDirectXtream,
  normaliserEntreeM3U,
  normaliserEpisodeXtream,
  normaliserFicheSerieXtream,
  normaliserFilmXtream,
  type Categories,
} from '../normalisation/normaliser.ts'
import type { Depot, ResumeImport } from './depot.ts'

export interface OptionsImportM3U {
  /** L'adresse d'origine. Elle est masquée avant d'entrer en base. */
  readonly adresse: string
  /** Fourni quand il ne figure pas dans l'adresse sous forme de paramètre. */
  readonly motDePasse?: string
  readonly paquet?: number
}

export async function importerM3U(
  depot: Depot,
  source: SourceTexte,
  options: OptionsImportM3U,
): Promise<ResumeImport> {
  const adresse = masquerIdentifiants(options.adresse, options.motDePasse ?? '')
  const sourceId = depot.declarerSource({ genre: 'm3u', adresse })

  const entrees = analyserM3U(source, {
    surEnTete: (entete) => {
      // L'adresse du guide arrive dès la première ligne, bien avant la fin de
      // l'analyse : on la range tout de suite plutôt que d'attendre 400 Mo.
      if (entete.urlEpg !== undefined) {
        depot.declarerSource({ genre: 'm3u', adresse, urlEpg: entete.urlEpg })
      }
    },
  })

  async function* normalises(): AsyncGenerator<Element> {
    for await (const entree of entrees) yield normaliserEntreeM3U(entree)
  }

  const options2 = options.paquet === undefined ? {} : { paquet: options.paquet }
  return depot.importer(sourceId, normalises(), options2)
}

export interface ResumeImportXtream extends ResumeImport {
  readonly fiches: number
}

/**
 * Importe le **catalogue** d'un panneau : direct, films, et les fiches de séries.
 *
 * Les épisodes n'en font délibérément pas partie. Les obtenir demande un appel
 * `get_series_info` **par série** — plusieurs centaines d'allers-retours sur un
 * panneau qui en accepte quelques dizaines par minute, pour des données dont
 * l'utilisateur ne verra qu'une poignée. Ils se chargent à l'ouverture d'une
 * fiche, par `importerEpisodes`.
 */
export async function importerXtream(
  depot: Depot,
  client: ClientXtream,
  identifiants: { utilisateur: string },
  options: { paquet?: number } = {},
): Promise<ResumeImportXtream> {
  const sourceId = depot.declarerSource({
    genre: 'xtream',
    adresse: client.base,
    utilisateur: identifiants.utilisateur,
    // Pas d'`urlEpg` : celle d'un panneau est toujours `{base}/xmltv.php`, et
    // elle porte le mot de passe en paramètre. La reconstruire au moment de
    // l'appel coûte une ligne ; l'enregistrer mettrait l'abonnement en base.
  })

  const table = (brutes: readonly Record<string, unknown>[]): Categories => {
    const carte = new Map<string, string>()
    for (const brute of brutes) {
      const id = texte(brute['category_id'])
      const nom = texte(brute['category_name'])
      if (id !== undefined && nom !== undefined) carte.set(id, nom)
    }
    return carte
  }

  const [catDirect, catFilms, catSeries] = await Promise.all([
    client.categories('live'),
    client.categories('vod'),
    client.categories('series'),
  ])

  const [directs, films, series] = await Promise.all([
    client.fluxDirects(),
    client.films(),
    client.series(),
  ])

  const fiches: FicheSerie[] = []
  const nomsSeries = table(catSeries)
  for (const brute of series) {
    const fiche = normaliserFicheSerieXtream(brute, client.base, nomsSeries)
    if (fiche !== undefined) fiches.push(fiche)
  }
  const ecrites = depot.enregistrerFiches(sourceId, fiches)

  const nomsDirect = table(catDirect)
  const nomsFilms = table(catFilms)

  async function* catalogue(): AsyncGenerator<Element> {
    for (const brute of directs) {
      const element = normaliserDirectXtream(brute, client, nomsDirect)
      if (element !== undefined) yield element
    }
    for (const brute of films) {
      const element = normaliserFilmXtream(brute, client, nomsFilms)
      if (element !== undefined) yield element
    }
  }

  const options2 = options.paquet === undefined ? {} : { paquet: options.paquet }
  const resume = await depot.importer(sourceId, catalogue(), options2)
  return { ...resume, fiches: ecrites }
}

/**
 * Charge les épisodes d'une série, au moment où on ouvre sa fiche.
 *
 * `purger: false` n'est pas un détail de réglage : sans lui, cet import
 * retirerait toutes les entrées de la source qu'il n'a pas revues — c'est-à-dire
 * le catalogue entier — et l'application se viderait sur un clic, sans erreur.
 */
export async function importerEpisodes(
  depot: Depot,
  client: ClientXtream,
  fiche: FicheSerie,
  sourceId: number,
): Promise<ResumeImport> {
  if (fiche.refExterne === undefined) {
    return { lus: 0, ecrits: 0, retires: 0, dureeMs: 0 }
  }
  const infos = await client.infosSerie(fiche.refExterne)
  const bruts = extraireEpisodesXtream(infos)

  async function* episodes(): AsyncGenerator<Element> {
    for (const brut of bruts) {
      const element = normaliserEpisodeXtream(brut, fiche, client)
      if (element !== undefined) yield element
    }
  }

  return depot.importer(sourceId, episodes(), { purger: false })
}
