import assert from 'node:assert/strict'
import test from 'node:test'

import { lignes, type SourceTexte } from '../src/flux/lignes.ts'

async function collecter(source: SourceTexte): Promise<string[]> {
  const sortie: string[] = []
  for await (const ligne of lignes(source)) sortie.push(ligne)
  return sortie
}

test('découpe une chaîne, retours Windows compris', async () => {
  assert.deepEqual(await collecter('un\ndeux\r\ntrois'), ['un', 'deux', 'trois'])
})

test('rend la dernière ligne même sans saut final', async () => {
  assert.deepEqual(await collecter('seule'), ['seule'])
})

test('ne rend rien pour une source vide', async () => {
  assert.deepEqual(await collecter(''), [])
})

test('retire la marque d’ordre des octets, sinon l’en-tête #EXTM3U est perdu', async () => {
  assert.deepEqual(await collecter('﻿#EXTM3U\nhttp://a'), ['#EXTM3U', 'http://a'])
})

test('recolle un caractère accentué coupé entre deux trames', async () => {
  // « Café » : le « é » occupe deux octets, et la coupure tombe entre les deux.
  const octets = new TextEncoder().encode('Café\nThé\n')
  const coupure = 4
  async function* trames(): AsyncGenerator<Uint8Array> {
    yield octets.slice(0, coupure)
    yield octets.slice(coupure)
  }
  assert.deepEqual(await collecter(trames()), ['Café', 'Thé'])
})

test('lit un flux Web', async () => {
  const flux = new ReadableStream<Uint8Array>({
    start(controleur) {
      controleur.enqueue(new TextEncoder().encode('a\nb'))
      controleur.close()
    },
  })
  assert.deepEqual(await collecter(flux), ['a', 'b'])
})

test('ne garde pas en mémoire un fichier sans aucun saut de ligne', async () => {
  // Le tampon doit être rendu au-delà du plafond plutôt que de grossir jusqu’à
  // la taille du fichier — c’est précisément le défaut que ce module évite.
  const bloc = 'x'.repeat(300_000)
  async function* trames(): AsyncGenerator<string> {
    for (let i = 0; i < 5; i += 1) yield bloc
  }
  const rendues = await collecter(trames())
  assert.ok(rendues.length >= 2, 'le tampon aurait dû être vidé en cours de route')
  assert.equal(rendues.join('').length, bloc.length * 5)
})
