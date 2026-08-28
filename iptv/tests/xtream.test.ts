import assert from 'node:assert/strict'
import test from 'node:test'

import {
  creerClientXtream,
  entier,
  ErreurXtream,
  masquerIdentifiants,
  normaliserServeur,
  texte,
} from '../src/ingestion/xtream.ts'

const IDS = { serveur: 'http://exemple.tv:8080', utilisateur: 'jean', motDePasse: 's3cr3t' }

/** Un `fetch` de test : retient l’URL appelée et rend ce qu’on lui dit. */
function fauxFetch(reponse: () => Response): { fetch: typeof globalThis.fetch; urls: string[] } {
  const urls: string[] = []
  const fetch = (async (entree: string | URL | Request) => {
    urls.push(String(entree))
    return reponse()
  }) as typeof globalThis.fetch
  return { fetch, urls }
}

test('ramène toutes les formes d’adresse à la même base', () => {
  assert.equal(normaliserServeur('http://exemple.tv:8080'), 'http://exemple.tv:8080')
  assert.equal(normaliserServeur('exemple.tv:8080'), 'http://exemple.tv:8080')
  assert.equal(normaliserServeur('http://exemple.tv:8080/'), 'http://exemple.tv:8080')
  assert.equal(normaliserServeur('http://exemple.tv:8080/c/'), 'http://exemple.tv:8080')
  assert.equal(normaliserServeur('https://exemple.tv/player_api.php'), 'https://exemple.tv')
  assert.throws(() => normaliserServeur('  '), ErreurXtream)
})

test('construit les URL de lecture attendues par un panneau', () => {
  const client = creerClientXtream(IDS)
  assert.equal(client.urlDirect(12), 'http://exemple.tv:8080/live/jean/s3cr3t/12.m3u8')
  assert.equal(client.urlFilm(7, 'mkv'), 'http://exemple.tv:8080/movie/jean/s3cr3t/7.mkv')
  assert.equal(client.urlEpisode('90'), 'http://exemple.tv:8080/series/jean/s3cr3t/90.mp4')
  assert.match(client.urlXmltv(), /^http:\/\/exemple\.tv:8080\/xmltv\.php\?/)
})

test('masque le mot de passe, paramètre comme segment de chemin', () => {
  const url = 'http://exemple.tv:8080/live/jean/s3cr3t/1.ts?password=s3cr3t&action=x'
  const masque = masquerIdentifiants(url, 's3cr3t')
  assert.ok(!masque.includes('s3cr3t'), masque)
  assert.ok(masque.includes('/jean/***/'))
})

test('lit un compte actif malgré des champs rendus en chaînes', async () => {
  const { fetch, urls } = fauxFetch(
    () =>
      new Response(
        JSON.stringify({
          user_info: {
            auth: 1,
            status: 'Active',
            exp_date: '1767225600',
            max_connections: '2',
            active_cons: 1,
          },
        }),
      ),
  )
  const compte = await creerClientXtream(IDS, { fetch, delaiMs: 1000 }).verifierCompte()

  assert.equal(compte.actif, true)
  assert.equal(compte.connexionsMax, 2)
  assert.equal(compte.connexionsActives, 1)
  assert.equal(compte.expiration?.getTime(), 1_767_225_600_000)
  assert.match(urls[0] ?? '', /player_api\.php\?username=jean/)
})

test('un abonnement expiré n’est pas actif, même avec auth à 1', async () => {
  const { fetch } = fauxFetch(
    () => new Response(JSON.stringify({ user_info: { auth: 1, status: 'Expired' } })),
  )
  const compte = await creerClientXtream(IDS, { fetch }).verifierCompte()
  assert.equal(compte.actif, false)
  assert.equal(compte.statut, 'Expired')
})

test('traduit une page HTML servie en 200 plutôt que de lever une SyntaxError', async () => {
  const { fetch } = fauxFetch(() => new Response('<html><body>Access denied</body></html>'))
  await assert.rejects(
    () => creerClientXtream(IDS, { fetch }).fluxDirects(),
    (erreur: unknown) => {
      assert.ok(erreur instanceof ErreurXtream)
      assert.match(erreur.message, /non JSON/)
      assert.ok(!erreur.message.includes('s3cr3t'), 'le mot de passe a fuité dans l’erreur')
      return true
    },
  )
})

test('remonte le code HTTP sans laisser fuiter les identifiants', async () => {
  const { fetch } = fauxFetch(() => new Response('nope', { status: 403 }))
  await assert.rejects(
    () => creerClientXtream(IDS, { fetch }).films(),
    (erreur: unknown) => {
      assert.ok(erreur instanceof ErreurXtream)
      assert.equal(erreur.statut, 403)
      assert.ok(!erreur.message.includes('s3cr3t'))
      return true
    },
  )
})

test('rend un tableau vide quand le panneau répond « false »', async () => {
  const { fetch } = fauxFetch(() => new Response('false'))
  assert.deepEqual(await creerClientXtream(IDS, { fetch }).series(), [])
})

test('passe la catégorie demandée en paramètre', async () => {
  const { fetch, urls } = fauxFetch(() => new Response('[]'))
  await creerClientXtream(IDS, { fetch }).fluxDirects('42')
  assert.match(urls[0] ?? '', /action=get_live_streams/)
  assert.match(urls[0] ?? '', /category_id=42/)
})

test('lit les nombres et les textes quel que soit leur type d’origine', () => {
  assert.equal(entier('12'), 12)
  assert.equal(entier(12.9), 12)
  assert.equal(entier('douze'), undefined)
  assert.equal(entier(null), undefined)
  assert.equal(texte(7), '7')
  assert.equal(texte('   '), undefined)
  assert.equal(texte(undefined), undefined)
})
