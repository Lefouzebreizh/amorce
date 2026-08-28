import Link from 'next/link'

import { Vide } from '../../composants/Vide.tsx'
import { depot } from '../../serveur/depot-partage.ts'

/*
 * Les séries ne sont pas listées comme des éléments : ce qu'on ouvre, c'est une
 * série, pas son premier épisode. Pour une liste M3U elles n'existent que par
 * regroupement — d'où `depot.series()`, qui les dérive des épisodes plutôt que
 * d'inventer une table qu'aucune source ne remplit.
 */
export default function Series() {
  const cache = depot()
  if (cache.compter() === 0) return <Vide quoi="les séries" />

  const series = cache.series()

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Séries</h1>
        <p className="text-doux">{series.length.toLocaleString('fr-FR')} séries</p>
      </header>

      {series.length === 0 ? (
        <p className="rounded-carte border border-bord bg-surface p-6 text-doux">
          Aucune série reconnue dans ce catalogue. Les numéros d’épisode se lisent sous les formes
          S01E02, 1x02 ou « Saison 1 Épisode 2 ».
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((serie) => (
            <li key={serie.serie}>
              <Link
                href={`/series/${encodeURIComponent(serie.serie)}`}
                className="flex flex-col rounded-carte border border-bord bg-surface p-4
                           hover:border-accent hover:bg-surface-haute"
              >
                <span className="font-medium">{serie.serie}</span>
                <span className="text-sm text-doux">
                  {serie.saisons} saison{serie.saisons > 1 ? 's' : ''} · {serie.episodes} épisode
                  {serie.episodes > 1 ? 's' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
