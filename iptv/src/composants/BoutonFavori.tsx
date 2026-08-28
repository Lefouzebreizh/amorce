'use client'

import { useState } from 'react'

export function BoutonFavori({ id, initial }: { id: string; initial: boolean }) {
  const [favori, setFavori] = useState(initial)
  const [envoi, setEnvoi] = useState(false)

  const basculer = async (): Promise<void> => {
    setEnvoi(true)
    // L'affichage suit la réponse du serveur, pas l'intention : marquer tout de
    // suite puis échouer laisserait un cœur plein pour un favori qui n'existe
    // pas, et l'écart ne se verrait qu'au prochain chargement.
    try {
      const reponse = await fetch('/api/favori', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (reponse.ok) {
        const donnees = (await reponse.json()) as { favori?: unknown }
        setFavori(donnees.favori === true)
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void basculer()}
      disabled={envoi}
      aria-pressed={favori}
      className={`rounded-lg border px-4 py-2 ${
        favori ? 'border-accent bg-accent-sombre' : 'border-bord text-doux hover:text-texte'
      }`}
    >
      <span aria-hidden>{favori ? '★' : '☆'}</span> {favori ? 'Dans les favoris' : 'Ajouter aux favoris'}
    </button>
  )
}
