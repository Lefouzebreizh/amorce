import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BAREMES,
  JOURS_AVANT_RELECTURE,
  PLAFONDS_EUR,
  VERIFIE_LE,
  bareme,
  baremesPerimes,
  joursDepuisVerification,
  tableAVerifier,
} from '../src/baremes.ts'

test('chaque barème porte sa source et ses deux dates', () => {
  // Sans source, un montant affiché à quelqu'un qui décide de son argent ne se
  // justifie plus. Sans dates, on ne sait pas s'il est encore vrai.
  for (const entree of BAREMES) {
    assert.ok(entree.source.length > 10, `${entree.cle} sans source`)
    assert.match(entree.enVigueurDepuis, /^\d{4}-\d{2}-\d{2}$/, entree.cle)
    assert.match(entree.prochaineRevision, /^\d{4}-\d{2}-\d{2}$/, entree.cle)
    assert.ok(entree.prochaineRevision > entree.enVigueurDepuis, `${entree.cle} : révision avant entrée en vigueur`)
  }
})

test('un barème dont la révision est passée est signalé périmé', () => {
  const apres = new Date('2027-03-01T00:00:00Z')
  const cles = baremesPerimes(apres).map((entree) => entree.cle)
  assert.ok(cles.includes('livret_a'), 'le Livret A se révise au 1er février')
})

test('avant sa révision, un barème ne l’est pas', () => {
  assert.equal(baremesPerimes(new Date('2026-09-02T00:00:00Z')).length, 0)
})

test('un barème inconnu lève au lieu de rendre zéro', () => {
  // Un taux manquant traité comme 0 % ferait apparaître un manque à gagner
  // spectaculaire et entièrement inventé.
  assert.throws(() => bareme('livret_z'), /Barème inconnu/)
})

test('la table réclame une relecture au-delà de deux cents jours', () => {
  const verifie = Date.parse(`${VERIFIE_LE}T00:00:00Z`)
  const juste = new Date(verifie + (JOURS_AVANT_RELECTURE - 1) * 86_400_000)
  const trop = new Date(verifie + (JOURS_AVANT_RELECTURE + 1) * 86_400_000)
  assert.equal(tableAVerifier(juste), false)
  assert.equal(tableAVerifier(trop), true)
})

test('le seuil de relecture couvre bien un semestre du Livret A', () => {
  // Le Livret A se révise tous les six mois : un seuil plus court crierait pour
  // rien, un seuil plus long laisserait passer une révision entière.
  assert.ok(JOURS_AVANT_RELECTURE > 182, 'plus court qu’un semestre')
  assert.ok(JOURS_AVANT_RELECTURE < 240, 'assez long pour rater une révision')
})

test('les plafonds réglementés sont ceux du Livret A, du LDDS et du LEP', () => {
  assert.equal(PLAFONDS_EUR.livret_a, 22950)
  assert.equal(PLAFONDS_EUR.ldds, 12000)
  assert.equal(PLAFONDS_EUR.lep, 10000)
})

test('la table livrée vient d’être relue, elle n’a pas besoin de l’être encore', () => {
  // Le pendant du test précédent : juste après une vraie relecture (celle du
  // 3 septembre 2026), le drapeau ne doit pas se lever. S'il se lève ici,
  // c'est que VERIFIE_LE n'a pas été mis à jour en même temps que les taux.
  assert.equal(joursDepuisVerification(new Date(`${VERIFIE_LE}T00:00:00Z`)) > JOURS_AVANT_RELECTURE, false)
})
