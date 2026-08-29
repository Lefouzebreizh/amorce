// Chercher un sous-titre ailleurs, quand le flux n'en porte pas.
//
// **Ce qui sort de la machine, et rien d'autre.** Une recherche envoie un
// titre, une année, un numéro de saison et d'épisode. Jamais l'adresse de la
// liste, jamais les identifiants du fournisseur IPTV, jamais l'URL du flux —
// qui les porte en clair. C'est la seule fonction du projet qui parle à un
// service tiers, et c'est pour cela qu'elle est écrite ici, seule, plutôt que
// glissée dans le lecteur.
//
// **Et elle ne part jamais toute seule.** La recherche se déclenche sur un
// geste, pas à l'ouverture d'une vidéo : une requête automatique dirait à un
// tiers ce que la personne regarde, à chaque lecture. Un sous-titre vaut moins
// que cela.
//
// **Sans clé, la fonctionnalité s'absente au lieu d'échouer.** Aucun écran ne
// casse, aucune erreur ne remonte : la liste des pistes externes est vide et
// l'interface dit quelle clé poser. C'est la règle de `/dependance-indisponible`
// appliquée telle quelle.

export interface DemandeSousTitre {
  readonly titre: string
  readonly annee?: number | undefined
  readonly serie?: string | undefined
  readonly saison?: number | undefined
  readonly episode?: number | undefined
  /** Codes ISO 639-1, par ordre de préférence. */
  readonly langues: readonly string[]
}

export interface PisteExterne {
  readonly id: string
  readonly fournisseur: string
  readonly langue: string
  readonly nom: string
  readonly note: number | undefined
}

export interface Fournisseur {
  readonly nom: string
  chercher(demande: DemandeSousTitre): Promise<PisteExterne[]>
  telecharger(id: string): Promise<Uint8Array | undefined>
}

export interface ReglagesSousTitres {
  readonly openSubtitlesKey?: string | undefined
  readonly fetch?: typeof globalThis.fetch
  readonly delaiMs?: number
}

const DELAI_DEFAUT = 12_000

function nombre(valeur: unknown): number | undefined {
  const n = typeof valeur === 'string' ? Number.parseFloat(valeur) : valeur
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function chaine(valeur: unknown): string | undefined {
  if (typeof valeur === 'string' && valeur.trim() !== '') return valeur
  if (typeof valeur === 'number') return String(valeur)
  return undefined
}

/**
 * OpenSubtitles, API REST v1.
 *
 * **Ce qui n'est pas vérifié ici, et il faut le dire :** aucun appel réel n'a
 * été fait, faute de clé. Les tests injectent `fetch` et décrivent la forme
 * documentée de l'API. Le premier branchement avec une vraie clé est le seul
 * moment où l'on saura si un champ a bougé — c'est le même aveu que pour
 * Xtream, et la même parade : rien n'est supposé présent, rien n'est supposé
 * typé, et une réponse qui n'est pas du JSON ne fait pas tomber la page.
 */
export function openSubtitles(cle: string, reglages: ReglagesSousTitres = {}): Fournisseur {
  const appeler = reglages.fetch ?? globalThis.fetch
  const delai = reglages.delaiMs ?? DELAI_DEFAUT
  const base = 'https://api.opensubtitles.com/api/v1'
  const entetes = {
    'api-key': cle,
    'content-type': 'application/json',
    // L'API exige un agent identifiant l'application ; un agent absent est
    // refusé en 403, sans que le corps de la réponse le dise clairement.
    'user-agent': 'AmorceIPTV v0.1',
  }

  const json = async (url: string, init?: RequestInit): Promise<unknown> => {
    const reponse = await appeler(url, {
      ...init,
      headers: { ...entetes, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(delai),
    })
    if (!reponse.ok) return undefined
    const corps = await reponse.text()
    try {
      return JSON.parse(corps) as unknown
    } catch {
      return undefined
    }
  }

  return {
    nom: 'OpenSubtitles',

    async chercher(demande): Promise<PisteExterne[]> {
      const parametres = new URLSearchParams()
      // Pour une série, c'est le nom de la série qui trouve, pas le titre de
      // l'épisode : `Kaamelott` + saison + épisode, jamais `Kaamelott S01E01`.
      parametres.set('query', demande.serie ?? demande.titre)
      if (demande.saison !== undefined) parametres.set('season_number', String(demande.saison))
      if (demande.episode !== undefined) parametres.set('episode_number', String(demande.episode))
      if (demande.annee !== undefined && demande.serie === undefined) {
        parametres.set('year', String(demande.annee))
      }
      parametres.set('languages', demande.langues.join(','))

      const donnees = await json(`${base}/subtitles?${parametres.toString()}`)
      const racine = (typeof donnees === 'object' && donnees !== null ? donnees : {}) as Record<
        string,
        unknown
      >
      const liste = Array.isArray(racine['data']) ? racine['data'] : []

      const pistes: PisteExterne[] = []
      for (const brut of liste) {
        if (typeof brut !== 'object' || brut === null) continue
        const attributs = (brut as Record<string, unknown>)['attributes']
        if (typeof attributs !== 'object' || attributs === null) continue
        const champs = attributs as Record<string, unknown>

        // L'identifiant qui sert au téléchargement est celui du **fichier**,
        // pas celui du sous-titre : les deux existent, et se tromper rend 404.
        const fichiers = Array.isArray(champs['files']) ? champs['files'] : []
        const premier = fichiers[0]
        const idFichier =
          typeof premier === 'object' && premier !== null
            ? chaine((premier as Record<string, unknown>)['file_id'])
            : undefined
        const langue = chaine(champs['language'])
        if (idFichier === undefined || langue === undefined) continue

        pistes.push({
          id: idFichier,
          fournisseur: 'OpenSubtitles',
          langue: langue.toLowerCase(),
          nom: chaine(champs['release']) ?? `Sous-titres ${langue.toUpperCase()}`,
          note: nombre(champs['ratings']),
        })
      }

      // L'ordre demandé prime sur celui du service : une piste française
      // d'abord, quelle que soit sa note.
      const rang = (piste: PisteExterne): number => {
        const position = demande.langues.indexOf(piste.langue)
        return position === -1 ? demande.langues.length : position
      }
      return pistes.sort((a, b) => rang(a) - rang(b) || (b.note ?? 0) - (a.note ?? 0))
    },

    async telecharger(id): Promise<Uint8Array | undefined> {
      // Le téléchargement se fait en deux temps : l'API rend un lien à usage
      // unique, elle ne sert pas le fichier. Appeler le premier point d'entrée
      // en espérant le contenu rend du JSON, qu'on prendrait pour un sous-titre.
      const donnees = await json(`${base}/download`, {
        method: 'POST',
        body: JSON.stringify({ file_id: Number.parseInt(id, 10) }),
      })
      const lien =
        typeof donnees === 'object' && donnees !== null
          ? chaine((donnees as Record<string, unknown>)['link'])
          : undefined
      if (lien === undefined) return undefined

      const fichier = await appeler(lien, { signal: AbortSignal.timeout(delai) })
      if (!fichier.ok) return undefined
      return new Uint8Array(await fichier.arrayBuffer())
    },
  }
}

/**
 * Les fournisseurs que les réglages permettent d'utiliser.
 *
 * Rend une liste vide plutôt qu'une erreur quand aucune clé n'est posée :
 * l'application doit fonctionner sans, et les sous-titres **intégrés au flux**
 * marchent de toute façon — c'est le cas courant sur une vidéo à la demande.
 *
 * SubDL n'est pas ici, et c'est délibéré : son API rend une **archive ZIP**, ce
 * qui demande un décompresseur, et rien ne permet de vérifier la forme réelle
 * de ses réponses sans clé. Écrire ce code à l'aveugle donnerait une
 * implémentation qui compile et ne marche pas — l'interface ci-dessus est là
 * pour l'ajouter le jour où une clé permet de l'éprouver.
 */
export function fournisseursDisponibles(reglages: ReglagesSousTitres = {}): Fournisseur[] {
  const cle = reglages.openSubtitlesKey?.trim()
  return cle === undefined || cle === '' ? [] : [openSubtitles(cle, reglages)]
}
