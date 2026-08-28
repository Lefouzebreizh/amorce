// L'accès au cache depuis l'application, et une seule ouverture pour tous.
//
// `node:sqlite` ouvre un fichier ; le rouvrir à chaque requête coûterait un
// descripteur et une relecture du schéma pour rien. Mais en développement, Next
// recharge les modules à chaque sauvegarde : une variable de module serait
// réinitialisée sans que la précédente soit fermée, et les descripteurs
// fuiraient jusqu'à la limite du système. D'où le passage par `globalThis`, qui
// survit au rechargement — c'est la parade habituelle, et elle a une raison.

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { ouvrirDepot, type Depot } from '../cache/depot.ts'

const CLE = Symbol.for('iptv.depot')

interface Portee {
  [CLE]?: Depot
}

/** Le chemin du cache. Modifiable pour servir plusieurs abonnements. */
export function cheminBase(): string {
  return process.env['IPTV_BASE'] ?? 'donnees/iptv.db'
}

export function depot(): Depot {
  const portee = globalThis as unknown as Portee
  const existant = portee[CLE]
  if (existant !== undefined) return existant
  const chemin = cheminBase()
  // SQLite ne crée pas les dossiers manquants : sur une installation neuve,
  // l'ouverture échoue par « unable to open database file », un message qui ne
  // dit pas que c'est le dossier qui manque.
  mkdirSync(dirname(chemin), { recursive: true })
  const ouvert = ouvrirDepot(chemin)
  portee[CLE] = ouvert
  return ouvert
}

/** Vrai tant que rien n'a été importé : l'interface le dit au lieu d'un écran vide. */
export function catalogueVide(): boolean {
  return depot().compter() === 0
}
