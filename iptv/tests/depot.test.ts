import assert from 'node:assert/strict'
import test from 'node:test'

import { ouvrirDepot, requeteFts, type Depot } from '../src/cache/depot.ts'
import { importerM3U } from '../src/cache/importer.ts'

const LISTE = [
  '#EXTM3U url-tvg="http://exemple.tv/epg.xml"',
  '#EXTINF:-1 tvg-id="tf1.fr" group-title="FR | TNT",FR | TF1 HD',
  'http://exemple.tv/live/u/p/1.m3u8',
  '#EXTINF:-1 group-title="FR | TNT",FR | Canal+ Cinéma FHD',
  'http://exemple.tv/live/u/p/2.m3u8',
  '#EXTINF:-1 group-title="FILMS VF",Le Fabuleux Destin (2001) MULTI 1080p',
  'http://exemple.tv/movie/u/p/7.mkv',
  '#EXTINF:-1 group-title="SERIES",Kaamelott S01E01',
  'http://exemple.tv/series/u/p/11.mkv',
  '#EXTINF:-1 group-title="SERIES",Kaamelott S01E02',
  'http://exemple.tv/series/u/p/12.mkv',
  '#EXTINF:-1 group-title="SERIES",[VOSTFR] Breaking Bad S01E01',
  'http://exemple.tv/series/u/p/21.mkv',
].join('\n')

async function depotRempli(liste = LISTE): Promise<Depot> {
  const depot = ouvrirDepot(':memory:')
  await importerM3U(depot, liste, { adresse: 'http://exemple.tv/get.php?username=jean&password=s3cr3t' })
  return depot
}

test('importe une liste et la range par genre', async () => {
  const depot = await depotRempli()
  try {
    assert.equal(depot.compter(), 6)
    assert.equal(depot.compter({ genre: 'direct' }), 2)
    assert.equal(depot.compter({ genre: 'film' }), 1)
    assert.equal(depot.compter({ genre: 'serie' }), 3)
  } finally {
    depot.fermer()
  }
})

test('aucun mot de passe n’entre en base', async () => {
  const depot = await depotRempli()
  try {
    const lignes = depot.base.prepare('SELECT adresse, url_epg FROM source').all()
    const tout = JSON.stringify(lignes)
    assert.ok(!tout.includes('s3cr3t'), tout)
    assert.ok(tout.includes('***'), tout)
    // L'adresse du guide, elle, est bien relevée dès l'en-tête.
    assert.ok(tout.includes('http://exemple.tv/epg.xml'))
  } finally {
    depot.fermer()
  }
})

test('réimporter la même liste ne duplique rien', async () => {
  const depot = await depotRempli()
  try {
    const resume = await importerM3U(depot, LISTE, { adresse: 'http://exemple.tv/get.php?username=jean&password=s3cr3t' })
    assert.equal(resume.ecrits, 6)
    assert.equal(resume.retires, 0)
    assert.equal(depot.compter(), 6)
    // Et une seule source, malgré `utilisateur` non renseigné — le piège des
    // NULL distincts dans une contrainte UNIQUE.
    const sources = depot.base.prepare('SELECT COUNT(*) AS n FROM source').get() as {
      n: number
    }
    assert.equal(sources.n, 1)
  } finally {
    depot.fermer()
  }
})

test('retire ce que le fournisseur ne sert plus, et seulement après coup', async () => {
  const depot = await depotRempli()
  try {
    const reduite = ['#EXTM3U', '#EXTINF:-1,FR | TF1 HD', 'http://exemple.tv/live/u/p/1.m3u8'].join(
      '\n',
    )
    const resume = await importerM3U(depot, reduite, {
      adresse: 'http://exemple.tv/get.php?username=jean&password=s3cr3t',
    })
    assert.equal(resume.ecrits, 1)
    assert.equal(resume.retires, 5)
    assert.equal(depot.compter(), 1)
  } finally {
    depot.fermer()
  }
})

test('un import partiel ne purge pas le catalogue', async () => {
  const depot = await depotRempli()
  try {
    const sourceId = 1
    async function* rien(): AsyncGenerator<never> {
      // Aucune entrée : c'est le cas d'une série vide, ou d'un panneau qui
      // répond `false`.
    }
    const resume = await depot.importer(sourceId, rien(), { purger: false })
    assert.equal(resume.retires, 0)
    assert.equal(depot.compter(), 6, 'le catalogue a été vidé par un import partiel')
  } finally {
    depot.fermer()
  }
})

test('cherche sans se soucier des accents ni de la fin du mot', async () => {
  const depot = await depotRempli()
  try {
    assert.equal(depot.chercher('cinema')[0]?.titre, 'Canal+ Cinéma')
    assert.equal(depot.chercher('fabul')[0]?.titre, 'Le Fabuleux Destin')
    assert.equal(depot.chercher('KAAMELOTT').length, 2)
    assert.deepEqual(depot.chercher('   '), [])
  } finally {
    depot.fermer()
  }
})

test('une saisie pleine de ponctuation ne casse pas la recherche', async () => {
  const depot = await depotRempli()
  try {
    // Sans nettoyage, FTS5 lève sur ces caractères et la recherche meurt en
    // pleine frappe.
    assert.doesNotThrow(() => depot.chercher('kaamelott" OR (x*'))
    assert.equal(requeteFts('le seign'), '"le" "seign"*')
    assert.equal(requeteFts('  '), undefined)
  } finally {
    depot.fermer()
  }
})

test('filtre par groupe, par langue et par série', async () => {
  const depot = await depotRempli()
  try {
    assert.equal(depot.lister({ groupe: 'FR | TNT' }).length, 2)
    assert.equal(depot.lister({ langue: 'vostfr' }).length, 1)
    assert.equal(depot.lister({ serie: 'Kaamelott' }).length, 2)
    const groupes = depot.groupes()
    assert.equal(groupes[0]?.nom, 'SERIES')
    assert.equal(groupes[0]?.compte, 3)
  } finally {
    depot.fermer()
  }
})

test('regroupe les séries et rend leurs épisodes dans l’ordre', async () => {
  const depot = await depotRempli()
  try {
    const series = depot.series()
    assert.deepEqual(
      series.map((s) => s.serie),
      ['Breaking Bad', 'Kaamelott'],
    )
    assert.equal(series[1]?.episodes, 2)
    assert.equal(series[1]?.saisons, 1)
    assert.deepEqual(
      depot.episodes('Kaamelott').map((e) => e.episode),
      [1, 2],
    )
  } finally {
    depot.fermer()
  }
})

test('le tri par défaut fait remonter le francophone', async () => {
  const depot = await depotRempli()
  try {
    const series = depot.lister({ genre: 'serie' })
    // Kaamelott n'est pas étiqueté, Breaking Bad est en VOSTFR : l'ordre suit
    // `prioriteFrancophone`, dont le SQL est dérivé.
    assert.equal(series[0]?.langue, 'vostfr')
    assert.equal(series[0]?.serie, 'Breaking Bad')
  } finally {
    depot.fermer()
  }
})

test('un favori survit à la disparition puis au retour de son élément', async () => {
  const depot = await depotRempli()
  try {
    const film = depot.lister({ genre: 'film' })[0]
    assert.ok(film !== undefined)
    assert.equal(depot.basculerFavori(film.id), true)
    assert.equal(depot.favoris().length, 1)

    // Le fournisseur retire le film.
    await importerM3U(depot, ['#EXTM3U', '#EXTINF:-1,TF1', 'http://exemple.tv/live/u/p/1.m3u8'].join('\n'), {
      adresse: 'http://exemple.tv/get.php?username=jean&password=s3cr3t',
    })
    assert.equal(depot.favoris().length, 0, 'il ne s’affiche plus')
    const restants = depot.base.prepare('SELECT COUNT(*) AS n FROM favori').get() as { n: number }
    assert.equal(restants.n, 1, 'mais il n’a pas été effacé')

    // Puis il le remet.
    await importerM3U(depot, LISTE, {
      adresse: 'http://exemple.tv/get.php?username=jean&password=s3cr3t',
    })
    assert.equal(depot.favoris().length, 1, 'le favori est revenu tout seul')
  } finally {
    depot.fermer()
  }
})

test('la reprise oublie ce qui est fini à 95 %', async () => {
  const depot = await depotRempli()
  try {
    const [premier, second] = depot.lister({ genre: 'serie' })
    assert.ok(premier !== undefined && second !== undefined)

    depot.enregistrerPosition(premier.id, 600, 3600)
    depot.enregistrerPosition(second.id, 3500, 3600)

    const reprises = depot.reprises()
    assert.equal(reprises.length, 1)
    assert.equal(reprises[0]?.element.id, premier.id)
    assert.equal(reprises[0]?.position, 600)
    assert.equal(reprises[0]?.duree, 3600)
  } finally {
    depot.fermer()
  }
})

test('une position réenregistrée remplace la précédente', async () => {
  const depot = await depotRempli()
  try {
    const film = depot.lister({ genre: 'film' })[0]
    assert.ok(film !== undefined)
    depot.enregistrerPosition(film.id, 60)
    depot.enregistrerPosition(film.id, 120, 7200)
    const reprises = depot.reprises()
    assert.equal(reprises.length, 1)
    assert.equal(reprises[0]?.position, 120)
    assert.equal(reprises[0]?.duree, 7200)
  } finally {
    depot.fermer()
  }
})

test('un flux marqué mort disparaît des listes, sans être effacé', async () => {
  const depot = await depotRempli()
  const avant = depot.compter({ genre: 'direct' })
  const [chaine] = depot.lister({ genre: 'direct' })
  assert.ok(chaine !== undefined)

  depot.marquerEtat(chaine.id, 'mort')
  assert.equal(depot.compter({ genre: 'direct' }), avant - 1)
  assert.equal(depot.compter({ genre: 'direct', inclureMorts: true }), avant)
  assert.equal(depot.etat(chaine.id), 'mort')

  // La recherche suit la même règle : trouver ce qu'on vient de masquer serait
  // rendre par une porte ce qu'on a fermé par l'autre.
  assert.ok(!depot.chercher(chaine.titre).some((element) => element.id === chaine.id))

  depot.marquerEtat(chaine.id, 'ok')
  assert.equal(depot.compter({ genre: 'direct' }), avant)
})

test('ce qui n’a jamais été testé reste visible', async () => {
  const depot = await depotRempli()
  assert.ok(depot.compter() > 0)
  assert.equal(depot.compterParEtat().inconnus, depot.compter())
  assert.equal(depot.aTester().length, depot.compter())
})

test('« ranimer » remet en jeu tout ce qui avait été condamné', async () => {
  const depot = await depotRempli()
  for (const element of depot.lister({ limite: 3 })) depot.marquerEtat(element.id, 'mort')
  assert.equal(depot.oublierEtats(), 3)
  assert.equal(depot.compterParEtat().morts, 0)
})

test('une base créée avant la colonne d’état s’ouvre et se complète', async () => {
  // Le cas réel : une base remplie par une version précédente. « CREATE TABLE IF
  // NOT EXISTS » ne la touche pas, donc sans migration toute requête citant
  // « etat » échouerait — et l'application refuserait de démarrer.
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dossier = mkdtempSync(join(tmpdir(), 'iptv-'))
  const chemin = join(dossier, 'ancienne.db')

  try {
    const ancien = ouvrirDepot(chemin)
    await importerM3U(ancien, LISTE, { adresse: 'http://exemple.tv/get.php' })
    const total = ancien.compter()
    ancien.base.exec('ALTER TABLE element DROP COLUMN etat')
    ancien.base.exec('ALTER TABLE element DROP COLUMN teste_le')
    ancien.fermer()

    const rouvert = ouvrirDepot(chemin)
    assert.equal(rouvert.compter(), total)
    const [premier] = rouvert.lister({ limite: 1 })
    assert.ok(premier !== undefined)
    rouvert.marquerEtat(premier.id, 'mort')
    assert.equal(rouvert.compter(), total - 1)
    rouvert.fermer()
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
