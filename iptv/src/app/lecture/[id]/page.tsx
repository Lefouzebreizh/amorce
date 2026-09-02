import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BandeAnnonce } from '../../../composants/BandeAnnonce.tsx'
import { BoutonFavori } from '../../../composants/BoutonFavori.tsx'
import { Etiquette } from '../../../composants/Carte.tsx'
import { Lecteur } from '../../../composants/Lecteur.tsx'
import { enrichirTmdb } from '../../../enrichissement/tmdb.ts'
import { antennesDe } from '../../../serveur/antennes.ts'
import { depot } from '../../../serveur/depot-partage.ts'
import { adresseLecture, estManifeste } from '../../../serveur/flux.ts'

export const dynamic = 'force-dynamic'

const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const horaire = (instant: string): string => HEURE.format(new Date(instant))

export default async function Lecture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cache = depot()
  const element = cache.element(decodeURIComponent(id))
  if (element === undefined) notFound()

  const antenne = antennesDe(cache, [element]).get(element.tvgId ?? '')
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

  // Un film n'a jamais de résumé côté catalogue — aucun fournisseur n'en sert
  // un pour ce genre. Sans clé, `enrichirTmdb` rend `undefined` sans requête :
  // la fiche s'affiche alors exactement comme avant.
  const tmdb =
    element.genre === 'film'
      ? await enrichirTmdb(process.env['TMDB_API_KEY'] ?? '', element.titre, element.annee, 'film')
      : undefined
  // L'affiche du fournisseur prime quand elle existe : TMDB ne comble que
  // l'absence, il ne remplace jamais une image déjà connue de la source.
  const affiche = element.logo ?? tmdb?.affiche

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
        // Sur `element.url` et non sur `adresseLecture(element)` : celle-ci rend
        // `/api/flux?e=…`, sans extension, où la détection répondrait toujours
        // faux et priverait tout flux HLS de hls.js.
        manifeste={estManifeste(element.url, null)}
      />

      <header className="mt-5 flex gap-4">
        {affiche !== undefined && (
          // eslint-disable-next-line @next/next/no-img-element -- une affiche
          // TMDB ou fournisseur, jamais servie par ce serveur : `next/image`
          // n'a rien à optimiser qu'un navigateur ne fasse déjà pour une seule
          // vignette.
          <img
            src={affiche}
            alt=""
            className="h-32 w-auto shrink-0 rounded-carte border border-bord object-cover"
          />
        )}
        <div>
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
          {tmdb?.resume !== undefined && <p className="mt-2 text-sm text-doux">{tmdb.resume}</p>}
        </div>
      </header>

      {antenne?.actuel !== undefined && (
        <section className="mt-4 rounded-carte border border-bord bg-surface p-4">
          <p className="text-sm text-doux">
            En ce moment · {horaire(antenne.actuel.debut)}
            {antenne.actuel.fin !== undefined && ` – ${horaire(antenne.actuel.fin)}`}
          </p>
          <h2 className="text-lg font-semibold">{antenne.actuel.titre}</h2>
          {antenne.actuel.sousTitre !== undefined && (
            <p className="text-doux">{antenne.actuel.sousTitre}</p>
          )}
          {antenne.actuel.resume !== undefined && (
            <p className="mt-2 text-sm">{antenne.actuel.resume}</p>
          )}
          {antenne.actuel.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {antenne.actuel.categories.map((categorie) => (
                <Etiquette key={categorie} texte={categorie} />
              ))}
            </div>
          )}
          {antenne.suivant !== undefined && (
            <p className="mt-3 text-sm text-doux">
              À suivre · {horaire(antenne.suivant.debut)} — {antenne.suivant.titre}
            </p>
          )}
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <BoutonFavori id={element.id} initial={estFavori} />

        {/* Seulement pour un film : une chaîne n'a pas de bande-annonce, et un
            épisode se regarde après le précédent, pas après une réclame. */}
        {element.genre === 'film' && <BandeAnnonce id={element.id} />}
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
