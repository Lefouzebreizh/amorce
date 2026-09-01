// Client Xtream Codes.
//
// **Ce que cette API est, et ce qu'elle n'est pas.** Xtream Codes n'a pas de
// spécification publiée : c'est un panneau propriétaire dont l'interface s'est
// figée par imitation. Il n'existe donc pas de document officiel à opposer à un
// panneau qui répond autrement, et `/api-tierce-verifiee` ne peut pas
// s'appliquer ici comme sur une bibliothèque qu'on installe. La parade est
// écrite dans le code plutôt que dans un contrat :
//
// - **Aucun champ n'est supposé présent.** Tout est lu au travers de `texte()`
//   et `entier()`, qui rendent `undefined` plutôt que de lever.
// - **Aucun type n'est supposé.** Le même panneau rend `stream_id` en nombre
//   pour le direct et en chaîne pour la vidéo à la demande, selon sa version.
// - **La réponse n'est pas supposée être du JSON.** Un panneau saturé rend une
//   page HTML avec un code 200 ; `JSON.parse` lèverait une `SyntaxError` sans
//   rapport avec la cause réelle, et c'est le genre d'erreur qui coûte une
//   heure. On la traduit ici.
//
// **Le mot de passe voyage dans l'URL**, c'est le protocole qui le veut. D'où
// `masquerIdentifiants`, appliqué à tout message d'erreur : sans lui, le
// premier flux serveur venu conserve les identifiants du fournisseur en clair.

import { entier, texte } from '../domaine/valeurs.ts'

export interface IdentifiantsXtream {
  /** `http://hote:port`, avec ou sans schéma, avec ou sans chemin superflu. */
  readonly serveur: string
  readonly utilisateur: string
  readonly motDePasse: string
}

export interface OptionsXtream {
  /** Injecté pour les tests : aucun appel réseau n'est fait sans le fournir en vrai. */
  readonly fetch?: typeof globalThis.fetch
  readonly delaiMs?: number
  /**
   * Certains panneaux refusent un agent inconnu et rendent 403. Le défaut est
   * neutre et honnête ; le jour où un fournisseur l'exige, c'est ici qu'on pose
   * l'agent qu'il attend, sans toucher au reste.
   */
  readonly agent?: string
}

export type TypeXtream = 'live' | 'vod' | 'series'

export type BrutXtream = Readonly<Record<string, unknown>>

export interface CompteXtream {
  readonly actif: boolean
  readonly statut: string | undefined
  readonly expiration: Date | undefined
  readonly connexionsMax: number | undefined
  readonly connexionsActives: number | undefined
}

export class ErreurXtream extends Error {
  statut: number | undefined
  constructor(message: string, statut?: number) {
    super(message)
    this.name = 'ErreurXtream'
    this.statut = statut
  }
}

const DELAI_DEFAUT = 15_000

/**
 * Ramène une adresse de serveur à sa base.
 *
 * Ce que les fournisseurs envoient par courriel prend toutes les formes :
 * `http://hote:8080`, `hote:8080`, `http://hote:8080/c/`, ou directement le
 * `get.php?...` de la liste. Les quatre désignent la même base, et laisser
 * traîner `/c/` fait répondre 404 à chaque appel.
 */
export function normaliserServeur(brut: string): string {
  // Nommée `saisie` et non `texte` : `texte` est désormais la fonction de
  // lecture tolérante importée plus haut, et l'ombrer se relit très mal.
  const saisie = brut.trim()
  if (saisie === '') throw new ErreurXtream('Adresse de serveur vide')
  const avecSchema = /^https?:\/\//i.test(saisie) ? saisie : `http://${saisie}`
  let adresse: URL
  try {
    adresse = new URL(avecSchema)
  } catch {
    throw new ErreurXtream(`Adresse de serveur illisible : ${saisie}`)
  }
  const chemin = adresse.pathname
    .replace(/\/(player_api\.php|panel_api\.php|get\.php|xmltv\.php|c)\/?$/i, '')
    .replace(/\/+$/, '')
  return `${adresse.origin}${chemin}`
}

/** Remplace le mot de passe partout où il apparaît — paramètre ou segment de chemin. */
export function masquerIdentifiants(url: string, motDePasse: string): string {
  let masque = url.replace(/([?&](?:password|pass)=)[^&]*/gi, '$1***')
  if (motDePasse !== '') {
    for (const forme of new Set([motDePasse, encodeURIComponent(motDePasse)])) {
      masque = masque.split(forme).join('***')
    }
  }
  return masque
}

export interface ClientXtream {
  readonly base: string
  verifierCompte(): Promise<CompteXtream>
  categories(type: TypeXtream): Promise<BrutXtream[]>
  fluxDirects(categorie?: string): Promise<BrutXtream[]>
  films(categorie?: string): Promise<BrutXtream[]>
  series(categorie?: string): Promise<BrutXtream[]>
  infosSerie(idSerie: string | number): Promise<BrutXtream>
  infosFilm(idFilm: string | number): Promise<BrutXtream>
  urlDirect(id: string | number, extension?: string): string
  urlFilm(id: string | number, extension?: string): string
  urlEpisode(id: string | number, extension?: string): string
  /** Le guide des programmes complet, au format XMLTV. */
  urlXmltv(): string
}

export function creerClientXtream(
  identifiants: IdentifiantsXtream,
  options: OptionsXtream = {},
): ClientXtream {
  const base = normaliserServeur(identifiants.serveur)
  const { utilisateur, motDePasse } = identifiants
  const appeler = options.fetch ?? globalThis.fetch
  const delai = options.delaiMs ?? DELAI_DEFAUT
  const agent = options.agent ?? 'AmorceIPTV/0.1'

  const masquer = (url: string): string => masquerIdentifiants(url, motDePasse)

  const adresseApi = (parametres: Record<string, string>): string => {
    const url = new URL(`${base}/player_api.php`)
    url.searchParams.set('username', utilisateur)
    url.searchParams.set('password', motDePasse)
    for (const [cle, valeur] of Object.entries(parametres)) url.searchParams.set(cle, valeur)
    return url.toString()
  }

  const interroger = async (parametres: Record<string, string>): Promise<unknown> => {
    if (typeof appeler !== 'function') {
      throw new ErreurXtream("Aucune implémentation de fetch disponible dans cet environnement")
    }
    const url = adresseApi(parametres)
    let reponse: Response
    try {
      reponse = await appeler(url, {
        headers: { 'user-agent': agent, accept: 'application/json' },
        signal: AbortSignal.timeout(delai),
      })
    } catch (cause) {
      // Le message d'origine contient parfois l'URL, donc le mot de passe.
      const raison = cause instanceof Error ? cause.message : String(cause)
      throw new ErreurXtream(`Serveur injoignable (${masquer(raison)}) — ${masquer(url)}`)
    }
    if (!reponse.ok) {
      throw new ErreurXtream(
        `Le serveur a répondu ${reponse.status} sur ${masquer(url)}`,
        reponse.status,
      )
    }
    const corps = await reponse.text()
    try {
      return JSON.parse(corps) as unknown
    } catch {
      // Le cas courant : une page d'erreur ou un portail captif servi en 200.
      const extrait = corps.slice(0, 120).replace(/\s+/g, ' ').trim()
      throw new ErreurXtream(
        `Réponse non JSON du panneau (« ${extrait} ») sur ${masquer(url)}`,
        reponse.status,
      )
    }
  }

  /** Une action de liste rend toujours un tableau — sauf quand le panneau rend `false`. */
  const liste = async (action: string, extra: Record<string, string>): Promise<BrutXtream[]> => {
    const donnees = await interroger({ action, ...extra })
    if (!Array.isArray(donnees)) return []
    return donnees.filter(
      (element): element is BrutXtream => typeof element === 'object' && element !== null,
    )
  }

  const flux = (dossier: string, id: string | number, extension: string): string =>
    `${base}/${dossier}/${encodeURIComponent(utilisateur)}/${encodeURIComponent(motDePasse)}/${encodeURIComponent(String(id))}.${extension}`

  return {
    base,

    async verifierCompte(): Promise<CompteXtream> {
      const donnees = await interroger({})
      const racine = (typeof donnees === 'object' && donnees !== null ? donnees : {}) as Record<
        string,
        unknown
      >
      const infos = (
        typeof racine['user_info'] === 'object' && racine['user_info'] !== null
          ? racine['user_info']
          : {}
      ) as Record<string, unknown>

      // `auth` vaut 1 ou 0, en nombre ou en chaîne selon le panneau ; un
      // `status` « Expired » ou « Banned » accompagne parfois un `auth` à 1.
      const auth = entier(infos['auth'])
      const statut = texte(infos['status'])
      const actif = auth !== 0 && (statut === undefined || /active/i.test(statut))
      const expirationBrute = entier(infos['exp_date'])

      return {
        actif,
        statut,
        // `exp_date` est un horodatage Unix en secondes ; absent ou nul pour un
        // abonnement sans échéance.
        expiration:
          expirationBrute === undefined || expirationBrute <= 0
            ? undefined
            : new Date(expirationBrute * 1000),
        connexionsMax: entier(infos['max_connections']),
        connexionsActives: entier(infos['active_cons']),
      }
    },

    categories(type: TypeXtream): Promise<BrutXtream[]> {
      const action =
        type === 'live'
          ? 'get_live_categories'
          : type === 'vod'
            ? 'get_vod_categories'
            : 'get_series_categories'
      return liste(action, {})
    },

    fluxDirects(categorie?: string): Promise<BrutXtream[]> {
      return liste('get_live_streams', categorie === undefined ? {} : { category_id: categorie })
    },

    films(categorie?: string): Promise<BrutXtream[]> {
      return liste('get_vod_streams', categorie === undefined ? {} : { category_id: categorie })
    },

    series(categorie?: string): Promise<BrutXtream[]> {
      return liste('get_series', categorie === undefined ? {} : { category_id: categorie })
    },

    async infosSerie(idSerie: string | number): Promise<BrutXtream> {
      const donnees = await interroger({ action: 'get_series_info', series_id: String(idSerie) })
      return typeof donnees === 'object' && donnees !== null ? (donnees as BrutXtream) : {}
    },

    async infosFilm(idFilm: string | number): Promise<BrutXtream> {
      const donnees = await interroger({ action: 'get_vod_info', vod_id: String(idFilm) })
      return typeof donnees === 'object' && donnees !== null ? (donnees as BrutXtream) : {}
    },

    // Le direct se demande en `.m3u8` : c'est le seul conteneur que HLS.js sait
    // lire dans un navigateur. Le `.ts` que servent les panneaux par défaut
    // demanderait un transcodage côté serveur.
    urlDirect(id: string | number, extension = 'm3u8'): string {
      return flux('live', id, extension)
    },

    // La vidéo à la demande, elle, garde son conteneur d'origine : `container_extension`
    // est rendu par le panneau, et demander un `.m3u8` sur un `.mkv` rend 404.
    urlFilm(id: string | number, extension = 'mp4'): string {
      return flux('movie', id, extension)
    },

    urlEpisode(id: string | number, extension = 'mp4'): string {
      return flux('series', id, extension)
    },

    urlXmltv(): string {
      const url = new URL(`${base}/xmltv.php`)
      url.searchParams.set('username', utilisateur)
      url.searchParams.set('password', motDePasse)
      return url.toString()
    },
  }
}
