import assert from 'node:assert/strict'
import test from 'node:test'

import type { Situation } from '../src/modeles.ts'
import {
  INSECABLE,
  MOIS_RESERVE_MAX,
  euros,
  montant,
  partPct,
  pourcent,
  reserve,
  valeurNetteLogement,
  valoriser,
} from '../src/valorisation.ts'

const BASE: Situation = {
  age: '30-39',
  foyer: { adultes: 2, enfants: 1 },
  revenuMensuelNetEur: 2800,
  horizon: '10ans',
  livretsEur: 31000,
  tauxLivretsPct: null,
  assuranceVieEur: 22000,
  tauxAssuranceViePct: 1.9,
  bourseEur: 4200,
  logement: { valeurEur: 148000, capitalRestantDuEur: 76500 },
}

function situation(modifs: Partial<Situation> = {}): Situation {
  return { ...BASE, ...modifs }
}

test('un bien compte pour sa valeur nette de crédit', () => {
  assert.equal(valeurNetteLogement(BASE), 71500)
  assert.equal(montant(valoriser(BASE), 'immobilier'), 71500)
})

test('le crédit reste affiché à côté de l’estimation', () => {
  // Sans quoi un bien de 148 000 € disparaît derrière 71 500 €, et l'effet de
  // levier avec lui.
  const ligne = valoriser(BASE).lignes.find((ligne) => ligne.poche === 'immobilier')
  assert.match(ligne?.detail ?? '', /148/)
  assert.match(ligne?.detail ?? '', /76/)
})

test('une poche non renseignée ne compte pas pour zéro', () => {
  // La décision la plus importante du module : compter zéro afficherait un
  // patrimoine faux avec l'aplomb d'un patrimoine juste.
  const partiel = valoriser(situation({ assuranceVieEur: null }))
  assert.equal(partiel.partiel, true)
  assert.deepEqual(partiel.pochesInconnues, ['assuranceVie'])
  assert.equal(partiel.totalEur, 31000 + 4200 + 71500)
})

test('une poche renseignée à zéro est connue, et le dit', () => {
  const complet = valoriser(situation({ assuranceVieEur: 0 }))
  assert.equal(complet.partiel, false)
  assert.equal(montant(complet, 'assuranceVie'), 0)
})

test('l’absence de logement n’est pas un logement sans valeur', () => {
  assert.equal(valeurNetteLogement(situation({ logement: null })), null)
})

test('un patrimoine vide ne divise pas par zéro', () => {
  // Le cas du tout premier essai, quand quelqu'un ouvre le formulaire pour voir
  // à quoi il ressemble — le pire moment pour afficher « NaN ».
  const vide = valoriser(situation({
    livretsEur: 0, assuranceVieEur: 0, bourseEur: 0, logement: null,
  }))
  assert.equal(partPct(vide, 'immobilier'), null)
})

test('les montants s’écrivent à la française, en espaces insécables', () => {
  // Écrites ` ` en toutes lettres : une insécable tapée au clavier est
  // invisible dans un diff, et c'est ainsi qu'on en perd une sans le voir.
  assert.equal(euros(128700), `128 700 €`)
  assert.equal(euros(950), `950 €`)
  assert.equal(pourcent(1.7), `1,7 %`)
  assert.equal(INSECABLE, ' ')
})

test('un montant négatif porte un vrai signe moins, pas un trait d’union', () => {
  assert.equal(euros(-1200), `−1 200 €`)
})

test('la réserve se juge en mois de revenus', () => {
  const etat = reserve(BASE)
  assert.equal(etat?.etat, 'excedentaire')
  assert.ok(Math.abs((etat?.moisCouverts ?? 0) - 31000 / 2800) < 1e-9)
  assert.equal(etat?.excedentEur, 31000 - 2800 * MOIS_RESERVE_MAX)
})

test('les trois états de la réserve se déclenchent aux bons seuils', () => {
  assert.equal(reserve(situation({ livretsEur: 2800 * 2 }))?.etat, 'insuffisante')
  assert.equal(reserve(situation({ livretsEur: 2800 * 4 }))?.etat, 'juste')
  assert.equal(reserve(situation({ livretsEur: 2800 * 7 }))?.etat, 'excedentaire')
})

test('une réserve saine n’a pas d’excédent à placer', () => {
  assert.equal(reserve(situation({ livretsEur: 2800 * 4 }))?.excedentEur, 0)
})

test('sans épargne renseignée, la réserve ne se juge pas', () => {
  assert.equal(reserve(situation({ livretsEur: null })), null)
})
