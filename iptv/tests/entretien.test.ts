import assert from 'node:assert/strict'
import test from 'node:test'

import { ouvrirDepot } from '../src/cache/depot.ts'
import { importerM3U } from '../src/cache/importer.ts'
import {
  choisirCandidats,
  ranimerFlux,
  rangerCatalogue,
  testerCatalogue,
} from '../src/entretien/taches.ts'

const LISTE = [
  '#EXTM3U',
  '#EXTINF:-1 group-title="FR | TNT",TF1 HD',
  'http://exemple.tv/live/1.m3u8',
  '#EXTINF:-1 group-title="FR | TNT",France 2',
  'http://exemple.tv/live/2.m3u8',
  '#EXTINF:-1 group-title="FR | SPORT",beIN SPORTS 1',
  'http://exemple.tv/live/3.m3u8',
  '#EXTINF:-1 group-title="FILMS | POLICIER",Le Dernier Témoin (2019)',
  'http://exemple.tv/movie/7.mkv',
].join('\n')

async function catalogue() {
  const depot = ouvrirDepot(':memory:')
  await importerM3U(depot, LISTE, { adresse: 'http://exemple.tv/get.php' })
  return depot
}

function reponse(corps: string, init: ResponseInit = {}): Response {
  return new Response(corps, init)
}

test('un balayage par lots se termine, même quand tout est indécis', async () => {
  // Le défaut que ce test existe pour empêcher : un flux « indécis » n'est
  // jamais condamné — et s'il n'est pas non plus horodaté, il revient dans
  // chaque lot. L'interface, qui rappelle tant qu'il reste quelque chose,
  // tournerait alors indéfiniment sur un fournisseur qui rend des 403.
  const depot = await catalogue()
  const refus: OptionsFetch = async () => reponse('', { status: 403 })

  let tours = 0
  while (choisirCandidats(depot).length > 0) {
    tours += 1
    assert.ok(tours <= 10, 'le balayage ne se termine pas')
    const lot = choisirCandidats(depot, { lot: 2 })
    const bilan = await testerCatalogue(depot, lot, { fetch: refus })
    assert.equal(bilan.inconnu, lot.length, 'un 403 laisse indécis')
  }

  assert.equal(tours, 2, '4 entrées par lots de 2')
  // Et rien n'a été masqué : un doute ne condamne pas.
  assert.equal(depot.compter(), 4)
  assert.equal(depot.compterParEtat().morts, 0)
})

type OptionsFetch = NonNullable<Parameters<typeof testerCatalogue>[2]>['fetch']

test('ce qui est vu refuser pour de bon est masqué, le reste non', async () => {
  const depot = await catalogue()
  const avant = depot.compter()

  const selonUrl: OptionsFetch = async (url) =>
    String(url).includes('/live/1')
      ? reponse('#EXTM3U\n#EXTINF:9,\ns.ts\n')
      : reponse('', { status: 404, statusText: 'Not Found' })

  const bilan = await testerCatalogue(depot, choisirCandidats(depot), { fetch: selonUrl })
  assert.equal(bilan.ok, 1)
  assert.equal(bilan.mort, avant - 1)
  assert.equal(depot.compter(), 1, 'seul le vivant reste visible')
})

test('« ranimer » remet tout en jeu, y compris ce qui était seulement horodaté', async () => {
  const depot = await catalogue()
  await testerCatalogue(depot, choisirCandidats(depot), {
    fetch: async () => reponse('', { status: 403 }),
  })
  assert.equal(choisirCandidats(depot).length, 0, 'plus rien à tester')

  ranimerFlux(depot)
  assert.equal(choisirCandidats(depot).length, 4, 'tout est de nouveau à éprouver')
})

test('le rangement rend de quoi l’afficher, sans rien décider de l’affichage', async () => {
  const depot = await catalogue()
  const bilan = rangerCatalogue(depot)

  assert.equal(bilan.chaines, 3)
  assert.equal(bilan.numerotees, 2, 'TF1 et France 2 ; beIN SPORTS suit par famille')

  const films = bilan.dossiers.find((dossier) => dossier.genre === 'film')
  assert.equal(films?.nommes, 1, 'un thème : Policier')
  // Les séries sont absentes du catalogue : le dossier ne remonte pas plutôt
  // que de remonter à zéro, ce qui obligerait l'affichage à filtrer lui-même.
  assert.equal(
    bilan.dossiers.some((dossier) => dossier.genre === 'serie'),
    false,
  )
})

test('un lot ne dépasse jamais ce qu’on lui demande', async () => {
  const depot = await catalogue()
  assert.equal(choisirCandidats(depot, { lot: 3 }).length, 3)
  assert.equal(choisirCandidats(depot, { lot: 99 }).length, 4)
  assert.equal(choisirCandidats(depot, { genre: 'film' }).length, 1)
})
