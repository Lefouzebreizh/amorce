import Link from 'next/link'

import { AfficheLien, Dossier } from '../../composants/Affiche.tsx'
import { SEUIL_DOSSIERS } from '../../composants/Catalogue.tsx'
import { Vide } from '../../composants/Vide.tsx'
import { detecterTheme, ordreTheme } from '../../normalisation/theme.ts'
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
export default async function Series({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme: themeOuvert } = await searchParams
  const cache = depot()
  if (cache.compter() === 0 && cache.fiches({ limite: 1 }).length === 0) {
    return <Vide quoi="les séries" />
  }

  const derivees = cache.series()
  const declarees = cache.fiches({ limite: 500 })

  const parTitre = new Map<
    string,
    {
      titre: string
      episodes: number
      saisons: number
      theme: string
      resume?: string | undefined
      logo?: string | undefined
    }
  >()

  for (const serie of derivees) {
    parTitre.set(serie.serie.toLocaleLowerCase('fr'), {
      titre: serie.serie,
      episodes: serie.episodes,
      saisons: serie.saisons,
      theme: serie.theme ?? '',
      logo: serie.logo,
    })
  }
  for (const fiche of declarees) {
    const cle = fiche.titre.toLocaleLowerCase('fr')
    const existant = parTitre.get(cle)
    parTitre.set(cle, {
      titre: fiche.titre,
      episodes: existant?.episodes ?? 0,
      saisons: existant?.saisons ?? 0,
      // Une fiche déclarée porte ses propres genres ; ils valent mieux que le
      // thème déduit du groupe de ses épisodes, qui n'existe pas toujours.
      theme: detecterTheme(fiche.groupe, fiche.genres) ?? existant?.theme ?? '',
      resume: fiche.resume,
      logo: fiche.logo ?? existant?.logo,
    })
  }

  const toutes = [...parTitre.values()].sort((a, b) =>
    a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' }),
  )

  // Les dossiers d'abord, comme pour les films : on choisit un thème, puis une
  // série. Une liste de deux mille titres à plat ne se parcourt pas — mais une
  // liste de trois se parcourt très bien, et les dossiers n'y coûteraient qu'un
  // clic de plus. Même seuil que le catalogue, même raison.
  if (themeOuvert === undefined && toutes.length > SEUIL_DOSSIERS) {
    const compte = new Map<string, number>()
    const apercus = new Map<string, string[]>()
    for (const serie of toutes) {
      compte.set(serie.theme, (compte.get(serie.theme) ?? 0) + 1)
      const images = apercus.get(serie.theme) ?? []
      if (images.length < 3 && serie.logo !== undefined) images.push(serie.logo)
      apercus.set(serie.theme, images)
    }
    const dossiers = [...compte.entries()].sort(
      ([a], [b]) => ordreTheme(a) - ordreTheme(b) || a.localeCompare(b, 'fr'),
    )

    return (
      <>
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Séries</h1>
          <p className="text-doux">
            {toutes.length.toLocaleString('fr-FR')} séries, {dossiers.length} thèmes
          </p>
        </header>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dossiers.map(([nom, total]) => (
            <li key={nom || 'autres'}>
              <Dossier
                href={`/series?theme=${encodeURIComponent(nom)}`}
                nom={nom === '' ? 'Autres' : nom}
                compte={total}
                apercus={apercus.get(nom) ?? []}
              />
            </li>
          ))}
        </ul>
      </>
    )
  }

  const series =
    themeOuvert === undefined ? toutes : toutes.filter((serie) => serie.theme === themeOuvert)

  return (
    <>
      <header className="mb-4">
        {themeOuvert !== undefined && (
          <Link href="/series" className="text-sm text-doux">
            ‹ Tous les thèmes
          </Link>
        )}
        <h1 className="text-2xl font-bold">
          {themeOuvert === undefined ? 'Séries' : themeOuvert === '' ? 'Autres' : themeOuvert}
        </h1>
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
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {series.map((serie) => (
            <li key={serie.titre}>
              <AfficheLien
                href={`/series/${encodeURIComponent(serie.titre)}`}
                titre={serie.titre}
                logo={serie.logo}
                sousTitre={
                  serie.episodes === 0
                    ? 'Épisodes à charger'
                    : `${serie.saisons} saison${serie.saisons > 1 ? 's' : ''} · ${serie.episodes} ép.`
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
