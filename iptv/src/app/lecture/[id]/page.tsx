import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BoutonFavori } from '../../../composants/BoutonFavori.tsx'
import { Etiquette } from '../../../composants/Carte.tsx'
import { Lecteur } from '../../../composants/Lecteur.tsx'
import { depot } from '../../../serveur/depot-partage.ts'
import { adresseLecture } from '../../../serveur/flux.ts'

export const dynamic = 'force-dynamic'

export default async function Lecture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cache = depot()
  const element = cache.element(decodeURIComponent(id))
  if (element === undefined) notFound()

  const reprise = cache.reprises(200).find((entree) => entree.element.id === element.id)
  const estFavori = cache.favoris().some((favori) => favori.id === element.id)

  // Les épisodes voisins, pour enchaîner sans repasser par la fiche de série.
  const voisins =
    element.serie === undefined
      ? []
      : cache.episodes(element.serie).filter((autre) => autre.id !== element.id)
  const rang =
    element.serie === undefined
      ? -1
      : cache.episodes(element.serie).findIndex((autre) => autre.id === element.id)
  const suivant =
    element.serie === undefined || rang === -1
      ? undefined
      : cache.episodes(element.serie)[rang + 1]

  return (
    <>
      <p className="mb-3 text-sm">
        <Link
          href={
            element.serie === undefined
              ? element.genre === 'film'
                ? '/films'
                : '/direct'
              : `/series/${encodeURIComponent(element.serie)}`
          }
          className="compact text-accent hover:underline"
        >
          ← Retour
        </Link>
      </p>

      <Lecteur
        id={element.id}
        src={adresseLecture(element)}
        positionDepart={reprise?.position ?? 0}
        direct={element.genre === 'direct'}
      />

      <header className="mt-5">
        <h1 className="text-2xl font-bold">{element.titre}</h1>
        {element.serie !== undefined && (
          <p className="text-doux">
            {element.serie}
            {element.saison !== undefined && ` — saison ${element.saison}`}
            {element.episode !== undefined && `, épisode ${element.episode}`}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {element.langue !== 'inconnue' && <Etiquette texte={element.langue} />}
          {element.qualite !== 'inconnue' && <Etiquette texte={element.qualite} />}
          {element.annee !== undefined && <Etiquette texte={String(element.annee)} />}
          {element.groupe !== undefined && <Etiquette texte={element.groupe} />}
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-3">
        <BoutonFavori id={element.id} initial={estFavori} />
        {suivant !== undefined && (
          <Link
            href={`/lecture/${encodeURIComponent(suivant.id)}`}
            className="rounded-lg border border-bord px-4 py-2 hover:border-accent"
          >
            Épisode suivant →
          </Link>
        )}
      </div>

      {voisins.length > 0 && (
        <p className="mt-6 text-sm text-doux">
          {voisins.length} autre{voisins.length > 1 ? 's' : ''} épisode
          {voisins.length > 1 ? 's' : ''} dans{' '}
          <Link
            href={`/series/${encodeURIComponent(element.serie ?? '')}`}
            className="compact text-accent hover:underline"
          >
            {element.serie}
          </Link>
          .
        </p>
      )}

      {/*
        Le titre d'origine est montré tel que le fournisseur l'écrit. Cela paraît
        du détail, et c'est ce qui permet de comprendre pourquoi une entrée est
        classée comme elle l'est quand le nettoyage se trompe.
      */}
      {element.titreBrut !== element.titre && (
        <p className="mt-4 break-all text-xs text-doux">Dans la liste : {element.titreBrut}</p>
      )}
    </>
  )
}
