// Le relais de flux. Voir `src/serveur/flux.ts` pour la raison d'être et la
// raison de la signature.

import { depot } from '../../../serveur/depot-partage.ts'
import {
  entetesDepuisOptions,
  estManifeste,
  reecrireManifeste,
  signatureValide,
} from '../../../serveur/flux.ts'

/** Rien de tout cela ne se met en cache : ce sont des flux, souvent en direct. */
export const dynamic = 'force-dynamic'

interface Cible {
  readonly url: string
  readonly entetes: Record<string, string>
}

function resoudre(parametres: URLSearchParams): Cible | { erreur: string; code: number } {
  const idElement = parametres.get('e')
  if (idElement !== null) {
    const element = depot().element(idElement)
    if (element === undefined) return { erreur: 'Élément inconnu', code: 404 }
    return { url: element.url, entetes: entetesDepuisOptions(element.optionsLecture) }
  }

  const url = parametres.get('u')
  const signature = parametres.get('s')
  if (url === null || signature === null) {
    return { erreur: 'Il faut un élément (e) ou une adresse signée (u + s)', code: 400 }
  }
  if (!signatureValide(url, signature)) {
    // Refusé sans détail : dire *pourquoi* une signature est invalide aide qui
    // essaie d'en fabriquer une.
    return { erreur: 'Adresse refusée', code: 403 }
  }
  return { url, entetes: {} }
}

export async function GET(requete: Request): Promise<Response> {
  const parametres = new URL(requete.url).searchParams
  const cible = resoudre(parametres)
  if ('erreur' in cible) {
    return new Response(cible.erreur, { status: cible.code })
  }

  // La plage demandée est transmise telle quelle : sans elle, on ne peut pas se
  // déplacer dans un film — le navigateur retéléchargerait depuis le début à
  // chaque saut, et la barre de progression deviendrait décorative.
  const entetes = new Headers(cible.entetes)
  const plage = requete.headers.get('range')
  if (plage !== null) entetes.set('range', plage)

  let amont: Response
  try {
    amont = await fetch(cible.url, { headers: entetes, redirect: 'follow' })
  } catch {
    // Le message d'origine porte l'URL, donc les identifiants du fournisseur.
    return new Response('Flux injoignable', { status: 502 })
  }

  if (!amont.ok && amont.status !== 206) {
    return new Response(`Le fournisseur a répondu ${amont.status}`, { status: amont.status })
  }

  const typeContenu = amont.headers.get('content-type')

  if (estManifeste(cible.url, typeContenu)) {
    // Un manifeste tient en quelques kilooctets : le lire entièrement est ici
    // sans conséquence, contrairement à un segment vidéo.
    const texte = await amont.text()
    return new Response(reecrireManifeste(texte, amont.url), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.apple.mpegurl',
        'cache-control': 'no-store',
      },
    })
  }

  // Segments et fichiers : relayés **en flux**, sans jamais être tenus en
  // mémoire. Un film de 4 Go passerait sinon par le tas du serveur.
  const sortie = new Headers()
  for (const nom of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const valeur = amont.headers.get(nom)
    if (valeur !== null) sortie.set(nom, valeur)
  }
  sortie.set('cache-control', 'no-store')

  return new Response(amont.body, { status: amont.status, headers: sortie })
}
