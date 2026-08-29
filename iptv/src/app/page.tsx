import Link from 'next/link'

import { Carte, Grille } from '../composants/Carte.tsx'
import { Entretien } from '../composants/Entretien.tsx'
import { Section, Vide } from '../composants/Vide.tsx'
import { choisirCandidats } from '../entretien/taches.ts'
import { antennesDe } from '../serveur/antennes.ts'
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
  const totalReel = cache.compter({ inclureMorts: true })
  const entretien = {
    total: totalReel,
    ...cache.compterParEtat(),
    aTester: choisirCandidats(cache).length,
  }

  // Deux vides, et les confondre enferme.
  //
  // Rien du tout : on dit quoi importer. Mais **tout masqué** est un état
  // différent — le catalogue existe, un balayage l'a simplement jugé mort d'un
  // bout à l'autre, ce qui arrive quand le réseau était coupé ou l'abonnement
  // saturé pendant le test. Renvoyer alors « importez une liste » accuse la
  // mauvaise cause, et surtout fait disparaître le bloc d'entretien avec le
  // bouton qui répare : plus aucun chemin de retour depuis l'interface.
  // Trouvé en regardant l'écran après un balayage, pas par un test.
  if (total === 0 && totalReel > 0) {
    return (
      <>
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Tout est masqué</h1>
          <p className="text-doux">
            Les {totalReel.toLocaleString('fr-FR')} entrées du catalogue ont été jugées hors
            service. Rien n’est effacé — un seul bouton les remet en jeu.
          </p>
        </header>
        <Entretien initial={entretien} />
        <p className="text-sm text-doux">
          Un balayage qui condamne tout signale presque toujours un problème de votre côté :
          réseau coupé, ou abonnement à court de connexions au moment du test.
        </p>
      </>
    )
  }

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

      {/* L'entretien avant les contenus : c'est ce qu'on vient faire quand on
          ouvre l'accueil sans intention de regarder, et le chercher ailleurs
          serait le rendre introuvable. */}
      <Entretien initial={entretien} />

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
        <Grille elements={chaines} antennes={antennesDe(cache, chaines)} />
      </Section>

      <p className="text-sm text-doux">
        <Link href="/recherche" className="compact text-accent hover:underline">
          Chercher dans tout le catalogue
        </Link>
      </p>
    </>
  )
}
