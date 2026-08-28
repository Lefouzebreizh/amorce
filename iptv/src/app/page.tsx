import Link from 'next/link'

import { Carte, Grille } from '../composants/Carte.tsx'
import { Section, Vide } from '../composants/Vide.tsx'
import { depot } from '../serveur/depot-partage.ts'

/*
 * L'accueil répond à une seule question : « qu'est-ce que je regarde
 * maintenant ? » D'où l'ordre — ce qui est commencé d'abord, les favoris
 * ensuite, la découverte en dernier. Un catalogue de 120 000 entrées présenté
 * comme une grille à parcourir est inutilisable ; ce qu'on rouvre, c'est ce
 * qu'on a laissé en cours.
 */
export default function Accueil() {
  const cache = depot()
  const total = cache.compter()

  if (total === 0) return <Vide quoi="le catalogue est vide" />

  const reprises = cache.reprises(6)
  const favoris = cache.favoris().slice(0, 6)
  const chaines = cache.lister({ genre: 'direct', limite: 6 })

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Bonsoir</h1>
        <p className="text-doux">
          {total.toLocaleString('fr-FR')} entrées — {cache.compter({ genre: 'direct' })} chaînes,{' '}
          {cache.compter({ genre: 'film' })} films, {cache.compter({ genre: 'serie' })} épisodes.
        </p>
      </header>

      {reprises.length > 0 && (
        <Section titre="Reprendre">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reprises.map((reprise) => (
              <li key={reprise.element.id}>
                <Carte
                  element={reprise.element}
                  sousTitre={
                    reprise.duree === undefined
                      ? 'En cours'
                      : `${Math.round((reprise.position / reprise.duree) * 100)} % — reste ${Math.round(
                          (reprise.duree - reprise.position) / 60,
                        )} min`
                  }
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {favoris.length > 0 && (
        <Section titre="Favoris">
          <Grille elements={favoris} />
        </Section>
      )}

      <Section titre="En direct" lien={{ href: '/direct', libelle: 'Tout voir' }}>
        <Grille elements={chaines} />
      </Section>

      <p className="text-sm text-doux">
        <Link href="/recherche" className="compact text-accent hover:underline">
          Chercher dans tout le catalogue
        </Link>
      </p>
    </>
  )
}
