// Le client Xtream de l'application, construit depuis `.env`.
//
// Il n'est pas mis en cache dans un objet global, contrairement au dépôt : un
// client ne tient aucune ressource — pas de connexion ouverte, pas de
// descripteur — et le reconstruire coûte la lecture de trois variables. Le
// garder obligerait en revanche à le jeter quand les identifiants changent,
// c'est-à-dire à écrire un invalidateur pour économiser trois microsecondes.

import { creerClientXtream, type ClientXtream } from '../ingestion/xtream.ts'
import { identifiantsXtream } from './reglages.ts'

export interface PanneauXtream {
  readonly client: ClientXtream
  readonly utilisateur: string
}

/** Rend `undefined` quand aucun panneau n'est réglé : ce n'est pas une panne. */
export function panneauXtream(): PanneauXtream | undefined {
  const identifiants = identifiantsXtream()
  if (identifiants === undefined) return undefined
  try {
    return {
      client: creerClientXtream(identifiants),
      utilisateur: identifiants.utilisateur,
    }
  } catch {
    // Adresse de serveur illisible : l'application doit continuer de servir le
    // catalogue déjà importé plutôt que de tomber sur une faute de frappe.
    return undefined
  }
}
