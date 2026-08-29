import assert from 'node:assert/strict'
import test from 'node:test'

import { ouvrirDepot } from '../src/cache/depot.ts'
import { importerEpg, importerM3U } from '../src/cache/importer.ts'
import { guideDemo, LISTE_DEMO } from '../src/demo.ts'

test('la démonstration remplit un catalogue des trois genres', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    const resume = await importerM3U(depot, LISTE_DEMO, { adresse: 'demonstration' })
    assert.equal(resume.ecrits, 7)
    // Les trois genres doivent être représentés : c'est ce qui fait qu'un
    // nouveau venu voit les trois écrans remplis plutôt qu'un seul.
    assert.ok(depot.compter({ genre: 'direct' }) > 0)
    assert.ok(depot.compter({ genre: 'film' }) > 0)
    assert.ok(depot.compter({ genre: 'serie' }) > 0)

    // Et le nettoyage des titres se voit : « FR | Flux de test HLS FHD »
    // ressort sans son préfixe de pays ni sa définition.
    const chaines = depot.lister({ genre: 'direct' }).map((element) => element.titre)
    assert.ok(chaines.includes('Flux de test HLS'), chaines.join(' / '))
  } finally {
    depot.fermer()
  }
})

test('le guide de démonstration est toujours « en ce moment »', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    await importerM3U(depot, LISTE_DEMO, { adresse: 'demonstration' })
    // Calé sur l'instant du lancement : une grille écrite en dur serait vide
    // dès le lendemain, et la démonstration montrerait une case blanche.
    await importerEpg(depot, guideDemo())
    const antennes = depot.maintenant(['demo.mux'])
    assert.equal(antennes.get('demo.mux')?.actuel?.titre, 'Émission de démonstration')
    assert.equal(antennes.get('demo.mux')?.suivant?.titre, 'Ce qui suit')
  } finally {
    depot.fermer()
  }
})

test('les flux de démonstration sont publics, sans identifiant', () => {
  // Une liste versionnée ne doit contenir aucun abonnement : la règle du
  // projet vaut aussi pour ses propres données d'exemple.
  assert.ok(!/username=|password=|get\.php/i.test(LISTE_DEMO), LISTE_DEMO)
  for (const ligne of LISTE_DEMO.split('\n')) {
    if (ligne.startsWith('#') || ligne.trim() === '') continue
    assert.match(ligne, /^https:\/\//, `flux non chiffré : ${ligne}`)
  }
})
