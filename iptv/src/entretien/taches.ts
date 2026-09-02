// Les trois gestes d'entretien du catalogue, en un seul endroit.
//
// **Pourquoi ce module existe.** Ces tâches vivaient dans `cli.ts`, mêlées à
// leurs `console.log`. Les rendre disponibles depuis l'interface demandait soit
// de les recopier dans une route — donc deux vérités qui divergeraient au
// premier correctif —, soit de séparer la **décision** de son **affichage**.
// C'est ce second chemin : ici la décision, et rien d'autre. La ligne de
// commande imprime, l'interface affiche, aucune des deux ne décide.
//
// **Le test se fait par lots, et ce n'est pas un détail d'implémentation.**
// Éprouver deux cents flux prend plusieurs minutes ; une requête HTTP qui dure
// plusieurs minutes est coupée par le navigateur, par le mandataire, ou par
// l'utilisateur qui croit à un blocage. L'appelant demande donc un lot, reçoit
// le bilan **et ce qu'il reste**, et rappelle. L'avancement devient visible
// sans qu'aucun état ne soit gardé côté serveur.

import type { Depot } from '../cache/depot.ts'
import type { Element, Genre } from '../domaine/types.ts'
import { testerFlux, type OptionsTest } from '../lecture/tester.ts'
import { numeroDeCanal, rangDeChaine } from '../normalisation/canal.ts'
import { detecterEpisode } from '../normalisation/episode.ts'
import { detecterGenre } from '../normalisation/genre.ts'
import { estEtrangerDirect, estEtrangerVod } from '../normalisation/pays.ts'
import { detecterTheme } from '../normalisation/theme.ts'

/** Le plafond d'un balayage complet : au-delà, ce n'est plus un catalogue. */
const TOUT = 100000

export interface ChoixCandidats {
  readonly genre?: Genre | undefined
  /** Repasser aussi ce qui a déjà été éprouvé. */
  readonly tout?: boolean
  /** Nombre maximum rendu. Absent : tout ce qui reste. */
  readonly lot?: number
}

/**
 * Ce qu'il reste à tester, et dans quel ordre.
 *
 * Ce qui a déjà été mesuré n'est pas repassé au crible par défaut : une liste
 * de 120 000 entrées y passerait la nuit, et l'utile est de dégrossir ce qu'on
 * n'a jamais vu.
 */
export function choisirCandidats(depot: Depot, choix: ChoixCandidats = {}): Element[] {
  const { genre, tout = false, lot } = choix
  const candidats = tout
    ? depot.lister({ genre, inclureMorts: true, limite: TOUT })
    : depot
        .aTester(TOUT, { jamaisTestes: true })
        .filter((element) => genre === undefined || element.genre === genre)
  return lot === undefined ? candidats : candidats.slice(0, lot)
}

export interface BilanEntretien {
  readonly ok: number
  readonly mort: number
  readonly inconnu: number
}

/**
 * Éprouve les flux donnés et retient ce qui a été **vu refuser pour de bon**.
 *
 * Un état « inconnu » n'est jamais écrit : un 403 ou un 429 sort aussi bien
 * d'un abonnement momentanément saturé que d'un flux mort, et masquer sur ce
 * seul indice retirerait de l'écran des chaînes qui marchent.
 */
export async function testerCatalogue(
  depot: Depot,
  candidats: readonly Element[],
  options: OptionsTest = {},
): Promise<BilanEntretien> {
  const { bilan } = await testerFlux(candidats, {
    ...options,
    surResultat: (resultat, faits, total) => {
      // Un indécis est horodaté sans être condamné : il reste visible, mais il
      // ne revient pas dans le lot suivant — sans quoi un balayage par lots ne
      // se terminerait jamais sur un fournisseur qui rend des 403.
      if (resultat.etat === 'inconnu') depot.marquerTeste(resultat.element.id)
      else depot.marquerEtat(resultat.element.id, resultat.etat)
      options.surResultat?.(resultat, faits, total)
    },
  })
  return bilan
}

export interface BilanRangement {
  readonly numerotees: number
  readonly chaines: number
  /** Entrées dont le **genre** a changé : le classement d'un import ancien. */
  readonly reclasses: number
  /** Entrées classées étrangères — voir `normalisation/pays.ts`. */
  readonly etrangeres: number
  readonly dossiers: readonly { genre: 'film' | 'serie'; nommes: number; autres: number }[]
  /** Chaînes et films masqués comme doublons — la meilleure qualité reste visible. */
  readonly doublonsMasques: number
  /** Fiches de séries retirées comme doublons. */
  readonly fichesDoublons: number
  /**
   * Le compte visible, chaînes / films / séries, avant et après le rangement.
   *
   * Pas un total du catalogue entier : ce que l'import a réellement écrit,
   * pour vérifier qu'un plafond n'en a pas amputé une partie et que le
   * dédoublonnage n'a rien perdu — seulement masqué ou retiré ce qui faisait
   * double emploi.
   */
  readonly avant: { chaines: number; films: number; series: number }
  readonly apres: { chaines: number; films: number; series: number }
}

/**
 * Reclasse le catalogue entier : genre, ordre des chaînes, thèmes — puis
 * dédoublonne chaînes, films et séries.
 *
 * Tout se calcule à l'import — donc tout reste figé sur la règle qui avait
 * cours ce jour-là, et un correctif livré ensuite ne touche jamais une base
 * déjà remplie. Le cas réel qui a imposé cette fonction : des **chaînes** de
 * cinéma — Ciné+, Canal+ Cinémas, les chaînes Pluto — rangées dans l'onglet
 * Films par une règle depuis corrigée, et qui y seraient restées pour toujours.
 *
 * Le dédoublonnage vient **après** le reclassement, et c'est l'ordre qui
 * compte : grouper par titre sur un genre encore faux mélangerait des chaînes
 * et des films sous la même règle.
 *
 * Rejouer la classification coûte quelques secondes, là où un réimport complet
 * coûte plusieurs minutes et demande de retrouver l'adresse de sa source.
 */
export function rangerCatalogue(depot: Depot): BilanRangement {
  const compterTout = (): { chaines: number; films: number; series: number } => ({
    chaines: depot.compter({ genre: 'direct' }),
    films: depot.compter({ genre: 'film' }),
    series: depot.fiches({ limite: TOUT }).length,
  })
  const avant = compterTout()

  const { numerotees, reclasses, etrangeres } = depot.reclasser(({ titre, url, groupe, langue }) => {
    const genre = detecterGenre({
      url,
      groupe,
      episode: detecterEpisode(titre) !== undefined,
    })
    // Chacun ne porte que ce qui le concerne : une chaîne a un numéro, une
    // œuvre a un thème. Poser les deux partout reviendrait à afficher un rang
    // de famille à côté d'un film. La langue étrangère se lit différemment
    // selon le genre — le groupe pour une chaîne, la piste pour une œuvre.
    const pays =
      genre === 'direct'
        ? estEtrangerDirect(groupe)
          ? 'etranger'
          : undefined
        : estEtrangerVod(langue)
          ? 'etranger'
          : undefined
    return genre === 'direct'
      ? { genre, canal: numeroDeCanal(titre), rang: rangDeChaine(titre), pays }
      : { genre, theme: detecterTheme(groupe), pays }
  })

  const directs = depot.dedoublonner('direct')
  const films = depot.dedoublonner('film')
  const fiches = depot.dedoublonnerFiches()

  const dossiers = (['film', 'serie'] as const)
    .map((genre) => {
      const themes = depot.themes({ genre, inclureMorts: true })
      return {
        genre,
        nommes: themes.filter((dossier) => dossier.nom !== '').length,
        autres: themes.find((dossier) => dossier.nom === '')?.compte ?? 0,
      }
    })
    .filter((dossier) => dossier.nommes > 0 || dossier.autres > 0)

  return {
    numerotees,
    reclasses,
    etrangeres,
    chaines: depot.compter({ genre: 'direct', inclureMorts: true }),
    dossiers,
    doublonsMasques: directs.masques + films.masques,
    fichesDoublons: fiches.retirees,
    avant,
    apres: compterTout(),
  }
}

/** Remet en jeu tout ce qui avait été condamné. Rend le nombre d'entrées rendues. */
export function ranimerFlux(depot: Depot): number {
  return depot.oublierEtats()
}
