'use client'

import { useState } from 'react'

// L'affiche et le résumé TMDB d'une fiche, chargés sur un geste et jamais avant.
//
// Même règle que pour la bande-annonce et les sous-titres externes, et pour la
// même raison : un chargement posé dès l'ouverture de la fiche dirait à un
// tiers ce que la personne s'apprête à regarder, à chaque film ou série
// ouverts.
//
// **Ce n'est pas la jaquette de `composants/Affiche.tsx`.** Celle-là vient du
// fournisseur IPTV et couvre déjà les grilles du catalogue ; celle-ci vient de
// TMDB et ne s'affiche que sur la fiche, à la demande — les deux peuvent
// coexister sans se remplacer.
//
// **L'absence n'est pas une panne**, et se dit comme telle : sans clé TMDB, ou
// si le service ne connaît rien sous ce titre, un message calme vaut mieux
// qu'un cadre vide qui laisse deviner une erreur.

interface Reponse {
  readonly disponible: boolean
  readonly url?: string
  readonly resume?: string
  readonly raison?: string
}

export function AfficheTmdb({ id }: { id: string }) {
  const [etat, setEtat] = useState<'repos' | 'cherche' | 'trouvee' | 'aucune'>('repos')
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [resume, setResume] = useState<string | undefined>(undefined)
  const [raison, setRaison] = useState<string | undefined>(undefined)

  const chercher = async (): Promise<void> => {
    setEtat('cherche')
    try {
      const reponse = await fetch(`/api/affiche?id=${encodeURIComponent(id)}`)
      const donnees = (await reponse.json()) as Reponse
      if (donnees.disponible && (donnees.url !== undefined || donnees.resume !== undefined)) {
        setUrl(donnees.url)
        setResume(donnees.resume)
        setEtat('trouvee')
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
    return <p className="mt-3 text-sm text-doux">{raison ?? 'Aucune affiche trouvée pour ce titre.'}</p>
  }

  if (etat === 'trouvee') {
    return (
      <div className="mt-3 flex gap-4">
        {url !== undefined && (
          <img src={url} alt="" className="h-40 w-auto shrink-0 rounded-carte border border-bord" />
        )}
        {resume !== undefined && <p className="text-sm">{resume}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void chercher()}
      disabled={etat === 'cherche'}
      className="mt-3 min-h-[44px] rounded-lg border border-bord px-4 text-sm disabled:text-doux"
    >
      {etat === 'cherche' ? 'Recherche…' : 'Voir l’affiche'}
    </button>
  )
}
