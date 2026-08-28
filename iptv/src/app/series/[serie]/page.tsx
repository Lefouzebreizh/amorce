import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Carte } from '../../../composants/Carte.tsx'
import { depot } from '../../../serveur/depot-partage.ts'

export default async function UneSerie({ params }: { params: Promise<{ serie: string }> }) {
  const { serie } = await params
  const nom = decodeURIComponent(serie)
  const episodes = depot().episodes(nom)
  if (episodes.length === 0) notFound()

  // Regroupés par saison à l'affichage, dans l'ordre que la base a déjà trié.
  const saisons = new Map<number, typeof episodes>()
  for (const episode of episodes) {
    const numero = episode.saison ?? 0
    const liste = saisons.get(numero)
    if (liste === undefined) saisons.set(numero, [episode])
    else liste.push(episode)
  }

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/series" className="compact text-accent hover:underline">
          ← Séries
        </Link>
      </p>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{nom}</h1>
        <p className="text-doux">
          {saisons.size} saison{saisons.size > 1 ? 's' : ''} · {episodes.length} épisodes
        </p>
      </header>

      {[...saisons.entries()].map(([numero, liste]) => (
        <section key={numero} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">
            {numero === 0 ? 'Épisodes' : `Saison ${numero}`}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((episode) => (
              <li key={episode.id}>
                <Carte
                  element={episode}
                  sousTitre={`Épisode ${episode.episode ?? '?'}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
