/**
 * Comparaison d'une répartition réelle avec une cible choisie par la personne.
 *
 * Ce module ne détermine aucune cible et ne nomme aucun produit. Il expose les
 * écarts arithmétiques, puis simule comment un apport pourrait les réduire
 * sans vente. Les valeurs arrivent depuis le navigateur ; rien n'est lu ni
 * conservé ici.
 */

export const POCHES_ALLOCATION = [
  'liquidites',
  'assuranceVie',
  'bourse',
  'crypto',
  'immobilier',
] as const

export type PocheAllocation = (typeof POCHES_ALLOCATION)[number]

export const LIBELLES_ALLOCATION: Readonly<Record<PocheAllocation, string>> = {
  liquidites: 'Épargne disponible',
  assuranceVie: 'Assurance vie',
  bourse: 'Bourse',
  crypto: 'Crypto-actifs',
  immobilier: 'Immobilier net',
}

export type ValeursAllocation = Readonly<Record<PocheAllocation, number>>
export type CiblesAllocation = Readonly<Record<PocheAllocation, number>>

export type LigneAllocation = {
  readonly poche: PocheAllocation
  readonly valeurEur: number
  readonly partPct: number | null
  readonly ciblePct: number
  readonly ecartPoints: number | null
  /** Positif = au-dessus de la cible, négatif = en dessous. */
  readonly ecartEur: number
  readonly apportSimuleEur: number
}

export type ResultatAllocation = {
  readonly totalEur: number
  readonly apportMensuelEur: number
  readonly lignes: readonly LigneAllocation[]
}

const SOMME_CIBLE = 100
const TOLERANCE_CIBLE = 0.01

/**
 * La décision de verser en priorité vers les poches sous-pondérées reprend la
 * logique du conseiller local. Aucun arbitrage de vente n'est calculé.
 */
export function analyserAllocation(
  valeurs: ValeursAllocation,
  cibles: CiblesAllocation,
  apportMensuelEur = 0,
): ResultatAllocation {
  for (const poche of POCHES_ALLOCATION) {
    const valeur = valeurs[poche]
    const cible = cibles[poche]
    if (!Number.isFinite(valeur) || (valeur < 0 && poche !== 'immobilier')) {
      throw new RangeError(`Valeur invalide pour « ${poche} ».`)
    }
    if (!Number.isFinite(cible) || cible < 0 || cible > SOMME_CIBLE) {
      throw new RangeError(`Cible invalide pour « ${poche} ».`)
    }
  }

  if (!Number.isFinite(apportMensuelEur) || apportMensuelEur < 0) {
    throw new RangeError('L’apport mensuel doit être un montant positif ou nul.')
  }
  const apportCentimesTotal = Math.round(apportMensuelEur * 100)
  const apportArrondiEur = apportCentimesTotal / 100

  const sommeCibles = POCHES_ALLOCATION.reduce((somme, poche) => somme + cibles[poche], 0)
  if (Math.abs(sommeCibles - SOMME_CIBLE) > TOLERANCE_CIBLE) {
    throw new RangeError(`Les cibles doivent totaliser ${SOMME_CIBLE} %.`)
  }

  const totalEur = POCHES_ALLOCATION.reduce((somme, poche) => somme + valeurs[poche], 0)
  const totalApresApport = totalEur + apportArrondiEur
  const besoins = Object.fromEntries(
    POCHES_ALLOCATION.map((poche) => [
      poche,
      Math.max(0, totalApresApport * cibles[poche] / SOMME_CIBLE - valeurs[poche]),
    ]),
  ) as Record<PocheAllocation, number>
  const besoinTotal = POCHES_ALLOCATION.reduce((somme, poche) => somme + besoins[poche], 0)

  const apportsCentimes = Object.fromEntries(
    POCHES_ALLOCATION.map((poche) => {
      const part = apportArrondiEur === 0
        ? 0
        : besoinTotal > 0
          ? apportArrondiEur * besoins[poche] / besoinTotal
          : apportArrondiEur * cibles[poche] / SOMME_CIBLE
      return [poche, Math.round(part * 100)]
    }),
  ) as Record<PocheAllocation, number>
  const residuelCentimes = apportCentimesTotal
    - POCHES_ALLOCATION.reduce((somme, poche) => somme + apportsCentimes[poche], 0)
  if (residuelCentimes !== 0) {
    const pocheResiduelle = [...POCHES_ALLOCATION].sort(
      (gauche, droite) => besoins[droite] - besoins[gauche],
    )[0]
    if (pocheResiduelle) apportsCentimes[pocheResiduelle] += residuelCentimes
  }

  const lignes = POCHES_ALLOCATION.map((poche): LigneAllocation => {
    const valeur = valeurs[poche]
    const cible = cibles[poche]
    const partPct = totalEur > 0 ? valeur / totalEur * SOMME_CIBLE : null
    const ecartEur = valeur - totalEur * cible / SOMME_CIBLE
    const apportSimuleEur = apportsCentimes[poche] / 100

    return {
      poche,
      valeurEur: valeur,
      partPct,
      ciblePct: cible,
      ecartPoints: partPct === null ? null : partPct - cible,
      ecartEur,
      apportSimuleEur,
    }
  })

  return { totalEur, apportMensuelEur: apportArrondiEur, lignes }
}
