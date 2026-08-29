// Le thème d'un film ou d'une série : policier, thriller, fantastique…
//
// **D'où vient l'information.** Nulle part d'officiel. Une liste IPTV range ses
// films dans des groupes qu'elle nomme comme elle veut — « FILMS | ACTION »,
// « FR - THRILLER », « VOD FR ▪ Science Fiction », « SERIES ┃ CRIME ». Il n'y a
// ni champ dédié, ni vocabulaire commun, et la moitié des listes écrivent en
// anglais même quand tout le reste est en français.
//
// **Pourquoi un vocabulaire fermé.** Prendre le nom du groupe tel quel donnerait
// quatre-vingts dossiers dont « ACTION », « Action VF », « FILMS ACTION » et
// « ACTION 2024 » — quatre fois le même, et aucun rangement. Les groupes sont
// donc ramenés à une liste courte de thèmes français, celle qu'on a en tête en
// cherchant quoi regarder.
//
// **Un film sans thème reconnu n'est jamais perdu.** Il se range dans un dossier
// « Autres » et reste atteignable par la recherche. Classer de force sur un
// motif approximatif serait pire : on chercherait un polar dans « Policier » et
// il serait ailleurs, sans qu'aucun message ne l'explique.
//
// **L'ordre des motifs compte, et c'est le seul piège du fichier.** « Science
// Fiction » contient « fiction », « Comédie dramatique » contient « drame » en
// anglais (« drama »), et « Action & Aventure » contient les deux. Le plus
// spécifique passe donc en premier, toujours, et le premier motif qui répond
// gagne.

/** Les thèmes retenus, dans l'ordre où ils s'affichent. */
export const THEMES = [
  'Action',
  'Aventure',
  'Science-fiction',
  'Fantastique',
  'Horreur',
  'Thriller',
  'Policier',
  'Guerre',
  'Western',
  'Drame',
  'Comédie',
  'Romance',
  'Historique',
  'Biopic',
  'Animation',
  'Jeunesse',
  'Documentaire',
  'Musical',
  'Sport',
  'Autres',
] as const

export type Theme = (typeof THEMES)[number]

/**
 * Les motifs, du plus spécifique au plus général.
 *
 * Chacun est testé sur le texte **normalisé** — minuscules, sans accents — ce
 * qui évite d'écrire « comedie » et « comédie », « épouvante » et « epouvante ».
 */
const MOTIFS: readonly { motif: RegExp; theme: Theme }[] = [
  // Les composés d'abord : « science fiction » contient « fiction », et
  // « comedie dramatique » contient « dramatique ».
  { motif: /science[^a-z]*fiction|\bsci.?fi\b|\bs\.?f\b|espace|futurist/, theme: 'Science-fiction' },
  { motif: /comedie[^a-z]*dramatique|dramedy/, theme: 'Comédie' },
  { motif: /comedie[^a-z]*romantique|romantic[^a-z]*comedy/, theme: 'Romance' },
  // « & », « et », « / » : les listes séparent comme elles veulent.
  { motif: /action[^a-z]*(et|and)?[^a-z]*aventure/, theme: 'Action' },

  { motif: /policier|\bpolar\b|\bcrime\b|criminel|enquete|detective|mystery|whodunit/, theme: 'Policier' },
  { motif: /thriller|suspense|psychologique/, theme: 'Thriller' },
  { motif: /horreur|horror|epouvante|gore|slasher|zombie|monstre/, theme: 'Horreur' },
  { motif: /fantastique|fantasy|fantaisie|heroic|magie|sorcell|surnaturel|super.?heros|superhero|marvel|\bdc\b/, theme: 'Fantastique' },
  { motif: /guerre|\bwar\b|militaire|\bwwii?\b|39.?45/, theme: 'Guerre' },
  { motif: /western|far.?west|cow.?boy/, theme: 'Western' },
  { motif: /documentaire|documentary|\bdoc\b|\bdocu\b|reportage|nature|animalier/, theme: 'Documentaire' },
  { motif: /animation|anime|manga|dessin.?anime|cartoon/, theme: 'Animation' },
  { motif: /jeunesse|enfant|\bkids?\b|famille|family|disney|junior|ados|teen/, theme: 'Jeunesse' },
  { motif: /biopic|biographie|biography|true.?story|histoire.?vraie/, theme: 'Biopic' },
  { motif: /historique|history|\bhisto\b|peplum|epoque|medieval/, theme: 'Historique' },
  { motif: /musical|comedie.?musicale|concert|\bmusique\b|\bmusic\b|opera/, theme: 'Musical' },
  { motif: /\bsport|foot|catch|\bufc\b|\bwwe\b|boxe|formule/, theme: 'Sport' },
  { motif: /romance|romantique|romantic|\blove\b|\bamour\b|sentimental/, theme: 'Romance' },
  { motif: /aventure|adventure|exploration|\bquete\b/, theme: 'Aventure' },
  { motif: /\baction\b|combat|arts.?martiaux|kung.?fu|karate/, theme: 'Action' },
  { motif: /comedie|comedy|humour|humor|\bfun\b|\brire\b/, theme: 'Comédie' },
  { motif: /drame|\bdrama\b|dramatique|melodrame/, theme: 'Drame' },
]

function nu(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Les mots qui décrivent le contenant et non le contenu.
 *
 * « FILMS », « VOD », « SERIES », « FR », « 4K » ne disent rien du thème et
 * apparaissent dans presque tous les groupes. Les laisser ferait répondre le
 * motif « action » de « FILMS ACTION » comme celui de « FILMS » — non, mais
 * surtout ils polluent les cas limites, où deux motifs se disputent une chaîne.
 */
const CONTENANT =
  /\b(films?|movies?|series?|serie|vod|tv|show|replay|fr|vf|vo|vostfr|multi|hd|fhd|uhd|4k|1080p?|720p?|nouveaute?s?|new|top|best|20\d\d)\b/g

/**
 * Le thème d'un élément, déduit de son groupe et, à défaut, de son titre.
 *
 * Rend `undefined` plutôt que « Autres » : c'est à l'affichage de décider
 * comment nommer l'absence, pas à la normalisation de la combler.
 */
export function detecterTheme(
  groupe: string | undefined,
  genres: readonly string[] = [],
): Theme | undefined {
  // Les genres déclarés — un panneau Xtream en fournit — passent avant le nom du
  // groupe : c'est une donnée, là où le groupe est un libellé de rangement.
  const sources = [...genres, groupe ?? '']
  for (const source of sources) {
    if (source === '') continue
    const texte = nu(source).replace(CONTENANT, ' ')
    for (const entree of MOTIFS) {
      if (entree.motif.test(texte)) return entree.theme
    }
  }
  return undefined
}

/** L'ordre d'affichage d'un thème, pour que les dossiers ne dansent pas. */
export function ordreTheme(theme: string): number {
  const rang = (THEMES as readonly string[]).indexOf(theme)
  return rang === -1 ? THEMES.length : rang
}
