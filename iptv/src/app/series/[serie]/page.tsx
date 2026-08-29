import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Carte, Etiquette } from '../../../composants/Carte.tsx'
import { importerEpisodes } from '../../../cache/importer.ts'
import { depot } from '../../../serveur/depot-partage.ts'
import { panneauXtream } from '../../../serveur/xtream-serveur.ts'

export default async function UneSerie({ params }: { params: Promise<{ serie: string }> }) {
  const { serie } = await params
  const nom = decodeURIComponent(serie)
  const cache = depot()
  const fiche = cache.ficheParTitre(nom)

  let episodes = cache.episodes(nom)

  /*
   * Les épisodes se chargent ici, à la première ouverture de la fiche.
   *
   * Pourquoi pas à l'import du catalogue : les obtenir demande un appel
   * `get_series_info` **par série**. Sur un panneau qui en sert deux mille et
   * accepte quelques dizaines de requêtes par minute, l'import complet
   * prendrait une heure — pour des épisodes dont on n'en regardera jamais que
   * quelques-uns.
   *
   * Le prix est visible et assumé : la première ouverture d'une série attend un
   * aller-retour. Les suivantes lisent le cache.
   */
  if (episodes.length === 0 && fiche?.refExterne !== undefined) {
    const panneau = panneauXtream()
    if (panneau !== undefined) {
      const sourceId = cache.declarerSource({
        genre: 'xtream',
        adresse: panneau.client.base,
        utilisateur: panneau.utilisateur,
      })
      try {
        await importerEpisodes(cache, panneau.client, fiche, sourceId)
        episodes = cache.episodes(nom)
      } catch {
        // Panneau injoignable : on affiche la fiche et on le dit, plutôt que
        // de rendre une page d'erreur sur une série qui existe bel et bien.
      }
    }
  }

  if (episodes.length === 0 && fiche === undefined) notFound()

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

      <header className="mb-6 flex gap-4">
        {fiche?.logo !== undefined && (
          <img src={fiche.logo} alt="" className="h-32 w-22 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{fiche?.titre ?? nom}</h1>
          <p className="text-doux">
            {episodes.length === 0
              ? 'Aucun épisode chargé'
              : `${saisons.size} saison${saisons.size > 1 ? 's' : ''} · ${episodes.length} épisodes`}
            {fiche?.annee !== undefined && ` · ${fiche.annee}`}
          </p>
          {fiche !== undefined && fiche.genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {fiche.genres.map((genre) => (
                <Etiquette key={genre} texte={genre} />
              ))}
            </div>
          )}
        </div>
      </header>

      {fiche?.resume !== undefined && <p className="mb-6 text-sm">{fiche.resume}</p>}

      {episodes.length === 0 ? (
        <p className="rounded-carte border border-bord bg-surface p-6 text-doux">
          Les épisodes n’ont pas pu être chargés. Le panneau est peut-être injoignable, ou les
          identifiants absents de <code>.env</code> — l’application les y lit, elle ne les garde
          jamais en base.
        </p>
      ) : (
        [...saisons.entries()].map(([numero, liste]) => (
          <section key={numero} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">
              {numero === 0 ? 'Épisodes' : `Saison ${numero}`}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((episode) => (
                <li key={episode.id}>
                  <Carte element={episode} sousTitre={`Épisode ${episode.episode ?? '?'}`} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
