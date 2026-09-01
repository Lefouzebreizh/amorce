import assert from 'node:assert/strict'
import test from 'node:test'

import { analyserM3U, lireM3U, separerExtinf, type EnTeteM3U } from '../src/ingestion/m3u.ts'

const LISTE = `#EXTM3U url-tvg="http://exemple.tv/xmltv.php?u=1,http://miroir/epg.xml"
#EXTINF:-1 tvg-id="tf1.fr" tvg-name="TF1" tvg-logo="http://img/tf1.png" group-title="FR | TNT",FR | TF1 HD
http://exemple.tv:8080/live/u/p/1.m3u8
#EXTINF:-1 tvg-name="Canal+, la chaîne" group-title="FR | CINE",Canal+ Cinéma, en clair
#EXTVLCOPT:http-user-agent=VLC/3.0
http://exemple.tv:8080/live/u/p/2.m3u8
#EXTGRP:DOCUMENTAIRES
#EXTINF:-1,Arte
http://exemple.tv:8080/live/u/p/3.m3u8
`

test('lit les attributs, le groupe et l’URL de chaque entrée', async () => {
  const { entrees, resume } = await lireM3U(LISTE)

  assert.equal(entrees.length, 3)
  assert.equal(resume.entrees, 3)
  assert.equal(resume.ignorees, 0)

  const tf1 = entrees[0]
  assert.ok(tf1 !== undefined)
  assert.equal(tf1.titre, 'FR | TF1 HD')
  assert.equal(tf1.url, 'http://exemple.tv:8080/live/u/p/1.m3u8')
  assert.equal(tf1.attributs['tvg-id'], 'tf1.fr')
  assert.equal(tf1.attributs['tvg-logo'], 'http://img/tf1.png')
  assert.equal(tf1.groupe, 'FR | TNT')
  assert.equal(tf1.duree, -1)
})

test('coupe à la virgule hors guillemets, pas à la première venue', async () => {
  const { entrees } = await lireM3U(LISTE)
  const canal = entrees[1]
  assert.ok(canal !== undefined)
  // L’attribut contient une virgule, et le titre aussi : les deux survivent.
  assert.equal(canal.attributs['tvg-name'], 'Canal+, la chaîne')
  assert.equal(canal.titre, 'Canal+ Cinéma, en clair')
})

test('conserve les options de lecture, sans quoi le flux est injouable', async () => {
  const { entrees } = await lireM3U(LISTE)
  const canal = entrees[1]
  assert.ok(canal !== undefined)
  assert.deepEqual(canal.optionsLecture, ['#EXTVLCOPT:http-user-agent=VLC/3.0'])
})

test('applique un #EXTGRP posé avant l’entrée', async () => {
  const { entrees } = await lireM3U(LISTE)
  const arte = entrees[2]
  assert.ok(arte !== undefined)
  assert.equal(arte.groupe, 'DOCUMENTAIRES')
})

test('annonce l’adresse du guide dès l’en-tête, avant la première entrée', async () => {
  const vus: EnTeteM3U[] = []
  const analyse = analyserM3U(LISTE, { surEnTete: (e) => vus.push(e) })
  await analyse.next()
  assert.equal(vus.length, 1)
  // Plusieurs adresses séparées par des virgules : la première suffit.
  assert.equal(vus[0]?.urlEpg, 'http://exemple.tv/xmltv.php?u=1')
  await analyse.return({ lignes: 0, entrees: 0, ignorees: 0, enTete: undefined })
})

test('compte une description restée sans adresse au lieu de la recoller', async () => {
  const { entrees, resume } = await lireM3U(
    ['#EXTINF:-1,Orpheline', '#EXTINF:-1,Vraie', 'http://a/1.ts', '#EXTINF:-1,Perdue en fin'].join(
      '\n',
    ),
  )
  assert.equal(entrees.length, 1)
  assert.equal(entrees[0]?.titre, 'Vraie')
  assert.equal(resume.ignorees, 2)
})

test('accepte une URL nue, seule forme des listes minimales', async () => {
  const { entrees } = await lireM3U('#EXTM3U\nhttp://exemple.tv/Le%20Film.mkv')
  assert.equal(entrees.length, 1)
  assert.equal(entrees[0]?.titre, 'Le Film.mkv')
})

test('rend les entrées au fil de l’eau, sans lire la source entière', { timeout: 5000 }, async () => {
  let produits = 0
  async function* interminable(): AsyncGenerator<string> {
    yield '#EXTM3U\n'
    for (;;) {
      produits += 1
      yield `#EXTINF:-1,Chaîne ${produits}\nhttp://exemple.tv/${produits}.ts\n`
    }
  }

  const vus: string[] = []
  for await (const entree of analyserM3U(interminable())) {
    vus.push(entree.titre)
    if (vus.length === 3) break
  }

  assert.deepEqual(vus, ['Chaîne 1', 'Chaîne 2', 'Chaîne 3'])
  // Si l’analyseur matérialisait la source, ce test ne se terminerait jamais.
  assert.ok(produits < 20, `la source a été consommée ${produits} fois`)
})

test('separerExtinf lit une durée réelle et des attributs sans guillemets', () => {
  const { duree, attributs, titre } = separerExtinf('123.5 tvg-id=abc group-title="VOD",Un film')
  assert.equal(duree, 123.5)
  assert.equal(attributs['tvg-id'], 'abc')
  assert.equal(attributs['group-title'], 'VOD')
  assert.equal(titre, 'Un film')
})
