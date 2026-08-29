import Link from 'next/link'

import { Vide } from '../../composants/Vide.tsx'
import { depot } from '../../serveur/depot-partage.ts'

/*
 * Deux notions de « série » cohabitent, et ce n'est pas un défaut de
 * conception : c'est le domaine.
 *
 * Une liste M3U n'a pas de séries — elle a des épisodes dont le titre porte un
 * `S01E02`, et la série n'existe que par leur regroupement. Un panneau Xtream,
 * lui, sert des séries comme objets, avec affiche et résumé, et ne livre leurs
 * épisodes que si on les demande une par une.
 *
 * L'écran réunit donc les deux : ce qui est déduit, et ce qui est déclaré. Une
 * série déclarée mais dont les épisodes ne sont pas encore chargés s'affiche
 * quand même — elle se remplira à l'ouverture.
 */
export default function Series() {
  const cache = depot()
  if (cache.compter() === 0 && cache.fiches({ limite: 1 }).length === 0) {
    return <Vide quoi="les séries" />
  }

  const derivees = cache.series()
  const declarees = cache.fiches({ limite: 500 })

  const parTitre = new Map<
    string,
    { titre: string; episodes: number; saisons: number; resume?: string | undefined; logo?: string | undefined }
  >()

  for (const serie of derivees) {
    parTitre.set(serie.serie.toLocaleLowerCase('fr'), {
      titre: serie.serie,
      episodes: serie.episodes,
      saisons: serie.saisons,
    })
  }
  for (const fiche of declarees) {
    const cle = fiche.titre.toLocaleLowerCase('fr')
    const existant = parTitre.get(cle)
    parTitre.set(cle, {
      titre: fiche.titre,
      episodes: existant?.episodes ?? 0,
      saisons: existant?.saisons ?? 0,
      resume: fiche.resume,
      logo: fiche.logo,
    })
  }

  const series = [...parTitre.values()].sort((a, b) =>
    a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' }),
  )

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Séries</h1>
        <p className="text-doux">{series.length.toLocaleString('fr-FR')} séries</p>
      </header>

      {series.length === 0 ? (
        <div className="rounded-carte border border-bord bg-surface p-6">
          <p className="font-medium">Aucune série dans ce catalogue.</p>
          <p className="mt-2 text-doux">
            C’est normal si votre liste ne contient que des chaînes en direct — beaucoup n’ont
            ni films ni séries. Rien n’est cassé&nbsp;: il n’y a simplement rien à ranger ici.
          </p>
          <p className="mt-2 text-sm text-doux">
            Une série est reconnue à son numéro d’épisode dans le titre, sous l’une de ces
            formes&nbsp;: <code>S01E02</code>, <code>1x02</code>, ou « Saison 1 Épisode 2 ».
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((serie) => (
            <li key={serie.titre}>
              <Link
                href={`/series/${encodeURIComponent(serie.titre)}`}
                className="flex gap-3 rounded-carte border border-bord bg-surface p-4
                           hover:border-accent hover:bg-surface-haute"
              >
                {serie.logo !== undefined && (
                  <img
                    src={serie.logo}
                    alt=""
                    loading="lazy"
                    className="h-16 w-12 shrink-0 rounded object-cover"
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{serie.titre}</span>
                  <span className="block text-sm text-doux">
                    {serie.episodes === 0
                      ? 'Épisodes à charger'
                      : `${serie.saisons} saison${serie.saisons > 1 ? 's' : ''} · ${serie.episodes} épisode${serie.episodes > 1 ? 's' : ''}`}
                  </span>
                  {serie.resume !== undefined && (
                    <span className="mt-1 line-clamp-2 block text-xs text-doux">{serie.resume}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
