import assert from 'node:assert/strict'
import test from 'node:test'

import { decoderOctets, estVtt, srtVersVtt, versVtt } from '../src/sous-titres/conversion.ts'
import { fournisseursDisponibles, openSubtitles } from '../src/sous-titres/fournisseurs.ts'

const SRT = `1
00:00:01,000 --> 00:00:03,500
Bonjour, l'été est là.

2
00:01:02,250 --> 00:01:04,000
{\\an8}Une réplique en haut
<i>et en italique</i>
`

test('décode l’UTF-8 quand c’est de l’UTF-8', () => {
  assert.equal(decoderOctets(new TextEncoder().encode("L'été")), "L'été")
})

test('retombe sur windows-1252 plutôt que de rendre des losanges', () => {
  // « L'été » tel qu'un outil Windows l'écrit : un octet par accent.
  const octets = new Uint8Array([0x4c, 0x27, 0xe9, 0x74, 0xe9])
  assert.equal(decoderOctets(octets), "L'été")
})

test('retire la marque d’ordre des octets', () => {
  const avecBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('WEBVTT')])
  assert.equal(decoderOctets(avecBom), 'WEBVTT')
})

test('convertit un SRT en WebVTT', () => {
  const vtt = srtVersVtt(SRT)
  assert.ok(vtt.startsWith('WEBVTT\n'), vtt.slice(0, 20))
  // La virgule des millisecondes devient un point : sans cela, la piste se
  // charge sans erreur et n'affiche rien.
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:03.500'))
  assert.ok(vtt.includes('00:01:02.250 --> 00:01:04.000'))
  // Les numéros de séquence ne servent à rien en WebVTT.
  assert.ok(!/^\d+$/m.test(vtt.replace(/^WEBVTT$/m, '')))
})

test('retire les balises de position et garde l’italique', () => {
  const vtt = srtVersVtt(SRT)
  assert.ok(!vtt.includes('{\\an8}'), 'une balise SSA serait affichée telle quelle')
  assert.ok(vtt.includes('Une réplique en haut'))
  assert.ok(vtt.includes('<i>et en italique</i>'))
})

test('accepte les heures à un chiffre et les retours Windows', () => {
  const vtt = srtVersVtt('1\r\n0:00:01,5 --> 0:00:02,75\r\nTexte\r\n')
  assert.ok(vtt.includes('00:00:01.500 --> 00:00:02.750'), vtt)
})

test('laisse un WebVTT tranquille', () => {
  const deja = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nDéjà bon\n'
  assert.ok(estVtt(deja))
  assert.equal(versVtt(new TextEncoder().encode(deja)), deja)
})

test('rend undefined plutôt qu’une piste qui n’affichera rien', () => {
  assert.equal(versVtt(new TextEncoder().encode('')), undefined)
  // Une page d'erreur HTML servie à la place du fichier : aucun horodatage.
  assert.equal(versVtt(new TextEncoder().encode('<html><body>403</body></html>')), undefined)
})

test('sans clé, aucun fournisseur — et surtout aucune erreur', () => {
  assert.deepEqual(fournisseursDisponibles(), [])
  assert.deepEqual(fournisseursDisponibles({ openSubtitlesKey: '   ' }), [])
  assert.equal(fournisseursDisponibles({ openSubtitlesKey: 'abc' }).length, 1)
})

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

const REPONSE_RECHERCHE = {
  data: [
    {
      attributes: {
        language: 'en',
        release: 'The.Movie.1080p',
        ratings: 6,
        files: [{ file_id: 111 }],
      },
    },
    {
      attributes: {
        language: 'fr',
        release: 'Le.Film.1080p',
        ratings: 8.5,
        files: [{ file_id: 222 }],
      },
    },
    // Sans fichier : inexploitable, donc écartée plutôt que rendue à moitié.
    { attributes: { language: 'fr', release: 'Sans fichier', files: [] } },
  ],
}

test('cherche par nom de série, saison et épisode — jamais par titre d’épisode', async () => {
  const { fetch, urls } = fauxFetch({
    '/subtitles?': () => new Response(JSON.stringify(REPONSE_RECHERCHE)),
  })
  const pistes = await openSubtitles('cle', { fetch }).chercher({
    titre: 'Kaamelott S01E01',
    serie: 'Kaamelott',
    saison: 1,
    episode: 1,
    langues: ['fr', 'en'],
  })

  const url = urls[0] ?? ''
  assert.match(url, /query=Kaamelott(&|$)/)
  assert.match(url, /season_number=1/)
  assert.match(url, /episode_number=1/)
  assert.ok(!url.includes('S01E01'), 'le titre d’épisode ne trouve rien chez le service')

  // Deux pistes exploitables, la française d'abord malgré une recherche qui
  // rendait l'anglaise en tête.
  assert.equal(pistes.length, 2)
  assert.equal(pistes[0]?.langue, 'fr')
  assert.equal(pistes[0]?.id, '222')
})

test('ne laisse fuiter ni l’adresse du flux ni les identifiants', async () => {
  const { fetch, urls } = fauxFetch({
    '/subtitles?': () => new Response(JSON.stringify({ data: [] })),
  })
  await openSubtitles('cle', { fetch }).chercher({
    titre: 'Le Fabuleux Destin',
    annee: 2001,
    langues: ['fr'],
  })
  const url = urls[0] ?? ''
  assert.ok(!url.includes('http://exemple'), url)
  assert.ok(!url.includes('password'), url)
  assert.match(url, /year=2001/)
})

test('télécharge en deux temps : le lien, puis le fichier', async () => {
  const { fetch, urls } = fauxFetch({
    '/download': () => new Response(JSON.stringify({ link: 'https://cdn.exemple/st.srt' })),
    'cdn.exemple': () => new Response('1\n00:00:01,000 --> 00:00:02,000\nSalut\n'),
  })
  const octets = await openSubtitles('cle', { fetch }).telecharger('222')
  assert.ok(octets !== undefined)
  assert.equal(urls.length, 2, 'le premier appel rend un lien, il ne sert pas le fichier')
  assert.ok(versVtt(octets)?.includes('00:00:01.000 --> 00:00:02.000'))
})

test('une réponse illisible ne fait pas tomber la recherche', async () => {
  const { fetch } = fauxFetch({ '/subtitles?': () => new Response('<html>403</html>') })
  const pistes = await openSubtitles('cle', { fetch }).chercher({ titre: 'X', langues: ['fr'] })
  assert.deepEqual(pistes, [])

  const { fetch: fetch2 } = fauxFetch({ '/download': () => new Response('nope', { status: 500 }) })
  assert.equal(await openSubtitles('cle', { fetch: fetch2 }).telecharger('1'), undefined)
})
