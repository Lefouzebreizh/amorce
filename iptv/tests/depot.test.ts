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
    // `inclureEtranger` : la liste de test compte une entrée VOSTFR par
    // construction (voir « filtre par groupe, par langue et par série »),
    // et ce test-ci porte sur l'import et le genre, pas sur la langue.
    assert.equal(depot.compter({ inclureEtranger: true }), 6)
    assert.equal(depot.compter({ genre: 'direct', inclureEtranger: true }), 2)
    assert.equal(depot.compter({ genre: 'film', inclureEtranger: true }), 1)
    assert.equal(depot.compter({ genre: 'serie', inclureEtranger: true }), 3)
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
    assert.equal(depot.compter({ inclureEtranger: true }), 6)
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
    assert.equal(depot.compter({ inclureEtranger: true }), 6, 'le catalogue a été vidé par un import partiel')
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
    const groupes = depot.groupes({ inclureEtranger: true })
    assert.equal(groupes[0]?.nom, 'SERIES')
    assert.equal(groupes[0]?.compte, 3)
  } finally {
    depot.fermer()
  }
})

test('regroupe les séries et rend leurs épisodes dans l’ordre', async () => {
  const depot = await depotRempli()
  try {
    const series = depot.series({ inclureEtranger: true })
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
    const series = depot.lister({ genre: 'serie', inclureEtranger: true })
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
  // `compterParEtat` et `aTester` portent sur l'état des flux, pas sur la
  // langue : ils comptent tout, y compris l'entrée étrangère de la liste de
  // test, d'où `inclureEtranger` pour comparer des ensembles identiques.
  const total = depot.compter({ inclureEtranger: true })
  assert.ok(total > 0)
  assert.equal(depot.compterParEtat().inconnus, total)
  assert.equal(depot.aTester().length, total)
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

test('une base d’avant les colonnes de rangement s’ouvre encore', async () => {
  // Le cas réel, remonté par un utilisateur : « no such column: rang » au
  // démarrage de l'application, sur une base importée par une version
  // précédente. Les index qui citent une colonne ajoutée ne peuvent pas vivre
  // dans le schéma — il s'exécute AVANT les migrations, donc sur une table qui
  // n'a pas encore la colonne, et « CREATE TABLE IF NOT EXISTS » ne la crée pas.
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dossier = mkdtempSync(join(tmpdir(), 'iptv-'))
  const chemin = join(dossier, 'avant.db')

  try {
    const ancien = ouvrirDepot(chemin)
    await importerM3U(ancien, LISTE, { adresse: 'http://exemple.tv/get.php' })
    const total = ancien.compter()
    // On ramène la base à ce qu'elle était : sans les colonnes de rangement,
    // et sans les index qui les citent.
    for (const index of ['element_par_rang', 'element_par_theme']) {
      ancien.base.exec(`DROP INDEX IF EXISTS ${index}`)
    }
    for (const colonne of ['canal', 'rang', 'theme', 'etat', 'teste_le']) {
      ancien.base.exec(`ALTER TABLE element DROP COLUMN ${colonne}`)
    }
    ancien.fermer()

    const rouvert = ouvrirDepot(chemin)
    assert.equal(rouvert.compter(), total, 'la base s’ouvre et garde son contenu')
    // Et les colonnes sont bien revenues, index compris : une requête qui trie
    // par rang doit passer.
    assert.equal(rouvert.lister({ genre: 'direct' }).length, rouvert.compter({ genre: 'direct' }))
    rouvert.fermer()
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un retrait est consigne seulement si l\u2019utilisateur avait marque l\u2019entree', async () => {
  const depot = await depotRempli()
  try {
    const film = depot.lister({ genre: 'film' })[0]
    assert.ok(film)
    // Une position de lecture sur le film, rien sur l'episode de Breaking Bad.
    depot.enregistrerPosition(film.id, 620, 5400)

    // Le fournisseur ne sert plus ni le film ni cet episode.
    const reduite = LISTE.split('\n')
      .filter((ligne) => !ligne.includes('Fabuleux') && !ligne.includes('movie/u/p/7'))
      .filter((ligne) => !ligne.includes('Breaking Bad') && !ligne.includes('series/u/p/21'))
      .join('\n')
    await importerM3U(depot, reduite, {
      adresse: 'http://exemple.tv/get.php?username=jean&password=s3cr3t',
    })

    assert.equal(depot.compter(), 4)
    assert.equal(depot.element(film.id), undefined)

    const retraits = depot.retraits()
    assert.equal(retraits.length, 1, JSON.stringify(retraits))
    assert.equal(retraits[0]?.elementId, film.id)
    // Le titre est recopie : l'entree d'origine n'existe plus pour le rendre.
    assert.match(retraits[0]?.titre ?? '', /Fabuleux/)
    // Et la position de lecture, elle, a survecu au retrait.
    assert.ok(depot.base.prepare('SELECT 1 FROM lecture WHERE element_id = ?').get(film.id))
  } finally {
    depot.fermer()
  }
})

test('reclasser peut masquer une entrée comme étrangère, et le filtre par défaut l’écarte', async () => {
  // Une liste isolée, sans rien de pré-classé étranger à l'import : le point
  // ici est le mécanisme reclasser → compter, pas la règle de classement
  // elle-même, déjà éprouvée dans pays.test.ts.
  const depot = ouvrirDepot(':memory:')
  await importerM3U(
    depot,
    [
      '#EXTM3U',
      '#EXTINF:-1 group-title="FR | TNT",FR | TF1 HD',
      'http://exemple.tv/live/u/p/1.m3u8',
      '#EXTINF:-1 group-title="FR | TNT",FR | France 2 HD',
      'http://exemple.tv/live/u/p/2.m3u8',
    ].join('\n'),
    { adresse: 'http://exemple.tv/get.php' },
  )
  try {
    const avant = depot.compter()
    const cible = depot.lister({ limite: 1 })[0]
    assert.ok(cible !== undefined)

    const bilan = depot.reclasser(({ url, langue }) => ({
      genre: 'direct',
      pays: url === cible.url ? 'etranger' : undefined,
      langue,
    }))
    assert.equal(bilan.etrangeres, 1)

    assert.equal(depot.compter(), avant - 1, 'masquée par défaut')
    assert.equal(depot.compter({ inclureEtranger: true }), avant, 'toujours là en base')
    // `element` reste sans filtre, comme pour `etat` : un lien direct vers une
    // entrée masquée continue de résoudre plutôt que de rendre une 404 muette.
    assert.ok(depot.element(cible.id) !== undefined)
  } finally {
    depot.fermer()
  }
})

test('choisir VOSTFR ou VO lève le filtre étranger, sinon le bouton ne rend jamais rien', async () => {
  const depot = await depotRempli()
  try {
    // Breaking Bad, importée en VOSTFR dans la liste de test, est étrangère.
    const avant = depot.lister({ langue: 'vostfr' }).length
    assert.ok(avant > 0)

    depot.reclasser(({ titre, groupe, langue }) => ({
      genre: groupe === 'SERIES' ? 'serie' : groupe === 'FILMS VF' ? 'film' : 'direct',
      langue,
      pays: langue === 'vostfr' || langue === 'vo' ? 'etranger' : undefined,
    }))

    // Filtrer sur « toutes langues » masque toujours le VOSTFR par défaut…
    assert.equal(
      depot.lister().some((e) => e.titre.includes('Breaking Bad')),
      false,
    )
    // … mais demander explicitement du VOSTFR le retrouve : sans quoi le
    // bouton « VOSTFR » de l'interface rendrait toujours zéro résultat.
    assert.equal(depot.lister({ langue: 'vostfr' }).length, avant)
  } finally {
    depot.fermer()
  }
})

test('le cache d’affiche distingue « jamais interrogé » de « rien trouvé »', async () => {
  const depot = await depotRempli()
  try {
    const film = depot.lister({ genre: 'film' })[0]
    assert.ok(film !== undefined)

    assert.equal(depot.affiche(film.id), undefined, 'rien n’a encore été demandé')

    depot.enregistrerAffiche(film.id, { url: undefined, resume: undefined })
    assert.deepEqual(depot.affiche(film.id), { url: undefined, resume: undefined })

    // Une seconde recherche remplace la première plutôt que d'empiler une ligne.
    depot.enregistrerAffiche(film.id, { url: 'https://image.tmdb.org/t/p/w500/x.jpg', resume: 'Un résumé.' })
    assert.deepEqual(depot.affiche(film.id), {
      url: 'https://image.tmdb.org/t/p/w500/x.jpg',
      resume: 'Un résumé.',
    })
    const lignes = depot.base.prepare('SELECT COUNT(*) AS n FROM affiche').get() as { n: number }
    assert.equal(lignes.n, 1)
  } finally {
    depot.fermer()
  }
})

test('une fiche de série se retrouve par son identifiant', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    const sourceId = depot.declarerSource({ genre: 'xtream', adresse: 'http://exemple.tv' })
    depot.enregistrerFiches(sourceId, [
      {
        id: 'se_abc',
        refExterne: '1',
        titre: 'Kaamelott',
        titreBrut: 'Kaamelott',
        annee: 2005,
        logo: undefined,
        resume: undefined,
        genres: [],
        groupe: undefined,
        langue: 'vf',
      },
    ])
    assert.equal(depot.ficheParId('se_abc')?.titre, 'Kaamelott')
    assert.equal(depot.ficheParId('inexistant'), undefined)
  } finally {
    depot.fermer()
  }
})
