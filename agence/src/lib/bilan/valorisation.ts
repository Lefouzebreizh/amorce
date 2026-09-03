// Combien vaut ce patrimoine, poche par poche.
//
// Porté du conseiller local (`conseiller-patrimoine/analyse/valorisation.py`),
// dont deux décisions sont reprises telles quelles parce qu'elles ont été
// payées une fois et qu'une réécriture de mémoire les aurait perdues.
//
// **1. L'immobilier compte en valeur nette.** Un bien à 148 000 € financé par
// 76 500 € de crédit restant pèse 71 500 € de patrimoine. Le compter brut
// écrase mécaniquement les autres poches et rend le bilan illisible tant que le
// crédit court — l'écran afficherait « 80 % d'immobilier » à quelqu'un qui vient
// d'acheter, ce qui est vrai et parfaitement inutile. Le capital restant dû est
// affiché à côté, pour ne pas perdre l'effet de levier de vue.
//
// **2. Une poche inconnue ne vaut pas zéro.** Elle sort du total, qui devient
// un **plancher** et se déclare tel. Compter zéro donnerait un patrimoine faux
// avec l'aplomb d'un patrimoine juste, et c'est ce qui le rendrait dangereux
// plutôt qu'incomplet.
//
// Copié depuis bilan-patrimoine/src/valorisation.ts (lot 1) pour le lot 2.

import { POCHES, type LignePoche, type Patrimoine, type Poche, type Situation } from './modeles'

/** Euros à la française, avec l'espace insécable qu'exige la typographie.
 *  Écrite ` ` en toutes lettres et jamais tapée au clavier : une insécable
 *  est invisible dans un diff, et deux relecteurs ne voient pas la même chose
 *  selon leur éditeur. */
export const INSECABLE = ' '

export function euros(montant: number): string {
  const arrondi = Math.round(montant)
  const texte = String(Math.abs(arrondi)).replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE)
  return `${arrondi < 0 ? '−' : ''}${texte}${INSECABLE}€`
}

export function pourcent(valeur: number, decimales = 2): string {
  return `${valeur.toFixed(decimales).replace('.', ',').replace(/,?0+$/, '')}${INSECABLE}%`
}

/** La valeur nette du logement, crédit déduit. `null` s'il n'y a pas de
 *  logement — ce qui n'est pas la même chose qu'un logement sans valeur. */
export function valeurNetteLogement(situation: Situation): number | null {
  if (situation.logement === null) return null
  return situation.logement.valeurEur - situation.logement.capitalRestantDuEur
}

function detailLogement(situation: Situation): string {
  const logement = situation.logement
  if (logement === null) return ''
  if (logement.capitalRestantDuEur <= 0) return `${euros(logement.valeurEur)}, sans crédit`
  return `${euros(logement.valeurEur)} moins ${euros(logement.capitalRestantDuEur)} de crédit restant`
}

export function valoriser(situation: Situation): Patrimoine {
  const montants: Record<Poche, number | null> = {
    liquidites: situation.livretsEur,
    assuranceVie: situation.assuranceVieEur,
    bourse: situation.bourseEur,
    immobilier: valeurNetteLogement(situation),
  }

  const lignes: LignePoche[] = POCHES.map((poche) => ({
    poche,
    montantEur: montants[poche],
    detail: poche === 'immobilier' ? detailLogement(situation) : '',
  }))

  const connues = lignes.filter((ligne) => ligne.montantEur !== null)
  const pochesInconnues = lignes
    .filter((ligne) => ligne.montantEur === null)
    .map((ligne) => ligne.poche)

  return {
    lignes,
    totalEur: connues.reduce((somme, ligne) => somme + (ligne.montantEur ?? 0), 0),
    partiel: pochesInconnues.length > 0,
    pochesInconnues,
  }
}

/**
 * La part d'une poche dans le total.
 *
 * Rend `null` sur un patrimoine vide plutôt que de diviser par zéro : le cas
 * arrive au tout premier essai, quand quelqu'un ouvre le formulaire pour voir à
 * quoi il ressemble, et c'est le pire moment pour afficher `NaN`.
 */
export function partPct(patrimoine: Patrimoine, poche: Poche): number | null {
  if (patrimoine.totalEur <= 0) return null
  const ligne = patrimoine.lignes.find((ligne) => ligne.poche === poche)
  if (ligne === undefined || ligne.montantEur === null) return null
  return (ligne.montantEur / patrimoine.totalEur) * 100
}

export function montant(patrimoine: Patrimoine, poche: Poche): number | null {
  return patrimoine.lignes.find((ligne) => ligne.poche === poche)?.montantEur ?? null
}

// ───────────────────────────────────────────────────────────────────────────
// L'épargne de précaution
// ───────────────────────────────────────────────────────────────────────────
//
// Le formulaire demande un revenu, pas des dépenses — parce que personne ne
// connaît ses dépenses mensuelles de tête, et qu'une question sans réponse
// franche fait abandonner le formulaire. Le revenu net est donc pris comme
// approximation, et l'approximation est **écrite dans le rapport**.
//
// Trois mois est le plancher qui fait consensus ; six le plafond au-delà duquel
// l'argent immobilisé coûte plus qu'il ne rassure. Entre les deux, on ne dit
// rien : c'est une zone de confort personnel, pas une erreur à corriger.

export const MOIS_RESERVE_MIN = 3
export const MOIS_RESERVE_MAX = 6

export type Reserve = {
  readonly planchereur: number
  readonly plafondEur: number
  readonly disponibleEur: number
  readonly moisCouverts: number
  readonly etat: 'insuffisante' | 'juste' | 'excedentaire'
  /** Ce qui dort au-delà du plafond. Zéro quand la réserve est saine — c'est ce
   *  montant, et lui seul, qu'il est légitime de proposer de placer ailleurs. */
  readonly excedentEur: number
}

export function reserve(situation: Situation): Reserve | null {
  const disponible = situation.livretsEur
  if (disponible === null || situation.revenuMensuelNetEur <= 0) return null

  const planchereur = situation.revenuMensuelNetEur * MOIS_RESERVE_MIN
  const plafondEur = situation.revenuMensuelNetEur * MOIS_RESERVE_MAX
  const moisCouverts = disponible / situation.revenuMensuelNetEur

  const etat = disponible < planchereur ? 'insuffisante' : disponible > plafondEur ? 'excedentaire' : 'juste'

  return {
    planchereur,
    plafondEur,
    disponibleEur: disponible,
    moisCouverts,
    etat,
    excedentEur: Math.max(0, disponible - plafondEur),
  }
}
