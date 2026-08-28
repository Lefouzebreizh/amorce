import { depot } from '../../../serveur/depot-partage.ts'
import { texte } from '../../../domaine/valeurs.ts'

export const dynamic = 'force-dynamic'

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
  if (id === undefined) return new Response('Il faut un identifiant', { status: 400 })

  return Response.json({ favori: depot().basculerFavori(id) })
}
