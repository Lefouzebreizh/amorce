'use client'

import { useState } from 'react'

// La bande-annonce, chargée sur un geste et jamais avant.
//
// **Deux gestes, et c'est délibéré.** Le premier demande au panneau s'il en
// connaît une ; le second seulement charge YouTube. Une intégration posée dès
// l'ouverture de la fiche dirait à un tiers ce que la personne s'apprête à
// regarder, à chaque film ouvert — la même règle que pour la recherche de
// sous-titres externes, et pour la même raison.
//
// **L'absence n'est pas une panne**, et se dit comme telle : une liste M3U ne
// porte aucune bande-annonce, et c'est le cas de la plupart des installations.
// Un message calme vaut mieux qu'un bouton qui ne fait rien.

interface Reponse {
  readonly disponible: boolean
  readonly video?: string
  readonly raison?: string
}

export function BandeAnnonce({ id }: { id: string }) {
  const [etat, setEtat] = useState<'repos' | 'cherche' | 'trouve' | 'aucune'>('repos')
  const [video, setVideo] = useState<string | undefined>(undefined)
  const [raison, setRaison] = useState<string | undefined>(undefined)
  const [joue, setJoue] = useState(false)

  const chercher = async (): Promise<void> => {
    setEtat('cherche')
    try {
      const reponse = await fetch(`/api/bande-annonce?id=${encodeURIComponent(id)}`)
      const donnees = (await reponse.json()) as Reponse
      if (donnees.disponible && donnees.video !== undefined) {
        setVideo(donnees.video)
        setEtat('trouve')
      } else {
        setRaison(donnees.raison)
        setEtat('aucune')
      }
    } catch {
      setRaison('La recherche n’a pas abouti.')
      setEtat('aucune')
    }
  }

  if (etat === 'aucune') {
    return <p className="mt-3 text-sm text-doux">{raison ?? 'Aucune bande-annonce.'}</p>
  }

  if (etat === 'trouve' && video !== undefined) {
    return joue ? (
      <div className="mt-3 aspect-video overflow-hidden rounded-carte border border-bord">
        <iframe
          // `youtube-nocookie` n'écrit rien tant que rien n'est lancé, et
          // l'`allow` est réduit au strict nécessaire : une intégration par
          // défaut réclame l'accélération, la géolocalisation et le paiement.
          src={`https://www.youtube-nocookie.com/embed/${video}?rel=0&modestbranding=1&autoplay=1`}
          title="Bande-annonce"
          allow="autoplay; encrypted-media; fullscreen"
          referrerPolicy="no-referrer"
          className="h-full w-full"
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => {
          setJoue(true)
        }}
        className="mt-3 min-h-[44px] w-full rounded-lg border border-accent bg-accent-sombre px-4 text-sm"
      >
        ▷ Lancer la bande-annonce
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void chercher()}
      disabled={etat === 'cherche'}
      className="mt-3 min-h-[44px] w-full rounded-lg border border-bord px-4 text-sm disabled:text-doux"
    >
      {etat === 'cherche' ? 'Recherche…' : 'Chercher la bande-annonce'}
    </button>
  )
}
