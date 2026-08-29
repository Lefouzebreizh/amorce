// Lecteur de guide des programmes au format XMLTV.
//
// **Pourquoi un analyseur écrit à la main plutôt qu'une bibliothèque XML.**
// Deux raisons, et la seconde compte davantage. La première est la promesse du
// projet : aucune dépendance d'exécution. La seconde est que toutes les
// bibliothèques XML courantes construisent un arbre — c'est leur métier — et un
// guide français couvre deux semaines sur trois cents chaînes : 50 à 200 Mo,
// plusieurs millions de nœuds. L'arbre ne tient pas, et il n'a aucun intérêt :
// on ne lit ce fichier qu'une fois, du début à la fin, pour le verser en base.
//
// Ce qui est analysé ici est donc **un sous-ensemble volontaire** de XML, celui
// que XMLTV utilise réellement : des éléments `<channel>` et `<programme>` sans
// imbrication récursive, des attributs entre guillemets, du texte avec entités
// et sections CDATA. Un fichier XML valide mais exotique — espaces de noms,
// entités déclarées par l'auteur — n'est pas géré, et c'est assumé : aucun
// générateur de guide n'en produit.

import type { Programme } from '../domaine/types.ts'
import { lignes, type SourceTexte } from '../flux/lignes.ts'

export interface ChaineEpg {
  readonly id: string
  readonly nom: string | undefined
  readonly logo: string | undefined
}

export type ProgrammeEpg = Programme

export interface ResumeEpg {
  readonly chaines: number
  readonly programmes: number
  readonly ignores: number
}

const ENTITES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Décode les entités XML, numériques comprises — un titre sur dix en porte. */
export function decoder(texte: string): string {
  return texte.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tout, corps: string) => {
    if (corps.startsWith('#x') || corps.startsWith('#X')) {
      const point = Number.parseInt(corps.slice(2), 16)
      return Number.isNaN(point) ? tout : String.fromCodePoint(point)
    }
    if (corps.startsWith('#')) {
      const point = Number.parseInt(corps.slice(1), 10)
      return Number.isNaN(point) ? tout : String.fromCodePoint(point)
    }
    return ENTITES[corps.toLowerCase()] ?? tout
  })
}

/**
 * Le texte d'un contenu d'élément, dans le bon ordre — et cet ordre est le
 * piège.
 *
 * Déballer le CDATA **avant** de retirer les balises fait manger le texte du
 * CDATA lui-même : `<![CDATA[Les <Bronzés>]]>` ressort « Les ». Or c'est
 * exactement ce que le CDATA existe pour protéger. On met donc son contenu de
 * côté d'abord, on nettoie ce qui l'entoure, et on le remet à la fin.
 *
 * Le décodage des entités a lieu **avant** la remise : dans une section CDATA,
 * `&amp;` est un vrai « &amp;amp; », pas une esperluette. C'est la définition du
 * CDATA, et l'oublier réécrit les titres qui en contiennent.
 */
function texteInterne(brut: string): string {
  const gardes: string[] = []
  const avecJetons = brut.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_tout, dedans: string) => {
    gardes.push(dedans)
    return `\u0000${gardes.length - 1}\u0000`
  })
  const decode = decoder(avecJetons.replace(/<[^>]*>/g, ''))
  return decode
    .replace(/\u0000(\d+)\u0000/g, (_tout, rang: string) => gardes[Number(rang)] ?? '')
    .trim()
}

/** Le contenu textuel d'un élément, sections CDATA comprises. */
export function contenu(bloc: string, nom: string): string | undefined {
  const trouve = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'i').exec(bloc)
  const brut = trouve?.[1]
  if (brut === undefined) return undefined
  const texte = texteInterne(brut)
  return texte === '' ? undefined : texte
}

function tousLesContenus(bloc: string, nom: string): string[] {
  const sortie: string[] = []
  const motif = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'gi')
  let trouve = motif.exec(bloc)
  while (trouve !== null) {
    const brut = trouve[1]
    if (brut !== undefined) {
      const texte = texteInterne(brut)
      if (texte !== '') sortie.push(texte)
    }
    trouve = motif.exec(bloc)
  }
  return sortie
}

export function attribut(bloc: string, nom: string): string | undefined {
  const trouve = new RegExp(`\\s${nom}\\s*=\\s*"([^"]*)"|\\s${nom}\\s*=\\s*'([^']*)'`, 'i').exec(bloc)
  const valeur = trouve?.[1] ?? trouve?.[2]
  return valeur === undefined ? undefined : decoder(valeur)
}

/**
 * Convertit un instant XMLTV en ISO 8601 UTC.
 *
 * Le format est `AAAAMMJJHHMMSS +HHMM`, et le décalage est **facultatif** —
 * c'est le piège. Un guide français sans décalage est en heure locale de son
 * générateur, pas en UTC : le prendre pour de l'UTC décale toute la grille de
 * deux heures en été, et personne ne voit l'erreur avant de chercher pourquoi
 * « en ce moment » montre le film d'après.
 *
 * Faute de mieux, un instant sans décalage est lu dans le fuseau de la machine :
 * c'est le comportement juste dans le cas courant, où le guide et le
 * spectateur sont dans le même pays.
 */
export function versInstant(brut: string | undefined): string | undefined {
  if (brut === undefined) return undefined
  const trouve = /^\s*(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4}|Z)?\s*$/.exec(brut)
  if (trouve === null) return undefined
  const [, annee, mois, jour, heure, minute, seconde, decalage] = trouve
  if (annee === undefined || mois === undefined || jour === undefined) return undefined

  const partie = `${annee}-${mois}-${jour}T${heure ?? '00'}:${minute ?? '00'}:${seconde ?? '00'}`
  if (decalage === undefined) {
    const local = new Date(partie)
    return Number.isNaN(local.getTime()) ? undefined : local.toISOString()
  }
  const zone = decalage === 'Z' ? 'Z' : `${decalage.slice(0, 3)}:${decalage.slice(3)}`
  const date = new Date(`${partie}${zone}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export type EntreeEpg =
  | { readonly type: 'chaine'; readonly chaine: ChaineEpg }
  | { readonly type: 'programme'; readonly programme: ProgrammeEpg }

/**
 * Taille au-delà de laquelle un bloc cesse d'en être un.
 *
 * Un `<programme>` fait quelques kilooctets. Sans ce plafond, un fichier
 * tronqué au milieu d'une balise ferait grossir le tampon jusqu'à la fin du
 * fichier — exactement le défaut que cet analyseur existe pour éviter.
 */
const BLOC_MAX = 1 << 20

export async function* analyserXmltv(
  source: SourceTexte,
): AsyncGenerator<EntreeEpg, ResumeEpg> {
  let chaines = 0
  let programmes = 0
  let ignores = 0

  let dans: 'chaine' | 'programme' | undefined
  let bloc = ''

  const rendreChaine = (texte: string): EntreeEpg | undefined => {
    const id = attribut(texte, 'id')
    if (id === undefined) return undefined
    return {
      type: 'chaine',
      chaine: {
        id,
        nom: contenu(texte, 'display-name'),
        logo: /<icon\b/i.test(texte) ? attribut(texte.slice(texte.search(/<icon\b/i)), 'src') : undefined,
      },
    }
  }

  const rendreProgramme = (texte: string): EntreeEpg | undefined => {
    const chaine = attribut(texte, 'channel')
    const debut = versInstant(attribut(texte, 'start'))
    const titre = contenu(texte, 'title')
    // Sans chaîne, sans début ou sans titre, l'entrée ne peut rien afficher ni
    // se rattacher : elle est comptée perdue plutôt que rendue à moitié.
    if (chaine === undefined || debut === undefined || titre === undefined) return undefined
    return {
      type: 'programme',
      programme: {
        chaine,
        debut,
        fin: versInstant(attribut(texte, 'stop')),
        titre,
        sousTitre: contenu(texte, 'sub-title'),
        resume: contenu(texte, 'desc'),
        categories: tousLesContenus(texte, 'category'),
        icone: /<icon\b/i.test(texte) ? attribut(texte.slice(texte.search(/<icon\b/i)), 'src') : undefined,
      },
    }
  }

  for await (const ligne of lignes(source)) {
    if (dans === undefined) {
      const debutChaine = /<channel\b/i.test(ligne)
      const debutProgramme = /<programme\b/i.test(ligne)
      if (!debutChaine && !debutProgramme) continue
      dans = debutChaine ? 'chaine' : 'programme'
      bloc = ligne
    } else {
      bloc += `\n${ligne}`
    }

    const ferme = dans === 'chaine' ? /<\/channel>/i.test(bloc) : /<\/programme>/i.test(bloc)
    // La forme `<programme … />` existe aussi, sans balise fermante.
    const autoFerme = /\/>\s*$/.test(bloc.trimEnd())

    if (!ferme && !autoFerme) {
      if (bloc.length > BLOC_MAX) {
        ignores += 1
        dans = undefined
        bloc = ''
      }
      continue
    }

    const entree = dans === 'chaine' ? rendreChaine(bloc) : rendreProgramme(bloc)
    if (entree === undefined) ignores += 1
    else {
      if (entree.type === 'chaine') chaines += 1
      else programmes += 1
      yield entree
    }
    dans = undefined
    bloc = ''
  }

  if (dans !== undefined) ignores += 1
  return { chaines, programmes, ignores }
}
