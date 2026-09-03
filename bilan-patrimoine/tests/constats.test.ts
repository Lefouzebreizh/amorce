import assert from 'node:assert/strict'
import test from 'node:test'

import { SEUIL_MONTANT_UTILE_EUR, constater } from '../src/constats.ts'
import type { Situation } from '../src/modeles.ts'

/** Une date où tous les barèmes livrés sont encore en vigueur : c'est la seule
 *  façon d'éprouver le chiffrage lui-même, séparément de la péremption. */
const FRAIS = new Date('2026-09-15T12:00:00Z')
/** Une date où ils sont tous périmés — pour éprouver le refus de chiffrer. */
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

function cles(situation: Partial<Situation>, le = FRAIS): string[] {
  return constater({ ...BASE, ...situation }, le).map((constat) => constat.cle)
}

function constat(situation: Partial<Situation>, cle: string, le = FRAIS) {
  return constater({ ...BASE, ...situation }, le).find((constat) => constat.cle === cle)
}

test('une assurance vie sous la moyenne du marché est chiffrée', () => {
  const trouve = constat({}, 'assurance_vie_sous_moyenne')
  // (2,6 − 1,9) % de 22 000 € = 154 €
  assert.ok(Math.abs((trouve?.coutAnnuelEur ?? 0) - 154) < 0.01)
})

test('une assurance vie au-dessus de la moyenne ne déclenche rien', () => {
  assert.ok(!cles({ tauxAssuranceViePct: 3.2 }).includes('assurance_vie_sous_moyenne'))
})

test('un taux d’assurance vie inconnu ne conclut ni bien ni mal', () => {
  // Il ouvre au contraire le seul constat honnête : on ne sait pas, et voici
  // où le chiffre se trouve.
  const sans = cles({ tauxAssuranceViePct: null })
  assert.ok(sans.includes('assurance_vie_taux_inconnu'))
  assert.ok(!sans.includes('assurance_vie_sous_moyenne'))
})

test('sans assurance vie du tout, aucun des deux constats ne sort', () => {
  const sans = cles({ assuranceVieEur: null, tauxAssuranceViePct: null })
  assert.ok(!sans.some((cle) => cle.startsWith('assurance_vie')))
})

test('un revenu sous le plafond fait signaler le LEP', () => {
  const trouve = constat({}, 'lep_probable')
  // (2,5 − 1,7) % sur le plafond LEP de 10 000 €, l'épargne le dépassant.
  assert.ok(Math.abs((trouve?.coutAnnuelEur ?? 0) - 80) < 0.01)
})

test('le LEP se mesure sur l’épargne réelle quand elle est sous le plafond', () => {
  // 4 000 € donnerait 32 €, sous le seuil utile de 40 € — le constat
  // disparaîtrait alors entièrement, pas seulement son montant. 6 000 € garde
  // ce test dans le régime qu'il éprouve : sous le plafond, mais utile.
  const trouve = constat({ livretsEur: 6000 }, 'lep_probable')
  assert.ok(Math.abs((trouve?.coutAnnuelEur ?? 0) - 48) < 0.01)
})

test('un revenu élevé ne fait pas espérer le LEP', () => {
  assert.ok(!cles({ revenuMensuelNetEur: 6000 }).includes('lep_probable'))
})

test('le plafond LEP tient compte du nombre de parts du foyer', () => {
  // Un célibataire à 2 800 € nets dépasse le plafond d'une part ; le même
  // revenu dans un foyer de deux adultes et un enfant reste dessous.
  assert.ok(!cles({ foyer: { adultes: 1, enfants: 0 } }).includes('lep_probable'))
  assert.ok(cles({ foyer: { adultes: 2, enfants: 1 } }).includes('lep_probable'))
})

test('un barème périmé fait disparaître le montant, jamais le constat', () => {
  // Le fait qualitatif reste vrai ; c'est le chiffre qui deviendrait faux.
  const trouve = constat({}, 'assurance_vie_sous_moyenne', PERIME)
  assert.ok(trouve !== undefined, 'le constat doit rester')
  assert.equal(trouve?.coutAnnuelEur, null, 'le montant doit disparaître')
})

test('l’excédent oisif ne sort que sur un horizon lointain', () => {
  // C'est ce qui justifie la seule question « conseil » du formulaire : sans
  // elle, impossible de dire si de l'argent disponible est une sagesse.
  // Taux fixé au-dessus de l'inflation à dessein : ce test isole l'effet de
  // l'horizon, pas celui de l'érosion — déjà couvert par le test suivant.
  const auDessusDeLinflation = { tauxLivretsPct: 3 }
  assert.ok(!cles({ ...auDessusDeLinflation, horizon: '3ans' }).includes('excedent_sans_emploi'))
  assert.ok(cles({ ...auDessusDeLinflation, horizon: '10ans' }).includes('excedent_sans_emploi'))
  assert.ok(cles({ ...auDessusDeLinflation, horizon: 'retraite' }).includes('excedent_sans_emploi'))
})

test('quand l’argent s’érode vraiment, c’est le constat chiffré qui parle', () => {
  // Une inflation supérieure au taux servi fait passer la main à
  // `epargne_qui_dort`, qui porte un montant — les deux ne s'affichent jamais
  // ensemble, ils diraient la même chose deux fois.
  const erosion = cles({ tauxLivretsPct: 0.2 })
  assert.ok(erosion.includes('epargne_qui_dort'))
  assert.ok(!erosion.includes('excedent_sans_emploi'))
})

test('une réserve trop mince passe avant tout le reste, sans être chiffrée', () => {
  const maigre = constat({ livretsEur: 3000 }, 'reserve_insuffisante')
  assert.ok(maigre !== undefined)
  // Un risque, pas un coût : le chiffrer en euros par an serait inventer.
  assert.equal(maigre?.coutAnnuelEur, null)
})

test('une épargne excédentaire produit d’abord un encouragement', () => {
  const trouves = constater(BASE, FRAIS)
  assert.ok(trouves.some((constat) => constat.ton === 'bravo'))
})

test('un patrimoine presque entièrement immobilier est signalé', () => {
  const concentre = cles({ livretsEur: 3000, assuranceVieEur: 0, bourseEur: 0 })
  assert.ok(concentre.includes('tout_sur_immobilier'))
})

test('un propriétaire ordinaire ne se fait pas crier dessus', () => {
  // Seuil volontairement haut : être « trop » en immobilier est la situation
  // normale d'un Français qui rembourse.
  assert.ok(!cles({}).includes('tout_sur_immobilier'))
})

test('un constat sous le seuil utile ne dérange personne', () => {
  // Le geste à faire coûterait plus de temps que l'économie ne rapporte.
  const minuscule = constater({ ...BASE, assuranceVieEur: 500, tauxAssuranceViePct: 1.9 }, FRAIS)
  const trouve = minuscule.find((constat) => constat.cle === 'assurance_vie_sous_moyenne')
  assert.equal(trouve, undefined)
  assert.ok((500 * 0.7) / 100 < SEUIL_MONTANT_UTILE_EUR)
})

test('les constats chiffrés viennent en premier, du plus cher au moins cher', () => {
  const chiffres = constater(BASE, FRAIS)
    .map((constat) => constat.coutAnnuelEur)
    .filter((montant): montant is number => montant !== null)
  assert.deepEqual(chiffres, [...chiffres].sort((a, b) => b - a))
})

test('aucun constat ne nomme un produit commercial', () => {
  // On informe et on chiffre ; recommander un contrat par son nom relèverait
  // du conseil réglementé.
  const interdits = /boursorama|fortuneo|linxea|yomoni|nalo|placement-direct|spirica|suravenir/i
  for (const situation of [BASE, { ...BASE, livretsEur: 3000 }, { ...BASE, horizon: 'retraite' as const }]) {
    for (const constat of constater(situation, FRAIS)) {
      assert.doesNotMatch(constat.titre + constat.explication, interdits, constat.cle)
    }
  }
})

test('chaque constat chiffré cite les barèmes dont il dépend', () => {
  for (const constat of constater(BASE, FRAIS)) {
    if (constat.coutAnnuelEur !== null) {
      assert.ok(constat.appuiSur.length > 0, `${constat.cle} chiffre sans citer sa source`)
    }
  }
})

test('une réserve trop mince passe avant une optimisation plus rentable', () => {
  // Défaut trouvé en **lisant** un bilan, pas en le mesurant : le tri par euros
  // seul plaçait « droit au LEP, 60 €/an » devant « moins de deux mois de
  // matelas ». Un risque passe avant une optimisation, quel que soit son
  // montant — et le constat sur la réserve dit lui-même qu'il vient d'abord.
  const fragile = constater({
    ...BASE,
    revenuMensuelNetEur: 3400,
    livretsEur: 6000,
    assuranceVieEur: null,
    tauxAssuranceViePct: null,
    bourseEur: null,
    logement: { valeurEur: 232000, capitalRestantDuEur: 198000 },
  }, FRAIS).filter((constat) => constat.ton !== 'bravo')

  assert.equal(fragile[0]?.cle, 'reserve_insuffisante')
  assert.ok(fragile.some((constat) => constat.cle === 'lep_probable'), 'le LEP doit rester dit, mais après')
})
