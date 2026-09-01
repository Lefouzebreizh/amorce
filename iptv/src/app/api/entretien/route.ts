// Les gestes d'entretien, depuis l'interface plutôt que depuis un terminal.
//
// **Pourquoi cette route existe.** Ranger le catalogue, éprouver les flux et
// remettre en jeu ce qui avait été masqué se faisaient uniquement en ligne de
// commande. C'est acceptable pour qui développe, et pas pour qui a installé
// l'application un soir : chaque entretien demandait de retrouver un terminal,
// le bon dossier, et la bonne incantation.
//
// **Elle ne décide rien.** Toute la logique vit dans `entretien/taches.ts`,
// partagée avec `cli.ts` — la route ne fait que la déclencher et rendre des
// nombres. C'est ce qui garantit que les deux chemins ne divergeront pas.
//
// **Le test avance par lots, et l'appelant rappelle.** Éprouver deux cents flux
// prend plusieurs minutes ; une requête HTTP qui dure aussi longtemps est
// coupée par le navigateur ou abandonnée par l'utilisateur, qui croit à un
// blocage. Chaque appel traite un petit lot et rend **ce qu'il reste** :
// l'avancement se voit, rien n'est gardé en mémoire côté serveur, et fermer
// l'onglet en cours de route ne laisse aucun travail à moitié fait.
//
// **POST et non GET, pour les trois tâches.** Elles écrivent en base. Un GET
// serait rejoué par un préchargement de navigateur ou un aspirateur de liens,
// et le catalogue se ferait retester sans que personne l'ait demandé.

import { texte } from '../../../domaine/valeurs.ts'
import {
  choisirCandidats,
  ranimerFlux,
  rangerCatalogue,
  testerCatalogue,
} from '../../../entretien/taches.ts'
import { depot } from '../../../serveur/depot-partage.ts'

export const dynamic = 'force-dynamic'

/**
 * Taille d'un lot de test, et son plafond.
 *
 * Vingt-cinq flux à huit secondes d'attente maximale, un seul test à la fois
 * par hôte : quelques dizaines de secondes au pire, ce qui tient largement dans
 * une requête. Le plafond empêche qu'un appel forgé demande le catalogue entier
 * et bloque le serveur pour tout le monde.
 */
const LOT = 25
const LOT_MAX = 100

export function GET(): Response {
  const cache = depot()
  const etats = cache.compterParEtat()
  return Response.json({
    total: cache.compter({ inclureMorts: true }),
    ...etats,
    aTester: choisirCandidats(cache).length,
    dernierImport: cache.dernierImport(),
  })
}

export async function POST(requete: Request): Promise<Response> {
  const corps: unknown = await requete.json().catch(() => ({}))
  const donnees = (typeof corps === 'object' && corps !== null ? corps : {}) as Record<
    string,
    unknown
  >
  const tache = texte(donnees['tache'])
  const cache = depot()

  if (tache === 'ranger') {
    return Response.json({ tache, ...rangerCatalogue(cache) })
  }

  if (tache === 'ranimer') {
    return Response.json({ tache, remis: ranimerFlux(cache) })
  }

  if (tache === 'tester') {
    const demande = Number(donnees['lot'])
    const lot = Number.isFinite(demande) && demande > 0 ? Math.min(demande, LOT_MAX) : LOT
    const candidats = choisirCandidats(cache, { lot })
    if (candidats.length === 0) {
      return Response.json({ tache, faits: 0, restants: 0, ok: 0, mort: 0, inconnu: 0 })
    }
    const bilan = await testerCatalogue(cache, candidats)
    return Response.json({
      tache,
      faits: candidats.length,
      // Recompté après coup, jamais déduit : les « inconnus » ne sont pas
      // marqués et reviendront donc dans le lot suivant. Une soustraction
      // ferait croire à un avancement qui n'a pas eu lieu.
      restants: choisirCandidats(cache).length,
      ...bilan,
    })
  }

  return Response.json({ erreur: 'Tâche inconnue.' }, { status: 400 })
}
