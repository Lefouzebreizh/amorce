import assert from 'node:assert/strict'
import test from 'node:test'

import { chercherAffiche, tmdbDisponible } from '../src/tmdb/tmdb.ts'

function fauxFetch(reponses: Record<string, () => Response>): {
  fetch: typeof globalThis.fetch
  urls: string[]
} {
  const urls: string[] = []
  const fetch = (async (entree: string | URL | Request) => {
    const url = String(entree)
    urls.push(url)
    const cle = Object.keys(reponses).find((motif) => url.includes(motif))
    return cle === undefined ? new Response('non', { status: 404 }) : (reponses[cle] as () => Response)()
  }) as typeof globalThis.fetch
  return { fetch, urls }
}

test('indisponible sans clé, disponible avec', () => {
  assert.equal(tmdbDisponible({}), false)
  assert.equal(tmdbDisponible({ cle: '   ' }), false)
  assert.equal(tmdbDisponible({ cle: 'abc' }), true)
})

test('sans clé, aucun appel réseau', async () => {
  const { fetch, urls } = fauxFetch({})
  const resultat = await chercherAffiche({ titre: 'X', genre: 'film' }, { fetch })
  assert.equal(resultat, undefined)
  assert.equal(urls.length, 0)
})

test('cherche un film sur search/movie, avec l’année', async () => {
  const { fetch, urls } = fauxFetch({
    'search/movie': () =>
      new Response(
        JSON.stringify({ results: [{ poster_path: '/abc.jpg', overview: 'Un résumé.' }] }),
      ),
  })
  const affiche = await chercherAffiche(
    { titre: 'Le Fabuleux Destin', annee: 2001, genre: 'film' },
    { cle: 'cle', fetch },
  )
  const url = urls[0] ?? ''
  assert.match(url, /\/search\/movie\?/)
  assert.match(url, /query=Le\+Fabuleux/)
  assert.match(url, /year=2001/)
  assert.equal(affiche?.url, 'https://image.tmdb.org/t/p/w500/abc.jpg')
  assert.equal(affiche?.resume, 'Un résumé.')
})

test('cherche une série sur search/tv, avec « first_air_date_year » et non « year »', async () => {
  const { fetch, urls } = fauxFetch({
    'search/tv': () => new Response(JSON.stringify({ results: [{ poster_path: '/kaa.jpg' }] })),
  })
  await chercherAffiche({ titre: 'Kaamelott', annee: 2005, genre: 'serie' }, { cle: 'cle', fetch })
  const url = urls[0] ?? ''
  assert.match(url, /\/search\/tv\?/)
  assert.match(url, /first_air_date_year=2005/)
  assert.ok(!url.includes('&year='), url)
})

test('aucun résultat rend un objet, pas undefined — ça se met en cache', async () => {
  const { fetch } = fauxFetch({ 'search/movie': () => new Response(JSON.stringify({ results: [] })) })
  const affiche = await chercherAffiche({ titre: 'Introuvable', genre: 'film' }, { cle: 'cle', fetch })
  assert.deepEqual(affiche, { url: undefined, resume: undefined })
})

test('service injoignable ou réponse illisible : undefined, jamais une erreur', async () => {
  const { fetch: horsService } = fauxFetch({ 'search/movie': () => new Response('non', { status: 500 }) })
  assert.equal(
    await chercherAffiche({ titre: 'X', genre: 'film' }, { cle: 'cle', fetch: horsService }),
    undefined,
  )

  const { fetch: illisible } = fauxFetch({ 'search/movie': () => new Response('<html>403</html>') })
  assert.equal(
    await chercherAffiche({ titre: 'X', genre: 'film' }, { cle: 'cle', fetch: illisible }),
    undefined,
  )
})

test('ne laisse fuiter ni l’adresse du flux ni les identifiants', async () => {
  const { fetch, urls } = fauxFetch({ 'search/movie': () => new Response(JSON.stringify({ results: [] })) })
  await chercherAffiche({ titre: 'Le Film', annee: 1999, genre: 'film' }, { cle: 'secrete', fetch })
  const url = urls[0] ?? ''
  assert.ok(!url.includes('http://exemple'), url)
  assert.ok(url.includes('api_key=secrete'), 'la clé part bien, elle — c’est celle du service, pas de l’abonnement')
})
