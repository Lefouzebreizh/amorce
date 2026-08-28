// Lire une valeur dont on ne contrôle pas le type.
//
// Deux frontières en ont besoin, et pour la même raison : ni le panneau Xtream
// ni SQLite ne garantissent le type de ce qu'ils rendent. Le premier rend
// `stream_id` en nombre pour le direct et en chaîne pour la vidéo à la demande ;
// la seconde rend `NULL` pour toute colonne absente et des entiers là où on
// avait écrit des booléens.
//
// Ces deux fonctions vivaient dans le client Xtream, où elles n'avaient rien à
// faire de particulier : elles ne parlent d'aucun protocole.

/** Rend `undefined` plutôt qu'une chaîne vide — un titre vide n'est pas un titre. */
export function texte(valeur: unknown): string | undefined {
  if (typeof valeur === 'string') return valeur.trim() === '' ? undefined : valeur
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return String(valeur)
  return undefined
}

export function entier(valeur: unknown): number | undefined {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? Math.trunc(valeur) : undefined
  if (typeof valeur === 'string') {
    const n = Number.parseInt(valeur.trim(), 10)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

export function reel(valeur: unknown): number | undefined {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : undefined
  if (typeof valeur === 'string') {
    const n = Number.parseFloat(valeur.trim())
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}
