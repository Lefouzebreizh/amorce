// Éprouver les flux, un par un, et retenir ceux qui répondent.
//
// **Pourquoi ce fichier existe.** Une liste publique de 215 chaînes en contient
// couramment la moitié de morte : serveur éteint, chaîne géobloquée, adresse
// changée depuis deux ans. Rien ne les distingue à l'œil d'une entrée valide —
// même titre propre, même logo, même groupe. L'utilisateur clique, attend dix
// secondes, tombe sur une erreur, recommence. C'est le défaut qui donne
// l'impression que l'application ne marche pas, alors que c'est la liste.
//
// **Pourquoi on ne peut pas se contenter d'un HEAD.** Beaucoup de serveurs de
// diffusion rendent 405 sur HEAD, ou 200 sur n'importe quoi. Un manifeste se
// vérifie par son contenu : les premiers octets doivent porter `#EXTM3U`. Un
// fichier se vérifie par un GET d'un octet — `Range: bytes=0-1` — qui coûte
// moins qu'un film.
//
// **Pourquoi le parallélisme est borné par hôte, et non globalement.** Un
// abonnement IPTV limite les connexions simultanées, souvent à une ou deux :
// ouvrir vingt flux du même serveur pour les tester déclenche « max connections
// reached » et fait passer pour morts des flux parfaitement vivants. Un hôte
// n'est donc sollicité que par un test à la fois par défaut, et le parallélisme
// se fait entre hôtes différents — ce qui est exactement le cas d'une liste
// publique, où chaque chaîne vit ailleurs.
//
// **Pourquoi « inconnu » existe à côté de « mort ».** Un refus qui parle de
// limite de connexions, un 429, une coupure réseau de notre côté ne disent rien
// du flux. Les compter pour morts effacerait de l'écran des chaînes qui
// marchent, et ce serait pire que le défaut qu'on répare : on ne masque que ce
// qu'on a vu refuser.

import type { Element } from '../domaine/types.ts'
import { entetesDepuisOptions } from '../serveur/flux.ts'

export type EtatFlux = 'ok' | 'mort' | 'inconnu'

export interface ResultatTest {
  readonly element: Element
  readonly etat: EtatFlux
  /** Ce qui a été constaté, en clair : « 404 », « manifeste vide », « délai dépassé ». */
  readonly raison: string
}

export interface OptionsTest {
  /** Délai au bout duquel on abandonne, en millisecondes. */
  readonly delaiMs?: number
  /** Tests menés de front, tous hôtes confondus. */
  readonly parallele?: number
  /** Tests menés de front **sur un même hôte**. Un au-delà d'un seul est un pari. */
  readonly parHote?: number
  readonly surResultat?: (resultat: ResultatTest, faits: number, total: number) => void
  readonly fetch?: typeof globalThis.fetch
}

const MANIFESTE = /\.m3u8?($|\?)/i

/** Les octets qu'on lit d'un manifeste avant de trancher. Un en-tête tient dans dix. */
const PREFIXE_MAX = 4096

/**
 * Les refus qui ne condamnent pas le flux.
 *
 * 401 et 403 sont ambigus : un abonnement saturé les rend, un flux mort aussi.
 * On penche du côté qui ne cache rien — au pire l'entrée reste affichée.
 */
const AMBIGU = new Set([401, 403, 408, 429, 456, 500, 502, 503, 504])

function hote(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Lit au plus `PREFIXE_MAX` octets, puis coupe : un direct ne se termine jamais. */
async function lirePrefixe(reponse: Response): Promise<string> {
  const corps = reponse.body
  if (corps === null) return ''
  const lecteur = corps.getReader()
  const morceaux: Uint8Array[] = []
  let taille = 0
  try {
    while (taille < PREFIXE_MAX) {
      const { done, value } = await lecteur.read()
      if (done) break
      if (value !== undefined) {
        morceaux.push(value)
        taille += value.length
      }
    }
  } finally {
    await lecteur.cancel().catch(() => undefined)
  }
  const total = new Uint8Array(taille)
  let position = 0
  for (const morceau of morceaux) {
    total.set(morceau, position)
    position += morceau.length
  }
  return new TextDecoder('utf-8').decode(total)
}

export async function testerElement(
  element: Element,
  options: OptionsTest = {},
): Promise<ResultatTest> {
  const delaiMs = options.delaiMs ?? 8000
  const appeler = options.fetch ?? globalThis.fetch
  const manifeste = MANIFESTE.test(element.url)
  const arret = new AbortController()
  const minuterie = setTimeout(() => {
    arret.abort()
  }, delaiMs)

  const rendre = (etat: EtatFlux, raison: string): ResultatTest => ({ element, etat, raison })

  try {
    const reponse = await appeler(element.url, {
      // GET et non HEAD : trop de serveurs de diffusion rendent 405 sur HEAD,
      // ou 200 sans jamais avoir cherché le flux.
      method: 'GET',
      redirect: 'follow',
      signal: arret.signal,
      headers: {
        'user-agent': 'VLC/3.0.20 LibVLC/3.0.20',
        accept: '*/*',
        // Sur un fichier, cela suffit à savoir qu'il existe sans le télécharger.
        // Un serveur qui ignore l'en-tête rend 200 et le flux entier — d'où la
        // lecture bornée puis l'annulation, juste en dessous.
        ...(manifeste ? {} : { range: 'bytes=0-1' }),
        ...entetesDepuisOptions(element.optionsLecture),
      },
    })

    if (!reponse.ok && reponse.status !== 206) {
      await reponse.body?.cancel().catch(() => undefined)
      return AMBIGU.has(reponse.status)
        ? rendre('inconnu', `refus ${String(reponse.status)}`)
        : rendre('mort', `${String(reponse.status)} ${reponse.statusText}`.trim())
    }

    if (!manifeste) {
      await reponse.body?.cancel().catch(() => undefined)
      // Un portail qui rend une page d'erreur en HTML avec un code 200 est le
      // piège classique : le code dit oui, le contenu n'est pas une vidéo.
      const type = reponse.headers.get('content-type') ?? ''
      if (/text\/html/i.test(type)) return rendre('mort', 'page HTML au lieu du média')
      return rendre('ok', `${String(reponse.status)} · ${type === '' ? 'sans type' : type}`)
    }

    const debut = (await lirePrefixe(reponse)).trimStart()
    if (debut === '') return rendre('mort', 'manifeste vide')
    if (!debut.startsWith('#EXTM3U')) {
      return rendre('mort', /^\s*</.test(debut) ? 'page HTML au lieu du flux' : 'manifeste illisible')
    }
    // Un manifeste maître ne liste que des variantes, un manifeste de média des
    // segments : les deux sont valides, mais l'un qui n'a ni l'un ni l'autre
    // est une carcasse — le serveur répond encore, la chaîne n'existe plus.
    if (!/#EXT-X-STREAM-INF|#EXTINF|#EXT-X-MEDIA/i.test(debut)) {
      return rendre('mort', 'manifeste sans piste')
    }
    return rendre('ok', 'manifeste valide')
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return rendre('mort', `pas de réponse en ${String(Math.round(delaiMs / 1000))} s`)
    }
    // Un DNS qui ne résout pas, une connexion refusée : le serveur n'est plus là.
    const message = cause instanceof Error ? cause.message : String(cause)
    return rendre('mort', message.slice(0, 80))
  } finally {
    clearTimeout(minuterie)
  }
}

export interface BilanTest {
  readonly ok: number
  readonly mort: number
  readonly inconnu: number
}

/**
 * Teste une liste d'éléments, en respectant la limite de connexions par hôte.
 *
 * Chaque hôte reçoit sa file ; les ouvriers se répartissent les files, et non
 * les éléments. Un fournisseur unique est donc traité en série — lentement,
 * mais sans se faire couper — pendant qu'une liste publique aux cinquante
 * domaines tourne à plein.
 */
export async function testerFlux(
  elements: readonly Element[],
  options: OptionsTest = {},
): Promise<{ bilan: BilanTest; resultats: ResultatTest[] }> {
  const parallele = Math.max(1, options.parallele ?? 12)
  const parHote = Math.max(1, options.parHote ?? 1)

  const files = new Map<string, Element[]>()
  for (const element of elements) {
    const cle = hote(element.url)
    const file = files.get(cle)
    if (file === undefined) files.set(cle, [element])
    else file.push(element)
  }

  // Un créneau par connexion autorisée : une file qui accepte trois tests de
  // front y figure trois fois, et se fait donc vider par trois ouvriers.
  const creneaux: Element[][] = []
  for (const file of files.values()) {
    for (let i = 0; i < Math.min(parHote, file.length); i += 1) creneaux.push(file)
  }

  const resultats: ResultatTest[] = []
  const bilan = { ok: 0, mort: 0, inconnu: 0 }
  let prochainCreneau = 0
  let faits = 0

  const travailler = async (): Promise<void> => {
    for (;;) {
      const creneau = creneaux[prochainCreneau]
      prochainCreneau += 1
      if (creneau === undefined) return
      for (;;) {
        const element = creneau.shift()
        if (element === undefined) break
        const resultat = await testerElement(element, options)
        resultats.push(resultat)
        bilan[resultat.etat] += 1
        faits += 1
        options.surResultat?.(resultat, faits, elements.length)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(parallele, creneaux.length) }, () => travailler()),
  )
  return { bilan, resultats }
}
