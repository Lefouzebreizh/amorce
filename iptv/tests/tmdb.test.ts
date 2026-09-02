import assert from 'node:assert/strict'
import test from 'node:test'

import { chercherAffiche, tmdbDisponible } from '../src/tmdb/tmdb.ts'
import { enrichirTmdb } from '../src/enrichissement/tmdb.ts'


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


function reponse(corps: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(corps), init)
}

test('sans clé, rien n’est demandé et rien ne casse', async () => {
  let appele = false
  const resultat = await enrichirTmdb('', 'Le Fabuleux Destin', 2001, 'film', {
    fetch: async () => {
      appele = true
      return reponse({})
    },
  })
  assert.equal(resultat, undefined)
  assert.equal(appele, false, 'une clé vide ne doit déclencher aucune requête')
})

test('rend l’affiche et le résumé du premier résultat', async () => {
  const resultat = await enrichirTmdb('cle-de-test', 'Le Fabuleux Destin', 2001, 'film', {
    fetch: async (url) => {
      assert.ok(String(url).includes('/search/movie'), 'un film cherche dans /search/movie')
      assert.ok(String(url).includes('year=2001'))
      return reponse({
        results: [
          { poster_path: '/abc123.jpg', overview: 'Amélie change la vie des gens autour d’elle.' },
        ],
      })
    },
  })
  assert.deepEqual(resultat, {
    affiche: 'https://image.tmdb.org/t/p/w342/abc123.jpg',
    resume: 'Amélie change la vie des gens autour d’elle.',
  })
})

test('une série cherche dans /search/tv, avec l’année de première diffusion', async () => {
  await enrichirTmdb('cle-de-test', 'Kaamelott', 2005, 'serie', {
    fetch: async (url) => {
      assert.ok(String(url).includes('/search/tv'))
      assert.ok(String(url).includes('first_air_date_year=2005'))
      return reponse({ results: [] })
    },
  })
})

test('aucun résultat rend undefined, pas une erreur', async () => {
  const resultat = await enrichirTmdb('cle-de-test', 'Film totalement inconnu', undefined, 'film', {
    fetch: async () => reponse({ results: [] }),
  })
  assert.equal(resultat, undefined)
})

test('un résultat sans affiche ni résumé rend undefined', async () => {
  const resultat = await enrichirTmdb('cle-de-test', 'Titre', undefined, 'film', {
    fetch: async () => reponse({ results: [{}] }),
  })
  assert.equal(resultat, undefined)
})

test('une réponse HTTP en échec ne fait pas tomber la page', async () => {
  const resultat = await enrichirTmdb('cle-de-test', 'Titre', undefined, 'film', {
    fetch: async () => reponse({}, { status: 401 }),
  })
  assert.equal(resultat, undefined)
})

test('une réponse qui n’est pas du JSON ne lève pas', async () => {
  const resultat = await enrichirTmdb('cle-de-test', 'Titre', undefined, 'film', {
    fetch: async () => new Response('<html>panne du service</html>'),
  })
  assert.equal(resultat, undefined)
})

test('une erreur réseau rend undefined plutôt que de propager', async () => {
  const resultat = await enrichirTmdb('cle-de-test', 'Titre', undefined, 'film', {
    fetch: async () => {
      throw new Error('ECONNRESET')
    },
  })
  assert.equal(resultat, undefined)
})
