// Rassembler le guide des chaînes affichées, en une requête.
//
// Le piège qu'on évite ici est le classique « N+1 » : demander son programme à
// chaque chaîne, une par une, fait deux cents allers-retours sur une grille de
// deux cents chaînes. Le dépôt sait répondre pour une liste d'identifiants ;
// encore faut-il la lui donner entière.

import type { Antenne, Depot } from '../cache/depot.ts'
import type { Element } from '../domaine/types.ts'

export function antennesDe(
  depot: Depot,
  elements: readonly Element[],
): ReadonlyMap<string, Antenne> {
  const identifiants = [
    ...new Set(
      elements
        .filter((element) => element.genre === 'direct')
        .map((element) => element.tvgId)
        .filter((tvgId): tvgId is string => tvgId !== undefined),
    ),
  ]
  return depot.maintenant(identifiants)
}
