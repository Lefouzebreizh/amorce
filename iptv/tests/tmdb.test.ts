import assert from 'node:assert/strict'
import test from 'node:test'

import { enrichirTmdb } from '../src/enrichissement/tmdb.ts'

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
