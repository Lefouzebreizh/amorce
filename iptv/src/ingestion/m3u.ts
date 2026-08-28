// Analyseur de listes M3U / M3U8 étendues.
//
// Il rend les entrées **au fil de l'eau** : un générateur asynchrone, jamais un
// tableau. C'est ce qui permet d'écrire les entrées en base par paquets de mille
// pendant que le téléchargement continue, et de rendre la main à l'interface
// après trois secondes plutôt qu'après trois minutes.
//
// Trois pièges du format ont chacun coûté une correction ailleurs, et sont
// traités ici une fois pour toutes :
//
// 1. **La virgule qui sépare les attributs du titre n'est pas la première.**
//    `#EXTINF:-1 tvg-name="Canal+, la chaîne",Canal+ Cinéma` porte une virgule
//    dans un attribut. Couper à la première donne un titre tronqué et un
//    attribut coupé en deux. On coupe donc à la première virgule *hors
//    guillemets*, ce qui demande de parcourir la ligne caractère par caractère.
// 2. **L'URL n'est pas toujours la ligne suivante.** `#EXTGRP`, `#EXTVLCOPT`,
//    `#KODIPROP` s'intercalent, et sauter la ligne d'après en aveugle prend une
//    directive pour une adresse de flux.
// 3. **Une liste réelle est malformée par endroits.** Deux `#EXTINF` de suite,
//    une entrée sans URL en fin de fichier, une URL nue sans description. Rien
//    de tout cela ne doit interrompre l'analyse d'un fichier de 300 Mo : ce qui
//    ne se comprend pas se compte, et l'analyse continue.

import { lignes, type SourceTexte } from '../flux/lignes.ts'

export interface EntreeM3U {
  /** `-1` pour un direct, la durée en secondes pour un élément de catalogue. */
  readonly duree: number
  /** Le texte après la virgule, tel quel. Le nettoyage vient plus tard. */
  readonly titre: string
  readonly url: string
  readonly attributs: Readonly<Record<string, string>>
  readonly groupe: string | undefined
  readonly optionsLecture: readonly string[]
  /** Numéro de la ligne `#EXTINF`, pour pouvoir montrer où ça coince. */
  readonly ligne: number
}

export interface EnTeteM3U {
  readonly attributs: Readonly<Record<string, string>>
  /** Adresse du guide XMLTV déclarée par la liste, quand elle en déclare une. */
  readonly urlEpg: string | undefined
}

export interface ResumeM3U {
  readonly lignes: number
  readonly entrees: number
  /** Descriptions restées sans adresse, ou lignes incompréhensibles. */
  readonly ignorees: number
  readonly enTete: EnTeteM3U | undefined
}

export interface OptionsM3U {
  /**
   * Appelée dès la première ligne, avant la première entrée. C'est le seul
   * moyen d'obtenir l'adresse de l'EPG sans attendre la fin d'un fichier de
   * plusieurs centaines de mégaoctets.
   */
  readonly surEnTete?: (entete: EnTeteM3U) => void
}

const ATTRIBUT = /([A-Za-z0-9_.-]+)=(?:"([^"]*)"|'([^']*)'|([^\s",]+))/g

/** Relève les `clé="valeur"` d'une ligne, guillemets simples et valeurs nues comprises. */
export function lireAttributs(texte: string): Record<string, string> {
  const attributs: Record<string, string> = {}
  ATTRIBUT.lastIndex = 0
  let trouve = ATTRIBUT.exec(texte)
  while (trouve !== null) {
    const cle = trouve[1]
    const valeur = trouve[2] ?? trouve[3] ?? trouve[4] ?? ''
    if (cle !== undefined) attributs[cle.toLowerCase()] = valeur
    trouve = ATTRIBUT.exec(texte)
  }
  return attributs
}

/** Coupe une ligne `#EXTINF` à sa première virgule hors guillemets — voir le piège n° 1. */
export function separerExtinf(reste: string): {
  duree: number
  attributs: Record<string, string>
  titre: string
} {
  let guillemet: string | null = null
  let coupure = -1
  for (let i = 0; i < reste.length; i += 1) {
    const c = reste.charAt(i)
    if (guillemet !== null) {
      if (c === guillemet) guillemet = null
      continue
    }
    if (c === '"' || c === "'") {
      guillemet = c
      continue
    }
    if (c === ',') {
      coupure = i
      break
    }
  }

  const gauche = coupure === -1 ? reste : reste.slice(0, coupure)
  const titre = coupure === -1 ? '' : reste.slice(coupure + 1).trim()
  const duree = /^\s*(-?\d+(?:\.\d+)?)/.exec(gauche)
  return {
    duree: duree?.[1] === undefined ? -1 : Number(duree[1]),
    attributs: lireAttributs(gauche),
    titre,
  }
}

/** Titre de repli pour une URL nue : le nom du fichier, sans extension ni encodage. */
function titreDepuisUrl(url: string): string {
  const sansRequete = url.split(/[?#]/)[0] ?? url
  const dernier = sansRequete.split('/').filter(Boolean).pop() ?? url
  try {
    return decodeURIComponent(dernier)
  } catch {
    return dernier
  }
}

interface EnCours {
  duree: number
  titre: string
  attributs: Record<string, string>
  groupe: string | undefined
  optionsLecture: string[]
  ligne: number
}

/**
 * Analyse une liste M3U et rend ses entrées au fil de l'eau.
 *
 * La valeur de retour du générateur porte le résumé : `for await` ne le voit
 * pas — c'est voulu, un consommateur qui écrit en base n'en a pas besoin — et
 * `lireM3U` le rend à ceux qui le veulent.
 */
export async function* analyserM3U(
  source: SourceTexte,
  options: OptionsM3U = {},
): AsyncGenerator<EntreeM3U, ResumeM3U> {
  let compteLignes = 0
  let compteEntrees = 0
  let ignorees = 0
  let enTete: EnTeteM3U | undefined
  let enCours: EnCours | undefined
  // `#EXTGRP` peut précéder les entrées auxquelles il s'applique et vaut alors
  // jusqu'au prochain : c'est ainsi que les listes Kodi déclarent leurs groupes.
  let groupeCourant: string | undefined

  for await (const brute of lignes(source)) {
    compteLignes += 1
    const ligne = brute.trim()
    if (ligne === '') continue

    if (ligne.startsWith('#')) {
      const majuscules = ligne.toUpperCase()

      if (majuscules.startsWith('#EXTM3U')) {
        const attributs = lireAttributs(ligne.slice('#EXTM3U'.length))
        const brutEpg = attributs['url-tvg'] ?? attributs['x-tvg-url'] ?? attributs['tvg-url']
        enTete = {
          attributs,
          // Certaines listes en déclarent plusieurs, séparées par des virgules.
          // Le premier suffit : les suivants sont des miroirs du même guide.
          urlEpg: brutEpg === undefined ? undefined : (brutEpg.split(',')[0] ?? '').trim() || undefined,
        }
        options.surEnTete?.(enTete)
        continue
      }

      if (majuscules.startsWith('#EXTINF:')) {
        // Une description qui en remplace une autre veut dire que la première
        // n'a jamais reçu d'adresse : on la compte perdue plutôt que de la
        // recoller à l'URL de la suivante.
        if (enCours !== undefined) ignorees += 1
        const { duree, attributs, titre } = separerExtinf(ligne.slice('#EXTINF:'.length))
        enCours = {
          duree,
          titre,
          attributs,
          groupe: attributs['group-title'] ?? groupeCourant,
          optionsLecture: [],
          ligne: compteLignes,
        }
        continue
      }

      if (majuscules.startsWith('#EXTGRP:')) {
        const groupe = ligne.slice('#EXTGRP:'.length).trim()
        if (enCours !== undefined) enCours.groupe = groupe
        else groupeCourant = groupe
        continue
      }

      if (
        majuscules.startsWith('#EXTVLCOPT:') ||
        majuscules.startsWith('#KODIPROP:') ||
        majuscules.startsWith('#EXTHTTP:')
      ) {
        enCours?.optionsLecture.push(ligne)
        continue
      }

      // Tout autre commentaire ou directive inconnue : ignoré sans bruit.
      continue
    }

    // Une ligne qui ne commence pas par `#` est une adresse.
    if (enCours !== undefined) {
      compteEntrees += 1
      yield {
        duree: enCours.duree,
        titre: enCours.titre,
        url: ligne,
        attributs: enCours.attributs,
        groupe: enCours.groupe,
        optionsLecture: enCours.optionsLecture,
        ligne: enCours.ligne,
      }
      enCours = undefined
      continue
    }

    // Une URL nue, sans description : les listes minimales n'ont que cela, et
    // les jeter viderait la liste entière.
    compteEntrees += 1
    yield {
      duree: -1,
      titre: titreDepuisUrl(ligne),
      url: ligne,
      attributs: {},
      groupe: groupeCourant,
      optionsLecture: [],
      ligne: compteLignes,
    }
  }

  if (enCours !== undefined) ignorees += 1

  return { lignes: compteLignes, entrees: compteEntrees, ignorees, enTete }
}

/**
 * Version qui matérialise tout en mémoire, pour les tests et les listes courtes.
 *
 * À ne pas utiliser sur une liste de fournisseur : c'est exactement ce que
 * `analyserM3U` existe pour éviter.
 */
export async function lireM3U(
  source: SourceTexte,
  options: OptionsM3U = {},
): Promise<{ entrees: EntreeM3U[]; resume: ResumeM3U }> {
  const analyse = analyserM3U(source, options)
  const entrees: EntreeM3U[] = []
  let pas = await analyse.next()
  while (pas.done !== true) {
    entrees.push(pas.value)
    pas = await analyse.next()
  }
  return { entrees, resume: pas.value }
}
