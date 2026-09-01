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

test('le rangement dédoublonne aussi, et le dit dans son bilan', async () => {
  // Le cas réel : un panneau Xtream classe TF1 dans plusieurs catégories
  // qualité à la fois, et chacune ressort comme une entrée séparée.
  const depot = ouvrirDepot(':memory:')
  await importerM3U(
    depot,
    [
      '#EXTM3U',
      '#EXTINF:-1 group-title="FR | TNT",TF1 SD',
      'http://exemple.tv/live/tf1sd.m3u8',
      '#EXTINF:-1 group-title="FR | TNT HD",TF1 HD',
      'http://exemple.tv/live/tf1hd.m3u8',
      '#EXTINF:-1 group-title="FR | TNT",France 2',
      'http://exemple.tv/live/f2.m3u8',
    ].join('\n'),
    { adresse: 'http://exemple.tv/fr.m3u' },
  )

  const bilan = rangerCatalogue(depot)
  assert.equal(bilan.avant.chaines, 3, 'les trois entrées sont bien arrivées, avant nettoyage')
  assert.equal(bilan.doublonsMasques, 1, 'un seul doublon : TF1 SD, au profit de TF1 HD')
  assert.equal(bilan.apres.chaines, 2, 'TF1 (une fois) et France 2')
  assert.equal(depot.compter({ genre: 'direct' }), 2)
  assert.equal(depot.compter({ genre: 'direct', inclureMorts: true }), 3, 'rien n’est supprimé')

  depot.fermer()
})

test('un lot ne dépasse jamais ce qu’on lui demande', async () => {
  const depot = await catalogue()
  assert.equal(choisirCandidats(depot, { lot: 3 }).length, 3)
  assert.equal(choisirCandidats(depot, { lot: 99 }).length, 4)
  assert.equal(choisirCandidats(depot, { genre: 'film' }).length, 1)
})

test('les chaînes rangées en films par une règle d’avant reviennent au direct', async () => {
  // Le cas réel, remonté sur une vraie base : « Ciné+ Classic », « Canal+
  // Cinemas », « Ciné Action by Pluto TV » — des chaînes, dans l'onglet Films.
  // Elles y étaient parce que leur groupe s'appelle « Cinema » et que la règle
  // de l'époque faisait confiance au nom du groupe. La règle a été corrigée,
  // mais le genre est calculé à l'import : sans reclassement, ces entrées y
  // seraient restées pour toujours.
  const depot = ouvrirDepot(':memory:')
  await importerM3U(
    depot,
    [
      '#EXTM3U',
      '#EXTINF:-1 group-title="Cinema",Ciné+ Classic',
      'https://exemple.tv/hls/cineplus.m3u8',
      '#EXTINF:-1 group-title="Movies",Canal+ Cinemas',
      'https://exemple.tv/hls/canalcine.m3u8',
      '#EXTINF:-1 group-title="Movies",Ciné Action by Pluto TV',
      'https://stitcher.exemple.tv/v1/stitch/master.m3u8',
    ].join('\n'),
    { adresse: 'https://exemple.tv/fr.m3u' },
  )

  // On fabrique l'état d'avant : le genre que rendait l'ancienne règle.
  depot.base.exec("UPDATE element SET genre = 'film', canal = NULL, rang = NULL")
  assert.equal(depot.compter({ genre: 'film' }), 3, 'l’état d’avant est bien en place')

  const bilan = rangerCatalogue(depot)
  assert.equal(bilan.reclasses, 3, 'les trois changent de genre')
  assert.equal(depot.compter({ genre: 'film' }), 0, 'plus aucune chaîne dans les films')
  assert.equal(depot.compter({ genre: 'direct' }), 3)

  // Et elles reçoivent leur rang de famille : le cinéma, après le sport.
  const rangs = depot.lister({ genre: 'direct' }).map((element) => element.rang)
  assert.ok(
    rangs.every((rang) => rang !== undefined),
    'chacune a un rang de tri',
  )
})

test('un reclassement ne perd ni les favoris ni les positions', async () => {
  // Les identifiants ne changent pas : ils sont calculés sur l'URL, que le
  // reclassement ne touche pas. C'est ce qui permet de rejouer la
  // classification sans rien coûter à l'utilisateur.
  const depot = await catalogue()
  const [premier] = depot.lister({ limite: 1 })
  assert.ok(premier !== undefined)
  depot.basculerFavori(premier.id)
  depot.enregistrerPosition(premier.id, 42, 100)

  rangerCatalogue(depot)

  assert.equal(depot.favoris().length, 1, 'le favori survit')
  assert.equal(depot.reprises().length, 1, 'la position aussi')
})
