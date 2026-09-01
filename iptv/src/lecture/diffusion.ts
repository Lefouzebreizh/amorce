// Envoyer la lecture sur une télévision.
//
// **Ce qu'il faut avoir compris avant de lire le code**, parce que tout en
// découle : un Chromecast ne reçoit pas l'image du téléphone. Le téléphone lui
// donne une **adresse**, et l'appareil va chercher le flux lui-même. Trois
// conséquences, et chacune casse le cast si on l'ignore.
//
// 1. **L'adresse doit être absolue et joignable depuis le salon.**
//    `/api/flux?e=…` ne veut rien dire pour une télé, et `http://localhost:3000`
//    désigne la télé elle-même. Il faut l'adresse de la machine sur le réseau
//    local — celle-là même par laquelle le téléphone est arrivé.
//
// 2. **Ce que le navigateur fabrique ne se diffuse pas.** hls.js assemble la
//    vidéo dans la page par Media Source Extensions ; ce flux-là n'existe que
//    dans l'onglet et n'a pas d'adresse. Diffuser oblige donc à repasser sur la
//    source directe — un Chromecast lit le HLS nativement, il n'a pas besoin de
//    la bibliothèque.
//
// 3. **L'API n'existe pas partout.** `RemotePlayback` réclame un contexte
//    sécurisé : elle est là sur `http://localhost`, souvent absente sur
//    `http://192.168.x.x`. Plutôt que de deviner la règle, on interroge l'objet
//    et on n'affiche le bouton que s'il répond — et on dit quoi faire sinon.

export interface MoyensDiffusion {
  /** L'API Remote Playback est exposée (Chrome, Edge, Android). */
  readonly distant: boolean
  /** Le sélecteur AirPlay de Safari. */
  readonly airplay: boolean
}

interface VideoDiffusable {
  remote?: { watchAvailability?: unknown; prompt?: unknown } | undefined
  webkitShowPlaybackTargetPicker?: unknown
}

export function moyensDiffusion(video: unknown): MoyensDiffusion {
  const element = (video ?? {}) as VideoDiffusable
  return {
    distant:
      typeof element.remote?.prompt === 'function' &&
      typeof element.remote?.watchAvailability === 'function',
    airplay: typeof element.webkitShowPlaybackTargetPicker === 'function',
  }
}

/**
 * L'adresse telle qu'un appareil du salon peut la joindre.
 *
 * Elle se calcule depuis l'adresse **de la page** : si le téléphone est arrivé
 * par `http://192.168.1.20:3000`, c'est exactement ce que la télé doit
 * utiliser. Rien à configurer, et aucune adresse à deviner côté serveur — ce
 * qui serait faux dès qu'une machine a deux cartes réseau.
 */
export function adresseAbsolue(src: string, base: string): string {
  try {
    return new URL(src, base).toString()
  } catch {
    return src
  }
}

const LOCALES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

/**
 * Vrai si l'adresse de la page peut être atteinte par un autre appareil.
 *
 * `localhost` sur le téléphone désigne le téléphone ; donné à un Chromecast, il
 * désigne le Chromecast. La lecture échoue alors sans message utile — l'appareil
 * affiche un écran noir et rend la main. Mieux vaut le dire avant.
 */
export function joignableParUnAutreAppareil(base: string): boolean {
  try {
    // `URL.hostname` garde les crochets d'une adresse IPv6 : « [::1] », jamais
    // « ::1 ». Comparer sans les retirer laisse passer l'adresse locale la plus
    // courante des serveurs de développement.
    const hote = new URL(base).hostname.replace(/^\[|\]$/g, '')
    return !LOCALES.has(hote) && !hote.endsWith('.local')
  } catch {
    return false
  }
}

/** Le conseil à afficher quand la diffusion ne peut pas marcher, et pourquoi. */
export function obstacleDiffusion(base: string, moyens: MoyensDiffusion): string | undefined {
  if (!joignableParUnAutreAppareil(base)) {
    return (
      'Ouvrez l’application par l’adresse réseau de la machine (par exemple ' +
      'http://192.168.1.20:3000) plutôt que par localhost : la télévision va ' +
      'chercher le flux elle-même, et « localhost » la désignerait elle.'
    )
  }
  if (!moyens.distant && !moyens.airplay) {
    return (
      'Ce navigateur n’expose pas la diffusion. Chrome et Edge la proposent, ' +
      'et Safari propose AirPlay ; certains la réservent aux pages en HTTPS.'
    )
  }
  return undefined
}
