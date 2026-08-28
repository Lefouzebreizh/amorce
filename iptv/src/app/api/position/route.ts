import { depot } from '../../../serveur/depot-partage.ts'
import { reel, texte } from '../../../domaine/valeurs.ts'

export const dynamic = 'force-dynamic'

/**
 * Retient où en est une lecture.
 *
 * Appelée toutes les dix secondes, et une dernière fois par `sendBeacon` quand
 * l'onglet se ferme. Elle ne rend donc rien d'utile et doit surtout ne jamais
 * lever : une erreur ici passerait inaperçue côté client et ferait perdre la
 * position sans que personne ne le sache.
 */
export async function POST(requete: Request): Promise<Response> {
  let charge: unknown
  try {
    charge = await requete.json()
  } catch {
    return new Response('Corps illisible', { status: 400 })
  }

  const donnees = (typeof charge === 'object' && charge !== null ? charge : {}) as Record<
    string,
    unknown
  >
  const id = texte(donnees['id'])
  const position = reel(donnees['position'])
  if (id === undefined || position === undefined) {
    return new Response('Il faut un identifiant et une position', { status: 400 })
  }

  const duree = reel(donnees['duree'])
  depot().enregistrerPosition(id, position, duree)
  return new Response(null, { status: 204 })
}
