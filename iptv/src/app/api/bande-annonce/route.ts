// La bande-annonce d'un film, demandée sur un geste.
//
// Route séparée et non donnée jointe à la fiche : l'obtenir coûte un appel au
// panneau **par film**, et la charger avec la page la rendrait obligatoire pour
// tout le monde, y compris pour qui vient seulement lancer la lecture.
//
// Elle rend un identifiant, jamais une intégration : la page décide de charger
// YouTube ou non, et ne le fait qu'après un clic. Une intégration posée
// d'office dirait à un tiers ce que la personne regarde, à chaque ouverture de
// fiche — la même règle que pour la recherche de sous-titres.

import { texte } from '../../../domaine/valeurs.ts'
import { creerClientXtream } from '../../../ingestion/xtream.ts'
import { identifiantBandeAnnonce } from '../../../lecture/bande-annonce.ts'
import { depot } from '../../../serveur/depot-partage.ts'
import { identifiantsXtream } from '../../../serveur/reglages.ts'

export const dynamic = 'force-dynamic'

export async function GET(requete: Request): Promise<Response> {
  const id = texte(new URL(requete.url).searchParams.get('id'))
  if (id === undefined) return Response.json({ disponible: false }, { status: 400 })

  const element = depot().element(id)
  if (element === undefined || element.genre !== 'film') {
    return Response.json({ disponible: false, raison: 'Ce n’est pas un film du catalogue.' })
  }

  const identifiants = identifiantsXtream()
  if (identifiants === undefined || element.refExterne === undefined) {
    // 200 et non 404 : l'absence de panneau n'est pas une panne, c'est une
    // source qui ne porte pas cette information. L'interface doit pouvoir le
    // dire calmement plutôt que d'afficher une erreur.
    return Response.json({
      disponible: false,
      raison:
        'Les bandes-annonces viennent du panneau de votre abonnement. Une liste M3U n’en fournit aucune.',
    })
  }

  try {
    const client = creerClientXtream(identifiants)
    const infos = await client.infosFilm(element.refExterne)
    const video = identifiantBandeAnnonce(infos)
    return video === undefined
      ? Response.json({ disponible: false, raison: 'Aucune bande-annonce pour ce film.' })
      : Response.json({ disponible: true, video })
  } catch {
    // Le message d'erreur d'un client Xtream porte l'adresse du panneau : il ne
    // sort pas d'ici. `masquerIdentifiants` le nettoie déjà, mais une
    // bande-annonce ne vaut pas le risque d'une fuite par un chemin nouveau.
    return Response.json({ disponible: false, raison: 'Le panneau n’a pas répondu.' })
  }
}
