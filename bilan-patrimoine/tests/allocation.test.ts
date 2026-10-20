import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyserAllocation,
  type CiblesAllocation,
  type ValeursAllocation,
} from '../src/allocation.ts'

const VALEURS: ValeursAllocation = {
  liquidites: 14400,
  assuranceVie: 12000,
  bourse: 16584,
  crypto: 5006,
  immobilier: 71500,
}

const CIBLES: CiblesAllocation = {
  liquidites: 10,
  assuranceVie: 20,
  bourse: 40,
  crypto: 10,
  immobilier: 20,
}

test('compare les parts réelles aux cibles, avec les écarts en euros et points', () => {
  const bilan = analyserAllocation(VALEURS, CIBLES)
  const immobilier = bilan.lignes.find((ligne) => ligne.poche === 'immobilier')

  assert.equal(bilan.totalEur, 119490)
  assert.ok(Math.abs((immobilier?.partPct ?? 0) - 59.837643735) < 0.000001)
  assert.ok(Math.abs((immobilier?.ecartPoints ?? 0) - 39.837643735) < 0.000001)
  assert.equal(immobilier?.ecartEur, 47602)
})

test('simule un apport uniquement vers les poches sous la cible', () => {
  const apport = 500
  const cibleAvecPochesSousPonderees: CiblesAllocation = {
    liquidites: 20,
    assuranceVie: 20,
    bourse: 20,
    crypto: 10,
    immobilier: 30,
  }
  const resultat = analyserAllocation(VALEURS, cibleAvecPochesSousPonderees, apport)
  const parPoche = Object.fromEntries(resultat.lignes.map((ligne) => [ligne.poche, ligne.apportSimuleEur]))

  assert.ok(Math.abs(Object.values(parPoche).reduce((somme, montant) => somme + montant, 0) - apport) < 1e-9)
  assert.equal(parPoche.immobilier, 0)
  assert.ok(parPoche.liquidites > 0)
  assert.ok(parPoche.assuranceVie > 0)
  assert.ok(parPoche.bourse > 0)
  assert.ok(parPoche.crypto > 0)
})

test('les versements arrondis au centime retombent exactement sur le montant saisi', () => {
  const resultat = analyserAllocation(VALEURS, CIBLES, 123.456)
  const somme = resultat.lignes.reduce((total, ligne) => total + ligne.apportSimuleEur, 0)

  assert.equal(resultat.apportMensuelEur, 123.46)
  assert.equal(somme, 123.46)
})

test('un patrimoine sans valeur ne produit pas de parts inventées', () => {
  const valeurs: ValeursAllocation = {
    liquidites: 0, assuranceVie: 0, bourse: 0, crypto: 0, immobilier: 0,
  }
  const resultat = analyserAllocation(valeurs, CIBLES, 100)

  assert.equal(resultat.totalEur, 0)
  assert.ok(resultat.lignes.every((ligne) => ligne.partPct === null && ligne.ecartPoints === null))
  assert.ok(Math.abs(resultat.lignes.reduce((somme, ligne) => somme + ligne.apportSimuleEur, 0) - 100) < 1e-9)
})

test('refuse des cibles qui ne totalisent pas 100 %', () => {
  assert.throws(
    () => analyserAllocation(VALEURS, { ...CIBLES, immobilier: 19 }),
    /totaliser 100 %/,
  )
})

test('refuse une valeur négative hors poche immobilière', () => {
  assert.throws(
    () => analyserAllocation({ ...VALEURS, bourse: -1 }, CIBLES),
    /Valeur invalide/,
  )
})

test('refuse un apport négatif', () => {
  assert.throws(() => analyserAllocation(VALEURS, CIBLES, -1), /positif ou nul/)
})
