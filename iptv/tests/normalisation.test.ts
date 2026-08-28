import assert from 'node:assert/strict'
import test from 'node:test'

import { lireM3U } from '../src/ingestion/m3u.ts'
import { detecterEpisode } from '../src/normalisation/episode.ts'
import { detecterLangue, detecterQualite } from '../src/normalisation/etiquettes.ts'
import { detecterGenre } from '../src/normalisation/genre.ts'
import {
  extraireEpisodesXtream,
  normaliserDirectXtream,
  normaliserEntreeM3U,
  normaliserEpisodeXtream,
  normaliserFicheSerieXtream,
  normaliserFilmXtream,
  regrouperParSerie,
  type ConstructeurUrl,
} from '../src/normalisation/normaliser.ts'
import { analyserTitre } from '../src/normalisation/titre.ts'

const URLS: ConstructeurUrl = {
  base: 'http://exemple.tv:8080',
  urlDirect: (id, ext = 'm3u8') => `http://exemple.tv:8080/live/u/p/${id}.${ext}`,
  urlFilm: (id, ext = 'mp4') => `http://exemple.tv:8080/movie/u/p/${id}.${ext}`,
  urlEpisode: (id, ext = 'mp4') => `http://exemple.tv:8080/series/u/p/${id}.${ext}`,
}

test('nettoie les titres que les fournisseurs écrivent réellement', () => {
  assert.equal(analyserTitre('FR | TF1 HD').titre, 'TF1')
  assert.equal(analyserTitre('|FR| CANAL+ CINEMA FHD').titre, 'CANAL+ CINEMA')
  assert.equal(analyserTitre('##FR## RMC Sport 1').titre, 'RMC Sport 1')
  assert.equal(analyserTitre('[VOSTFR] Breaking Bad S01E01').titre, 'Breaking Bad S01E01')

  const scene = analyserTitre('Le.Seigneur.des.Anneaux.2001.MULTI.1080p.BluRay.x264.mkv')
  assert.equal(scene.titre, 'Le Seigneur des Anneaux')
  assert.equal(scene.annee, 2001)
})

test('n’ampute jamais un titre au milieu d’un mot', () => {
  // « HD » dans « HDTV Bahia », « VO » dans « Voyage » : aucune étiquette ne se
  // retire si elle n’est pas un mot entier.
  assert.equal(analyserTitre('Voyage au bout de la nuit').titre, 'Voyage au bout de la nuit')
  assert.equal(analyserTitre('Sport en clair').titre, 'Sport en clair')
})

test('garde une année qui est le titre entier', () => {
  const film = analyserTitre('1917 (2019) VF')
  assert.equal(film.titre, '1917')
  assert.equal(film.annee, 2019)
  // 2049 est hors des bornes plausibles : c’est un titre, pas une date.
  assert.equal(analyserTitre('Blade Runner 2049').titre, 'Blade Runner 2049')
})

test('classe la langue en donnant la priorité au francophone', () => {
  assert.equal(detecterLangue(['VF']), 'vf')
  assert.equal(detecterLangue(['VOSTFR']), 'vostfr')
  assert.equal(detecterLangue(['MULTI']), 'multi')
  // Les deux marquages ensemble : le fichier porte les deux pistes.
  assert.equal(detecterLangue(['VF', 'VOSTFR']), 'multi')
  assert.equal(detecterLangue([], 'FILMS VF'), 'vf')
  assert.equal(detecterLangue([]), 'inconnue')
})

test('l’étiquette de l’élément l’emporte sur le nom du groupe', () => {
  // Un groupe « SERIES VF » contient aussi des épisodes sous-titrés : le
  // marquage porté par l’élément est le seul qui parle de lui.
  assert.equal(detecterLangue(['VOSTFR'], 'SERIES VF'), 'vostfr')
  assert.equal(detecterQualite(['4K'], 'CHAINES HD'), '4k')
  // Et le groupe reprend la main dès que l’élément se tait.
  assert.equal(detecterLangue([], 'SERIES VF'), 'vf')
})

test('classe la définition, sans confondre HD et UHD', () => {
  assert.equal(detecterQualite(['4K']), '4k')
  assert.equal(detecterQualite(['1080P']), 'fhd')
  assert.equal(detecterQualite([], 'CHAINES UHD'), '4k')
  assert.equal(detecterQualite([], 'CHAINES HD'), 'hd')
  assert.equal(detecterQualite([]), 'inconnue')
})

test('reconnaît les cinq façons d’écrire un numéro d’épisode', () => {
  assert.deepEqual(detecterEpisode('Breaking Bad S01E01'), {
    serie: 'Breaking Bad',
    saison: 1,
    episode: 1,
  })
  assert.deepEqual(detecterEpisode('Kaamelott 1x02'), {
    serie: 'Kaamelott',
    saison: 1,
    episode: 2,
  })
  assert.deepEqual(detecterEpisode('Engrenages Saison 3 Episode 10'), {
    serie: 'Engrenages',
    saison: 3,
    episode: 10,
  })
  // Un numéro seul n’invente pas de saison.
  assert.deepEqual(detecterEpisode('Le Bureau des Légendes - Episode 4'), {
    serie: 'Le Bureau des Légendes',
    saison: undefined,
    episode: 4,
  })
  // Le titre placé après le motif sert de nom quand rien ne précède.
  assert.equal(detecterEpisode('S02E05 - Le Retour')?.serie, 'Le Retour')
})

test('ne prend pas une résolution pour un numéro d’épisode', () => {
  assert.equal(detecterEpisode('Documentaire 1920x1080'), undefined)
  assert.equal(detecterEpisode('TF1'), undefined)
  assert.equal(detecterEpisode('RMC Sport 1'), undefined)
})

test('le chemin de l’URL prime sur le nom du groupe', () => {
  // Le fournisseur a rangé une série dans un groupe « FILMS » : le serveur, lui,
  // ne se trompe pas.
  assert.equal(
    detecterGenre({ url: 'http://x/series/u/p/9.mkv', groupe: 'FILMS FR' }),
    'serie',
  )
  assert.equal(detecterGenre({ url: 'http://x/movie/u/p/9.mkv', groupe: 'SERIES' }), 'film')
  assert.equal(detecterGenre({ url: 'http://x/live/u/p/9.m3u8', groupe: 'VOD' }), 'direct')
  assert.equal(detecterGenre({ url: 'http://x/9.mkv', groupe: 'FILMS' }), 'film')
  assert.equal(detecterGenre({ url: 'http://x/9.mkv' }), 'film')
  assert.equal(detecterGenre({ url: 'http://x/9', episode: true }), 'serie')
  assert.equal(detecterGenre({ url: 'http://x/9' }), 'direct')
})

test('une entrée M3U traverse toute la chaîne et ressort affichable', async () => {
  const { entrees } = await lireM3U(
    [
      '#EXTM3U',
      '#EXTINF:-1 tvg-id="tf1.fr" tvg-logo="http://img/tf1.png" group-title="FR | TNT",FR | TF1 HD',
      'http://exemple.tv:8080/live/u/p/1.m3u8',
    ].join('\n'),
  )
  const entree = entrees[0]
  assert.ok(entree !== undefined)
  const element = normaliserEntreeM3U(entree)

  assert.equal(element.genre, 'direct')
  assert.equal(element.titre, 'TF1')
  assert.equal(element.titreBrut, 'FR | TF1 HD')
  assert.equal(element.qualite, 'hd')
  assert.equal(element.tvgId, 'tf1.fr')
  assert.equal(element.logo, 'http://img/tf1.png')
  assert.equal(element.source, 'm3u')
  assert.match(element.id, /^ch_[0-9a-f]{16}$/)
})

test('un épisode de liste M3U garde le nom de sa série', async () => {
  const { entrees } = await lireM3U(
    [
      '#EXTM3U',
      '#EXTINF:-1 group-title="SERIES VF",[VOSTFR] Breaking Bad S01E01',
      'http://exemple.tv:8080/series/u/p/55.mkv',
    ].join('\n'),
  )
  const element = normaliserEntreeM3U(entrees[0]!)

  assert.equal(element.genre, 'serie')
  assert.equal(element.serie, 'Breaking Bad')
  assert.equal(element.saison, 1)
  assert.equal(element.episode, 1)
  assert.equal(element.langue, 'vostfr')
})

test('l’identifiant Xtream ne dépend pas du mot de passe', () => {
  const brut = { stream_id: 12, name: 'TF1 HD', epg_channel_id: 'tf1.fr' }
  const a = normaliserDirectXtream(brut, URLS)
  const b = normaliserDirectXtream(brut, {
    ...URLS,
    urlDirect: (id) => `http://exemple.tv:8080/live/u/AUTRE-MOT-DE-PASSE/${id}.m3u8`,
  })
  assert.ok(a !== undefined && b !== undefined)
  assert.equal(a.id, b.id, 'changer de mot de passe effacerait les favoris')
  assert.equal(a.tvgId, 'tf1.fr')
})

test('un film Xtream garde le conteneur annoncé par le panneau', () => {
  const film = normaliserFilmXtream(
    {
      stream_id: '7',
      name: 'Le Fabuleux Destin (2001) MULTI 1080p',
      container_extension: 'mkv',
      category_id: '3',
      stream_icon: 'http://img/7.jpg',
    },
    URLS,
    new Map([['3', 'FILMS FR']]),
  )

  assert.ok(film !== undefined)
  assert.equal(film.url, 'http://exemple.tv:8080/movie/u/p/7.mkv')
  assert.equal(film.titre, 'Le Fabuleux Destin')
  assert.equal(film.annee, 2001)
  assert.equal(film.langue, 'multi')
  assert.equal(film.qualite, 'fhd')
  assert.equal(film.groupe, 'FILMS FR')
})

test('une entrée sans identifiant est écartée plutôt que rendue à moitié', () => {
  assert.equal(normaliserDirectXtream({ name: 'Sans identifiant' }, URLS), undefined)
  assert.equal(normaliserFilmXtream({ name: 'Sans identifiant' }, URLS), undefined)
})

test('aplatit les épisodes d’une série, dont les saisons sont un objet', () => {
  const infos = {
    episodes: {
      '1': [
        { id: '101', episode_num: 1, title: 'Pilote', container_extension: 'mkv' },
        { id: '102', episode_num: 2, title: 'Suite', info: { movie_image: 'http://img/2.jpg' } },
      ],
      '2': [{ id: '201', episode_num: 1, title: 'Retour' }],
    },
  }
  const bruts = extraireEpisodesXtream(infos)
  assert.equal(bruts.length, 3)
  assert.deepEqual(
    bruts.map((e) => e.saison),
    [1, 1, 2],
  )

  const fiche = normaliserFicheSerieXtream(
    { series_id: '9', name: 'Engrenages', cover: 'http://img/9.jpg', genre: 'Policier, Drame' },
    URLS.base,
  )
  assert.ok(fiche !== undefined)
  assert.deepEqual(fiche.genres, ['Policier', 'Drame'])

  const premier = normaliserEpisodeXtream(bruts[0]!, fiche, URLS)
  assert.ok(premier !== undefined)
  assert.equal(premier.url, 'http://exemple.tv:8080/series/u/p/101.mkv')
  assert.equal(premier.serie, 'Engrenages')
  assert.equal(premier.saison, 1)
  assert.equal(premier.episode, 1)
  assert.equal(premier.logo, 'http://img/9.jpg')

  const second = normaliserEpisodeXtream(bruts[1]!, fiche, URLS)
  assert.equal(second?.logo, 'http://img/2.jpg')
})

test('une réponse de série vide ne fait pas tomber l’aplatissement', () => {
  assert.deepEqual(extraireEpisodesXtream({}), [])
  assert.deepEqual(extraireEpisodesXtream({ episodes: null }), [])
  assert.deepEqual(extraireEpisodesXtream({ episodes: { '1': 'inattendu' } }), [])
})

test('regroupe les épisodes par série, sans fondre ce qui n’a pas été reconnu', async () => {
  const { entrees } = await lireM3U(
    [
      '#EXTM3U',
      '#EXTINF:-1 group-title="SERIES",Kaamelott S01E01',
      'http://x/series/u/p/1.mkv',
      '#EXTINF:-1 group-title="SERIES",Kaamelott S01E02',
      'http://x/series/u/p/2.mkv',
      '#EXTINF:-1 group-title="SERIES",Documentaire sans numéro',
      'http://x/series/u/p/3.mkv',
      '#EXTINF:-1,TF1',
      'http://x/live/u/p/4.m3u8',
    ].join('\n'),
  )
  const groupes = regrouperParSerie(entrees.map(normaliserEntreeM3U))

  assert.equal(groupes.size, 2)
  assert.equal(groupes.get('kaamelott')?.length, 2)
  assert.equal(groupes.get('documentaire sans numéro')?.length, 1)
})
