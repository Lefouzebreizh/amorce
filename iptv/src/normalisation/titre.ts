// Nettoyer un titre de liste IPTV.
//
// Ce que les fournisseurs écrivent tient rarement dans une case :
// `FR | TF1 HD`, `##FR## RMC Sport 1`, `[VOSTFR] Breaking Bad S01E01`,
// `Le.Seigneur.des.Anneaux.2001.MULTI.1080p.BluRay.x264.mkv`. Affiché tel quel,
// c'est illisible ; cherché tel quel, « Le Seigneur des Anneaux » ne trouve
// rien.
//
// Le nettoyage rend donc trois choses d'un coup, et c'est ce qui justifie qu'il
// soit fait en une passe plutôt qu'en trois : le titre affichable, l'année, et
// les **étiquettes retirées**. Ces étiquettes ne sont pas des déchets — ce sont
// elles qui portent la langue et la définition, et les jeter obligerait à
// relire le titre d'origine deux fois de plus.
//
// Règle qui tient tout le module : **une étiquette n'est retirée que si elle
// forme un mot entier**. « HD » disparaît de `TF1 HD`, jamais de `HDTV Bahia`,
// et surtout jamais au milieu d'un mot — c'est la faute qui transforme
// « Chandler » en « Chandler » privé de sa syllabe et rend le titre
// introuvable.

/**
 * Codes de pays acceptés **en tête de titre seulement**.
 *
 * La restriction n'est pas de la prudence excessive : `US` retiré partout
 * ampute « The US Office », et `IT` ampute tout titre anglais contenant « it ».
 * En tête et suivi d'un séparateur, l'ambiguïté disparaît.
 */
const PAYS = new Set([
  'FR', 'BE', 'CH', 'CA', 'QC', 'LU', 'MC', 'UK', 'GB', 'US', 'EN', 'DE', 'AT',
  'ES', 'IT', 'NL', 'PT', 'PL', 'TR', 'AR', 'MA', 'DZ', 'TN', 'EG', 'RU', 'RO',
  'GR', 'AF', 'SE', 'NO', 'DK', 'FI', 'BR', 'MX', 'IN', 'CN', 'JP', 'KR', 'VN',
])

/** Étiquettes de langue. Ce sont elles que `detecterLangue` relit. */
const LANGUE = [
  'VF', 'VFF', 'VFQ', 'VFI', 'VOF', 'TRUEFRENCH', 'FRENCH', 'SUBFRENCH',
  'MULTI', 'MULTI-AUDIO', 'VOSTFR', 'VOSTA', 'VOST', 'VO', 'VOA', 'ENGLISH',
]

/** Étiquettes de définition. Ce sont elles que `detecterQualite` relit. */
const QUALITE = [
  '4K', 'UHD', '2160P', 'FHD', '1080P', '1080I', 'HD', '720P', '720I', 'SD',
  '576P', '480P', '360P', 'HQ', 'LQ', 'HDLIGHT', 'HDR', 'HDR10', 'SDR',
]

/** Étiquettes de source et de codec : sans intérêt pour l'affichage, retirées. */
const TECHNIQUE = [
  'WEB', 'WEBRIP', 'WEBDL', 'WEB-DL', 'BLURAY', 'BLU-RAY', 'BRRIP', 'BDRIP',
  'DVDRIP', 'DVDSCR', 'HDRIP', 'HDTV', 'CAM', 'H264', 'H265', 'X264', 'X265',
  'HEVC', 'AVC', 'AAC', 'AC3', 'EAC3', 'DTS', 'ATMOS', '10BIT', 'REMUX',
  'REPACK', 'PROPER', 'IMAX', '3D',
]

const ETIQUETTES = new Set([...LANGUE, ...QUALITE, ...TECHNIQUE])

export const ETIQUETTES_LANGUE: ReadonlySet<string> = new Set(LANGUE)
export const ETIQUETTES_QUALITE: ReadonlySet<string> = new Set(QUALITE)

const EXTENSION = /\.(mkv|mp4|avi|mov|webm|m3u8|flv|mpe?g|wmv|ts)$/i

/** Bornes de plausibilité d'une année de sortie, relatives à l'exécution. */
function anneePlausible(valeur: number): boolean {
  return valeur >= 1900 && valeur <= new Date().getFullYear() + 2
}

export interface TitreAnalyse {
  /** Ce qui s'affiche. Jamais vide : à défaut, le titre d'origine. */
  readonly titre: string
  readonly annee: number | undefined
  /** Les étiquettes retirées, en majuscules, sans doublon. */
  readonly etiquettes: readonly string[]
}

export function analyserTitre(brut: string): TitreAnalyse {
  const etiquettes = new Set<string>()
  let t = brut.trim()

  t = t.replace(EXTENSION, '')

  // Nommage « scène » : les points tiennent lieu d'espaces. On ne convertit que
  // si le titre n'a aucune espace, sinon `Dr. House` perdrait son point.
  if (!/\s/.test(t) && /[._]/.test(t)) t = t.replace(/[._]+/g, ' ')

  // `##FR##` en tête.
  t = t.replace(/^#+\s*([A-Za-z]{2,3})\s*#+\s*/, (tout, code: string) =>
    PAYS.has(code.toUpperCase()) ? '' : tout,
  )

  // Préfixe de pays, deux fois au plus : `FR | VIP | …` existe.
  for (let i = 0; i < 2; i += 1) {
    t = t.replace(/^\s*[[(|]?\s*([A-Za-z]{2,3})\s*[\])|:\-–]\s*/, (tout, code: string) =>
      PAYS.has(code.toUpperCase()) ? '' : tout,
    )
  }

  // Année entre parenthèses ou crochets : la forme la plus sûre, traitée avant
  // le découpage en mots pour qu'elle ne soit pas confondue avec un numéro.
  let annee: number | undefined
  t = t.replace(/[([](19\d{2}|20\d{2})[)\]]/g, (tout, valeur: string) => {
    const n = Number(valeur)
    if (!anneePlausible(n)) return tout
    annee = n
    return ' '
  })

  // Les barres verticales collées aux mots deviennent des mots à part, sans
  // quoi `FR|TF1` resterait un seul jeton et l'étiquette ne serait pas vue.
  const mots = t.replace(/\|/g, ' | ').split(/\s+/).filter((mot) => mot !== '')
  const gardes: string[] = []
  for (const mot of mots) {
    const cle = mot.replace(/^[[({<]+|[\])}>,;]+$/g, '').toUpperCase()
    if (ETIQUETTES.has(cle)) {
      etiquettes.add(cle)
      continue
    }
    gardes.push(mot)
  }

  // Année en fin de titre, une fois les étiquettes parties. Jamais si elle est
  // le titre entier : « 1917 » est un film.
  if (annee === undefined && gardes.length > 1) {
    const dernier = gardes[gardes.length - 1]
    if (dernier !== undefined && /^[([]?(19\d{2}|20\d{2})[)\]]?$/.test(dernier)) {
      const n = Number(dernier.replace(/\D/g, ''))
      if (anneePlausible(n)) {
        annee = n
        gardes.pop()
      }
    }
  }

  let titre = gardes
    .join(' ')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/^[\s\-–—:|,]+/, '')
    .replace(/[\s\-–—:|,]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Un titre entièrement fait d'étiquettes existe (`HD`, `VF`) : mieux vaut le
  // rendre tel quel qu'afficher une ligne vide dans la grille.
  if (titre === '') titre = brut.trim()

  return { titre, annee, etiquettes: [...etiquettes] }
}
