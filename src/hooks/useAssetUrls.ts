import { useEffect, useRef, useState } from 'react'
import type { MediaAsset } from '../types'

/**
 * Maintient une URL d'objet par média importé, créée une seule fois et révoquée
 * dès que le média disparaît du projet.
 */
export function useAssetUrls(assets: Record<string, MediaAsset>): Record<string, string> {
  const cache = useRef<Record<string, string>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let changed = false
    const next = { ...cache.current }

    for (const [id, asset] of Object.entries(assets)) {
      if (!next[id]) {
        next[id] = URL.createObjectURL(asset.blob)
        changed = true
      }
    }
    for (const id of Object.keys(next)) {
      if (!assets[id]) {
        URL.revokeObjectURL(next[id])
        delete next[id]
        changed = true
      }
    }

    if (changed) {
      cache.current = next
      setUrls(next)
    }
  }, [assets])

  useEffect(
    () => () => {
      for (const url of Object.values(cache.current)) URL.revokeObjectURL(url)
      cache.current = {}
    },
    [],
  )

  return urls
}
