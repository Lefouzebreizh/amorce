// L'ordre des chaînes, et le numéro qu'on lit sur la télécommande.
//
// **Pourquoi ce fichier existe.** Une liste IPTV sort ses chaînes dans l'ordre
// où le fournisseur les a écrites — c'est-à-dire dans aucun ordre. TF1 se
// retrouve entre deux chaînes régionales, France 2 trente lignes plus bas. Or
// personne ne cherche « TF1 » : on descend au premier, on sait que le deuxième
// est France 2, et c'est ce geste-là que l'ordre d'origine casse.
//
// **La numérotation a changé le 6 juin 2025**, et c'est le piège de ce fichier.
// C8 et NRJ 12 ont cessé d'émettre le 28 février 2025, Canal+ a quitté la TNT,
// et l'Arcom a renuméroté : France 4 remonte au 4, LCP prend le 8, Gulli le 12,
// et les quatre chaînes d'information forment un bloc de 13 à 16. Une table
// écrite de mémoire décrit donc la TNT d'avant, ce qui est pire qu'aucune table
// — l'ordre paraît juste et place les chaînes au mauvais endroit.
//
// **Deux nombres, et non un.** Le *numéro* est ce qui s'affiche : il n'existe
// que pour les chaînes qui en ont un vrai, et s'arrête à 50. Le *rang* est ce
// qui trie, et il continue au-delà par familles — sport, cinéma, musique —
// parce qu'au-delà de la cinquantaine plus personne ne connaît de numéro, mais
// tout le monde sait qu'il cherche « une chaîne de foot ». Confondre les deux
// afficherait « 2000 » à côté de Canal+, ce qui ne veut rien dire.
//
// **Rien n'est jamais retiré** : ce qui n'entre dans aucune famille se range
// simplement en dernier, par ordre alphabétique. Une chaîne mal classée reste
// atteignable ; une chaîne masquée est perdue.

/**
 * Les chaînes qui portent un vrai numéro, de 1 à 50.
 *
 * De 1 à 25, c'est la TNT nationale — un fait, vérifiable. De 26 à 50, c'est un
 * choix : les grandes thématiques qu'on cherche après la TNT, hors sport,
 * cinéma et musique, qui ont leur bloc plus bas. Aucun opérateur ne numérote
 * exactement ainsi ; l'ordre est stable, c'est ce qu'on lui demande.
 *
 * Les clés sont des titres **normalisés** par `cle()` : minuscules, sans
 * accents, sans espaces ni ponctuation. Plusieurs clés peuvent viser le même
 * canal — les listes écrivent « France Info », « franceinfo » ou « France
 * Info: » selon l'humeur du fournisseur.
 */
const NUMEROS: ReadonlyMap<string, number> = new Map([
  // La TNT nationale, numérotation en vigueur depuis le 6 juin 2025.
  ['tf1', 1],
  ['france2', 2],
  ['france3', 3],
  ['france4', 4],
  ['france5', 5],
  ['m6', 6],
  ['arte', 7],
  ['lcp', 8],
  ['lcpan', 8],
  ['lachaineparlementaire', 8],
  ['publicsenat', 8],
  ['lcppublicsenat', 8],
  ['w9', 9],
  ['tmc', 10],
  ['tfx', 11],
  ['gulli', 12],
  ['bfmtv', 13],
  ['bfm', 13],
  ['cnews', 14],
  ['lci', 15],
  ['franceinfo', 16],
  ['franceinfotv', 16],
  ['cstar', 17],
  ['t18', 18],
  ['cmitv', 18],
  ['novo19', 19],
  ['oftv', 19],
  ['tf1seriesfilms', 20],
  ['lequipe', 21],
  ['6ter', 22],
  ['rmcstory', 23],
  ['rmcdecouverte', 24],
  ['cherie25', 25],

  // Au-delà de la TNT : les thématiques qu'on cherche ensuite.
  ['parispremiere', 26],
  ['tvbreizh', 27],
  ['teva', 28],
  ['comedie', 29],
  ['serieclub', 30],
  ['planete', 31],
  ['planetecrime', 32],
  ['ushuaiatv', 33],
  ['histoiretv', 34],
  ['histoire', 34],
  ['scienceetvietv', 35],
  ['nationalgeographic', 36],
  ['natgeo', 36],
  ['natgeowild', 37],
  ['nationalgeographicwild', 37],
  ['discoverychannel', 38],
  ['discovery', 38],
  ['discoveryinvestigation', 39],
  ['animaux', 40],
  ['chasseetpeche', 41],
  ['voyage', 42],
  ['france24', 43],
  ['euronews', 44],
  ['bfmbusiness', 45],
  ['i24news', 46],
  ['tv5monde', 47],
  ['tiji', 48],
  ['piwi', 49],
  ['canalj', 50],
])

/**
 * Les rangs de tête de chaque famille, une fois les cinquante premiers passés.
 *
 * Les nombres sont espacés : un rang inséré entre deux familles ne doit pas
 * obliger à tout renuméroter. Ils ne s'affichent jamais.
 */
const RANG = {
  /** Les diffuseurs de la Ligue des champions et de la Ligue 1, en tête du sport. */
  footballMajeur: 1000,
  sport: 1100,
  /** Canal+, seul, avant le reste du cinéma. */
  canalPlus: 2000,
  cinema: 2010,
  musique: 3000,
  /** Ce qui n'entre dans aucune famille : dernier, par ordre alphabétique. */
  reste: 9000,
} as const

/** Une famille se reconnaît par motif : les listes n'écrivent jamais deux fois pareil. */
const FAMILLES: readonly { motif: RegExp; rang: number }[] = [
  // L'ordre compte : « canal+ sport » contient « canal », et doit partir au
  // sport, pas en tête du cinéma. Le plus précis d'abord, toujours.
  { motif: /^(ligue1|l1)|^bein|^canal(sport|foot)|^canalplus(sport|foot)/, rang: RANG.footballMajeur },
  {
    motif:
      /sport|^dazn|^eurosport|^equidia|^golf|^automoto|^infosport|foot|rugby|tennis|^nba|^nfl|^mlb|^ufc|^wwe|boxe|olymp/,
    rang: RANG.sport,
  },
  // Canal+ tout court : la chaîne principale, pas une déclinaison.
  { motif: /^canal(plus)?$/, rang: RANG.canalPlus },
  { motif: /^cine|cinema|^ocs|^tcm|^action$|^paramount|^warnertv|^polar|^sundance|^syfy/, rang: RANG.cinema },
  {
    motif:
      /^mtv|^m6music|^nrj(hits|music)|^mcm|^trace|^melody|^mezzo|^clubbing|^rfm|^virgin|^djing|^vevo|music|^radio/,
    rang: RANG.musique,
  },
]

/**
 * Les suffixes qu'une liste colle au nom sans qu'ils fassent partie du nom.
 *
 * « TF1 HD », « TF1 FHD », « TF1 (FR) » désignent tous TF1. Sans ce retrait, la
 * table ne reconnaît rien du tout sur une liste réelle — c'est le défaut qui
 * fait croire que la numérotation ne marche pas.
 */
const SUFFIXES = /(hd|fhd|uhd|sd|4k|8k|1080p?|720p?|hevc|h265|h264|fr|france)+$/

export function cle(titre: string): string {
  const nu = titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  // Le retrait ne s'applique qu'à ce qui reste non vide : « FR » seul est un
  // titre, pas un suffixe, et « HD » aussi sur les listes qui n'ont que cela.
  const coupe = nu.replace(SUFFIXES, '')
  return coupe === '' ? nu : coupe
}

/** Les attributs d'une liste qui portent un numéro, du plus courant au moins. */
const ATTRIBUTS = ['tvg-chno', 'tvg-num', 'channel-number', 'chno', 'num'] as const

function numeroDeclare(attributs: Readonly<Record<string, string>>): number | undefined {
  for (const nom of ATTRIBUTS) {
    const brut = attributs[nom]
    if (brut === undefined) continue
    const valeur = Number.parseInt(brut.trim(), 10)
    // Un zéro ou un négatif est une case laissée vide, pas un rang.
    if (Number.isFinite(valeur) && valeur > 0) return valeur
  }
  return undefined
}

/**
 * Le numéro **affiché** à côté d'une chaîne, ou `undefined` s'il n'y en a pas.
 *
 * Seulement les cinquante connus. Le numéro qu'un fournisseur déclare n'est
 * délibérément pas repris ici : un « 3412 » à côté d'un nom de chaîne n'aide
 * personne, alors qu'il sert encore à trier — voir `rangDeChaine`.
 */
export function numeroDeCanal(titre: string): number | undefined {
  return NUMEROS.get(cle(titre))
}

/**
 * Le rang de **tri** d'une chaîne : les cinquante numérotées, puis les familles.
 *
 * Sport d'abord — diffuseurs de Ligue des champions et de Ligue 1 en tête —,
 * puis le cinéma mené par Canal+, puis la musique, puis tout le reste. Le
 * numéro que le fournisseur déclare sert de départage dans ce reste : c'est son
 * ordre à lui, et il vaut mieux qu'aucun ordre.
 */
export function rangDeChaine(
  titre: string,
  attributs: Readonly<Record<string, string>> = {},
): number {
  const numero = NUMEROS.get(cle(titre))
  if (numero !== undefined) return numero

  const identifiant = cle(titre)
  for (const famille of FAMILLES) {
    if (famille.motif.test(identifiant)) return famille.rang
  }

  const declare = numeroDeclare(attributs)
  // Borné : un numéro déclaré énorme ne doit pas repasser devant une famille.
  return declare === undefined ? RANG.reste : RANG.reste + Math.min(declare, 99999)
}
