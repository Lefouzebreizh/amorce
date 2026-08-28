// Le modèle commun, et la raison d'être de tout ce dossier.
//
// Deux sources alimentent l'application — une liste M3U et un panneau Xtream
// Codes — et elles ne se ressemblent pas : l'une est un fichier texte de
// plusieurs centaines de mégaoctets, l'autre une API JSON paginée par
// catégories. Si chacune gardait sa forme jusqu'à l'interface, tout ce qui est
// au-dessus (recherche, filtres, favoris, reprise de lecture, EPG) devrait
// connaître les deux, et chaque fonctionnalité serait écrite deux fois.
//
// D'où la règle : **rien ne remonte au-dessus de l'ingestion sans être un
// `Element`**. Le parseur M3U et le client Xtream produisent du brut ; la
// normalisation le convertit ; le reste de l'application ne voit que ceci.

/** Ce qu'un élément est, du point de vue de la navigation. */
export type Genre = 'direct' | 'film' | 'serie'

/**
 * La langue telle qu'une liste IPTV la déclare — jamais telle que le flux la
 * contient réellement. C'est une étiquette de catalogue, utile pour trier et
 * filtrer ; la vérité sur les pistes audio ne se connaît qu'à la lecture, une
 * fois le manifeste HLS chargé.
 */
export type Langue = 'vf' | 'multi' | 'vostfr' | 'vo' | 'inconnue'

export type Qualite = '4k' | 'fhd' | 'hd' | 'sd' | 'inconnue'

export type Source = 'm3u' | 'xtream'

export interface Element {
  /** Stable d'une analyse à l'autre : c'est la clé du cache et des favoris. */
  readonly id: string
  readonly source: Source
  readonly genre: Genre
  /** Titre nettoyé, celui qui s'affiche. */
  readonly titre: string
  /** Titre d'origine, conservé : c'est lui qu'on cherche quand le nettoyage a trop mangé. */
  readonly titreBrut: string
  readonly url: string
  readonly langue: Langue
  readonly qualite: Qualite
  readonly groupe: string | undefined
  readonly logo: string | undefined
  /** Identifiant EPG (`tvg-id`), le seul lien avec le flux XMLTV. */
  readonly tvgId: string | undefined
  readonly annee: number | undefined
  /** Renseignés seulement pour un épisode ; `serie` sert à regrouper. */
  readonly serie: string | undefined
  readonly saison: number | undefined
  readonly episode: number | undefined
  /** Étiquettes relevées puis retirées du titre (VF, 1080P, MULTI…). */
  readonly etiquettes: readonly string[]
  /**
   * Options de lecture portées par la liste (`#EXTVLCOPT`, `#KODIPROP`) :
   * agent utilisateur, référent, en-têtes. Certaines listes ne se lisent
   * qu'avec, et les jeter à l'ingestion rend le flux injouable sans que rien
   * ne le signale.
   */
  readonly optionsLecture: readonly string[]
  /** Identifiant côté panneau Xtream, quand il vient de là. */
  readonly refExterne: string | undefined
}

/**
 * Une série, qui n'est pas un `Element` — et ce n'est pas un détail de typage.
 *
 * Un `Element` se lit : il a une URL. Une série n'en a pas, elle contient des
 * épisodes qui, eux, en ont une. Leur donner un `Element` avec une URL vide
 * ferait qu'un clic sur une série ouvrirait un lecteur sur rien, et le défaut
 * ne se verrait qu'à l'exécution. Ici il ne compile pas.
 */
export interface FicheSerie {
  readonly id: string
  readonly refExterne: string | undefined
  readonly titre: string
  readonly titreBrut: string
  readonly annee: number | undefined
  readonly logo: string | undefined
  readonly resume: string | undefined
  readonly genres: readonly string[]
  readonly groupe: string | undefined
  readonly langue: Langue
}

/** Ordre de préférence francophone : c'est le tri par défaut de l'application. */
export function prioriteFrancophone(langue: Langue): number {
  switch (langue) {
    case 'vf':
      return 0
    case 'multi':
      return 1
    case 'vostfr':
      return 2
    case 'vo':
      return 3
    default:
      return 4
  }
}
