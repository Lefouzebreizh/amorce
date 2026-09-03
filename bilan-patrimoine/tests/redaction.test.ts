import assert from 'node:assert/strict'
import test from 'node:test'

import type { Situation } from '../src/modeles.ts'
import { CONSTATS_MONTRES_MAX, rediger } from '../src/redaction.ts'

const FRAIS = new Date('2026-09-15T12:00:00Z')
const PERIME = new Date('2027-04-01T12:00:00Z')

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

function texte(modifs: Partial<Situation> = {}, le = FRAIS): string {
  return rediger({ ...BASE, ...modifs }, le).texte
}

test('le rapport ouvre sur le total, pas sur un reproche', () => {
  assert.match(texte().split('\n')[0] ?? '', /Vous avez/)
})

test('ce qui va bien se lit avant ce qui coûte', () => {
  // Un bilan qui commence par les problèmes fait fermer l'onglet : la personne
  // est venue inquiète et repart inquiète, sans avoir rien lu.
  const rapport = texte()
  assert.ok(rapport.indexOf('Ce qui va bien') < rapport.indexOf('Ce qui vous coûte'))
})

test('jamais plus de trois choses à corriger', () => {
  // Sept constats vrais valent moins qu'un seul suivi.
  const rapport = rediger({ ...BASE, livretsEur: 40000, tauxLivretsPct: 0.1 }, FRAIS)
  const montres = (rapport.texte.match(/^\*\*\d\. /gm) ?? []).length
  assert.ok(montres <= CONSTATS_MONTRES_MAX, `${montres} constats affichés`)
})

test('le rapport se termine par un seul geste', () => {
  const rapport = texte()
  assert.match(rapport, /Si vous ne faites qu'une chose ce mois-ci/)
  assert.equal((rapport.match(/Si vous ne faites qu'une chose/g) ?? []).length, 1)
})

test('le premier geste est le plus facile, pas le plus cher', () => {
  // Le LEP se règle en cinq minutes ; une assurance vie en plusieurs semaines.
  // Un premier geste réussi vaut mieux qu'un chantier reporté.
  assert.match(texte(), /avis d'imposition/)
})

test('un total incomplet s’annonce comme un plancher', () => {
  const partiel = texte({ assuranceVieEur: null, tauxAssuranceViePct: null })
  assert.match(partiel, /Ce total est un minimum/)
  assert.match(partiel, /assurance vie/i)
})

test('des barèmes périmés retirent les montants et le disent en tête', () => {
  const rapport = texte({}, PERIME)
  assert.match(rapport, /taux de référence/)
  // L'avertissement ouvre le rapport : lu après le conseil, il arrive quand la
  // décision est déjà prise.
  assert.ok(rapport.indexOf('⚠️') < 5)
  assert.doesNotMatch(rapport, /par an\.\*\*/)
})

test('des barèmes frais laissent les montants s’afficher', () => {
  assert.match(texte(), /Environ .* par an/)
  assert.doesNotMatch(texte(), /⚠️/)
})

test('le drapeau de relecture est levé tant que la table n’a pas été revue', () => {
  // Rien ne doit sortir en production avec ce drapeau : c'est le verrou qui
  // empêche de livrer des chiffres de l'an dernier.
  assert.equal(rediger(BASE, PERIME).baremesARelire, true)
  assert.equal(rediger(BASE, FRAIS).baremesARelire, false)
})

test('le texte ne contient aucun jargon financier', () => {
  // « Arbitrage », « allocation d'actifs », « unités de compte » : chacun de
  // ces mots fait décrocher exactement le lecteur que cet outil vise.
  const jargon = /arbitrage|allocation d'actifs|unités de compte|volatilité|sous-jacent|encours|SICAV/i
  for (const modifs of [{}, { livretsEur: 3000 }, { horizon: 'retraite' as const }, { tauxLivretsPct: 0.1 }]) {
    assert.doesNotMatch(texte(modifs), jargon, JSON.stringify(modifs))
  }
})

test('la composition du patrimoine se détaille poche par poche', () => {
  const rapport = texte()
  for (const attendu of ['Épargne disponible', 'Assurance vie', 'Bourse', 'Immobilier']) {
    assert.ok(rapport.includes(attendu), attendu)
  }
})

test('une poche à zéro ne s’affiche pas dans la composition', () => {
  // Afficher « Bourse : 0 € » donne l'impression d'un manque là où il n'y a
  // qu'une case non cochée.
  assert.doesNotMatch(texte({ bourseEur: 0 }), /\*\*Bourse\*\* : 0/)
})

test('une situation sans rien à corriger le dit franchement', () => {
  // Un écran vide se lit comme une panne ; un feu vert doit se lire comme un
  // feu vert.
  // La réserve se compte en mois du revenu **de cette situation** : quatre mois
  // de 6 000 € et non de 2 800 €. Le premier jet de ce test se trompait de
  // revenu et déclenchait « réserve insuffisante » — le code avait raison.
  const saine = texte({
    livretsEur: 6000 * 4, assuranceVieEur: 40000, tauxAssuranceViePct: 3.4,
    bourseEur: 30000, revenuMensuelNetEur: 6000, logement: null,
  })
  assert.match(saine, /Ce qui va bien/)
  assert.match(saine, /rien trouvé qui vous coûte/)
})

test('un formulaire vide ne plante pas et ne raconte rien', () => {
  const vide = texte({
    livretsEur: null, assuranceVieEur: null, tauxAssuranceViePct: null,
    bourseEur: null, logement: null,
  })
  assert.match(vide, /pas encore assez d'éléments/)
})

test('le premier geste ne contredit jamais le premier constat', () => {
  // Proposer d'ouvrir un LEP à quelqu'un dont le matelas couvre deux mois va
  // contre le conseil qu'on vient de lui donner deux paragraphes plus haut.
  const fragile = texte({
    revenuMensuelNetEur: 3400,
    livretsEur: 6000,
    assuranceVieEur: null,
    tauxAssuranceViePct: null,
    bourseEur: null,
    logement: { valeurEur: 232000, capitalRestantDuEur: 198000 },
  })
  assert.match(fragile, /\*\*1\. Votre matelas de sécurité/)
  assert.match(fragile, /Si vous ne faites qu'une chose ce mois-ci :\*\* mettez en place un virement/)
  assert.doesNotMatch(fragile.split('Si vous ne faites')[1] ?? '', /LEP/)
})
